package com.healthplatform.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 전체화면+adjustResize 에서 키보드 시 웹뷰가 12px 로 붕괴하는 버그 우회 (측정 확인됨)
        AndroidBug5497Workaround.assistActivity(this);
    }
}
