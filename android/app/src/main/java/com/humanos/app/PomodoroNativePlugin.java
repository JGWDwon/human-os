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
        if (triggerAtMillis == null) {
            call.reject("triggerAtMillis is required");
            return;
        }

        PomodoroAlarmHelper.scheduleAlarm(getContext(), triggerAtMillis);
        call.resolve();
    }

    @PluginMethod
    public void playAlarmSound(PluginCall call) {
        // STREAM_ALARM으로 음소거/무음 모드를 뚫고 강제로 종소리 재생
        PomodoroAlarmHelper.playAlarmSound(getContext());
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
