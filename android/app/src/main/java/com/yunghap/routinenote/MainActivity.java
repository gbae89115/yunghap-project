package com.yunghap.routinenote;

import android.Manifest;
import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.GeolocationPermissions;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends AppCompatActivity {

    // assets 폴더의 index.html을 https 주소처럼 연다 (카카오 지도는 http/https 주소에서만 동작)
    private static final String START_URL = "https://appassets.androidplatform.net/assets/index.html";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. 화면 구성: 브랜드색 바탕 위에 웹뷰를 올린다
        //    - 위쪽 상태바 영역: 헤더와 같은 파란색(brand-600) + 흰 아이콘
        //    - 아래쪽 내비게이션바 영역: 하단 탭과 같은 흰색
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#2563eb"));

        webView = new WebView(this);
        FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
        root.addView(webView, webParams);

        View bottomBarBackground = new View(this);
        bottomBarBackground.setBackgroundColor(Color.WHITE);
        FrameLayout.LayoutParams bottomParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, 0, Gravity.BOTTOM);
        root.addView(bottomBarBackground, bottomParams);

        setContentView(root);

        WindowInsetsControllerCompat barController = WindowCompat.getInsetsController(getWindow(), root);
        barController.setAppearanceLightStatusBars(false);     // 상태바 아이콘: 흰색
        barController.setAppearanceLightNavigationBars(true);  // 내비게이션바 아이콘: 어두운색

        // 상태바·내비게이션바를 뺀 나머지 영역에만 웹뷰를 둔다
        // (웹뷰에 padding을 주면 웹 화면 높이가 어긋나서 margin으로 자리를 비운다)
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            webParams.setMargins(bars.left, bars.top, bars.right, bars.bottom);
            webView.setLayoutParams(webParams);
            bottomParams.height = bars.bottom;
            bottomBarBackground.setLayoutParams(bottomParams);
            return WindowInsetsCompat.CONSUMED;
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