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
   * 최고 중요도(HIGH) + 헤드업 슬라이드 팝업 전용 알림 채널 생성.
   * 채널 ID 버전을 v6로 갱신하여 기존 캐시를 무효화하고,
   * 알림음 자체는 무음(null)으로 설정하여 시스템 알림음과 MediaPlayer 종소리의 이중 울림을 방지합니다.
   * (종소리 및 인강 일시정지 오디오 포커스는 PomodoroAlarmHelper가 USAGE_ALARM으로 단일 전담)
   */
  private void createHeadsUpNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationManager notificationManager =
        (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      if (notificationManager != null) {
        String channelId = "pomodoro-headsup-v6";
        CharSequence channelName = "Pomodoro Heads-Up Alarm (뽀모도로 알람 및 헤드업 팝업)";
        String channelDesc = "뽀모도로 완료 시 화면 상단에 슬라이드 팝업이 내려오는 최고 중요도 채널";
        int importance = NotificationManager.IMPORTANCE_HIGH;

        NotificationChannel channel = new NotificationChannel(channelId, channelName, importance);
        channel.setDescription(channelDesc);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 200, 100, 200, 100, 400});
        channel.setShowBadge(true);
        channel.setBypassDnd(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

        // 채널 자체 사운드는 null로 설정하여 중복 알림음 원천 방지
        channel.setSound(null, null);

        notificationManager.createNotificationChannel(channel);
      }
    }
  }
}
