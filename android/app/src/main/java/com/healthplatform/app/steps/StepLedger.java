package com.healthplatform.app.steps;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;
import org.json.JSONException;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;

/**
 * 걸음 장부 (2026-10-26, 자체 만보기 1차).
 *
 *   폰의 걸음 센서(TYPE_STEP_COUNTER)는 «부팅 뒤 누적» 숫자 하나만 준다. 이 장부가 그 숫자의 «차이»를
 *   사건 시각의 날짜 칸에 더해 「오늘 걸음」을 만든다. SharedPreferences 하나에 전부 적는다(작고 단순).
 *
 *   규칙
 *   · 처음 받은 숫자는 기준값으로만 쓴다(설치 전 걸음은 세지 않는다).
 *   · 일꾼을 «끄면» 기준값도 지운다 — 다시 켤 때 그 사이(며칠·몇 주) 걸음이 한 번에 오늘로 들어오지 않게 (검토 10-26 high).
 *   · 재부팅은 OS 부팅 횟수(Settings.Global.BOOT_COUNT)로 안다 — 벽시계로 재면 시간 보정도 재부팅으로 오인한다.
 *     재부팅이나 숫자가 줄어든 경우 = 센서가 0 부터 다시 센 것 → 받은 숫자 전부를 더한다.
 *   · 날짜가 바뀐 뒤 첫 숫자는 기준값만 갱신한다 — 그 차이가 어느 날 걸음인지 모르므로(자정 근처 한 배치만 잃는다).
 *   · 일꾼이 잠시 죽었다 살아난 경우(같은 날) = 기준값이 남아 있으니 그 사이 걸음은 오늘에 들어간다.
 *   · 60일 넘은 칸은 지운다.
 */
public final class StepLedger {
    private static final String PREFS = "dodam_steps";
    private static final int KEEP_DAYS = 60;

    private final Context ctx;
    private final SharedPreferences sp;

