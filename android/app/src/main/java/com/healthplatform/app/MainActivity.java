package com.healthplatform.app;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= 35) {
            // Android 15+ : targetSdk 35 강제 엣지-투-엣지가 adjustResize 를 무력화 →
            //   setDecorFitsSystemWindows(true) 로 해제해야 adjustResize(매니페스트) 정상. (에뮬 API35 검증됨)
            WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        } else {
            // Android 14 이하 (노트9=안드10 포함): adjustResize + setDecorFitsSystemWindows 조합이
            //   일부 기기(삼성 안드10 등)에서 키보드 표시 시 웹뷰 창을 ~12px 로 붕괴시킴(실기기 측정 확인).
            //   → adjustPan 으로 전환: 창을 «리사이즈하지 않아»(붕괴 원천 차단) 포커스된 입력창이
            //     키보드 위로 보이도록 화면을 밀어올린다. (구형 안드로이드의 안정적 기본 동작)
            getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN);
        }
    }
}
