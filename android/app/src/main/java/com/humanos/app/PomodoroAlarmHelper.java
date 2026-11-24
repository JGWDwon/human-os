package com.humanos.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

public class PomodoroAlarmHelper {
    private static final String TAG = "PomodoroAlarm";
    private static MediaPlayer sMediaPlayer = null;
    private static AudioFocusRequest sFocusRequest = null;
    private static Ringtone sRingtone = null;
    private static PowerManager.WakeLock sWakeLock = null;
    private static long sLastPlayTime = 0;
    private static final AudioManager.OnAudioFocusChangeListener sFocusListener = focusChange -> {
        Log.d(TAG, "Audio focus changed: " + focusChange);
    };

    /**
     * 알람 재생 중 CPU가 절전 모드로 들어가지 않도록 WakeLock 유지
     */
    private static synchronized void acquireWakeLock(Context context) {
        try {
            if (sWakeLock == null && context != null) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    sWakeLock = pm.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP,
                        "HumanOS:PomodoroPlaybackWakeLock"
                    );
                    sWakeLock.setReferenceCounted(false);
                }
            }
            if (sWakeLock != null && !sWakeLock.isHeld()) {
                sWakeLock.acquire(15000); // 최대 15초 안전 타임아웃
            }
        } catch (Exception e) {
            Log.w(TAG, "WakeLock acquire warning: " + e.getMessage());
        }
    }

    private static synchronized void releaseWakeLock() {
        try {
            if (sWakeLock != null && sWakeLock.isHeld()) {
                sWakeLock.release();
            }
        } catch (Exception e) {}
    }

    /**
     * 갤럭시탭/스마트폰이 음소거(무음/진동) 모드이거나 인강/동영상이 재생 중이어도
     * 알람 시계와 동일한 STREAM_ALARM 및 USAGE_ALARM으로 무음을 뚫고 100% 확실하게 종소리를 재생합니다.
     * 재생 전 오디오 포커스를 획득하여 강의 앱을 일시정지/Ducking시키고, 종료 후 반환합니다.
     */
    public static synchronized void playAlarmSound(Context context) {
        if (context == null) return;

        // 중복 실행 방지 가드: 4초 이내 중복 트리거 차단
        long now = System.currentTimeMillis();
        if (now - sLastPlayTime < 4000) {
            Log.i(TAG, "Prevented duplicate alarm sound within 4 seconds");
            return;
        }
        sLastPlayTime = now;

        stopAlarmSound(context);
        acquireWakeLock(context);

        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                .build();

            if (audioManager != null) {
                // 1. 알람 및 미디어 볼륨 강제 확보: 볼륨이 너무 작거나 0이면 85%로 올려 무조건 들리게 보장
                try {
                    int maxAlarmVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                    int currentAlarmVol = audioManager.getStreamVolume(AudioManager.STREAM_ALARM);
                    if (currentAlarmVol < (int) (maxAlarmVol * 0.7)) {
                        audioManager.setStreamVolume(AudioManager.STREAM_ALARM, (int) Math.round(maxAlarmVol * 0.85), 0);
                    }
                    int maxMusicVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                    int currentMusicVol = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
                    if (currentMusicVol < (int) (maxMusicVol * 0.5)) {
                        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, (int) Math.round(maxMusicVol * 0.85), 0);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Cannot adjust volume: " + e.getMessage());
                }

                // 2. 오디오 포커스 획득 (강의/유튜브 소리 일시 정지 또는 ducking)
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        sFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                            .setAudioAttributes(audioAttributes)
                            .setOnAudioFocusChangeListener(sFocusListener)
                            .setWillPauseWhenDucked(true)
                            .build();
                        int focusRes = audioManager.requestAudioFocus(sFocusRequest);
                        Log.i(TAG, "requestAudioFocus (O+) result: " + focusRes);
                    } else {
                        int focusRes = audioManager.requestAudioFocus(sFocusListener, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
                        Log.i(TAG, "requestAudioFocus (<O) result: " + focusRes);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Audio focus request warning: " + e.getMessage());
                }
            }

            // 3. bell2.mp3 음원 파일 로드 및 USAGE_ALARM으로 재생
            try {
                sMediaPlayer = new MediaPlayer();
                sMediaPlayer.setAudioAttributes(audioAttributes);
                android.content.res.AssetFileDescriptor afd = context.getResources().openRawResourceFd(R.raw.bell2);
                if (afd != null) {
                    sMediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                    sMediaPlayer.prepare(); // prepare MUST be called before closing afd!
                    afd.close();
                }
                sMediaPlayer.setVolume(1.0f, 1.0f);
                sMediaPlayer.setLooping(false);
                sMediaPlayer.setOnCompletionListener(mp -> stopAlarmSound(context));
                sMediaPlayer.setOnErrorListener((mp, what, extra) -> {
                    Log.e(TAG, "MediaPlayer error: " + what + ", " + extra);
                    fallbackPlayRingtone(context, audioAttributes);
                    return true;
                });
                sMediaPlayer.start();
                Log.i(TAG, "MediaPlayer started successfully on STREAM_ALARM with USAGE_ALARM via bell2");
            } catch (Throwable t) {
                Log.w(TAG, "MediaPlayer setup with raw fd failed: " + t.getMessage() + ", trying create fallback");
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        sMediaPlayer = MediaPlayer.create(context, R.raw.bell2, audioAttributes, audioManager.generateAudioSessionId());
                    } else {
                        sMediaPlayer = MediaPlayer.create(context, R.raw.bell2);
                    }
                    if (sMediaPlayer != null) {
                        sMediaPlayer.setVolume(1.0f, 1.0f);
                        sMediaPlayer.setOnCompletionListener(mp -> stopAlarmSound(context));
                        sMediaPlayer.start();
                    } else {
                        fallbackPlayRingtone(context, audioAttributes);
                    }
                } catch (Throwable t2) {
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
                        audioManager.abandonAudioFocus(sFocusListener);
                    }
                }
            }
        } catch (Exception e) {}

        releaseWakeLock();
    }

    public static synchronized void stopAlarmSound() {
        stopAlarmSound(null);
    }

    /**
     * 정확한 시간(endTime)에 STREAM_ALARM 사운드가 울리도록 AlarmManager에 예약
     * 삼성 One UI 및 안드로이드 Doze 모드를 100% 뚫는 setAlarmClock 사용
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

            Intent showIntent = new Intent(context, MainActivity.class);
            showIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent showPendingIntent = PendingIntent.getActivity(context, 1006, showIntent, flags);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(triggerAtMillis, showPendingIntent);
                alarmManager.setAlarmClock(clockInfo, pendingIntent);
                Log.i(TAG, "Scheduled AlarmClock at " + triggerAtMillis);
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
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
