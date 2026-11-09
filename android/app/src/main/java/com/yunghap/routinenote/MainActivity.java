package com.yunghap.routinenote;

import android.Manifest;
import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
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
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

public class MainActivity extends AppCompatActivity {

    // assets 폴더의 index.html을 https 주소처럼 연다 (카카오 지도는 http/https 주소에서만 동작)
    private static final String START_URL = "https://appassets.androidplatform.net/assets/index.html";

    // 상태바·내비게이션바 바탕색 (style.css / tailwind 색상과 맞춤)
    private static final int COLOR_BRAND_600 = Color.parseColor("#2563eb"); // 라이트 모드 헤더
    private static final int COLOR_SLATE_900 = Color.parseColor("#0f172a"); // 다크 모드 헤더·하단 탭

    private WebView webView;
    private FrameLayout root;
    private View bottomBarBackground;
    private WindowInsetsControllerCompat barController;

    // 웹 화면이 다 뜰 때까지 시작 화면(스플래시)을 보여 준다
    private boolean isWebReady = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 0. 시작 화면: 파란 배경 + R 로고 (themes.xml 의 Theme.RoutineNote.Starting)
        //    웹 화면이 준비되면 닫히고, 늦어져도 3초 뒤에는 닫는다
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() -> !isWebReady);
        new Handler(Looper.getMainLooper()).postDelayed(() -> isWebReady = true, 3000);

        super.onCreate(savedInstanceState);

        // 1. 화면 구성: 브랜드색 바탕 위에 웹뷰를 올린다
        //    - 위쪽 상태바 영역: 헤더와 같은 파란색(brand-600) + 흰 아이콘
        //    - 아래쪽 내비게이션바 영역: 하단 탭과 같은 흰색
        root = new FrameLayout(this);

        webView = new WebView(this);
        webView.setBackgroundColor(COLOR_SLATE_900); // 웹 화면이 그려지기 전 하얀 화면이 번쩍이지 않게
        FrameLayout.LayoutParams webParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
        root.addView(webView, webParams);

        bottomBarBackground = new View(this);
        FrameLayout.LayoutParams bottomParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, 0, Gravity.BOTTOM);
        root.addView(bottomBarBackground, bottomParams);

        setContentView(root);

        barController = WindowCompat.getInsetsController(getWindow(), root);
        applyBarTheme(false); // 처음에는 라이트 모드 색으로 시작

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

            @Override
            public void onPageFinished(WebView view, String url) {
                // 페이지를 다 읽은 뒤 화면이 그려질 시간을 조금 주고 시작 화면을 닫는다
                view.postDelayed(() -> isWebReady = true, 200);
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

        // 웹(index.html)에서 다크 모드가 바뀌면 RoutineNoteApp.setDarkMode(true/false)로 알려 준다
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void setDarkMode(boolean isDark) {
                runOnUiThread(() -> applyBarTheme(isDark));
            }
        }, "RoutineNoteApp");

        // 4. 휴대폰 위치 권한 요청 (처음 실행할 때 팝업이 뜬다)
        requestPermissions(new String[]{
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
        }, 1);

        // 5. 루틴노트 화면 열기
        webView.loadUrl(START_URL);

        // 6. 뒤로가기 버튼: 먼저 웹 화면(app.js 의 handleAppBack)에 맡긴다
        //    - 열린 창 닫기 / 이전 탭으로 이동 / 초기값 설정 이전 단계 → 웹이 처리하고 "true"
        //    - 처음 화면에서 두 번 눌렀을 때 → "false" 를 받아 앱 종료
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                webView.evaluateJavascript(
                        "(typeof handleAppBack === 'function') ? handleAppBack() : false",
                        result -> {
                            if ("true".equals(result)) return;
                            if (webView.canGoBack()) {
                                webView.goBack();
                            } else {
                                finish();
                            }
                        });
            }
        });
    }

    // 상태바·내비게이션바 색을 웹 화면의 라이트/다크 모드에 맞춘다
    private void applyBarTheme(boolean isDark) {
        root.setBackgroundColor(isDark ? COLOR_SLATE_900 : COLOR_BRAND_600);
        bottomBarBackground.setBackgroundColor(isDark ? COLOR_SLATE_900 : Color.WHITE);
        barController.setAppearanceLightStatusBars(false);       // 상태바 아이콘: 항상 흰색
        barController.setAppearanceLightNavigationBars(!isDark); // 내비게이션바 아이콘: 라이트=어둡게, 다크=밝게
    }
}