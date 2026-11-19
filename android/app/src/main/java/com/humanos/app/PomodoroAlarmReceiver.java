package com.humanos.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.PowerManager;

public class PomodoroAlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                "HumanOS:PomodoroAlarmWakeLock"
            );
            wakeLock.acquire(15000); // 15초간 CPU 깨움 유지하여 종소리 재생 보장
        }

        String title = intent.getStringExtra("title");
        if (title == null || title.isEmpty()) {
            title = "성장의 숲 🍅 집중 완료!";
        }
        String body = intent.getStringExtra("body");
        if (body == null || body.isEmpty()) {
            body = "🎉 집중 완료! 기록이 안전하게 저장되었습니다.";
        }

        // 1. STREAM_ALARM으로 음소거 모드를 우회하여 종소리 재생
        PomodoroAlarmHelper.playAlarmSound(context);

        // 2. 화면 상단 헤드업 슬라이드 팝업 표시
        PomodoroAlarmHelper.showHeadsUpNotification(context, title, body, 1002);
    }
}
