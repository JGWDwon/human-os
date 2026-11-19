package com.humanos.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    createAlarmNotificationChannel();
  }

  /**
   * 무음 모드 / 방해금지 모드를 완전히 뚫는 알림 채널 생성.
   * USAGE_ALARM 속성 덕분에 알람 앱처럼 강제로 소리가 울립니다.
   */
  private void createAlarmNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager notificationManager =
        (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      if (notificationManager != null) {
        // 기존 테스트 채널 삭제하여 새로 설정 적용
        try {
          notificationManager.deleteNotificationChannel("pomodoro-alerts");
          notificationManager.deleteNotificationChannel("pomodoro-alarm-v2");
          notificationManager.deleteNotificationChannel("pomodoro-alarm-v3");
          notificationManager.deleteNotificationChannel("pomodoro-alarm-v5");
          notificationManager.deleteNotificationChannel("pomodoro-alarm-v6");
          notificationManager.deleteNotificationChannel("pomodoro-status-popup-v1");
        } catch (Exception e) {}

        String[] channelIds = new String[]{"pomodoro-alarm-v4", "pomodoro-alarm-v7"};
        for (String channelId : channelIds) {
          CharSequence channelName = "Pomodoro Alarm (무음 뚫는 강제 알람)";
          String channelDesc = "알람 완료 시 무음/방해금지 모드에서도 강제로 슬라이드 팝업과 소리가 울리는 채널";
          int importance = NotificationManager.IMPORTANCE_HIGH;

          NotificationChannel channel = new NotificationChannel(channelId, channelName, importance);
          channel.setDescription(channelDesc);
          channel.enableVibration(true);
          channel.setVibrationPattern(new long[]{0, 200, 100, 200, 100, 400});
          channel.setShowBadge(true);
          channel.setBypassDnd(true); // 방해금지 모드 우회
          channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

          // USAGE_ALARM + AUDIBILITY_ENFORCED 속성으로 무음 모드 강제 뚫기
          Uri soundUri = Uri.parse(
            "android.resource://" + getPackageName() + "/raw/bell2"
          );
          AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
            .build();
          channel.setSound(soundUri, audioAttributes);

          notificationManager.createNotificationChannel(channel);
        }

        // 상태바 헤드업 팝업 & USAGE_ALARM 알람 채널 (인강/영상 재생 중에도 강제로 오디오 덕킹 후 종소리 재생)
        NotificationChannel popupChannel = new NotificationChannel(
          "pomodoro-status-popup-v2",
          "Pomodoro Status Alarm (뽀모도로 알람 및 팝업)",
          NotificationManager.IMPORTANCE_HIGH
        );
        popupChannel.setDescription("뽀모도로 완료 시 화면 상단 슬라이드 팝업과 강제 알람 소리가 울리는 채널");
        popupChannel.enableVibration(true);
        popupChannel.setVibrationPattern(new long[]{0, 200, 100, 200, 100, 400});
        popupChannel.setShowBadge(true);
        popupChannel.setBypassDnd(true);
        popupChannel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

        Uri popupSoundUri = Uri.parse(
          "android.resource://" + getPackageName() + "/raw/bell2"
        );
        AudioAttributes popupAudioAttributes = new AudioAttributes.Builder()
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
          .build();
        popupChannel.setSound(popupSoundUri, popupAudioAttributes);
        notificationManager.createNotificationChannel(popupChannel);
      }
    }
  }
}
