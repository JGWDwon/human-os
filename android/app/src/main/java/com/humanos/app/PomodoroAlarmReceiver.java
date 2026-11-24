package com.humanos.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class PomodoroAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "PomodoroAlarm";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;
        Log.i(TAG, "PomodoroAlarmReceiver triggered on exact alarm!");

        // 1. 상태바 헤드업 알림 팝업 + 알람 사운드(USAGE_ALARM) 발송
        // (안드로이드 system_server가 백그라운드 및 타 앱 작업 중에도 100% 확실하게 소리와 헤드업 팝업을 띄움)
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                Intent tapIntent = new Intent(context, MainActivity.class);
                tapIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    flags |= PendingIntent.FLAG_MUTABLE;
                }
                PendingIntent pendingIntent = PendingIntent.getActivity(context, 1007, tapIntent, flags);

                Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/raw/bell2");

                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, "pomodoro-headsup-v8")
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("성장의 숲 🍅 집중 완료!")
                    .setContentText("🎉 목표 집중 시간이 완료되었습니다! 수고하셨습니다.")
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setFullScreenIntent(pendingIntent, true)
                    .setSound(soundUri)
                    .setVibrate(new long[]{0, 200, 100, 200, 100, 400});

                nm.notify(1002, builder.build());
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to post native notification from receiver: " + e.getMessage());
        }

        // 2. 알람 발생 타임스탬프 기록 (앱 복귀 시 소리 중복 재생 방지용)
        PomodoroAlarmHelper.recordAlarmTriggered();
    }
}
