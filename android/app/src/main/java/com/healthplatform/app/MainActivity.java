package com.healthplatform.app;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.activity.EdgeToEdge;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // 폰 «글자 크기» 설정 반영 상한 (2026-09-15 본인 결정: 1.15배까지만 따른다).
    //   웹뷰는 기본으로 시스템 글꼴 배율을 그대로 곱해(1.3 → 10px 가 13px) 큰 글꼴 폰에서 배너·링·모달이 넘쳤다.
    //   작게 설정한 사용자(0.85 등)는 그대로 따르고, 크게 설정한 사용자만 1.15배에서 멈춘다.
    private static final float MAX_TEXT_SCALE = 1.15f;

    private void applyTextZoomCap() {
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        float fontScale = getResources().getConfiguration().fontScale;
        int zoom = Math.round(Math.min(fontScale, MAX_TEXT_SCALE) * 100f);
        webView.getSettings().setTextZoom(zoom);
    }

    @Override
    public void onResume() {
        super.onResume();
        applyTextZoomCap();   // 앱 사용 중 설정에서 글자 크기를 바꾸고 돌아온 경우까지 반영
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // ⚠️ EdgeToEdge.enable 은 super.onCreate(= setContentView) «이전» 에 불러야 한다.
        if (Build.VERSION.SDK_INT >= 35) {
            EdgeToEdge.enable(this);
        }

        super.onCreate(savedInstanceState); // ← Capacitor 브리지·플러그인 로드

        if (Build.VERSION.SDK_INT >= 35) {
            // 안드15+ : 엣지투엣지를 «받아들이고» 인셋을 직접 처리한다 (v48, 2026-09-20).
            //   이전에는 WindowCompat.setDecorFitsSystemWindows(true) + SOFT_INPUT_ADJUST_RESIZE 로
            //   «끄려고» 했으나 ① 둘 다 지원 중단 API 라 Play 가 경고했고 ② 안드16 은 그 해제를 아예
            //   무시했다(2026-09-20 실측: app=1080x2400, 내비바 영역까지 앱에 줌). 그래서 S24+ 에서
            //   하단 버튼이 내비게이션 바에 깔렸다. [[project_edge_to_edge_migration_2026-09-20]]
            //
            //   ⚠️ CSS env(safe-area-inset-*) 에만 기대지 않는다 — 웹뷰에서 0 으로 오는 경우를 실측했다.
            //   여기서 시스템 바 인셋을 «패딩» 으로 직접 주면 기기·롬과 무관하게 일정하다.
            //   ⚠️ 키보드(ime) 높이도 같은 자리에서 받는다. 그만큼 웹뷰가 줄어들므로 visualViewport 가
            //   정상 반응하고 기존 useKeyboardInset 이 그대로 동작한다(ADJUST_RESIZE 를 대체).
            View root = findViewById(android.R.id.content);
            if (root != null) {
                ViewCompat.setOnApplyWindowInsetsListener(root, (v, windowInsets) -> {
                    Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
                    Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
                    v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                    return WindowInsetsCompat.CONSUMED;
                });
            }
        } else {
            // 안드14 이하 (노트9=안드10): adjustResize 는 웹뷰를 12px 로 붕괴시킴(측정 확정) → 못 씀.
            //   adjustNothing(창을 리사이즈·팬 안 함, 붕괴 불가). 키보드 높이는 JS(lib/nativeKeyboard)가
            //   포커스 기반으로 우회 처리한다. ⚠️ API29 에는 ime() 인셋이 없으므로 이 경로는 그대로 둔다.
            getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);
        }
    }
}
