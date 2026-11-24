package com.humanos.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class PomodoroAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "PomodoroAlarm";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null) return;
        Log.i(TAG, "PomodoroAlarmReceiver triggered on exact alarm!");

        // 1. 화면 꺼짐 상태에서도 화면을 깨우기 위한 WakeLock (화면 켜기 보장)
        PowerManager.WakeLock wakeLock = null;
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                    "HumanOS:PomodoroWakeScreenLock"
                );
                wakeLock.acquire(10000); // 10초간 화면 켜짐 유지
            }
        } catch (Exception e) {
            Log.w(TAG, "WakeLock acquire warning: " + e.getMessage());
        }

        // 2. 상태바 헤드업 알림 팝업 발송 (화면 상단 슬라이드 팝업 강제)
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
                    .setFullScreenIntent(pendingIntent, true) // 헤드업 슬라이드 강제
                    .setSound(soundUri)
                    .setVibrate(new long[]{0, 200, 100, 200, 100, 400});

                nm.notify(1002, builder.build());
                Log.i(TAG, "Heads-up notification posted from receiver");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to post native notification from receiver: " + e.getMessage());
        }

        // 3. USAGE_ALARM 오디오 스트림으로 종소리(bell2) 직접 재생 (강의/유튜브 소리 Ducking)
        try {
            PomodoroAlarmHelper.playAlarmSound(context);
        } catch (Exception e) {
            Log.e(TAG, "Failed to play alarm sound from receiver: " + e.getMessage());
        }

        // 4. 알람 발생 타임스탬프 기록 (앱 복귀 시 소리 중복 재생 방지)
        PomodoroAlarmHelper.recordAlarmTriggered();
    }
}
