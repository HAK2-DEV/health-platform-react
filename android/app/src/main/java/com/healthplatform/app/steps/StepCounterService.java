package com.healthplatform.app.steps;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener2;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import com.healthplatform.app.MainActivity;
import com.healthplatform.app.R;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * 걸음 일꾼 — 포그라운드 서비스 (2026-10-26, 자체 만보기 1차).
 *
 *   왜 서비스인가: 안드로이드는 앱이 뒤에 있으면 센서 이벤트를 주지 않고(안드9+), 「오늘 걸음」은 자정 기준값이
 *   있어야 구해진다. 그래서 걷기 테마 프로그램에 참여한 동안 이 일꾼이 알림 한 줄(「오늘 N걸음」)과 함께 떠 있다.
 *   배터리: 세는 건 센서 칩이 하고, 일꾼은 배칭(maxReportLatency)으로 몇 분에 한 번만 깨어 숫자를 받는다.
 *   인증하는 날 2분, 쉬는 날 30분. 앱이 숫자를 물으면 flush 로 즉시 받는다.
 *   켜고 끄기는 StepCounterPlugin(JS)이, 재부팅 뒤 되살리기는 BootReceiver 가 한다.
 */
public class StepCounterService extends Service implements SensorEventListener2 {
    public static final String ACTION_START = "com.healthplatform.app.steps.START";
    public static final String ACTION_STOP = "com.healthplatform.app.steps.STOP";
    public static final String CHANNEL_ID = "dodam_steps";
    private static final int NOTIFICATION_ID = 7301;
    private static final int LATENCY_ACTIVE_US = 2 * 60 * 1_000_000;    // 인증하는 날: 2분
    private static final int LATENCY_REST_US = 30 * 60 * 1_000_000;     // 쉬는 날: 30분

    private static volatile StepCounterService instance;
    public static boolean isRunning() { return instance != null; }
    public static StepCounterService getInstance() { return instance; }

