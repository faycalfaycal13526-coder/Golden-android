package com.goldenstore.app;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * Rewrites the store's clean, extension-less URLs (e.g. /app?slug=x) to the
 * real HTML files served by Capacitor's local asset server (e.g. /app.html?slug=x).
 * This matches the Vercel rewrites used by the public site.
 */
public class GSWebViewClient extends BridgeWebViewClient {

    private static final Set<String> HTML_PAGES = new HashSet<>(Arrays.asList(
        "app", "search", "account", "points", "games", "login", "featured", "books", "admin"
    ));

    private final Bridge bridge;

    public GSWebViewClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (request != null && request.isForMainFrame() && handleUrl(view, request.getUrl())) {
            return true;
        }
        return super.shouldOverrideUrlLoading(view, request);
    }

    @Override
    @SuppressWarnings("deprecation")
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (url != null && handleUrl(view, Uri.parse(url))) {
            return true;
        }
        return super.shouldOverrideUrlLoading(view, url);
    }

    private boolean handleUrl(WebView view, Uri url) {
        if (url == null) return false;
        String scheme = url.getScheme();
        if (!"https".equals(scheme) && !"http".equals(scheme)) return false;

        String host = url.getHost();
        if (host == null) return false;
        if (!host.equalsIgnoreCase(bridge.getHost())) return false;

        String path = url.getPath();
        if (path == null || path.equals("/") || path.contains(".")) return false;

        String first = path.startsWith("/") ? path.substring(1) : path;
        int slash = first.indexOf('/');
        if (slash >= 0) first = first.substring(0, slash);

        if (!HTML_PAGES.contains(first)) return false;

        String newPath = "/" + first + ".html";
        Uri.Builder builder = url.buildUpon()
            .path(newPath)
            .query(null)
            .fragment(null);
        if (url.getQuery() != null) {
            builder.encodedQuery(url.getEncodedQuery());
        }
        if (url.getFragment() != null) {
            builder.encodedFragment(url.getEncodedFragment());
        }

        String rewritten = builder.build().toString();
        if (rewritten.equals(url.toString())) return false;

        view.loadUrl(rewritten);
        return true;
    }
}
