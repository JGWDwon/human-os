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

        // STREAM_ALARM으로 음소거 모드를 우회하여 강제로 종소리 재생
        PomodoroAlarmHelper.playAlarmSound(context);
    }
}
