package com.goldenstore.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import java.security.MessageDigest;
import java.util.Arrays;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.tasks.Task;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public class GSAndroid {
    private static final String TAG = "GSAndroid";
    private static final int RC_SIGN_IN = 9002;

    private final MainActivity activity;
    private final WebView webView;
    private final Handler mainHandler;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Map<String, DownloadState> active = new ConcurrentHashMap<>();
    private GoogleSignInClient googleSignInClient;

    private static class DownloadState {
        String slug;
        String packageName;
        String filename;
        File file;
        long lastProgressTime = 0;
        double lastProgress = -1;
        boolean cancelled = false;
        boolean installed = false;
    }

    public GSAndroid(MainActivity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    public void setGoogleSignInClient(GoogleSignInClient client) {
        this.googleSignInClient = client;
    }

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

    @JavascriptInterface
    public void downloadApk(final String url, final String filename, final String slug, final String packageName) {
        if (url == null || url.isEmpty() || slug == null || slug.isEmpty()) {
            emit(slug, "failed", -1);
            return;
        }
        executor.execute(() -> startDownload(url, filename, slug, packageName));
    }

    private void startDownload(String url, String filename, String slug, String packageName) {
        DownloadState state = new DownloadState();
        state.slug = slug;
        state.packageName = packageName;
        state.filename = filename;
        active.put(slug, state);
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
            InputStream in = conn.getInputStream();
            File dir = new File(activity.getExternalFilesDir(null), "downloads");
            if (dir == null) dir = new File(activity.getFilesDir(), "downloads");
            if (!dir.exists()) dir.mkdirs();
            String safeFile = (filename != null && !filename.isEmpty()) ? filename : (slug + ".apk");
            state.file = new File(dir, safeFile);
            FileOutputStream out = new FileOutputStream(state.file);
            byte[] buffer = new byte[8192];
            long downloaded = 0;
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                downloaded += read;
                if (state.cancelled) {
                    out.close();
                    in.close();
                    state.file.delete();
                    active.remove(slug);
                    return;
                }
                double progress = total > 0 ? (double) downloaded / total : -1;
                long now = System.currentTimeMillis();
                if (now - state.lastProgressTime > 200 || Math.abs(progress - state.lastProgress) > 0.01 || progress == 1.0) {
                    state.lastProgressTime = now;
                    state.lastProgress = progress;
                    final double p = progress;
                    mainHandler.post(() -> emit(slug, "downloading", p));
                }
            }
            out.close();
            in.close();
            conn.disconnect();
            conn = null;

            active.put(slug, state);
            mainHandler.post(() -> {
                emit(slug, "downloaded", 1.0);
                emit(slug, "installing", 1.0);
                installApk(state.file, slug, packageName);
            });
        } catch (Exception e) {
            Log.e(TAG, "Download failed for " + slug, e);
            if (conn != null) conn.disconnect();
            active.remove(slug);
            mainHandler.post(() -> emit(slug, "failed", -1));
        }
    }

    private String appendStreamParam(String url) {
        if (url.contains("stream=1")) return url;
        return url + (url.contains("?") ? "&" : "?") + "stream=1";
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

            // For an expected package, only enforce package/signature when the
            // app is already installed (it is an update). A fresh install can
            // use any valid package name.
            if (expectedPackage != null && !expectedPackage.isEmpty()) {
                try {
                    PackageInfo installedInfo = pm.getPackageInfo(expectedPackage, flags);
                    if (installedInfo != null) {
                        if (!apkPackage.equals(expectedPackage)) return "package_mismatch";
                        byte[][] apkSigs = getSignatures(apkInfo);
                        byte[][] installedSigs = getSignatures(installedInfo);
                        if (apkSigs == null || installedSigs == null || apkSigs.length == 0 || installedSigs.length == 0) {
                            return null;
                        }
                        for (byte[] a : apkSigs) {
                            boolean found = false;
                            for (byte[] b : installedSigs) {
                                if (Arrays.equals(a, b)) { found = true; break; }
                            }
                            if (!found) return "signature_mismatch";
                        }
                    }
                } catch (PackageManager.NameNotFoundException e) {
                    // not installed, fresh install is fine
                }
                return null;
            }

            // No expected package supplied: allow fresh installs, but block
            // signature mismatches when an app with the same package is already installed.
            try {
                PackageInfo installedInfo = pm.getPackageInfo(apkPackage, flags);
                if (installedInfo != null) {
                    byte[][] apkSigs = getSignatures(apkInfo);
                    byte[][] installedSigs = getSignatures(installedInfo);
                    if (apkSigs == null || installedSigs == null || apkSigs.length == 0 || installedSigs.length == 0) {
                        return null;
                    }
                    for (byte[] a : apkSigs) {
                        boolean found = false;
                        for (byte[] b : installedSigs) {
                            if (Arrays.equals(a, b)) { found = true; break; }
                        }
                        if (!found) return "signature_mismatch";
                    }
                }
            } catch (PackageManager.NameNotFoundException e) {
                // not installed, fresh install is fine
            }
            return null;
        } catch (Exception e) {
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
            emit(slug, "failed", -1);
        }
    }

    public void onPackageInstalled(String installedPackage) {
        if (installedPackage == null || installedPackage.isEmpty()) return;
        for (Map.Entry<String, DownloadState> entry : active.entrySet()) {
            DownloadState state = entry.getValue();
            if (!state.installed && installedPackage.equals(state.packageName)) {
                state.installed = true;
                final String slug = state.slug;
                mainHandler.post(() -> {
                    emit(slug, "installed", 1.0);
                    active.remove(slug);
                });
                return;
            }
        }
    }

    private void emit(String slug, String status, double progress, String message) {
        if (webView == null) return;
        String progressStr = progress < 0 ? "-1" : String.format(Locale.US, "%.4f", progress);
        String js = "if(window.__gsApkDownloadUpdate){window.__gsApkDownloadUpdate(" + quote(slug) + "," + quote(status) + "," + progressStr + "," + quote(message) + ");}";
        webView.evaluateJavascript(js, null);
    }

    private void emit(String slug, String status, double progress) {
        emit(slug, status, progress, null);
    }

    private String quote(String s) {
        return JSONObject.quote(s != null ? s : "");
    }
}
