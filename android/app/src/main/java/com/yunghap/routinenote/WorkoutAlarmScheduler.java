package com.yunghap.routinenote;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// 운동 알림 예약 담당
// - 웹 화면(app.js)이 "앞으로 울릴 알림 목록"을 JSON 으로 넘기면, 예전 알림을 모두 지우고 새로 예약한다
// - 목록을 SharedPreferences 에 저장해 두었다가, 휴대폰을 껐다 켠 뒤에도 다시 예약한다 (BootReceiver)
public final class WorkoutAlarmScheduler {

    private static final String PREFS_NAME = "workout_alarms";
    private static final String KEY_ALARMS = "alarms";

    private WorkoutAlarmScheduler() {
    }

    // 웹에서 받은 목록으로 알림을 새로 예약한다 (예전 알림은 모두 취소)
    public static synchronized void setAlarms(Context context, String alarmsJson) {
        JSONArray newAlarms;
        try {
            newAlarms = new JSONArray(alarmsJson);
        } catch (JSONException e) {
            return; // 형식이 이상하면 기존 예약을 건드리지 않는다
        }

        cancelAll(context);
        saveAlarms(context, newAlarms);
        scheduleAll(context, newAlarms);
    }

    // 휴대폰을 다시 켠 뒤 저장해 둔 알림을 다시 예약한다
    public static synchronized void restoreAlarms(Context context) {
        scheduleAll(context, loadAlarms(context));
    }

    private static void scheduleAll(Context context, JSONArray alarms) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        long now = System.currentTimeMillis();

        for (int i = 0; i < alarms.length(); i++) {
            JSONObject alarm = alarms.optJSONObject(i);
            if (alarm == null) continue;

            String id = alarm.optString("id", "");
            long at = alarm.optLong("at", 0);
            if (id.isEmpty() || at <= now) continue; // 이미 지난 알림은 예약하지 않는다

            PendingIntent pendingIntent = buildPendingIntent(
                    context, id,
                    alarm.optString("title", "운동 시간이에요!"),
                    alarm.optString("text", ""));

            scheduleOne(alarmManager, at, pendingIntent);
        }
    }

    private static void scheduleOne(AlarmManager alarmManager, long at, PendingIntent pendingIntent) {
        try {
            boolean canUseExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarmManager.canScheduleExactAlarms();
            if (canUseExact) {
                // 절전 모드(Doze)여도 정확한 시간에 깨워서 알림을 띄운다
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pendingIntent);
            } else {
                // 정확한 알람 권한이 없으면 몇 분 정도 늦을 수 있는 방식으로 예약한다
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pendingIntent);
            }
        } catch (SecurityException e) {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pendingIntent);
        }
    }

    private static void cancelAll(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        JSONArray oldAlarms = loadAlarms(context);
        for (int i = 0; i < oldAlarms.length(); i++) {
            JSONObject alarm = oldAlarms.optJSONObject(i);
            if (alarm == null) continue;

            String id = alarm.optString("id", "");
            if (id.isEmpty()) continue;

            // 예약할 때와 같은 주소(data)로 만들어야 같은 알림으로 인식되어 취소된다
            alarmManager.cancel(buildPendingIntent(context, id, "", ""));
        }
    }

    // 알림마다 고유한 주소(data)를 달아 서로 다른 PendingIntent 로 구분한다
    private static PendingIntent buildPendingIntent(Context context, String id, String title, String text) {
        Intent intent = new Intent(context, AlarmReceiver.class);
        intent.setData(Uri.parse("routinenote://workout-alarm/" + Uri.encode(id)));
        intent.putExtra(AlarmReceiver.EXTRA_ID, id);
        intent.putExtra(AlarmReceiver.EXTRA_TITLE, title);
        intent.putExtra(AlarmReceiver.EXTRA_TEXT, text);

        return PendingIntent.getBroadcast(
                context,
                id.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void saveAlarms(Context context, JSONArray alarms) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_ALARMS, alarms.toString()).apply();
    }

    private static JSONArray loadAlarms(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        try {
            return new JSONArray(prefs.getString(KEY_ALARMS, "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }
}
