package jp.family.kazokuothello;

import android.app.Activity;
import android.content.Intent;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/assets/index.html";
    private static final int PHOTO_REQUEST = 1;
    private WebView webView;
    private ValueCallback<Uri[]> photoCallback;

    // A same-origin HTTPS asset router lets Web Workers and their imports run offline.
    // Every request outside the bundled game is blocked, including external navigation.
    private static final class GameAssets {
        private final AssetManager assets;
        private final Set<String> allowed = new HashSet<>(Arrays.asList(
            "index.html", "style.css", "engine.js", "game-store.js", "app.js", "ai-worker.js",
            "assets/kuma.jpg", "assets/panda.jpg", "assets/neko.jpg",
            "assets/usagi.jpg", "assets/inu.jpg", "assets/hiyoko.jpg"
        ));
        GameAssets(AssetManager assets) { this.assets = assets; }
        WebResourceResponse load(Uri uri) {
            String path = uri.getPath();
            if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
                    && path != null && path.startsWith("/assets/")) {
                String file = path.substring(8);
                if (allowed.contains(file)) {
                    String mime = file.endsWith(".js") ? "application/javascript"
                        : file.endsWith(".css") ? "text/css"
                        : file.endsWith(".jpg") ? "image/jpeg" : "text/html";
                    try {
                        return new WebResourceResponse(mime, "UTF-8", assets.open("www/" + file));
                    } catch (IOException ignored) { }
                }
            }
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null,
                new ByteArrayInputStream(new byte[0]));
        }
    }

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(245, 244, 238));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(245, 244, 238));
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        root.requestApplyInsets();
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);
        GameAssets assets = new GameAssets(getApplicationContext().getAssets());
        webView.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.load(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Keep the home link on the same page, so it cannot reset an in-progress match.
                return true;
            }
        });
        // Lets the family editor open the device's photo picker from inside the WebView.
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view,
                    ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (photoCallback != null) photoCallback.onReceiveValue(null);
                photoCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), PHOTO_REQUEST);
                    return true;
                } catch (Exception denied) {
                    photoCallback = null;
                    return false;
                }
            }
        });
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                return assets.load(request.getUrl());
            }
        });
        webView.loadUrl(HOME);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != PHOTO_REQUEST) { super.onActivityResult(requestCode, resultCode, data); return; }
        if (photoCallback == null) return;
        photoCallback.onReceiveValue(resultCode == RESULT_OK && data != null
            ? WebChromeClient.FileChooserParams.parseResult(resultCode, data) : null);
        photoCallback = null;
    }
    @Override protected void onPause() {
        webView.evaluateJavascript("window.dispatchEvent(new Event('pagehide'))", null);
        webView.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }
    @Override public void onBackPressed() {
        webView.evaluateJavascript("(function(){var d=document.querySelector('dialog[open]');"
            + "if(d){d.close();return true;}return false;})()", value -> {
            if (!"true".equals(value)) moveTaskToBack(true);
        });
    }
    @Override protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
