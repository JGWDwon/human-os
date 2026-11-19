package com.humanos.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

public class PomodoroAlarmHelper {
    private static final String TAG = "PomodoroAlarm";
    private static MediaPlayer sMediaPlayer = null;
    private static AudioFocusRequest sFocusRequest = null;
    private static Ringtone sRingtone = null;

    /**
     * 갤럭시탭/스마트폰이 음소거(무음/진동) 모드이거나 인강/동영상이 재생 중이어도
     * 알람 시계와 동일한 STREAM_ALARM으로 무음을 뚫고 100% 확실하게 종소리를 재생합니다.
     */
    public static synchronized void playAlarmSound(Context context) {
        if (context == null) return;
        stopAlarmSound(context);

        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                // 1. 알람 볼륨 강제 확보: 볼륨이 너무 작거나 0이면 80%로 올려 무조건 들리게 보장
                int maxAlarmVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                int currentAlarmVol = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
                if (currentAlarmVol < (int) (maxAlarmVol * 0.5)) {
                    audioManager.setStreamVolume(AudioManager.STREAM_ALARM, (int) Math.round(maxAlarmVol * 0.8), 0);
                }

                // 2. USAGE_ALARM + FLAG_AUDIBILITY_ENFORCED 속성 (무음/음소거 우회 핵심)
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                    .build();

                // 3. 오디오 포커스 획득 (인강/유튜브 소리 일시 ducking/일시정지)
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        sFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                            .setAudioAttributes(audioAttributes)
                            .setWillPauseWhenDucked(false)
                            .build();
                        audioManager.requestAudioFocus(sFocusRequest);
                    } else {
                        audioManager.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Audio focus request warning: " + e.getMessage());
                }

                // 4. bell2.mp3 음원 파일 로드 (AssetFileDescriptor 방식으로 100% 보장)
                boolean loaded = false;
                sMediaPlayer = new MediaPlayer();
                sMediaPlayer.setAudioAttributes(audioAttributes);

                try {
                    int resId = context.getResources().getIdentifier("bell2", "raw", context.getPackageName());
                    if (resId != 0) {
                        AssetFileDescriptor afd = context.getResources().openRawResourceFd(resId);
                        if (afd != null) {
                            sMediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                            afd.close();
                            loaded = true;
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "openRawResourceFd failed, trying URI fallback: " + e.getMessage());
                }

                if (!loaded) {
                    try {
                        Uri soundUri = Uri.parse("android.resource://" + context.getPackageName() + "/raw/bell2");
                        sMediaPlayer.setDataSource(context, soundUri);
                        loaded = true;
                    } catch (Exception e) {
                        Log.w(TAG, "URI fallback failed: " + e.getMessage());
                    }
                }

                if (loaded) {
                    sMediaPlayer.setLooping(false);
                    sMediaPlayer.setOnCompletionListener(mp -> stopAlarmSound(context));
                    sMediaPlayer.setOnErrorListener((mp, what, extra) -> {
                        Log.e(TAG, "MediaPlayer error: " + what + ", " + extra);
                        fallbackPlayRingtone(context, audioAttributes);
                        return true;
                    });
                    sMediaPlayer.setOnPreparedListener(mp -> {
                        try {
                            mp.setVolume(1.0f, 1.0f);
                            mp.start();
                            Log.i(TAG, "MediaPlayer started successfully on STREAM_ALARM");
                        } catch (Exception e) {
                            Log.e(TAG, "Error starting MediaPlayer: " + e.getMessage());
                            fallbackPlayRingtone(context, audioAttributes);
                        }
                    });
                    sMediaPlayer.prepareAsync();
                } else {
                    // 음원 파일 로드 실패 시 시스템 기본 알람 사운드로 즉시 대체 재생
                    fallbackPlayRingtone(context, audioAttributes);
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "playAlarmSound failed: " + e.getMessage(), e);
            fallbackPlayRingtone(context, null);
        }
    }

    /**
     * 비상 대체: RingtoneManager로 USAGE_ALARM 사운드 강제 재생
     */
    private static void fallbackPlayRingtone(Context context, AudioAttributes audioAttributes) {
        try {
            Uri alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            sRingtone = RingtoneManager.getRingtone(context, alarmUri);
            if (sRingtone != null) {
                if (audioAttributes != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    sRingtone.setAudioAttributes(audioAttributes);
                }
                sRingtone.play();
                Log.i(TAG, "Fallback Ringtone played successfully");
            }
        } catch (Exception e) {
            Log.e(TAG, "fallbackPlayRingtone failed: " + e.getMessage());
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
            if (sRingtone != null) {
                if (sRingtone.isPlaying()) {
                    sRingtone.stop();
                }
                sRingtone = null;
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

            // Android 12+ 정확한 알람 허용 여부 체크
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
            Log.i(TAG, "Scheduled alarm sound at " + triggerAtMillis);
        } catch (Exception e) {
            Log.e(TAG, "scheduleAlarm error: " + e.getMessage(), e);
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
