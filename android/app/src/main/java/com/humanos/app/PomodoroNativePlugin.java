package com.humanos.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PomodoroNative")
public class PomodoroNativePlugin extends Plugin {

    @PluginMethod
    public void schedule(PluginCall call) {
        Long triggerAtMillis = call.getLong("triggerAtMillis");
        String title = call.getString("title", "성장의 숲 🍅 집중 완료!");
        String body = call.getString("body", "🎉 집중 완료! 기록이 안전하게 저장되었습니다.");
        Integer minutes = call.getInt("minutes", 30);

        if (triggerAtMillis == null) {
            call.reject("triggerAtMillis is required");
            return;
        }

        PomodoroAlarmHelper.scheduleAlarm(getContext(), triggerAtMillis, title, body, minutes != null ? minutes : 30);
        call.resolve();
    }

    @PluginMethod
    public void triggerNow(PluginCall call) {
        String title = call.getString("title", "성장의 숲 🍅 집중 완료!");
        String body = call.getString("body", "🎉 집중 완료! 기록이 안전하게 저장되었습니다.");

        // 기존 예약 알람 먼저 취소
        PomodoroAlarmHelper.cancelAlarm(getContext());

        // STREAM_ALARM으로 음소거를 뚫고 강제로 종소리 재생
        PomodoroAlarmHelper.playAlarmSound(getContext());

        // 화면 상단 헤드업 슬라이드 팝업 표시
        PomodoroAlarmHelper.showHeadsUpNotification(getContext(), title, body, 1002);

        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        PomodoroAlarmHelper.cancelAlarm(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stopSound(PluginCall call) {
        PomodoroAlarmHelper.stopAlarmSound(getContext());
        call.resolve();
    }
}
