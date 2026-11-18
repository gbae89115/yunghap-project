package com.yunghap.routinenote;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;

import androidx.appcompat.app.AlertDialog;
import androidx.core.app.NotificationManagerCompat;

// 운동 알림 "동의" 담당
// - 처음 실행할 때: 한국어 안내 창으로 "알림 받기 / 나중에" 를 물어본다
// - 나중에 알림 시간을 정했는데 알림이 꺼져 있으면: 다시 물어본다 (이미 거절했다면 알림 설정 화면으로 안내)
// 시스템 권한 창(허용 / 허용 안 함)은 폰 언어로 나오므로, 그 앞에서 한국어로 이유를 먼저 설명한다
public final class NotificationHelper {

    private static final String PREFS_NAME = "app_state";
    private static final String KEY_INTRO_SHOWN = "notification_intro_shown";
    private static final String KEY_ASKED = "notification_asked";
    private static final int REQUEST_CODE = 1;

    private NotificationHelper() {
    }

    // 지금 알림을 띄울 수 있는 상태인지 (권한 허용 + 앱 알림이 꺼져 있지 않음)
    public static boolean isAllowed(Activity activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(activity).areNotificationsEnabled();
    }

    // 앱을 켤 때: 위치 권한은 그대로 요청하고, 알림은 한국어 안내 창으로 먼저 물어본다 (처음 한 번만)
    public static void requestAtStartup(Activity activity, String[] basePermissions) {
        SharedPreferences prefs = activity.getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);

        boolean needsAsk = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && !isAllowed(activity)
                && !prefs.getBoolean(KEY_INTRO_SHOWN, false);

        if (!needsAsk) {
            if (basePermissions.length > 0) activity.requestPermissions(basePermissions, REQUEST_CODE);
            return;
        }

        new AlertDialog.Builder(activity)
                .setTitle("운동 알림")
                .setMessage("정해 둔 운동 시간에 알림을 받으시겠어요?\n\n"
                        + "'알림 받기'를 누르면 나오는 권한 창에서 '허용'을 눌러 주세요.\n"
                        + "나중에 설정에서 바꿀 수 있어요.")
                .setCancelable(false)
                .setPositiveButton("알림 받기", (dialog, which) -> {
                    prefs.edit().putBoolean(KEY_INTRO_SHOWN, true).putBoolean(KEY_ASKED, true).apply();
                    String[] all = new String[basePermissions.length + 1];
                    System.arraycopy(basePermissions, 0, all, 0, basePermissions.length);
                    all[basePermissions.length] = Manifest.permission.POST_NOTIFICATIONS;
                    activity.requestPermissions(all, REQUEST_CODE);
                })
                .setNegativeButton("나중에", (dialog, which) -> {
                    prefs.edit().putBoolean(KEY_INTRO_SHOWN, true).apply();
                    if (basePermissions.length > 0) activity.requestPermissions(basePermissions, REQUEST_CODE);
                })
                .show();
    }

    // 알림 시간을 정했는데 알림이 꺼져 있을 때 다시 물어본다
    public static void askAgain(Activity activity) {
        if (isAllowed(activity)) return;

        SharedPreferences prefs = activity.getSharedPreferences(PREFS_NAME, Activity.MODE_PRIVATE);

        new AlertDialog.Builder(activity)
                .setTitle("운동 알림이 꺼져 있어요")
                .setMessage("알림을 켜야 정해 둔 운동 시간에 알려 드릴 수 있어요.\n\n지금 켤까요?")
                .setPositiveButton("알림 켜기", (dialog, which) -> {
                    boolean askedBefore = prefs.getBoolean(KEY_ASKED, false);
                    prefs.edit().putBoolean(KEY_ASKED, true).apply();

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !askedBefore) {
                        activity.requestPermissions(
                                new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_CODE);
                    } else {
                        openNotificationSettings(activity);
                    }
                })
                .setNegativeButton("나중에", null)
                .show();
    }

    // 이 앱의 알림 설정 화면을 연다 (이미 거절했거나 알림을 꺼 둔 경우)
    private static void openNotificationSettings(Activity activity) {
        Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
        intent.putExtra(Settings.EXTRA_APP_PACKAGE, activity.getPackageName());
        activity.startActivity(intent);
    }
}
