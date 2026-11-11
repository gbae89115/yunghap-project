package com.yunghap.routinenote;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

// 휴대폰을 껐다 켜면 예약된 알림이 사라지므로, 저장해 둔 알림을 다시 예약한다
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            WorkoutAlarmScheduler.restoreAlarms(context);
        }
    }
}
