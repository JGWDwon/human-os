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

        // 1. STREAM_ALARM으로 음소거 모드를 우회하여 강제로 종소리 재생
        PomodoroAlarmHelper.playAlarmSound(context);

        // 2. 화면이 꺼져있거나 백그라운드인 상태에서도 즉시 상태바 헤드업 팝업 띄우기
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

                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, "pomodoro-headsup-v6")
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle("성장의 숲 🍅 집중 완료!")
                    .setContentText("🎉 목표 집중 시간이 완료되었습니다! 수고하셨습니다.")
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setFullScreenIntent(pendingIntent, true)
                    .setSound(null) // 알람 소리는 PomodoroAlarmHelper.playAlarmSound(context)가 단일 전담
                    .setVibrate(new long[]{0, 200, 100, 200, 100, 400});

                nm.notify(1002, builder.build());
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to post native notification from receiver: " + e.getMessage());
        }
    }
}
