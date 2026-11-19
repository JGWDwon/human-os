package com.humanos.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;

public class PomodoroAlarmHelper {
    public static final String CHANNEL_ID = "pomodoro-headsup-v4";
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
     * 화면 상단 슬라이드 헤드업 팝업 배너 표시
     */
    public static void showHeadsUpNotification(Context context, String title, String body, int notificationId) {
        try {
            NotificationManager notificationManager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) return;

            // 알림 채널 생성 (최고 중요도 HIGH + 무음)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Pomodoro Alarm (뽀모도로 강제 알람 및 팝업)",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("뽀모도로 완료 시 음소거 상태에서도 상단 슬라이드 팝업과 알람 소리가 울리는 채널");
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 250, 100, 250, 100, 400});
                channel.setShowBadge(true);
                channel.setBypassDnd(true);
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                channel.setSound(null, null); // 사운드는 음소거 우회를 위해 MediaPlayer가 STREAM_ALARM으로 직접 재생
                notificationManager.createNotificationChannel(channel);
            }

            // 클릭 시 앱 실행 Intent
            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.setAction(Intent.ACTION_MAIN);
            openIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(context, notificationId, openIntent, pendingFlags);

            int smallIconRes = context.getApplicationInfo().icon;
            if (smallIconRes == 0) {
                smallIconRes = android.R.drawable.ic_lock_idle_alarm;
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(smallIconRes)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setFullScreenIntent(pendingIntent, true) // 헤드업 팝업 강제 노출 및 화면 깨우기
                .setVibrate(new long[]{0, 250, 100, 250, 100, 400});

            notificationManager.notify(notificationId, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * 정확한 시간(endTime)에 울리도록 AlarmManager에 예약
     */
    public static void scheduleAlarm(Context context, long triggerAtMillis, String title, String body, int minutes) {
        cancelAlarm(context);
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent intent = new Intent(context, PomodoroAlarmReceiver.class);
            intent.putExtra("title", title);
            intent.putExtra("body", body);
            intent.putExtra("minutes", minutes);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                flags |= PendingIntent.FLAG_MUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 1001, intent, flags);

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
                PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 1001, intent, flags);
                alarmManager.cancel(pendingIntent);
                pendingIntent.cancel();
            }
        } catch (Exception e) {}
        stopAlarmSound(context);
    }
}
