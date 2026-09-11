package com.healthplatform.app;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState); // ← Capacitor 브리지·플러그인 로드(@capacitor/keyboard 포함)

        // ⚠️ super.onCreate 이후에 softInputMode 를 «명시적으로» 지정 → @capacitor/keyboard(resize:none)가
        //    로드 중 모드를 바꿔도 여기서 최종 확정한다.
        if (Build.VERSION.SDK_INT >= 35) {
            // Android 15+ : 강제 엣지-투-엣지 해제 → adjustResize 로 창이 정상 축소(검증됨).
            WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
            getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        } else {
            // Android 14 이하 (노트9=안드10): adjustResize 는 웹뷰를 12px 로 붕괴시킴(측정 확정) → 못 씀.
            //   adjustNothing(창을 리사이즈·팬 안 함, 붕괴 불가). 대신 @capacitor/keyboard 이벤트로
            //   키보드 높이를 JS(lib/nativeKeyboard)가 받아 --kb-inset 여백 + 포커스 스크롤로 처리.
            getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);
        }
    }
}
