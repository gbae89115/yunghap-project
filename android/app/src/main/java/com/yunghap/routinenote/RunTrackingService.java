package com.yunghap.routinenote;

import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

// 러닝 중에만 켜지는 서비스: 알림창 기록 카드를 계속 보여 주고,
// 화면을 끄거나 다른 앱을 봐도 앱이 꺼지지 않게(GPS 기록이 끊기지 않게) 해 준다
public class RunTrackingService extends Service {

    static volatile boolean isRunning = false;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(RunNotification.NOTIFICATION_ID, RunNotification.build(this),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(RunNotification.NOTIFICATION_ID, RunNotification.build(this));
        }
        isRunning = true;
        return START_NOT_STICKY;
    }

    // 앱을 최근 앱 목록에서 밀어 끄면 알림도 함께 없앤다
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopSelf();
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        RunNotification.reset();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
