package com.humanos.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;

public class PomodoroAlarmHelper {
    private static MediaPlayer sMediaPlayer = null;
    private static AudioFocusRequest sFocusRequest = null;

    /**
     * 갤럭시탭/폰이 음소거(무음) 모드이거나 인강/음악이 재생 중이어도
     * 알람 시계와 동일한 STREAM_ALARM으로 무음을 뚫고 강제로 종소리를 재생합니다.
     */
    public static synchronized void playAlarmSound(Context context) {
        stopAlarmSound(context);
        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                // 알람 볼륨이 0으로 되어 있으면 75% 수준으로 자동 보정하여 소리 보장
                int currentAlarmVol = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
                int maxAlarmVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                if (currentAlarmVol == 0 && maxAlarmVol > 0) {
                    audioManager.setStreamVolume(AudioManager.STREAM_ALARM, (int) Math.round(maxAlarmVol * 0.75), 0);
                }

                // USAGE_ALARM + FLAG_AUDIBILITY_ENFORCED 속성 (무음 모드 완전 우회)
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                    .build();

                // 오디오 포커스 획득 (인강/유튜브 소리 일시 ducking/일시정지)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    sFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                        .setAudioAttributes(audioAttributes)
                        .setWillPauseWhenDucked(false)
                        .build();
                    audioManager.requestAudioFocus(sFocusRequest);
                } else {
                    audioManager.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
                }

                Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/raw/bell2");
                sMediaPlayer = new MediaPlayer();
                sMediaPlayer.setAudioAttributes(audioAttributes);
                sMediaPlayer.setDataSource(context, soundUri);
                sMediaPlayer.setLooping(false);
                sMediaPlayer.setOnCompletionListener(mp -> stopAlarmSound(context));
                sMediaPlayer.setOnErrorListener((mp, what, extra) -> {
                    stopAlarmSound(context);
                    return false;
                });
                sMediaPlayer.prepare();
                sMediaPlayer.start();
            }
        } catch (Exception e) {
            e.printStackTrace();
            stopAlarmSound(context);
        }
    }

    public static synchronized void stopAlarmSound(Context context) {
        try {
            if (sMediaPlayer != null) {
                if (sMediaPlayer.isPlaying()) {
                    sMediaPlayer.stop();
                }
                sMediaPlayer.release();
                sMediaPlayer = null;
            }
        } catch (Exception e) {}

        try {
            if (context != null) {
                AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
                if (audioManager != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && sFocusRequest != null) {
                        audioManager.abandonAudioFocusRequest(sFocusRequest);
                        sFocusRequest = null;
                    } else {
                        audioManager.abandonAudioFocus(null);
                    }
                }
            }
        } catch (Exception e) {}
    }

    public static synchronized void stopAlarmSound() {
        stopAlarmSound(null);
    }

    /**
     * 정확한 시간(endTime)에 STREAM_ALARM 사운드가 울리도록 AlarmManager에 예약
     */
    public static void scheduleAlarm(Context context, long triggerAtMillis) {
        cancelAlarm(context);
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent intent = new Intent(context, PomodoroAlarmReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags |= PendingIntent.FLAG_MUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 1005, intent, flags);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * 예약된 알람 취소 및 진행 중인 소리 중지
     */
    public static void cancelAlarm(Context context) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                Intent intent = new Intent(context, PomodoroAlarmReceiver.class);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    flags |= PendingIntent.FLAG_MUTABLE;
                }
                PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 1005, intent, flags);
                alarmManager.cancel(pendingIntent);
                pendingIntent.cancel();
            }
        } catch (Exception e) {}
        stopAlarmSound(context);
    }
}
