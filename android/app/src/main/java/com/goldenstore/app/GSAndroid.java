package com.goldenstore.app;

import android.app.Activity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.app.NotificationCompat;
import androidx.core.content.FileProvider;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.tasks.Task;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;
import android.content.pm.ResolveInfo;
import java.util.List;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Golden Store — native JS bridge.
 *
 * v1.6 (professional install pipeline, Google Play style):
 *  - Real install state straight from the device PackageManager
 *    (isPackageInstalled returns the installed versionName synchronously).
 *  - Persistent download/install state: survives page navigation, app restarts
 *    and process death (states are saved to gs_download_states.json).
 *  - Automatic resume of interrupted downloads (HTTP Range) when the app is
 *    reopened, so the user always finds the live progress or completion.
 *  - cancelDownload() so downloads can be cancelled like on Google Play.
 *  - onAppResumed() reconciliation: when the user comes back (e.g. after the
 *    system installer closed), states are re-checked against the device and
 *    pushed to the web layer ("installed" / retry "downloaded" states).
 */
public class GSAndroid {
    private static final String TAG = "GSAndroid";
    private static final int RC_SIGN_IN = 9002;
    private static final String STATE_FILE = "gs_download_states.json";
    private static final String INSTALLED_PREFS = "gs_installed_apps";

    // --- Progress notifications (Google Play style status bar) ---
    private static final String CH_DOWNLOADS = "gs_downloads";
    private static final String ACTION_CANCEL_DOWNLOAD = "com.goldenstore.app.CANCEL_DOWNLOAD";
    private static final String EXTRA_SLUG = "slug";
    private static final int NOTIF_BASE_ID = 20000;

    private final MainActivity activity;
    private final WebView webView;
    private final Handler mainHandler;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile String lastUninstallSlug = null;
    private volatile String lastUninstallPkg = null;
    // Dedicated thread for notification work (icon fetching must never block
    // the download executor nor the UI thread).
    private final ExecutorService notifExecutor = Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService watcherScheduler = Executors.newSingleThreadScheduledExecutor();
    private final Map<String, ScheduledFuture<?>> installWatchers = new ConcurrentHashMap<>();
    private final Map<String, DownloadState> active = new ConcurrentHashMap<>();
    private final Map<String, JSONObject> persisted = new ConcurrentHashMap<>();
    private final Map<String, Bitmap> iconCache = new ConcurrentHashMap<>();
    // Metadata snapshot for terminal notifications: the state maps are cleaned
    // up right after emit(), but the "تم التثبيت" notification is built
    // asynchronously and still needs appName/icon/package afterwards.
    private final Map<String, String[]> notifMetaStash = new ConcurrentHashMap<>();
    private SharedPreferences installedPrefs;
    private File stateFile;
    private boolean stateLoaded = false;
    private GoogleSignInClient googleSignInClient;
    private BroadcastReceiver cancelReceiver;
    private boolean cancelReceiverRegistered = false;

    private static class DownloadState {
        String slug;
        String packageName;
        String filename;
        String url;
        String appName;
        String iconUrl;
        File file;
        long downloadedBytes = 0;
        long totalBytes = 0;
        long lastProgressTime = 0;
        long lastPersistTime = 0;
        double lastProgress = -1;
        boolean cancelled = false;
        boolean installed = false;
        String status = "downloading"; // downloading | downloaded | installing | installed
    }

    public GSAndroid(MainActivity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.installedPrefs = activity.getSharedPreferences(INSTALLED_PREFS, Activity.MODE_PRIVATE);
        this.stateFile = new File(activity.getFilesDir(), STATE_FILE);
        loadPersistedStates();
        registerCancelReceiver();
    }

    public void onDestroy() {
        if (cancelReceiverRegistered && cancelReceiver != null) {
            try {
                activity.unregisterReceiver(cancelReceiver);
            } catch (Throwable ignore) {}
            cancelReceiverRegistered = false;
            cancelReceiver = null;
        }
        for (ScheduledFuture<?> watcher : installWatchers.values()) {
            try {
                if (watcher != null) watcher.cancel(true);
            } catch (Throwable ignore) {}
        }
        installWatchers.clear();
    }

    public void setGoogleSignInClient(GoogleSignInClient client) {
        this.googleSignInClient = client;
    }

    /* ------------------------------------------------------------------
     * Google Sign-In plumbing (unchanged behaviour)
     * ------------------------------------------------------------------ */

