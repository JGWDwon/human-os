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
    registerPlugin(PomodoroNativePlugin.class);
    super.onCreate(savedInstanceState);
    createHeadsUpNotificationChannel();
  }

  /**
   * 최고 중요도(HIGH) + 헤드업 슬라이드 팝업 및 전용 알람 사운드(USAGE_ALARM) 채널 생성.
   * 안드로이드 system_server가 백그라운드나 다른 앱 사용 중에도 무음을 뚫고 확실하게 종소리를 재생합니다.
   */
  private void createHeadsUpNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager notificationManager =
        (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      if (notificationManager != null) {
        String channelId = "pomodoro-headsup-v8";
        CharSequence channelName = "Pomodoro Heads-Up Alarm (뽀모도로 알람 및 헤드업 팝업)";
        String channelDesc = "뽀모도로 완료 시 화면 상단에 슬라이드 팝업과 알람음이 울리는 최고 중요도 채널";
        int importance = NotificationManager.IMPORTANCE_HIGH;

        NotificationChannel channel = new NotificationChannel(channelId, channelName, importance);
        channel.setDescription(channelDesc);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 200, 100, 200, 100, 400});
        channel.setShowBadge(true);
        channel.setBypassDnd(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

        Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/bell2");
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
