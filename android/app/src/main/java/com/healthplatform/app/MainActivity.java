package com.healthplatform.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 엣지-투-엣지 비활성화 → 창이 시스템 바(상태바·키보드 IME)에 맞게 축소.
        //   Capacitor 8 + targetSdk 35+ 기본 엣지-투-엣지가 windowSoftInputMode=adjustResize 를
        //   무력화(키보드 시 웹뷰 inner:12 붕괴)하던 것을 해제 → adjustResize 정상 작동.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}