    private SensorManager sensorManager;
    private Sensor stepSensor;
    private StepLedger ledger;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean listening = false;
    private boolean activeDayNow = true;
    private int lastShown = -1;
    private volatile CountDownLatch flushLatch;

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        ledger = new StepLedger(this);
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        stepSensor = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        ensureChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopListening();
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
            stopSelf();
            return START_NOT_STICKY;
        }
        // START / 시스템 재시작(intent null)
        try {
            int type = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH : 0;
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(ledger.getToday()), type);
        } catch (SecurityException e) {
            // 안드14+: 신체활동 권한이 «정말» 없으면 health 타입 FGS 시작이 SecurityException — 끄고 내려간다.
            ledger.setEnabled(false);
            stopSelf();
            return START_NOT_STICKY;
        } catch (Exception e) {
            // 안드12+: 시스템이 뒤에서 되살릴 때(START_STICKY) 포그라운드 시작이 막히는 경우
            //   (ForegroundServiceStartNotAllowedException 등) — 켜짐은 그대로 두고 조용히 내려간다.
            //   앱이 다음에 앞으로 오면 StepWorkerSync 가 start() 로 다시 켠다. (검토 10-26)
            stopSelf();
            return START_NOT_STICKY;
        }
        if (ledger.isExpired(System.currentTimeMillis())) { shutdown(); return START_NOT_STICKY; }   // 프로그램 종료일이 지남
        ledger.setEnabled(true);
        startListening(true);
        scheduleMidnight();
        return START_STICKY;
    }

    /** 프로그램 종료일이 지났을 때 — 스스로 끄고 알림도 걷는다(앱을 안 열어도 멈춘다). */
    private void shutdown() {
        ledger.setEnabled(false);
        stopListening();
        handler.removeCallbacksAndMessages(null);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        stopListening();
        handler.removeCallbacksAndMessages(null);
        instance = null;
        super.onDestroy();
    }

    // ---------- 센서 ----------

    private void startListening(boolean force) {
        if (sensorManager == null || stepSensor == null) return;
        boolean active = ledger.isActiveDay(System.currentTimeMillis());
        if (listening && !force && active == activeDayNow) return;
        if (listening) sensorManager.unregisterListener(this);
        activeDayNow = active;
        int latency = active ? LATENCY_ACTIVE_US : LATENCY_REST_US;
        listening = sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL, latency);
        updateNotification(ledger.getToday(), true);
    }

    private void stopListening() {
        if (listening && sensorManager != null) sensorManager.unregisterListener(this);
        listening = false;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_STEP_COUNTER) return;
        // 배칭으로 늦게 온 이벤트도 «실제 걸은 시각»의 날짜 칸에 넣는다 (event.timestamp = 부팅 기준 ns)
        long wall = System.currentTimeMillis() - (SystemClock.elapsedRealtimeNanos() - event.timestamp) / 1_000_000L;
        ledger.applyCounter(event.values[0], wall);
        // 한 배치가 이벤트 여러 개로 쏟아져도 알림은 마지막 값으로 한 번만 (NotificationManager 연타 제한 회피)
        handler.removeCallbacks(notifyTask);
        handler.postDelayed(notifyTask, 300L);
        // 깊은 잠에서 자정 틱이 늦어도 스스로 맞춘다: 인증하는 날/쉬는 날이 바뀌었거나 기한이 지났으면 재조정
        if (ledger.isExpired(System.currentTimeMillis())) { handler.post(this::shutdown); return; }
        if (ledger.isActiveDay(wall) != activeDayNow) handler.post(() -> startListening(true));
    }

    private final Runnable notifyTask = () -> updateNotification(ledger.getToday(), false);

    @Override public void onAccuracyChanged(Sensor sensor, int accuracy) { }

    @Override
    public void onFlushCompleted(Sensor sensor) {
        CountDownLatch l = flushLatch;
        if (l != null) l.countDown();
    }

    /** 앱이 「지금 걸음」을 물을 때 — 배칭 큐를 비우고 최대 1.5초 기다린 뒤 오늘 걸음을 돌려준다. */
    public int flushAndGetToday() {
        if (listening && sensorManager != null && stepSensor != null) {
            CountDownLatch l = new CountDownLatch(1);
            flushLatch = l;
            if (sensorManager.flush(this)) {
                try { l.await(1500, TimeUnit.MILLISECONDS); } catch (InterruptedException ignored) { }
            }
            flushLatch = null;
        }
        return ledger.getToday();
    }

    /** 설정(목표·요일·프로그램명)이 바뀌었을 때 — 배칭 간격과 알림을 다시 맞춘다. */
    public void refreshFromLedger() {
        handler.post(() -> { startListening(true); updateNotification(ledger.getToday(), true); });
    }

    // ---------- 자정 ----------

    private final Runnable midnightTick = new Runnable() {
        @Override public void run() {
            lastShown = -1;
            if (ledger.isExpired(System.currentTimeMillis())) { shutdown(); return; }   // 프로그램 종료일 다음 날 0시
            startListening(true);     // 인증하는 날/쉬는 날이 바뀌면 배칭 간격도 바뀐다
            scheduleMidnight();
        }
    };

    private void scheduleMidnight() {
        handler.removeCallbacks(midnightTick);
        long delay = Math.max(1_000L, StepLedger.nextMidnightMillis() - System.currentTimeMillis());
        handler.postDelayed(midnightTick, delay);
    }

    // ---------- 알림 ----------

    private void ensureChannel() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "걸음 측정", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("걷기 프로그램에 참여하는 동안 오늘 걸음을 보여줘요. 소리·진동 없음.");
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
    }

    private Notification buildNotification(int today) {
        boolean active = ledger.isActiveDay(System.currentTimeMillis());
        int goal = ledger.getGoal();
        String steps = String.format(Locale.KOREA, "%,d", today);
        String goalText = String.format(Locale.KOREA, "%,d", goal);
        String title;
        if (active && goal > 0) title = today >= goal ? "목표 달성 · 오늘 " + steps + "걸음" : "오늘 " + steps + "걸음 · 목표 " + goalText;
        else title = active ? "오늘 " + steps + "걸음" : "쉬는 날 · 오늘 " + steps + "걸음";
        String name = ledger.getProgramName();
        String text = name.isEmpty() ? "도담이 걸음을 세고 있어요" : name + " · 도담이 걸음을 세고 있어요";
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_steps)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(pi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void updateNotification(int today, boolean force) {
        if (!force && today == lastShown) return;
        lastShown = today;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification(today));
    }
}