    public StepLedger(Context context) {
        ctx = context.getApplicationContext();
        sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ---------- 설정 (JS 에서 start 로 넘어오는 값) ----------

    public boolean isEnabled() { return sp.getBoolean("enabled", false); }

    /** 끌 때는 센서 기준값도 함께 지운다(위 규칙). */
    public synchronized void setEnabled(boolean enabled) {
        SharedPreferences.Editor e = sp.edit().putBoolean("enabled", enabled);
        if (!enabled) e.remove("lastCounter").remove("lastBootCount").remove("lastAt");
        e.apply();
    }
    public int getGoal() { return sp.getInt("goal", 0); }
    public String getProgramName() { return sp.getString("programName", ""); }
    /** 이 시각(벽시계 ms)이 지나면 일꾼이 스스로 꺼진다. 0 = 기한 없음. (걷기 프로그램 종료일 23:59:59) */
    public long getUntil() { return sp.getLong("until", 0L); }
    public boolean isExpired(long nowMillis) { long u = getUntil(); return u > 0L && nowMillis > u; }

    /** ISO 요일 목록(1=월 … 7=일). 비어 있으면 「매일 인증」. */
    public List<Integer> getActiveDays() {
        List<Integer> out = new ArrayList<>();
        String csv = sp.getString("activeDays", "");
        if (csv.isEmpty()) return out;
        for (String s : csv.split(",")) {
            try { out.add(Integer.parseInt(s.trim())); } catch (NumberFormatException ignored) { }
        }
        return out;
    }

    public void configure(int goal, List<Integer> activeDays, String programName, long until) {
        StringBuilder csv = new StringBuilder();
        for (int d : activeDays) { if (csv.length() > 0) csv.append(','); csv.append(d); }
        sp.edit().putInt("goal", goal).putString("activeDays", csv.toString())
          .putString("programName", programName == null ? "" : programName)
          .putLong("until", Math.max(0L, until)).apply();
    }

    /** 그 시각이 「인증하는 날」인가 — 쉬는 날은 센서를 느리게 받고 알림 문구도 다르다. */
    public boolean isActiveDay(long wallMillis) {
        List<Integer> days = getActiveDays();
        return days.isEmpty() || days.contains(isoDow(wallMillis));
    }

    // ---------- 센서 적용 ----------

    private int bootCount() {
        try { return Settings.Global.getInt(ctx.getContentResolver(), Settings.Global.BOOT_COUNT, 0); }
        catch (Exception e) { return 0; }
    }

    /** 센서 누적값 하나를 장부에 반영하고 오늘 걸음을 돌려준다. */
    public synchronized int applyCounter(float counter, long wallMillis) {
        float last = sp.getFloat("lastCounter", -1f);
        int lastBootCount = sp.getInt("lastBootCount", -1);
        long lastAt = sp.getLong("lastAt", 0L);
        int boots = bootCount();
        boolean rebooted = lastBootCount >= 0 && boots != lastBootCount;
        boolean dayChanged = lastAt != 0L && !dayKey(lastAt).equals(dayKey(wallMillis));
        int delta;
        if (last < 0f) delta = 0;                                            // 첫 숫자 = 기준값
        else if (rebooted || counter < last) delta = Math.round(counter);    // 센서가 0 부터 다시 셈 → 부팅 뒤 걸음은 이 날짜로
        else if (dayChanged) delta = 0;                                      // 날짜를 넘긴 첫 숫자 = 기준값만 갱신
        else delta = Math.round(counter - last);
        if (delta > 0) addToDay(dayKey(wallMillis), delta);
        sp.edit().putFloat("lastCounter", counter).putInt("lastBootCount", boots).putLong("lastAt", wallMillis).apply();
        return getToday();
    }

    /** 에뮬레이터·디버그 전용 — 센서 없이 오늘 칸에 더한다. */
    public synchronized int debugAdd(int steps) {
        if (steps > 0) addToDay(dayKey(System.currentTimeMillis()), steps);
        return getToday();
    }

    public int getToday() { return getSteps(dayKey(System.currentTimeMillis())); }

    public int getSteps(String dayKey) { return days().optInt(dayKey, 0); }

    /** 최근 n일 [{date, steps}] — 오래된 날부터. 없는 날은 0. */
    public List<String[]> getDaily(int n) {
        List<String[]> out = new ArrayList<>();
        JSONObject d = days();
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_YEAR, -(n - 1));
        for (int i = 0; i < n; i++) {
            String key = dayKey(c.getTimeInMillis());
            out.add(new String[] { key, String.valueOf(d.optInt(key, 0)) });
            c.add(Calendar.DAY_OF_YEAR, 1);
        }
        return out;
    }

    public long getLastAt() { return sp.getLong("lastAt", 0L); }

    // ---------- 내부 ----------

    private JSONObject days() {
        try { return new JSONObject(sp.getString("days", "{}")); }
        catch (JSONException e) { return new JSONObject(); }
    }

    private void addToDay(String key, int delta) {
        JSONObject d = days();
        try {
            d.put(key, d.optInt(key, 0) + delta);
            // 60일 넘은 칸 정리
            String cutoff = dayKey(System.currentTimeMillis() - KEEP_DAYS * 86_400_000L);
            Iterator<String> it = d.keys();
            List<String> old = new ArrayList<>();
            while (it.hasNext()) { String k = it.next(); if (k.compareTo(cutoff) < 0) old.add(k); }
            for (String k : old) d.remove(k);
        } catch (JSONException ignored) { }
        sp.edit().putString("days", d.toString()).apply();
    }

    public static String dayKey(long wallMillis) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(wallMillis));
    }

    /** ISO 요일 1=월 … 7=일 (missions.active_days 와 같은 규약). */
    public static int isoDow(long wallMillis) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(wallMillis);
        int dow = c.get(Calendar.DAY_OF_WEEK);   // 1=일 … 7=토
        return dow == Calendar.SUNDAY ? 7 : dow - 1;
    }

    /** 다음 자정(로컬)의 벽시계 시각 — 일꾼이 날짜를 넘길 때 알림·배칭 간격을 다시 맞추는 데 쓴다. */
    public static long nextMidnightMillis() {
        Calendar c = Calendar.getInstance();
        c.add(Calendar.DAY_OF_YEAR, 1);
        c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 1); c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }
}
