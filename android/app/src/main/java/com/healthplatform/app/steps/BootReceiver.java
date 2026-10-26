package com.healthplatform.app.steps;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;

/**
 * 재부팅·앱 업데이트 뒤 걸음 일꾼 되살리기 (2026-10-26).
 *   장부에 「켜짐」이 적혀 있고 신체활동 권한이 남아 있을 때만. (안드15 에서 BOOT_COMPLETED 로 시작 못 하는
 *   FGS 타입 목록에 health 는 없다.)
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(a) && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)) return;
        StepLedger ledger = new StepLedger(context);
        if (!ledger.isEnabled()) return;
        if (Build.VERSION.SDK_INT >= 29
            && ContextCompat.checkSelfPermission(context, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) return;
        Intent svc = new Intent(context, StepCounterService.class).setAction(StepCounterService.ACTION_START);
        try { ContextCompat.startForegroundService(context, svc); } catch (Exception ignored) { }
    }
}
