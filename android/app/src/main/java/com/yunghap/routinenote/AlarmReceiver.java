package com.yunghap.routinenote;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

// 정한 시간이 되면 안드로이드가 깨워 주는 곳: 앱이 꺼져 있어도 알림(상단 팝업)을 띄운다
public class AlarmReceiver extends BroadcastReceiver {

    public static final String EXTRA_ID = "alarmId";
    public static final String EXTRA_TITLE = "alarmTitle";
    public static final String EXTRA_TEXT = "alarmText";

    private static final String CHANNEL_ID = "workout_reminder";

    @Override
    public void onReceive(Context context, Intent intent) {
        String id = intent.getStringExtra(EXTRA_ID);
        String title = intent.getStringExtra(EXTRA_TITLE);
        String text = intent.getStringExtra(EXTRA_TEXT);
        if (id == null) return;

        createChannel(context);

        // 알림을 누르면 루틴노트 앱이 열린다
        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPendingIntent = PendingIntent.getActivity(
                context, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(title == null || title.isEmpty() ? "운동 시간이에요!" : title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_HIGH)    // 화면 위쪽에 팝업으로 뜬다
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setDefaults(NotificationCompat.DEFAULT_ALL)      // 소리 + 진동
                .setAutoCancel(true)
                .setContentIntent(openPendingIntent);

        try {
            NotificationManagerCompat.from(context).notify(id.hashCode(), builder.build());
        } catch (SecurityException e) {
            // 알림 권한을 허용하지 않은 경우: 조용히 넘어간다
        }
    }

    // 안드로이드 8 이상은 알림 채널이 있어야 알림이 뜬다 (중요도 높음 = 팝업)
    private static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "운동 알림", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("정해 둔 운동 시간에 알려 줘요");

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }
}
