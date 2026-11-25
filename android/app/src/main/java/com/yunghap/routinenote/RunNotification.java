package com.yunghap.routinenote;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;

// 러닝 중 알림창에 계속 떠 있는 "킬로미터 / 시간 / 평균 페이스" 알림 만들기
// 웹(kakao-map.js)이 1초마다 RoutineNoteApp.updateRunNotification(...) 으로 값을 넘기면 같은 알림을 갱신한다
public final class RunNotification {

    static final int NOTIFICATION_ID = 3001;
    private static final String CHANNEL_ID = "run_tracking";

    // 가장 최근에 받은 값 (서비스가 처음 알림을 띄울 때 사용)
    private static String lastKm = "0.00";
    private static String lastTime = "0:00";
    private static String lastPace = "-";

    private RunNotification() {
    }

    // 알림 채널 (소리·진동 없는 조용한 알림)
    private static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "러닝 기록", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("러닝 중 거리·시간·평균 페이스를 알림창에 보여 줍니다");
        channel.setSound(null, null);
        channel.enableVibration(false);
        manager.createNotificationChannel(channel);
    }

    static Notification build(Context context) {
        ensureChannel(context);

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.notification_run);
        views.setTextViewText(R.id.runNotiKm, lastKm);
        views.setTextViewText(R.id.runNotiTime, lastTime);
        views.setTextViewText(R.id.runNotiPace, lastPace);

        // 알림을 누르면 열려 있던 루틴노트 화면으로 돌아간다 (앱을 다시 만들지 않음)
        Intent openIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        PendingIntent openPendingIntent = PendingIntent.getActivity(
                context, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("러닝 기록 중")
                .setContentText(lastKm + "km · " + lastTime + " · " + lastPace)
                .setCustomContentView(views)
                .setCustomBigContentView(views)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
                .setContentIntent(openPendingIntent)
                .build();
    }

    // 새 값으로 알림을 갱신한다 (러닝 서비스가 켜져 있을 때만)
    static void update(Context context, String km, String time, String pace) {
        lastKm = km;
        lastTime = time;
        lastPace = pace;
        if (!RunTrackingService.isRunning) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_ID, build(context));
    }

    static void reset() {
        lastKm = "0.00";
        lastTime = "0:00";
        lastPace = "-";
    }
}
