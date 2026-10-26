package com.healthplatform.app.steps;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.hardware.Sensor;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import android.content.pm.ApplicationInfo;
import java.util.ArrayList;
import java.util.List;

/**
 * JS ↔ 걸음 일꾼 다리 (2026-10-26). 웹 쪽 lib/stepCounter.js 가 이 이름(StepCounter)으로 부른다.
 *   checkPermissions / requestPermissions 는 Capacitor 기본 구현(아래 @Permission 별칭 activity)을 그대로 쓴다.
 *   권한을 묻기 «직전» 에 걸음 데이터 사용 안내(prominent disclosure)를 보여주는 건 JS(StepsVerify)의 몫.
 */
@CapacitorPlugin(
    name = "StepCounter",
    permissions = {
        @Permission(strings = { Manifest.permission.ACTIVITY_RECOGNITION }, alias = StepCounterPlugin.ACTIVITY),
        // 안드13+: 알림 권한이 없으면 포그라운드 서비스는 돌아도 «알림 한 줄이 안 보인다»(에뮬 실측 2026-10-26) → 함께 묻는다
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = StepCounterPlugin.NOTIFICATIONS)
    }
)
public class StepCounterPlugin extends Plugin {
    static final String ACTIVITY = "activity";
    static final String NOTIFICATIONS = "notifications";

    /** 신체활동 + (안드13+) 알림 권한을 한 번에 묻는다. 결과는 checkPermissions 와 같은 모양 {activity, notifications}. */
    @Override
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        List<String> aliases = new ArrayList<>();
        aliases.add(ACTIVITY);
        if (Build.VERSION.SDK_INT >= 33) aliases.add(NOTIFICATIONS);
        requestPermissionForAliases(aliases.toArray(new String[0]), call, "permissionsCallback");
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) { checkPermissions(call); }

    private boolean notificationsGranted() {
        if (Build.VERSION.SDK_INT < 33) return true;
        return getPermissionState(NOTIFICATIONS) == PermissionState.GRANTED;
    }

    /** 앱 알림 설정 화면 — 알림 권한을 거절한 뒤 다시 켜는 길. */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) { call.reject("설정 화면을 열지 못했어요"); }
    }

    private StepLedger ledger() { return new StepLedger(getContext()); }

    private boolean sensorAvailable() {
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        return sm != null && sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null;
    }

    /** 디버그 빌드(에뮬레이터)에선 걸음 센서가 없어도 일꾼을 켜 본다 — 숫자는 debugAddSteps 로 흉내. 릴리스는 센서 필수. */
    private boolean isDebuggable() {
        return (getContext().getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    private boolean sensorOk() { return sensorAvailable() || isDebuggable(); }

    private boolean permissionGranted() {
        if (Build.VERSION.SDK_INT < 29) return true;   // 안드10 미만은 설치 시 권한
        return getPermissionState(ACTIVITY) == PermissionState.GRANTED;
    }

    private JSObject status() {
        StepLedger l = ledger();
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        boolean ignoring = pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        JSObject o = new JSObject();
        o.put("supported", sensorOk());
        o.put("sensor", sensorAvailable());
        o.put("permission", permissionGranted() ? "granted" : String.valueOf(getPermissionState(ACTIVITY)).toLowerCase());
        o.put("notifications", notificationsGranted() ? "granted" : String.valueOf(getPermissionState(NOTIFICATIONS)).toLowerCase());
        o.put("enabled", l.isEnabled());
        o.put("running", StepCounterService.isRunning());
        o.put("today", l.getToday());
        o.put("goal", l.getGoal());
        o.put("activeToday", l.isActiveDay(System.currentTimeMillis()));
        o.put("until", l.getUntil());
        o.put("batteryOptimized", !ignoring);
        o.put("lastAt", l.getLastAt());
        return o;
    }

    @PluginMethod
    public void getStatus(PluginCall call) { call.resolve(status()); }

    /** 일꾼 켜기 — { goal, activeDays:[1..7], programName }. 권한이 없으면 켜지 않고 status 만 돌려준다. */
    @PluginMethod
    public void start(PluginCall call) {
        int goal = call.getInt("goal", 0);
        String programName = call.getString("programName", "");
        List<Integer> days = new ArrayList<>();
        JSArray arr = call.getArray("activeDays");
        if (arr != null) {
            try { for (Object v : arr.toList()) days.add(((Number) v).intValue()); } catch (Exception ignored) { }
        }
        Long untilBoxed = call.getLong("until");            // 걷기 프로그램 종료일 23:59:59 (ms). 없으면 0 = 기한 없음
        long until = untilBoxed == null ? 0L : untilBoxed;
        StepLedger l = ledger();
        l.configure(goal, days, programName, until);
        if (!sensorOk() || !permissionGranted()) { call.resolve(status()); return; }
        l.setEnabled(true);
        Intent svc = new Intent(getContext(), StepCounterService.class).setAction(StepCounterService.ACTION_START);
        try { ContextCompat.startForegroundService(getContext(), svc); }
        catch (Exception e) { call.reject("일꾼을 켜지 못했어요: " + e.getMessage()); return; }
        StepCounterService s = StepCounterService.getInstance();
        if (s != null) s.refreshFromLedger();
        call.resolve(status());
    }

    @PluginMethod
    public void stop(PluginCall call) {
        ledger().setEnabled(false);
        Intent svc = new Intent(getContext(), StepCounterService.class).setAction(StepCounterService.ACTION_STOP);
        try { getContext().startService(svc); } catch (Exception ignored) { }
        call.resolve(status());
    }

    /** 오늘 걸음 — 일꾼이 돌고 있으면 배칭 큐를 비운 뒤(최대 1.5초) 최신값. */
    @PluginMethod
    public void getToday(PluginCall call) {
        getBridge().execute(() -> {
            StepCounterService s = StepCounterService.getInstance();
            int today = s != null ? s.flushAndGetToday() : ledger().getToday();
            JSObject o = new JSObject();
            o.put("steps", today);
            o.put("running", s != null);
            call.resolve(o);
        });
    }

    /** 최근 n일 — [{ date: "YYYY-MM-DD", steps }] */
    @PluginMethod
    public void getDaily(PluginCall call) {
        int days = Math.max(1, Math.min(60, call.getInt("days", 7)));
        JSArray out = new JSArray();
        for (String[] row : ledger().getDaily(days)) {
            JSObject o = new JSObject();
            o.put("date", row[0]);
            o.put("steps", Integer.parseInt(row[1]));
            out.put(o);
        }
        JSObject res = new JSObject();
        res.put("daily", out);
        call.resolve(res);
    }

    /** 배터리 최적화 «설정 화면» 열기 — 권한(REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)은 Play 정책상 쓰지 않는다. */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) { call.reject("설정 화면을 열지 못했어요"); }
    }

    /** 에뮬레이터·디버그 빌드 전용 — 센서 없이 오늘 걸음을 더한다. 릴리스에선 거부. */
    @PluginMethod
    public void debugAddSteps(PluginCall call) {
        if (!isDebuggable()) { call.reject("debug only"); return; }
        int today = ledger().debugAdd(call.getInt("steps", 0));
        StepCounterService s = StepCounterService.getInstance();
        if (s != null) s.refreshFromLedger();
        JSObject o = new JSObject();
        o.put("steps", today);
        call.resolve(o);
    }
}
