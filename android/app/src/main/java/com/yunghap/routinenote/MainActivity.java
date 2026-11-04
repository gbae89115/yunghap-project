package com.yunghap.routinenote;

import android.Manifest;
import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends AppCompatActivity {

    // assets 폴더의 index.html을 https 주소처럼 연다 (카카오 지도는 http/https 주소에서만 동작)
    private static final String START_URL = "https://appassets.androidplatform.net/assets/index.html";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. 화면 전체를 웹뷰 하나로 채운다
        webView = new WebView(this);
        setContentView(webView);

        // 상태바·내비게이션바에 화면이 가려지지 않도록 여백을 준다
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });

        // 2. assets 폴더 파일을 https://appassets.androidplatform.net/assets/... 로 제공하는 도구
        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        // 3. 웹 기능 켜기
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);    // 자바스크립트 (카카오 지도, 캘린더 등)
        settings.setDomStorageEnabled(true);    // localStorage (루틴 데이터 저장)
        settings.setGeolocationEnabled(true);   // GPS 운동 기록

        // 페이지가 요청하는 파일을 assets에서 찾아서 돌려준다
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });

        // 서비스워커(sw.js)가 요청하는 파일도 assets에서 찾게 한다
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });

        // alert() 창 표시, 웹페이지의 위치 요청 허용
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }
        });

        // 4. 휴대폰 위치 권한 요청 (처음 실행할 때 팝업이 뜬다)
        requestPermissions(new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
        }, 1);

        // 5. 루틴노트 화면 열기
        webView.loadUrl(START_URL);

        // 6. 뒤로가기 버튼: 웹 안에서 뒤로 가고, 더 갈 곳이 없으면 앱 종료
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });
    }
}