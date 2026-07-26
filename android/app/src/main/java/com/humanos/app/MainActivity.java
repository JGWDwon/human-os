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
        // 기존 채널 삭제하여 새로 설정 적용
        try {
          notificationManager.deleteNotificationChannel("pomodoro-alerts");
          notificationManager.deleteNotificationChannel("pomodoro-alarm-v2");
        } catch (Exception e) {}

        String channelId = "pomodoro-alarm-v3";
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
    }
  }
}