    @JavascriptInterface
    public void signInWithGoogle() {
        if (googleSignInClient == null) {
            emitGoogleSignInError("auth/sign-in-failed", "Google Sign-In not available");
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                // Sign out first so the account picker is shown each time.
                googleSignInClient.signOut().addOnCompleteListener(activity, task -> {
                    Intent signInIntent = googleSignInClient.getSignInIntent();
                    activity.startActivityForResult(signInIntent, RC_SIGN_IN);
                });
            } catch (Exception e) {
                Log.e(TAG, "signInWithGoogle failed", e);
                emitGoogleSignInError("auth/sign-in-failed", e.getMessage());
            }
        });
    }

    public void onGoogleSignInResult(Intent data) {
        if (webView == null) return;
        try {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            GoogleSignInAccount account = task.getResult(ApiException.class);
            if (account == null) throw new Exception("no_account");
            String idToken = account.getIdToken();
            if (idToken == null || idToken.isEmpty()) throw new Exception("no_id_token");
            String email = account.getEmail();
            String displayName = account.getDisplayName();
            String photoURL = account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : null;
            emitGoogleSignInResult(idToken, null, email, displayName, photoURL);
        } catch (ApiException e) {
            String details = "status=" + e.getStatusCode();
            if (e.getMessage() != null) details += ": " + e.getMessage();
            emitGoogleSignInError(mapGoogleSignInError(e.getStatusCode()), details);
        } catch (Exception e) {
            Log.e(TAG, "Google sign-in result failed", e);
            emitGoogleSignInError("auth/sign-in-failed", e.getMessage());
        }
    }

    private String mapGoogleSignInError(int statusCode) {
        if (statusCode == GoogleSignInStatusCodes.SIGN_IN_CANCELLED) return "auth/popup-closed-by-user";
        if (statusCode == CommonStatusCodes.DEVELOPER_ERROR) return "auth/developer-error";
        if (statusCode == CommonStatusCodes.NETWORK_ERROR) return "auth/network-request-failed";
        if (statusCode == CommonStatusCodes.API_NOT_CONNECTED) return "auth/network-request-failed";
        if (statusCode == CommonStatusCodes.SERVICE_DISABLED) return "auth/network-request-failed";
        if (statusCode == CommonStatusCodes.SERVICE_VERSION_UPDATE_REQUIRED) return "auth/network-request-failed";
        if (statusCode == GoogleSignInStatusCodes.SIGN_IN_FAILED) return "auth/sign-in-failed";
        return "auth/sign-in-failed";
    }

    private void emitGoogleSignInResult(String idToken, String accessToken, String email, String displayName, String photoURL) {
        if (webView == null) return;
        String js = "if(window.GAuth&&window.GAuth.handleNativeGoogleSignIn){window.GAuth.handleNativeGoogleSignIn(" +
                safeQuote(idToken) + "," +
                (accessToken == null ? "null" : safeQuote(accessToken)) + "," +
                safeQuote(email) + "," +
                safeQuote(displayName) + "," +
                (photoURL == null ? "null" : safeQuote(photoURL)) + ",null,null);}else{" +
                "if(window.__gsGoogleSignInResolve){window.__gsGoogleSignInResolve(null);}}";
        webView.evaluateJavascript(js, null);
    }

    private void emitGoogleSignInError(String code, String message) {
        if (webView == null) return;
        String js = "if(window.GAuth&&window.GAuth.handleNativeGoogleSignIn){window.GAuth.handleNativeGoogleSignIn(null,null,null,null,null," +
                safeQuote(message) + "," + safeQuote(code) + ");}else{" +
                "if(window.__gsGoogleSignInReject){window.__gsGoogleSignInReject(new Error(" + safeQuote(message) + "));}}";
        webView.evaluateJavascript(js, null);
    }

    private String safeQuote(String s) {
        return JSONObject.quote(s != null ? s : "");
    }

    /* ------------------------------------------------------------------
     * Real install state (device PackageManager = source of truth)
     * ------------------------------------------------------------------ */

    /**
     * Synchronous device check used by the web layer when rendering an app
     * page. Returns the installed versionName when the package is present on
     * the device, or "" when it is not installed. Because @JavascriptInterface
     * methods run on a dedicated thread, this is safe to call inline from JS.
     */
    @JavascriptInterface
    public String isPackageInstalled(final String packageName) {
        if (packageName == null || packageName.isEmpty()) return "";
        try {
            PackageManager pm = activity.getPackageManager();
            PackageInfo info = pm.getPackageInfo(packageName, 0);
            if (info == null) return "";
            return info.versionName != null ? info.versionName : "installed";
        } catch (Throwable t) {
            return "";
        }
    }

    /**
     * Snapshot of every tracked download/install state, as JSON. The web layer
     * calls this on every page load so progress, "downloaded" and "installed"
     * states survive navigation and app restarts.
     */
    @JavascriptInterface
    public String getDownloadStates() {
        ensureReconciled();
        JSONObject out = new JSONObject();
        try {
            // Merge persisted states first…
            for (Map.Entry<String, JSONObject> e : persisted.entrySet()) {
                try { out.put(e.getKey(), new JSONObject(e.getValue().toString())); } catch (Exception ignore) {}
            }
            // …then overlay any live in-memory state (fresher progress).
            for (Map.Entry<String, DownloadState> e : active.entrySet()) {
                out.put(e.getKey(), stateToJson(e.getValue()));
            }
        } catch (Exception ignore) {}
        return out.toString();
    }

    /**
     * Cancels a running download and forgets its partial file + state.
     */
    @JavascriptInterface
    public void cancelDownload(final String slug) {
        if (slug == null || slug.isEmpty()) return;
        DownloadState state = active.get(slug);
        if (state != null) {
            state.cancelled = true;
        } else {
            // Not running: just drop the persisted entry + partial file.
            JSONObject p = persisted.get(slug);
            if (p != null) {
                try {
                    String filename = p.optString("filename", "");
                    if (!filename.isEmpty()) deleteDownloadFile(filename);
                } catch (Exception ignore) {}
                persisted.remove(slug);
                savePersistedStates();
            }
            mainHandler.post(() -> emit(slug, "cancelled", -1, null));
        }
    }

    /**
     * Called by MainActivity.onResume(). Reconciles every state against the
     * real device and pushes a fresh snapshot to the current web page. This is
     * what makes progress/status "live" across app exits and installer round
     * trips.
     */
    private String getSlugForPackage(String packageName) {
        if (packageName == null || packageName.isEmpty()) return null;
        try {
            Map<String, ?> all = installedPrefs.getAll();
            for (Map.Entry<String, ?> e : all.entrySet()) {
                if (packageName.equals(String.valueOf(e.getValue()))) {
                    return e.getKey();
                }
            }
        } catch (Exception ignore) {}
        return null;
    }

    private void checkPendingUninstall() {
        final String targetPkg = lastUninstallPkg;
        final String targetSlug = lastUninstallSlug;
        if (targetPkg != null && !targetPkg.isEmpty()) {
            if (isPackageInstalledInternal(targetPkg).isEmpty()) {
                Log.i(TAG, "Pending uninstall confirmed for pkg=" + targetPkg + ", slug=" + targetSlug);
                removeInstalledRegistryByPackage(targetPkg);
                if (targetSlug != null && !targetSlug.isEmpty()) {
                    installedPrefs.edit().remove(targetSlug).apply();
                    persisted.remove(targetSlug);
                    savePersistedStates();
                    mainHandler.post(() -> emit(targetSlug, "uninstalled", -1, targetPkg));
                }
                mainHandler.post(() -> emitPackageEvent(targetPkg));
                lastUninstallPkg = null;
                lastUninstallSlug = null;
            }
        }
    }

    public void onAppResumed() {
        checkPendingUninstall();
        ensureReconciled();
        mainHandler.post(this::pushAllStates);
    }

    /* ------------------------------------------------------------------
     * Download pipeline
     * ------------------------------------------------------------------ */

    /**
     * Starts (or resumes) an APK download. `appName` and `iconUrl` are used
     * for the status-bar progress notification (both optional for backward
     * compatibility with older web callers).
     */
    @JavascriptInterface
    public void downloadApk(final String url, final String filename, final String slug, final String packageName,
                            final String appName, final String iconUrl) {
        if (url == null || url.isEmpty() || slug == null || slug.isEmpty()) {
            emit(slug, "failed", -1, null);
            return;
        }
        // Never start the same download twice (prevents gesture/duplicate conflicts).
        if (active.containsKey(slug)) return;
        final String name = (appName == null || appName.isEmpty())
                ? ("app-update".equals(slug) ? "Golden Store" : slug) : appName;
        final String icon = iconUrl == null ? "" : iconUrl;
        executor.execute(() -> startDownload(url, filename, slug, packageName, name, icon, true));
    }

    private void startDownload(String url, String filename, String slug, String packageName,
                               String appName, String iconUrl, boolean allowResume) {
        DownloadState state = new DownloadState();
        state.slug = slug;
        state.packageName = packageName;
        state.filename = filename;
        state.url = url;
        state.appName = appName;
        state.iconUrl = iconUrl;
        state.status = "downloading";
        active.put(slug, state);

        File dir = new File(activity.getExternalFilesDir(null), "downloads");
        if (dir == null) dir = new File(activity.getFilesDir(), "downloads");
        if (!dir.exists()) dir.mkdirs();
        String safeFile = (filename != null && !filename.isEmpty()) ? filename : (slug + ".apk");
        state.file = new File(dir, safeFile);

        HttpURLConnection conn = null;
        try {
            String downloadUrl = appendStreamParam(url);
            conn = (HttpURLConnection) new URL(downloadUrl).openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(30000);
            conn.setReadTimeout(0);
            conn.setRequestProperty("User-Agent", "GoldenStoreApp Android");
            int responseCode = conn.getResponseCode();
            if (responseCode >= 400) {
                throw new Exception("HTTP " + responseCode);
            }
            long total = conn.getContentLengthLong();
            state.totalBytes = total;
            if (total > 0) {
                JSONObject p = persistedState(slug);
                try { p.put("total_bytes", total); } catch (Exception ignore) {}
            }

            InputStream in = conn.getInputStream();
            OutputStream out = new FileOutputStream(state.file, false);
            byte[] buffer = new byte[16384];
            long downloaded = 0;
            int read;
            while ((read = in.read(buffer)) != -1) {
                if (state.cancelled) {
                    try { out.close(); in.close(); } catch (Exception ignore) {}
                    state.file.delete();
                    active.remove(slug);
                    persisted.remove(slug);
                    savePersistedStates();
                    mainHandler.post(() -> emit(slug, "cancelled", -1, null));
                    return;
                }
                out.write(buffer, 0, read);
                downloaded += read;
                state.downloadedBytes = downloaded;
                double progress = total > 0 ? (double) downloaded / total : -1;
                long now = System.currentTimeMillis();
                if (now - state.lastProgressTime > 200 || Math.abs(progress - state.lastProgress) > 0.01 || progress == 1.0) {
                    state.lastProgressTime = now;
                    state.lastProgress = progress;
                    final double p = progress;
                    mainHandler.post(() -> emit(slug, "downloading", p, null));
                }
                if (now - state.lastPersistTime > 2000) {
                    state.lastPersistTime = now;
                    persistState(state);
                }
            }
            try { out.close(); in.close(); } catch (Exception ignore) {}
            conn.disconnect();
            conn = null;

            state.status = "downloaded";
            String realPkg = readApkPackageName(state.file);
            if (realPkg != null && !realPkg.isEmpty()) {
                state.packageName = realPkg;
            }
            persistState(state);

            final String resolvedPkg = state.packageName;
            mainHandler.post(() -> {
                emit(slug, "downloaded", 1.0, state.filename);
                emit(slug, "installing", 1.0, null);
                state.status = "installing";
                persistState(state);
                installApk(state.file, slug, resolvedPkg);
            });
        } catch (Exception e) {
            Log.e(TAG, "Download failed for " + slug, e);
            if (conn != null) conn.disconnect();
            active.remove(slug);
            persisted.remove(slug);
            savePersistedStates();
            mainHandler.post(() -> emit(slug, "failed", -1, null));
        }
    }

    private String appendStreamParam(String url) {
        if (url.contains("stream=1")) return url;
        return url + (url.contains("?") ? "&" : "?") + "stream=1";
    }

    /* ------------------------------------------------------------------
     * Install step
     * ------------------------------------------------------------------ */

        private void startInstallWatcher(final String slug, final String packageName, final File apkFile) {
        if (slug == null || slug.isEmpty()) return;
        ScheduledFuture<?> prev = installWatchers.remove(slug);
        if (prev != null) prev.cancel(true);

        final long startTime = System.currentTimeMillis();
        final long MAX_WATCH_TIME_MS = 120000L;

        ScheduledFuture<?> future = watcherScheduler.scheduleWithFixedDelay(new Runnable() {
            @Override
            public void run() {
                try {
                    if (System.currentTimeMillis() - startTime > MAX_WATCH_TIME_MS) {
                        ScheduledFuture<?> f = installWatchers.remove(slug);
                        if (f != null) f.cancel(false);
                        return;
                    }

                    String targetPkg = packageName;
                    if (targetPkg == null || targetPkg.isEmpty()) {
                        targetPkg = readApkPackageName(apkFile);
                    }
                    if (targetPkg == null || targetPkg.isEmpty()) {
                        targetPkg = installedPrefs.getString(slug, "");
                    }

                    if (targetPkg != null && !targetPkg.isEmpty()) {
                        String ver = isPackageInstalledInternal(targetPkg);
                        if (!ver.isEmpty()) {
                            Log.i(TAG, "Install detected via active watcher for slug=" + slug + ", pkg=" + targetPkg);
                            ScheduledFuture<?> f = installWatchers.remove(slug);
                            if (f != null) f.cancel(false);
                            final String resolved = targetPkg;
                            mainHandler.post(() -> markStateInstalled(slug, resolved));
                        }
                    }
                } catch (Throwable t) {
                    Log.e(TAG, "Error in install watcher for " + slug, t);
                }
            }
        }, 500, 800, TimeUnit.MILLISECONDS);

        installWatchers.put(slug, future);
    }

    private void installApk(File file, String slug, String packageName) {
        if (file == null || !file.exists()) {
            emit(slug, "failed", -1, "file_missing");
            active.remove(slug);
            return;
        }

        // Pre-check: the APK must have the same package name and signing
        // certificate as the currently installed app. If the certificate
        // differs, Android will reject the install with a package conflict.
        String signatureError = checkApkSignature(file, packageName);
        if (signatureError != null) {
            Log.e(TAG, signatureError);
            file.delete();
            active.remove(slug);
            persisted.remove(slug);
            savePersistedStates();
            emit(slug, "failed", -1, signatureError);
            return;
        }

        activity.requestInstallPackages(() -> {
            try {
                Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", file);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                }
                activity.startActivity(intent);
                startInstallWatcher(slug, packageName, file);
            } catch (Exception e) {
                Log.e(TAG, "Install failed for " + slug, e);
                active.remove(slug);
                emit(slug, "failed", -1, "install_error");
            }
        }, slug);
    }

    private String checkApkSignature(File file, String expectedPackage) {
        try {
            PackageManager pm = activity.getPackageManager();
            if (pm == null) return null;

            final int flags = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
                    ? PackageManager.GET_SIGNING_CERTIFICATES
                    : PackageManager.GET_SIGNATURES;
            PackageInfo apkInfo = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
            if (apkInfo == null) return "apk_parse_failed";

            String apkPackage = apkInfo.packageName;
            if (apkPackage == null || apkPackage.isEmpty()) return "apk_parse_failed";

            // If an app with apkPackage is already installed on the device, check signature compatibility.
            // Fresh installs or installs where the catalog metadata differs from apkPackage must not be blocked.
            try {
                PackageInfo installedInfo = pm.getPackageInfo(apkPackage, flags);
                if (installedInfo != null) {
                    byte[][] apkSigs = getSignatures(apkInfo);
                    byte[][] installedSigs = getSignatures(installedInfo);
                    if (apkSigs != null && installedSigs != null && apkSigs.length > 0 && installedSigs.length > 0) {
                        for (byte[] a : apkSigs) {
                            boolean found = false;
                            for (byte[] b : installedSigs) {
                                if (Arrays.equals(a, b)) { found = true; break; }
                            }
                            if (!found) return "signature_mismatch";
                        }
                    }
                }
            } catch (PackageManager.NameNotFoundException ignored) {
                // Fresh install, no conflict
            }
            return null;
        } catch (Throwable e) {
            Log.e(TAG, "Signature check failed", e);
            return null;
        }
    }

    private byte[][] getSignatures(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && info.signingInfo != null) {
            Signature[] signatures = info.signingInfo.getApkContentsSigners();
            if (signatures == null) return null;
            byte[][] out = new byte[signatures.length][];
            for (int i = 0; i < signatures.length; i++) {
                out[i] = signatures[i].toByteArray();
            }
            return out;
        } else if (info.signatures != null) {
            Signature[] signatures = info.signatures;
            byte[][] out = new byte[signatures.length][];
            for (int i = 0; i < signatures.length; i++) {
                out[i] = signatures[i].toByteArray();
            }
            return out;
        }
        return null;
    }

    public void onInstallPermissionDenied(String slug) {
        if (slug != null) {
            active.remove(slug);
            emit(slug, "failed", -1, "permission_denied");
        }
    }

    /* ------------------------------------------------------------------
     * Open / uninstall / re-install helpers
     * ------------------------------------------------------------------ */

    /**
     * Opens an installed app by its package name (launches the launcher's main
     * activity). Reports 'open_failed' back to the web layer when the app is
     * not present on the device.
     */
    @JavascriptInterface
    public void openInstalledApp(final String packageName) {
        openInstalledApp(packageName, null);
    }

    @JavascriptInterface
    public void openInstalledApp(final String packageName, final String slug) {
        String pkg = (packageName != null && !packageName.trim().isEmpty()) ? packageName.trim() : "";
        if (pkg.isEmpty() && slug != null && !slug.isEmpty()) {
            pkg = installedPrefs.getString(slug, "");
        }
        if (pkg.isEmpty()) {
            Log.e(TAG, "openInstalledApp: cannot resolve package for slug=" + slug);
            emit(slug == null ? "" : slug, "open_failed", -1, null);
            return;
        }
        final String targetPkg = pkg;
        activity.runOnUiThread(() -> {
            try {
                PackageManager pm = activity.getPackageManager();
                Intent intent = pm.getLaunchIntentForPackage(targetPkg);
                if (intent == null) {
                    Intent queryIntent = new Intent(Intent.ACTION_MAIN, null);
                    queryIntent.addCategory(Intent.CATEGORY_LAUNCHER);
                    queryIntent.setPackage(targetPkg);
                    List<ResolveInfo> activities = pm.queryIntentActivities(queryIntent, 0);
                    if (activities != null && !activities.isEmpty()) {
                        ResolveInfo resolveInfo = activities.get(0);
                        intent = new Intent(Intent.ACTION_MAIN);
                        intent.addCategory(Intent.CATEGORY_LAUNCHER);
                        intent.setClassName(resolveInfo.activityInfo.packageName, resolveInfo.activityInfo.name);
                    }
                }
                if (intent == null) {
                    Log.e(TAG, "No launcher activity found for package: " + targetPkg);
                    emit(slug == null ? "" : slug, "open_failed", -1, null);
                    return;
                }
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
                activity.startActivity(intent);
            } catch (ActivityNotFoundException e) {
                emit(slug == null ? "" : slug, "open_failed", -1, null);
            } catch (Exception e) {
                Log.e(TAG, "openInstalledApp failed for " + targetPkg, e);
                emit(slug == null ? "" : slug, "open_failed", -1, null);
            }
        });
    }

    @JavascriptInterface
    public void uninstallApp(final String packageName) {
        uninstallApp(packageName, null);
    }

    @JavascriptInterface
    public void uninstallApp(final String packageName, final String slug) {
        String pkg = (packageName != null && !packageName.trim().isEmpty()) ? packageName.trim() : "";
        // If package from caller is not currently installed, check installedPrefs for the real device package
        if (pkg.isEmpty() || isPackageInstalledInternal(pkg).isEmpty()) {
            if (slug != null && !slug.isEmpty()) {
                String saved = installedPrefs.getString(slug, "");
                if (saved != null && !saved.isEmpty() && !isPackageInstalledInternal(saved).isEmpty()) {
                    pkg = saved;
                } else if (pkg.isEmpty()) {
                    pkg = saved;
                }
            }
        }
        if (pkg == null || pkg.isEmpty()) {
            Log.e(TAG, "uninstallApp: cannot resolve package for slug=" + slug + ", passed pkg=" + packageName);
            return;
        }
        final String targetPkg = pkg;
        final String targetSlug = (slug != null && !slug.isEmpty()) ? slug : getSlugForPackage(targetPkg);
        lastUninstallPkg = targetPkg;
        lastUninstallSlug = targetSlug;
        activity.runOnUiThread(() -> {
            boolean started = false;
            try {
                Intent intent = new Intent(Intent.ACTION_DELETE);
                intent.setData(Uri.fromParts("package", targetPkg, null));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
                started = true;
            } catch (Throwable e) {
                Log.w(TAG, "ACTION_DELETE failed for " + targetPkg + ", trying ACTION_UNINSTALL_PACKAGE", e);
                try {
                    Intent intent = new Intent(Intent.ACTION_UNINSTALL_PACKAGE);
                    intent.setData(Uri.fromParts("package", targetPkg, null));
                    intent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    activity.startActivity(intent);
                    started = true;
                } catch (Throwable e2) {
                    Log.e(TAG, "ACTION_UNINSTALL_PACKAGE also failed for " + targetPkg, e2);
                    try {
                        Intent intent = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                        intent.setData(Uri.fromParts("package", targetPkg, null));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        activity.startActivity(intent);
                        started = true;
                    } catch (Throwable ignore) {}
                }
            }
        });
    }

    /**
     * Re-opens the system installer for an APK that was already downloaded
     * (e.g. user dismissed the installer the first time). The file lives under
     * /Android/data/<pkg>/files/downloads/<filename>.
     */
    @JavascriptInterface
    public void openDownloadedApk(final String filename, final String slug, final String packageName) {
        if (filename == null || filename.isEmpty()) {
            emit(slug == null ? "" : slug, "failed", -1, "file_missing");
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                File dir = new File(activity.getExternalFilesDir(null), "downloads");
                if (dir == null || !dir.exists()) {
                    emit(slug, "failed", -1, "file_missing");
                    return;
                }
                File file = new File(dir, filename);
                if (!file.exists()) {
                    emit(slug, "failed", -1, "file_missing");
                    return;
                }
                JSONObject p = persistedState(slug);
                // The APK file is ground truth: prefer the real package name
                // read from it, fall back to what the caller supplied.
                String realPkg = readApkPackageName(file);
                if (realPkg == null || realPkg.isEmpty()) realPkg = packageName;
                if (realPkg != null && !realPkg.isEmpty()) {
                    try { p.put("package_name", realPkg); } catch (Exception ignore) {}
                }
                try { p.put("status", "installing"); } catch (Exception ignore) {}
                savePersistedStates();
                emit(slug, "installing", 1.0, null);
                installApk(file, slug, realPkg);
            } catch (Exception e) {
                Log.e(TAG, "openDownloadedApk failed", e);
                emit(slug, "failed", -1, "install_error");
            }
        });
    }

    /**
     * Deletes a previously-downloaded APK file from the device.
     */
    @JavascriptInterface
    public void deleteDownloadedApk(final String filename, final String slug) {
        deleteDownloadFile(filename);
        if (slug != null && !slug.isEmpty()) {
            persisted.remove(slug);
            savePersistedStates();
        }
    }

    private void deleteDownloadFile(String filename) {
        try {
            File dir = new File(activity.getExternalFilesDir(null), "downloads");
            if (dir == null || !dir.exists()) return;
            File file = new File(dir, filename);
            if (file.exists()) file.delete();
        } catch (Exception e) {
            Log.e(TAG, "deleteDownloadFile failed", e);
        }
    }

    /* ------------------------------------------------------------------
     * Package broadcast hooks (installed / removed)
     * ------------------------------------------------------------------ */

    public void onPackageUninstalled(String uninstalledPackage) {
        if (uninstalledPackage == null || uninstalledPackage.isEmpty()) return;
        removeInstalledRegistryByPackage(uninstalledPackage);
        mainHandler.post(() -> emitPackageEvent(uninstalledPackage));
    }

    public void onPackageInstalled(String installedPackage) {
        if (installedPackage == null || installedPackage.isEmpty()) return;

        // 1) Match live in-memory download states by package name. When the
        //    state has no package name (legacy/broken store metadata), read
        //    the REAL one from the downloaded APK file — the file is truth.
        for (Map.Entry<String, DownloadState> entry : active.entrySet()) {
            DownloadState state = entry.getValue();
            if (state.installed) continue;
            String stPkg = state.packageName;
            if (stPkg == null || stPkg.isEmpty()) {
                stPkg = readApkPackageName(state.file);
                if (stPkg != null && !stPkg.isEmpty()) state.packageName = stPkg;
            }
            if (installedPackage.equals(stPkg)) {
                markStateInstalled(state.slug, installedPackage);
                return;
            }
        }

        // 2) Match persisted (disk) states too — covers the case where the
        //    process died/restarted while the system installer was open.
        for (Map.Entry<String, JSONObject> e : persisted.entrySet()) {
            JSONObject p = e.getValue();
            String pkg = p.optString("package_name", "");
            if (pkg.isEmpty()) {
                pkg = readApkPackageName(downloadFile(p.optString("filename", "")));
            }
            if (installedPackage.equals(pkg)) {
                final String s = e.getKey();
                installedPrefs.edit().putString(s, installedPackage).apply();
                persisted.remove(s);
                savePersistedStates();
                mainHandler.post(() -> emit(s, "installed", 1.0, installedPackage));
                return;
            }
        }
    }

    /**
     * Marks a slug as successfully installed and cleans up like Google Play:
     * removes the tracked state, deletes the downloaded APK file and pushes
     * the "installed" event to the web layer (button becomes فتح/إلغاء).
     */
    private void markStateInstalled(final String slug, final String packageName) {
        ScheduledFuture<?> watcher = installWatchers.remove(slug);
        if (watcher != null) watcher.cancel(true);
        DownloadState state = active.get(slug);
        if (state != null) {
            state.installed = true;
            state.status = "installed";
        }
        if (packageName != null && !packageName.isEmpty()) {
            installedPrefs.edit().putString(slug, packageName).apply();
        }
        final String resolvedPkg = packageName;
        mainHandler.post(() -> {
            // Message payload carries the REAL resolved package name so the
            // web layer can wire Open/Uninstall to the correct package even
            // when the store metadata is empty or wrong.
            emit(slug, "installed", 1.0, resolvedPkg);
            // Install finished — tidy up like Google Play: drop the tracked
            // state and delete the downloaded APK file.
            DownloadState st = active.get(slug);
            if (st != null && st.file != null && st.file.exists()) {
                st.file.delete();
            }
            persisted.remove(slug);
            savePersistedStates();
            active.remove(slug);
        });
    }

    /* ------------------------------------------------------------------
     * State reconciliation & persistence
     * ------------------------------------------------------------------ */

    /**
     * Aligns persisted states with the real device:
     *  - package now installed          -> "installed" (+ registry + cleanup)
     *  - was "installing", not installed -> "downloaded" (retry available)
     *  - "downloading" with a complete or partial file -> stays resumable
     */
    private void ensureReconciled() {
        if (!stateLoaded) loadPersistedStates();

        // 1. Check live active states
        for (Map.Entry<String, DownloadState> entry : active.entrySet()) {
            DownloadState st = entry.getValue();
            if (st.installed) continue;
            String pkg = st.packageName;
            if (pkg == null || pkg.isEmpty()) {
                pkg = readApkPackageName(st.file);
                if (pkg != null && !pkg.isEmpty()) st.packageName = pkg;
            }
            if (pkg == null || pkg.isEmpty()) {
                pkg = installedPrefs.getString(st.slug, "");
            }
            if (pkg != null && !pkg.isEmpty() && !isPackageInstalledInternal(pkg).isEmpty()) {
                markStateInstalled(st.slug, pkg);
            }
        }

        // 2. Check persisted states
        boolean dirty = false;
        Iterator<Map.Entry<String, JSONObject>> it = persisted.entrySet().iterator();
        while (it.hasNext()) {
            Map.Entry<String, JSONObject> e = it.next();
            JSONObject p = e.getValue();
            String status = p.optString("status", "");
            String slug = e.getKey();
            if ("installed".equals(status)) { it.remove(); dirty = true; continue; }
            String pkg = p.optString("package_name", "");
            // Unknown package: 1) the installed-registry (slug→package built
            // from real installs), 2) the downloaded APK file itself.
            if (pkg.isEmpty()) {
                String reg = installedPrefs.getString(slug, "");
                if (reg != null && !reg.isEmpty()) pkg = reg;
            }
            if (pkg.isEmpty()) {
                String real = readApkPackageName(downloadFile(p.optString("filename", "")));
                if (real != null && !real.isEmpty()) pkg = real;
            }
            String savedPkg = installedPrefs.getString(slug, "");
            if (!savedPkg.isEmpty() && !isPackageInstalledInternal(savedPkg).isEmpty()) {
                pkg = savedPkg;
            }
            if (pkg.isEmpty()) {
                // No package name anywhere: drop stale state silently without false failed error
                it.remove();
                dirty = true;
                continue;
            }
            try { p.put("package_name", pkg); } catch (Exception ignore) {}
            boolean present = !isPackageInstalledInternal(pkg).isEmpty();
            if (present) {
                installedPrefs.edit().putString(slug, pkg).apply();
                it.remove();
                dirty = true;
                markStateInstalled(slug, pkg);
            } else if ("installing".equals(status)) {
                try { p.put("status", "downloaded"); } catch (Exception ignore) {}
                dirty = true;
                final String s = slug;
                final String fn = p.optString("filename", "");
                mainHandler.post(() -> emit(s, "downloaded", 1.0, fn));
            }
        }
        if (dirty) savePersistedStates();
        try {
            Map<String, ?> installedMap = installedPrefs.getAll();
            for (Map.Entry<String, ?> entry : installedMap.entrySet()) {
                String s = entry.getKey();
                String p = String.valueOf(entry.getValue());
                if (!p.isEmpty() && isPackageInstalledInternal(p).isEmpty()) {
                    installedPrefs.edit().remove(s).apply();
                    final String removedSlug = s;
                    final String removedPkg = p;
                    mainHandler.post(() -> {
                        emit(removedSlug, "uninstalled", -1, removedPkg);
                        emitPackageEvent(removedPkg);
                    });
                }
            }
        } catch (Exception ignore) {}
    }

        private void autoResumeInterrupted() {
        // Disabled: do NOT start downloads automatically without user action.
    }

    private void pushAllStates() {
        if (webView == null) return;
        ensureReconciled();
        JSONObject out = new JSONObject();
        try {
            for (Map.Entry<String, JSONObject> e : persisted.entrySet()) {
                out.put(e.getKey(), e.getValue());
            }
            for (Map.Entry<String, DownloadState> e : active.entrySet()) {
                out.put(e.getKey(), stateToJson(e.getValue()));
            }
        } catch (Exception ignore) {}
        String js = "try{if(window.__gsDownloadStatesSnapshot){window.__gsDownloadStatesSnapshot(" + out.toString() + ");}}catch(e){}";
        webView.evaluateJavascript(js, null);
    }

    private String isPackageInstalledInternal(String packageName) {
        if (packageName == null || packageName.trim().isEmpty()) return "";
        String pkg = packageName.trim();
        try {
            PackageManager pm = activity.getPackageManager();
            if (pm != null) {
                PackageInfo info = pm.getPackageInfo(pkg, 0);
                if (info != null) {
                    return info.versionName != null ? info.versionName : "installed";
                }
            }
        } catch (Throwable ignore) {}

        try {
            PackageManager pm = activity.getPackageManager();
            if (pm != null && pm.getApplicationInfo(pkg, 0) != null) {
                return "installed";
            }
        } catch (Throwable ignore) {}

        try {
            PackageManager pm = activity.getPackageManager();
            if (pm != null && pm.getLaunchIntentForPackage(pkg) != null) {
                return "installed";
            }
        } catch (Throwable ignore) {}

        return "";
    }

    /**
     * Slug-based installed check for the web layer. Looks up the slug→package
     * registry (built from REAL installs) and verifies the package is still
     * present on the device. This is the fallback that keeps فتح/إلغاء التثبيت
     * correct even when the store metadata package name is missing or wrong.
     * Returns the installed versionName, or "" when not installed.
     */
    @JavascriptInterface
    public String isSlugInstalled(final String slug) {
        if (slug == null || slug.isEmpty()) return "";
        try {
            String pkg = installedPrefs.getString(slug, "");
            if (pkg == null || pkg.isEmpty()) return "";
            String ver = isPackageInstalledInternal(pkg);
            if (ver.isEmpty()) {
                // Stale registry entry — the app was removed outside the store.
                installedPrefs.edit().remove(slug).apply();
            }
            return ver;
        } catch (Throwable t) {
            return "";
        }
    }

    /**
     * THE single source of truth for the install button state (v1.9).
     *
     * Resolves whether the app behind `slug` is REALLY installed on this
     * device, trying every ground-truth in order:
     *   1. the caller-supplied package name (store metadata) → PackageManager
     *   2. the slug→package registry (built from REAL installs) → PackageManager
     *   3. the downloaded APK file itself → read its REAL manifest package →
     *      PackageManager   (closes the hole where store metadata is empty
     *      or wrong — the APK file cannot lie)
     *
     * On the FIRST positive detection the full Google-Play cleanup runs:
     * registry updated, tracked state dropped, APK file deleted, the
     * "تم التثبيت" notification posted and the "installed" event pushed to
     * the web layer. Subsequent calls are cheap no-ops.
     *
     * Returns a JSON object:
     *   { installed: bool, version: "...", package_name: "...",
     *     status: "downloading|downloaded|installing|none", progress: -1..1,
     *     filename: "..." }
     */
    @JavascriptInterface
    public String checkAppStatus(final String slug, final String packageName) {
        JSONObject out = new JSONObject();
        try {
            out.put("installed", false);
            out.put("package_name", "");
            out.put("version", "");
            out.put("status", "none");
            out.put("progress", -1);
            out.put("filename", "");
        } catch (Exception ignore) {}

        if (slug == null || slug.isEmpty()) return out.toString();
        ensureReconciled();

        // Live/persisted progress snapshot (reported even when not installed).
        DownloadState live = active.get(slug);
        JSONObject persistedState = persisted.get(slug);
        String liveStatus = live != null ? live.status
                : (persistedState != null ? persistedState.optString("status", "") : "");
        String liveFilename = live != null && live.filename != null ? live.filename
                : (persistedState != null ? persistedState.optString("filename", "") : "");
        double liveProgress = -1;
        if (live != null && live.totalBytes > 0) {
            liveProgress = (double) live.downloadedBytes / live.totalBytes;
        } else if (persistedState != null) {
            liveProgress = persistedState.optDouble("progress", -1);
        }

        File apkFile = downloadFile(liveFilename);

        // ---- Ground-truth resolution chain ----
        String resolvedPkg = "";
        String resolvedVer = "";

        // 1) Metadata package name supplied by the web layer.
        if (packageName != null && !packageName.trim().isEmpty()) {
            String ver = isPackageInstalledInternal(packageName.trim());
            if (!ver.isEmpty()) { resolvedPkg = packageName.trim(); resolvedVer = ver; }
        }

        // 2) Slug→package registry (real installs remembered natively).
        if (resolvedPkg.isEmpty()) {
            try {
                String reg = installedPrefs.getString(slug, "");
                if (reg != null && !reg.isEmpty()) {
                    String ver = isPackageInstalledInternal(reg);
                    if (!ver.isEmpty()) { resolvedPkg = reg; resolvedVer = ver; }
                    else installedPrefs.edit().remove(slug).apply(); // stale
                }
            } catch (Exception ignore) {}
        }

        // 3) REAL package read straight from the downloaded APK file.
        if (resolvedPkg.isEmpty() && apkFile != null) {
            String realPkg = readApkPackageName(apkFile);
            if (realPkg != null && !realPkg.isEmpty()) {
                String ver = isPackageInstalledInternal(realPkg);
                if (!ver.isEmpty()) { resolvedPkg = realPkg; resolvedVer = ver; }
            }
        }

        boolean installed = !resolvedPkg.isEmpty();

        if (installed) {
            // Register the REAL package for this slug (فتح/إلغاء التثبيت rely on it).
            installedPrefs.edit().putString(slug, resolvedPkg).apply();

            // First detection? Run the Google-Play end-of-install pipeline
            // (drop state, delete the APK, post the "تم التثبيت" notification
            // and push "installed" to the web layer).
            boolean alreadyClean = !persisted.containsKey(slug)
                    && (live == null || live.installed);
            if (!alreadyClean) {
                markStateInstalled(slug, resolvedPkg);
                liveStatus = "installed";
            }
        } else if (live != null) {
            live.installed = false;
        }

        try {
            out.put("installed", installed);
            out.put("package_name", resolvedPkg);
            out.put("version", resolvedVer);
            out.put("status", installed ? "installed" : (liveStatus == null || liveStatus.isEmpty() ? "none" : liveStatus));
            out.put("progress", liveProgress);
            out.put("filename", liveFilename == null ? "" : liveFilename);
        } catch (Exception ignore) {}
        return out.toString();
    }

    /** Resolves the downloads directory file, or null when it doesn't exist. */
    private File downloadFile(String filename) {
        try {
            if (filename == null || filename.isEmpty()) return null;
            File dir = new File(activity.getExternalFilesDir(null), "downloads");
            if (dir == null) return null;
            File f = new File(dir, filename);
            return f.exists() ? f : null;
        } catch (Throwable t) {
            return null;
        }
    }

    /**
     * Reads the REAL package name out of an APK file on disk. This is the
     * ground truth for install tracking — never rely on the store's label.
     */
    private String readApkPackageName(File file) {
        if (file == null || !file.exists()) return "";
        try {
            PackageManager pm = activity.getPackageManager();
            if (pm == null) return "";
            PackageInfo info = pm.getPackageArchiveInfo(file.getAbsolutePath(), 0);
            if (info == null || info.packageName == null) return "";
            return info.packageName;
        } catch (Throwable t) {
            return "";
        }
    }

    private JSONObject persistedState(String slug) {
        JSONObject p = persisted.get(slug);
        if (p == null) { p = new JSONObject(); persisted.put(slug, p); }
        return p;
    }

    private void persistState(DownloadState state) {
        try {
            JSONObject p = persistedState(state.slug);
            p.put("slug", state.slug);
            p.put("package_name", state.packageName == null ? "" : state.packageName);
            p.put("filename", state.filename == null ? "" : state.filename);
            p.put("url", state.url == null ? "" : state.url);
            p.put("app_name", state.appName == null ? "" : state.appName);
            p.put("icon_url", state.iconUrl == null ? "" : state.iconUrl);
            p.put("status", state.status);
            p.put("progress", state.totalBytes > 0 ? (double) state.downloadedBytes / state.totalBytes : -1);
            p.put("downloaded_bytes", state.downloadedBytes);
            p.put("total_bytes", state.totalBytes);
            p.put("updated_at", System.currentTimeMillis() / 1000);
            savePersistedStates();
        } catch (Exception e) {
            Log.e(TAG, "persistState failed", e);
        }
    }

    private JSONObject stateToJson(DownloadState state) {
        JSONObject p = new JSONObject();
        try {
            p.put("slug", state.slug);
            p.put("package_name", state.packageName == null ? "" : state.packageName);
            p.put("filename", state.filename == null ? "" : state.filename);
            p.put("url", state.url == null ? "" : state.url);
            p.put("status", state.status);
            p.put("progress", state.totalBytes > 0 ? (double) state.downloadedBytes / state.totalBytes : -1);
            p.put("downloaded_bytes", state.downloadedBytes);
            p.put("total_bytes", state.totalBytes);
            p.put("updated_at", System.currentTimeMillis() / 1000);
        } catch (Exception ignore) {}
        return p;
    }

    private void loadPersistedStates() {
        try {
            if (stateFile.exists()) {
                byte[] raw = new byte[(int) stateFile.length()];
                FileInputStream fin = new FileInputStream(stateFile);
                int read = fin.read(raw);
                fin.close();
                if (read > 0) {
                    JSONObject obj = new JSONObject(new String(raw, StandardCharsets.UTF_8));
                    persisted.clear();
                    Iterator<String> keys = obj.keys();
                    while (keys.hasNext()) {
                        String k = keys.next();
                        persisted.put(k, obj.getJSONObject(k));
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "loadPersistedStates failed", e);
        }
        stateLoaded = true;
    }

    private void savePersistedStates() {
        try {
            JSONObject obj = new JSONObject();
            for (Map.Entry<String, JSONObject> e : persisted.entrySet()) {
                obj.put(e.getKey(), e.getValue());
            }
            FileOutputStream fos = new FileOutputStream(stateFile);
            fos.write(obj.toString().getBytes(StandardCharsets.UTF_8));
            fos.close();
        } catch (Exception e) {
            Log.e(TAG, "savePersistedStates failed", e);
        }
    }

    private void removeInstalledRegistryByPackage(String packageName) {
        try {
            SharedPreferences.Editor ed = installedPrefs.edit();
            boolean changed = false;
            Map<String, ?> all = installedPrefs.getAll();
            for (Map.Entry<String, ?> e : all.entrySet()) {
                if (packageName.equals(String.valueOf(e.getValue()))) {
                    final String s = e.getKey();
                    ed.remove(s);
                    changed = true;
                    mainHandler.post(() -> emit(s, "uninstalled", -1, packageName));
                }
            }
            if (changed) ed.apply();
        } catch (Exception ignore) {}
    }

    /* ------------------------------------------------------------------
     * Web-layer emissions
     * ------------------------------------------------------------------ */

    private void emit(String slug, String status, double progress, String message) {
        // Status-bar progress notification mirrors every state change so the
        // user sees live download/install progress outside the app (and an
        // "installed / open" notification at the end) — Google Play style.
        if (slug != null && !slug.isEmpty()) {
            if ("installed".equals(status)) {
                // Capture the app metadata NOW, before the caller cleans up
                // the tracked state (the notification builds async later).
                String[] meta = null;
                DownloadState st = active.get(slug);
                if (st != null) {
                    meta = new String[]{
                            st.appName == null ? "" : st.appName,
                            st.iconUrl == null ? "" : st.iconUrl,
                            st.packageName == null ? "" : st.packageName };
                } else {
                    JSONObject p = persisted.get(slug);
                    if (p != null) {
                        meta = new String[]{ p.optString("app_name", ""), p.optString("icon_url", ""), p.optString("package_name", "") };
                    }
                }
                if (meta != null) notifMetaStash.put(slug, meta);
            }
            updateNotificationAsync(slug, status, progress);
        }
        if (webView == null) return;
        String progressStr = progress < 0 ? "-1" : String.format(Locale.US, "%.4f", progress);
        String js = "if(window.__gsApkDownloadUpdate){window.__gsApkDownloadUpdate(" + quote(slug) + "," + quote(status) + "," + progressStr + "," + quote(message) + ");}";
        webView.evaluateJavascript(js, null);
    }

    /**
     * Emits a package-level uninstall event to the web layer (no slug
     * context): the message payload carries the removed package name.
     */
    private void emitPackageEvent(String packageName) {
        if (webView == null || packageName == null) return;
        String js = "try{if(window.__gsPackageUninstalled){window.__gsPackageUninstalled(" + quote(packageName) + ");}}catch(e){}";
        webView.evaluateJavascript(js, null);
    }

    private String quote(String s) {
        return JSONObject.quote(s != null ? s : "");
    }

    /* ------------------------------------------------------------------
     * Status-bar notifications (Google Play style)
     * downloading → progress bar + cancel · installing → indeterminate
     * installed → "open" action · cancelled/failed → removed
     * ------------------------------------------------------------------ */

    private void registerCancelReceiver() {
        if (cancelReceiverRegistered) return;
        cancelReceiverRegistered = true;
        cancelReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String slug = intent == null ? null : intent.getStringExtra(EXTRA_SLUG);
                if (slug != null && !slug.isEmpty()) cancelDownload(slug);
            }
        };
        IntentFilter f = new IntentFilter(ACTION_CANCEL_DOWNLOAD);
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                activity.registerReceiver(cancelReceiver, f, Context.RECEIVER_NOT_EXPORTED);
            } else {
                activity.registerReceiver(cancelReceiver, f);
            }
        } catch (Exception e) {
            Log.e(TAG, "registerCancelReceiver failed", e);
        }
    }

    private void ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        try {
            NotificationManager nm = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel ch = new NotificationChannel(CH_DOWNLOADS, "تنزيلات التطبيقات", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("تقدم تنزيل وتثبيت التطبيقات من Golden Store");
            ch.setShowBadge(false);
            ch.setSound(null, null);
            nm.createNotificationChannel(ch);
        } catch (Exception e) {
            Log.e(TAG, "ensureChannels failed", e);
        }
    }

    private int notifId(String slug) {
        return NOTIF_BASE_ID + (Math.abs(slug.hashCode()) % 100000);
    }

    private boolean canPostNotifications() {
        if (Build.VERSION.SDK_INT >= 33) {
            return activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private void updateNotificationAsync(final String slug, final String status, final double progress) {
        notifExecutor.execute(() -> updateNotification(slug, status, progress));
    }

    private String metaOf(String slug, String key) {
        String[] stash = notifMetaStash.get(slug);
        if (stash != null && stash.length == 3) {
            if ("app_name".equals(key)) return stash[0] == null ? "" : stash[0];
            if ("icon_url".equals(key)) return stash[1] == null ? "" : stash[1];
            if ("package_name".equals(key)) return stash[2] == null ? "" : stash[2];
        }
        DownloadState st = active.get(slug);
        if (st != null) {
            if ("app_name".equals(key)) return st.appName == null ? "" : st.appName;
            if ("icon_url".equals(key)) return st.iconUrl == null ? "" : st.iconUrl;
            if ("package_name".equals(key)) return st.packageName == null ? "" : st.packageName;
        }
        JSONObject p = persisted.get(slug);
        return p == null ? "" : p.optString(key, "");
    }

    /** App icon bitmap for the notification (cached in memory + on disk). */
    private Bitmap loadIconBitmap(String slug, String iconUrl) {
        if (iconUrl == null || iconUrl.isEmpty()) return null;
        Bitmap cached = iconCache.get(slug);
        if (cached != null) return cached;
        try {
            File dir = new File(activity.getFilesDir(), "icons");
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, Integer.toHexString(slug.hashCode()) + ".png");
            Bitmap bmp = f.exists() ? BitmapFactory.decodeFile(f.getAbsolutePath()) : null;
            if (bmp == null) {
                HttpURLConnection c = (HttpURLConnection) new URL(iconUrl).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setRequestProperty("User-Agent", "GoldenStoreApp Android");
                int code = c.getResponseCode();
                if (code >= 200 && code < 400) {
                    InputStream in = c.getInputStream();
                    bmp = BitmapFactory.decodeStream(in);
                    try { in.close(); } catch (Exception ignore) {}
                    if (bmp != null) {
                        try {
                            FileOutputStream fo = new FileOutputStream(f);
                            bmp.compress(Bitmap.CompressFormat.PNG, 90, fo);
                            fo.close();
                        } catch (Exception ignore) {}
                    }
                }
                c.disconnect();
            }
            if (bmp != null) iconCache.put(slug, bmp);
            return bmp;
        } catch (Throwable t) {
            return null;
        }
    }

    private void updateNotification(String slug, String status, double progress) {
        try {
            NotificationManager nm = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            ensureChannels();

            if ("cancelled".equals(status) || "failed".equals(status)) {
                nm.cancel(notifId(slug));
                notifMetaStash.remove(slug);
                return;
            }
            if (!canPostNotifications()) return;

            String name = metaOf(slug, "app_name");
            if (name == null || name.isEmpty()) name = "app-update".equals(slug) ? "Golden Store" : slug;
            Bitmap large = loadIconBitmap(slug, metaOf(slug, "icon_url"));
            int id = notifId(slug);

            NotificationCompat.Builder b;
            if ("installed".equals(status)) {
                // Finished: "تم تثبيت التطبيق" with an Open action, auto-dismiss on tap.
                b = new NotificationCompat.Builder(activity, CH_DOWNLOADS)
                        .setSmallIcon(getApplicationIconRes())
                        .setOnlyAlertOnce(true)
                        .setAutoCancel(true)
                        .setOngoing(false)
                        .setContentTitle("تم التثبيت")
                        .setContentText("تم تثبيت " + name + " بنجاح — يمكنك فتحه الآن")
                        .setProgress(0, 0, false);
                if (large != null) b.setLargeIcon(large);
                String pkg = metaOf(slug, "package_name");
                if (pkg != null && !pkg.isEmpty()) {
                    try {
                        Intent open = activity.getPackageManager().getLaunchIntentForPackage(pkg);
                        if (open != null) {
                            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            PendingIntent pi = PendingIntent.getActivity(
                                    activity, Math.abs(slug.hashCode()) & 0x7fff, open,
                                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                            b.setContentIntent(pi);
                            b.addAction(0, "فتح", pi);
                        }
                    } catch (Exception ignore) {}
                }
                nm.notify(id, b.build());
                notifMetaStash.remove(slug); // terminal state — stash consumed
                return;
            }

            boolean preparing = "installing".equals(status) || "downloaded".equals(status);
            b = new NotificationCompat.Builder(activity, CH_DOWNLOADS)
                    .setSmallIcon(getApplicationIconRes())
                    .setOnlyAlertOnce(true)
                    .setOngoing(true)
                    .setSilent(true);
            if (large != null) b.setLargeIcon(large);
            if (preparing) {
                b.setContentTitle("جارٍ تثبيت " + name)
                        .setContentText("يتم تجهيز التطبيق للتثبيت…")
                        .setProgress(0, 0, true);
            } else {
                b.setContentTitle("جارٍ تنزيل " + name);
                if (progress >= 0) {
                    int pct = (int) Math.max(0, Math.min(100, Math.round(progress * 100)));
                    b.setProgress(100, pct, false);
                    b.setContentText(pct + "%");
                } else {
                    b.setProgress(0, 0, true);
                    b.setContentText("جارٍ التنزيل…");
                }
                // Cancel action right on the notification.
                try {
                    Intent cancel = new Intent(ACTION_CANCEL_DOWNLOAD);
                    cancel.putExtra(EXTRA_SLUG, slug);
                    cancel.setPackage(activity.getPackageName());
                    PendingIntent pi = PendingIntent.getBroadcast(
                            activity, Math.abs(slug.hashCode()) & 0x7fff, cancel,
                            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                    b.addAction(0, "إلغاء", pi);
                } catch (Exception ignore) {}
            }
            nm.notify(id, b.build());
        } catch (Throwable t) {
            Log.e(TAG, "updateNotification failed", t);
        }
    }

    private int getApplicationIconRes() {
        try {
            return activity.getApplicationInfo().icon;
        } catch (Exception e) {
            return android.R.drawable.stat_sys_download;
        }
    }
}
