package com.goldenstore.app;

import android.Manifest;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import java.lang.ref.WeakReference;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    public static WeakReference<MainActivity> currentActivity = new WeakReference<>(null);
    private static String pendingPushToken = null;
    private static String pendingDeepLink = null;
    private static String pendingNotificationExtra = null;

    private static final int INSTALL_PACKAGES_REQUEST = 9001;
    private static final int POST_NOTIFICATIONS_REQUEST = 1001;
    private static final int RC_SIGN_IN = 9002;

    GSAndroid gsAndroid;
    private GoogleSignInClient googleSignInClient;
    private Runnable pendingInstallAction = null;
    private String pendingInstallSlug = null;
    private PackageChangeReceiver packageReceiver;
    private WebViewListener pageListener;
    private volatile boolean pageLoaded;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        currentActivity = new WeakReference<>(this);

        if (getBridge() != null) {
            getBridge().setWebViewClient(new GSWebViewClient(getBridge()));
        }

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            String ua = settings.getUserAgentString();
            if (ua == null) ua = "";
            if (!ua.contains("GoldenStoreApp")) {
                settings.setUserAgentString(ua + " GoldenStoreApp");
            }
            settings.setSupportZoom(false);
            settings.setBuiltInZoomControls(false);
            settings.setDisplayZoomControls(false);
            settings.setTextZoom(100);

            gsAndroid = new GSAndroid(this, webView);
            webView.addJavascriptInterface(gsAndroid, "GSAndroid");
            setupGoogleSignIn();

            pageListener = new WebViewListener() {
                @Override
                public void onPageLoaded(WebView webView) {
                    if (isDestroyed()) return;
                    pageLoaded = true;
                    if (pendingPushToken != null) {
                        evaluatePushToken(pendingPushToken);
                        pendingPushToken = null;
                    }
                    if (pendingDeepLink != null) {
                        evaluateDeepLink(pendingDeepLink);
                        pendingDeepLink = null;
                    }
                    if (pendingNotificationExtra != null) {
                        String js = "try { window.Store && window.Store.showUpdateDialog(JSON.parse(" + JSONObject.quote(pendingNotificationExtra) + ")); } catch (e) { console.error(e); }";
                        webView.evaluateJavascript(js, null);
                        pendingNotificationExtra = null;
                    }
                    // Make sure the FCM token is requested and forwarded to the web layer.
                    FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
                        if (!task.isSuccessful()) {
                            Log.e("MainActivity", "getToken failed", task.getException());
                            return;
                        }
                        String token = task.getResult();
                        if (token != null && !token.isEmpty()) {
                            setPendingPushToken(token);
                        }
                    });
                }

                @Override
                public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                    return true;
                }
            };
            getBridge().addWebViewListener(pageListener);
        }

        registerPackageReceiver();
        requestNotificationPermission();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Coming back from the system installer (or from another app):
        // reconcile every tracked download/install state against the real
        // device and push a fresh snapshot to the web layer, so progress and
        // status stay live across exits and installer round trips.
        if (gsAndroid != null) {
            gsAndroid.onAppResumed();
        }
    }

    private void setupGoogleSignIn() {
        try {
            String serverClientId = getString(R.string.default_web_client_id);
            GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestIdToken(serverClientId)
                    .requestEmail()
                    .build();
            googleSignInClient = GoogleSignIn.getClient(this, gso);
            gsAndroid.setGoogleSignInClient(googleSignInClient);
        } catch (Exception e) {
            Log.e("MainActivity", "Google Sign-In setup failed", e);
        }
    }

    @Override
    public void onDestroy() {
        currentActivity.clear();
        if (packageReceiver != null) {
            unregisterReceiver(packageReceiver);
            packageReceiver = null;
        }
        if (getBridge() != null && pageListener != null) {
            getBridge().removeWebViewListener(pageListener);
            pageListener = null;
        }
        super.onDestroy();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent == null) return;
        String slug = intent.getStringExtra("app_slug");
        if (slug != null && !slug.isEmpty()) {
            String link = "/app?slug=" + Uri.encode(slug);
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                evaluateDeepLink(link);
            } else {
                pendingDeepLink = link;
            }
            return;
        }
        String type = intent.getStringExtra("notification_type");
        String extra = intent.getStringExtra("notification_extra");
        if ("update".equals(type) && extra != null && !extra.isEmpty()) {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            String js = "try { window.Store && window.Store.showUpdateDialog(JSON.parse(" + JSONObject.quote(extra) + ")); } catch (e) { console.error(e); }";
            if (webView != null) {
                webView.evaluateJavascript(js, null);
            } else {
                pendingNotificationExtra = extra;
            }
        }
    }

    @Override
    public void onBackPressed() {
        WebView webView = getBridge().getWebView();
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == INSTALL_PACKAGES_REQUEST) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (getPackageManager().canRequestPackageInstalls()) {
                    if (pendingInstallAction != null) pendingInstallAction.run();
                } else {
                    if (gsAndroid != null) gsAndroid.onInstallPermissionDenied(pendingInstallSlug);
                }
            } else if (pendingInstallAction != null) {
                pendingInstallAction.run();
            }
            pendingInstallAction = null;
            pendingInstallSlug = null;
            return;
        }
        if (requestCode == RC_SIGN_IN && gsAndroid != null) {
            gsAndroid.onGoogleSignInResult(data);
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        if (requestCode == POST_NOTIFICATIONS_REQUEST) {
            return;
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    public void requestInstallPackages(Runnable onGranted, String slug) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (getPackageManager().canRequestPackageInstalls()) {
                onGranted.run();
                return;
            }
            pendingInstallAction = onGranted;
            pendingInstallSlug = slug;
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName()));
            startActivityForResult(intent, INSTALL_PACKAGES_REQUEST);
        } else {
            onGranted.run();
        }
    }

    public static void setPendingPushToken(String token) {
        if (token == null || token.isEmpty()) return;
        MainActivity activity = currentActivity.get();
        if (activity != null && activity.pageLoaded) {
            activity.evaluatePushToken(token);
        } else {
            pendingPushToken = token;
        }
    }

    private void evaluatePushToken(String token) {
        if (isDestroyed() || getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null || token == null) return;
        String js = "window.__gsRegisterPushToken && window.__gsRegisterPushToken(" + JSONObject.quote(token) + ")";
        webView.evaluateJavascript(js, null);
    }

    private void evaluateDeepLink(String link) {
        if (isDestroyed() || getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        String js = "window.location.href = " + JSONObject.quote(link);
        webView.evaluateJavascript(js, null);
    }

    private void registerPackageReceiver() {
        packageReceiver = new PackageChangeReceiver();
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_PACKAGE_ADDED);
        filter.addAction(Intent.ACTION_PACKAGE_REPLACED);
        filter.addAction(Intent.ACTION_PACKAGE_REMOVED);
        filter.addDataScheme("package");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.registerReceiver(this, packageReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(packageReceiver, filter);
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.POST_NOTIFICATIONS}, POST_NOTIFICATIONS_REQUEST);
            }
        }
    }
}
