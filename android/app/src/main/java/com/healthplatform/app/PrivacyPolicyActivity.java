package com.healthplatform.app;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/**
 * Health Connect 권한 화면의 「개인정보처리방침」 링크가 여는 화면 (2026-10-25, A안).
 *
 *   capacitor-health 가 제공하는 PermissionsRationaleActivity 는 JavaScript 를 끈 WebView 라 우리 방침 페이지
 *   (React SPA, /privacy)가 «빈 흰 화면»으로 뜬다 — 에뮬레이터(API 36) 실측. Play 건강 앱 심사에서 방침 링크가
 *   빈 화면이면 반려 사유가 되므로 같은 역할을 직접 만든다: JS·DOM 저장소 켜고, 엣지투엣지 인셋만큼 패딩.
 *
 *   주소는 res/values/strings.xml 의 privacy_policy_url — Play 등록정보에 적은 방침 URL 과 «같은 문서»여야 한다.
 *   AndroidManifest 의 ACTION_SHOW_PERMISSIONS_RATIONALE(안드13 이하) 와 VIEW_PERMISSION_USAGE alias(안드14+) 가
 *   이 액티비티를 가리킨다. 뒤로가기는 시스템 기본(창 닫기) — 페이지 하나만 보여주므로 WebView 히스토리는 안 탄다.
 *   (onBackPressed 재정의는 지원 중단 API 라 쓰지 않는다 — Play 가 경고한다.)
 */
public class PrivacyPolicyActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);   // 방침 페이지는 React SPA — JS 없이는 빈 화면
        settings.setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());   // 링크를 외부 브라우저로 넘기지 않고 이 창 안에서
        webView.setBackgroundColor(0xFFF8FBF9);          // surface-app 토큰과 동일 — 로드 전 흰 플래시 완화
        setContentView(webView);

        // 안드15+ 엣지투엣지: 상태바·내비바·노치 아래로 글이 깔리지 않게 인셋만큼 패딩 (MainActivity 와 같은 방식)
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        webView.loadUrl(getString(R.string.privacy_policy_url));
    }
}
