import { useState, useEffect, useRef } from 'react';
import { Plus, CalendarDays, Trash2, Clock, Play, Pause, RotateCcw, Bell, Check } from 'lucide-react';
import { storage } from '../utils/storage';
import mushroomImg from '../assets/mushroom.png';
import bell2Sound from '../assets/bell2.mp3';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

let globalAudioCtx = null;
let decodedBellBuffer = null;

const loadBellSound = async (audioCtx) => {
  if (decodedBellBuffer) return;
  try {
    const response = await fetch(bell2Sound);
    const arrayBuffer = await response.arrayBuffer();
    decodedBellBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.error('Failed to load/decode bell2.mp3:', e);
  }
};

export default function PomodoroTracker({ selectedDate, onUpdate }) {
  // Manual input states
  const [todayData, setTodayData] = useState({ count: 0, totalMinutes: 0, timestamps: [] });
  const [weeklyData, setWeeklyData] = useState({ weeklyCount: 0, weeklyMinutes: 0, weekData: [] });
  const [customTime, setCustomTime] = useState('');
  const [customMinutes, setCustomMinutes] = useState('25');
  const [selectedDuration, setSelectedDuration] = useState(25); // minutes
  const [customDuration, setCustomDuration] = useState('');
  const sessionStartTsRef = useRef(null);
  const pauseStartTsRef = useRef(null);

  // Helper for current date in YYYY-MM-DD
  const getTodayStr = () => {
    const now = new Date();
    return new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  };

  // Persistent Timer State
  const [timerState, setTimerState] = useState(() => {
    const saved = localStorage.getItem('human_os_timer_state_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.mode === 'break') {
        parsed.mode = 'focus';
        parsed.duration = 1500;
        parsed.timeLeft = 1500;
        parsed.isRunning = false;
        parsed.isPaused = false;
      }
      if (parsed.isRunning) {
        const remaining = Math.max(0, Math.round((parsed.endTime - Date.now()) / 1000));
        if (remaining <= 0) {
          // Timer finished while app was closed / suspended
          return {
            ...parsed,
            timeLeft: 0,
            isRunning: false,
            isPaused: false,
            pendingAutoLog: true,
            autoLogMins: Math.max(1, Math.round(parsed.duration / 60)),
            autoLogEndTime: parsed.endTime
          };
        }
        return {
          ...parsed,
          timeLeft: remaining,
          isRunning: true
        };
      }
      return parsed;
    }
    return {
      isRunning: false,
      isPaused: false,
      endTime: 0,
      duration: 1500, // 25 min default
      timeLeft: 1500,
    };
  });

  const [notifPermission, setNotifPermission] = useState('default');

  // Handle pending auto-log when timer completed in background/while app was closed
  useEffect(() => {
    if (timerState.pendingAutoLog) {
      const targetEndTimeMs = timerState.autoLogEndTime || Date.now();
      const endObj = new Date(targetEndTimeMs);
      const actualToday = new Date(endObj.getTime() - (endObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const endTimeStr = endObj.toTimeString().split(' ')[0].substring(0, 5);
      const mins = timerState.autoLogMins || 25;

      const startObj = new Date(targetEndTimeMs - mins * 60 * 1000);
      const startTimeStr = startObj.toTimeString().split(' ')[0].substring(0, 5);

      storage.addCustomPomodoroWithMinutes(actualToday, endTimeStr, mins, startTimeStr);
      refreshData();
      window.dispatchEvent(new CustomEvent('xp-updated'));
      if (onUpdate) onUpdate();

      const nextDuration = timerState.duration || 1500;
      const nextState = {
        isRunning: false,
        isPaused: false,
        endTime: 0,
        duration: nextDuration,
        timeLeft: nextDuration
      };
      setTimerState(nextState);
      localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
    }
  }, []);

  // Check notification permission on mount
  useEffect(() => {
    const checkNotifPermission = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const result = await LocalNotifications.checkPermissions();
          setNotifPermission(result.display === 'granted' ? 'granted' : 'default');
        } else if (typeof window !== 'undefined' && 'Notification' in window) {
          setNotifPermission(window.Notification.permission);
        }
      } catch (e) {}
    };
    checkNotifPermission();
  }, []);

  const intervalRef = useRef(null);
  const wakeLockRef = useRef(null);
  const bgAudioRef = useRef(null);
  const isCompletingRef = useRef(false);
  const lastBellPlayTsRef = useRef(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      bgAudioRef.current = new Audio(SILENT_WAV);
      bgAudioRef.current.loop = true;
    }
  }, []);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (err) {
      console.log('Wake Lock request failed', err);
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().then(() => {
        wakeLockRef.current = null;
      }).catch(() => {});
    }
  };

  // Keep alive when running
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && timerState.isRunning) {
        requestWakeLock();
        
        // Catch-up if timer expired while backgrounded
        const remaining = Math.max(0, Math.round((timerState.endTime - Date.now()) / 1000));
        if (remaining <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          handleTimerComplete(true);
        }
      }
    };
    
    if (timerState.isRunning) {
      requestWakeLock();
      if (bgAudioRef.current) {
        bgAudioRef.current.play().catch(() => {});
      }
    } else {
      releaseWakeLock();
      if (bgAudioRef.current) {
        bgAudioRef.current.pause();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [timerState.isRunning]);

  // Sync data on date change
  useEffect(() => {
    refreshData();
  }, [selectedDate]);

  // Timer countdown ticker
  useEffect(() => {
    if (timerState.isRunning) {
      intervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.round((timerState.endTime - Date.now()) / 1000));
        
        if (remaining <= 0) {
          handleTimerComplete();
        } else {
          setTimerState(prev => {
            const nextState = { ...prev, timeLeft: remaining };
            localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
            return nextState;
          });
        }
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerState.isRunning, timerState.endTime]);

  const refreshData = () => {
    setTodayData(storage.getPomodoroByDate(selectedDate));
    setWeeklyData(storage.getWeeklyPomodoroStats());
  };

  const requestNotificationPermission = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await LocalNotifications.requestPermissions();
        const granted = result.display === 'granted';
        setNotifPermission(granted ? 'granted' : 'denied');
        if (granted) {
          await LocalNotifications.schedule({
            notifications: [{
              id: 9999,
              title: '알림 활성화 완료! 🍅',
              body: '집중이 완료되면 화면 상단 알림 팝업으로 알려드립니다.',
              schedule: { at: new Date(Date.now() + 500) },
              channelId: 'pomodoro-alarm-v4',
              sound: 'bell2'
            }]
          });
        } else {
          alert('알림을 허용하려면:\n설정 > Human OS > 알림 에서 직접 활성화해주세요.');
        }
      } else if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        setNotifPermission(permission);
        if (permission === 'granted') {
          const title = '알림 활성화 완료! 🍅';
          const body = '집중이 완료되면 화면 상단 알림 팝업으로 알려드립니다.';
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body })).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.error('Notification permission error:', e);
    }
  };

  const playSound = async (type = 'complete') => {
    if (type === 'complete') {
      const now = Date.now();
      if (now - lastBellPlayTsRef.current < 2500) {
        console.log("Prevented duplicate bell sound playback within 2.5s");
        return;
      }
      lastBellPlayTsRef.current = now;

      try {
        if (!globalAudioCtx && typeof window !== 'undefined') {
          globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
          await globalAudioCtx.resume();
        }
        const audioCtx = globalAudioCtx;
        if (!audioCtx) return;

        if (!decodedBellBuffer) {
          await loadBellSound(audioCtx);
        }

        if (decodedBellBuffer) {
          const source = audioCtx.createBufferSource();
          source.buffer = decodedBellBuffer;
          source.connect(audioCtx.destination);
          source.start(0);
        } else {
          const audio = new Audio(bell2Sound);
          audio.volume = 1.0;
          audio.play().catch(e => console.log('Bell audio play failed:', e));
        }
      } catch (e) {
        console.log('Bell audio unavailable:', e);
      }
      return;
    }

    try {
      if (!globalAudioCtx && typeof window !== 'undefined') {
        globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
        globalAudioCtx.resume();
      }
      const audioCtx = globalAudioCtx;
      if (!audioCtx) return;

      const playBeep = (freq, time, duration, wave = 'sine') => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(freq, time);
        gainNode.gain.setValueAtTime(0.30, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(time);
        oscillator.stop(time + duration);
      };

      if (type === 'click') {
        playBeep(900, audioCtx.currentTime, 0.05, 'sine');
      }
    } catch (e) {
      console.log('Audio Context unavailable:', e);
    }
  };

  const handleTimerComplete = (isFromCatchUp = false) => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;

    if (intervalRef.current) clearInterval(intervalRef.current);

    if (!Capacitor.isNativePlatform() || !isFromCatchUp) {
      playSound('complete');
    }

    const minutesCompleted = Math.round(timerState.duration / 60);

    // Send Browser Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = '성장의 숲 🍅';
      const body = `🎉 ${minutesCompleted}분 집중 완료! 기록이 안전하게 저장되었습니다.`;
      const iconUrl = new URL(mushroomImg, window.location.href).href;
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.getNotifications().then(notifications => {
            notifications.forEach(n => n.close());
            registration.showNotification(title, { 
              body, 
              icon: iconUrl,
              vibrate: [200, 100, 200, 100, 400],
              requireInteraction: true,
              tag: 'pomodoro-' + Date.now()
            }).catch(err => {
              console.error("Service worker notification error:", err);
              try { new Notification(title, { body, icon: iconUrl }); } catch(e) {}
            });
          });
        }).catch(() => {
          try { new Notification(title, { body, icon: iconUrl }); } catch(e) {}
        });
      } else {
        try { new Notification(title, { body, icon: iconUrl }); } catch(e) {}
      }
    }

    // Always log study record to the exact time when the timer bell rang
    const targetEndTimeMs = (timerState.endTime && timerState.endTime > 0) ? timerState.endTime : Date.now();
    const endObj = new Date(targetEndTimeMs);
    const actualToday = new Date(endObj.getTime() - (endObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const endTimeStr = endObj.toTimeString().split(' ')[0].substring(0, 5); // "HH:mm"

    const startObj = new Date(targetEndTimeMs - minutesCompleted * 60 * 1000);
    const startTimeStr = startObj.toTimeString().split(' ')[0].substring(0, 5); // "HH:mm"

    storage.addCustomPomodoroWithMinutes(actualToday, endTimeStr, minutesCompleted, startTimeStr);
    refreshData();
    window.dispatchEvent(new CustomEvent('xp-updated'));
    if (onUpdate) onUpdate();

    // Reset back to selected study time
    const nextDuration = (customDuration ? parseInt(customDuration, 10) : selectedDuration) * 60;
    const nextState = {
      isRunning: false,
      isPaused: false,
      endTime: 0,
      duration: nextDuration,
      timeLeft: nextDuration
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
  };

  const startTimer = async () => {
    if (timerState.isRunning) return;
    isCompletingRef.current = false;
    playSound('click');
    
    try {
      if (!globalAudioCtx && typeof window !== 'undefined') {
        globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (globalAudioCtx) {
        if (globalAudioCtx.state === 'suspended') {
          globalAudioCtx.resume();
        }
        loadBellSound(globalAudioCtx);
      }
    } catch(e) {}
    
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
      } catch (e) {
        console.log('Notification permission request failed:', e);
      }
    }

    const duration = timerState.timeLeft;
    const endTime = Date.now() + duration * 1000;
    const now = new Date();
    const actualToday = getTodayStr();
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

    // If resuming from pause, log pause duration
    if (timerState.isPaused && pauseStartTsRef.current) {
      const pauseSecs = Math.round((Date.now() - pauseStartTsRef.current) / 1000);
      const pauseMins = Math.max(1, Math.round(pauseSecs / 60));
      const pauseStartStr = new Date(pauseStartTsRef.current).toTimeString().split(' ')[0].substring(0, 5);
      storage.logStudySession(actualToday, 'pause', pauseStartStr, timeStr, pauseMins);
      pauseStartTsRef.current = null;
    }

    sessionStartTsRef.current = Date.now();
    const minutesLeft = Math.ceil(duration / 60);

    // Schedule native local notification
    if (Capacitor.isNativePlatform()) {
      try {
        LocalNotifications.requestPermissions().then(result => {
          if (result.display === 'granted') {
            LocalNotifications.schedule({
              notifications: [
                {
                  id: 1001,
                  title: '성장의 숲 🍅',
                  body: `🎉 ${minutesLeft}분 집중 완료! 기록이 안전하게 저장되었습니다.`,
                  schedule: { at: new Date(endTime), allowWhileIdle: true },
                  channelId: 'pomodoro-alarm-v4',
                  sound: 'bell2',
                  vibrationPattern: [200, 100, 200, 100, 400],
                  actionTypeId: 'OPEN_APP',
                  extra: { route: '/' }
                }
              ]
            });
          }
        });
      } catch (e) {
        console.error('Failed to schedule native local notification:', e);
      }
    }

    const nextState = {
      ...timerState,
      isRunning: true,
      isPaused: false,
      endTime
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
  };

  const pauseTimer = () => {
    playSound('click');
    
    const now = new Date();
    const actualToday = getTodayStr();
    const nowStr = now.toTimeString().split(' ')[0].substring(0, 5);
    if (sessionStartTsRef.current) {
      const focusSecs = Math.round((Date.now() - sessionStartTsRef.current) / 1000);
      const focusMins = Math.max(1, Math.round(focusSecs / 60));
      const startStr = new Date(sessionStartTsRef.current).toTimeString().split(' ')[0].substring(0, 5);
      storage.logStudySession(actualToday, 'focus', startStr, nowStr, focusMins);
      sessionStartTsRef.current = null;
    }
    pauseStartTsRef.current = Date.now();

    if (Capacitor.isNativePlatform()) {
      try {
        LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
      } catch (e) {}
    }

    const nextState = {
      ...timerState,
      isRunning: false,
      isPaused: true
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
  };

  const handleEarlyComplete = () => {
    if (!window.confirm("지금까지 집중한 시간을 저장하고 조기 완료하시겠습니까?")) {
      return;
    }

    playSound('complete');

    if (Capacitor.isNativePlatform()) {
      try {
        LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
      } catch (e) {}
    }
    
    const elapsedSeconds = timerState.duration - timerState.timeLeft;
    const minutesCompleted = Math.floor(elapsedSeconds / 60);

    if (minutesCompleted <= 0) {
      alert("1분 이상 진행된 후 완료할 수 있습니다.");
      return;
    }

    const now = new Date();
    const actualToday = getTodayStr();
    const endTimeStr = now.toTimeString().split(' ')[0].substring(0, 5); // "HH:mm"
    const startObj = new Date(now.getTime() - minutesCompleted * 60 * 1000);
    const startTimeStr = startObj.toTimeString().split(' ')[0].substring(0, 5);
    storage.addCustomPomodoroWithMinutes(actualToday, endTimeStr, minutesCompleted, startTimeStr);
    refreshData();
    window.dispatchEvent(new CustomEvent('xp-updated'));
    if (onUpdate) onUpdate();

    const nextDuration = (customDuration ? parseInt(customDuration, 10) : selectedDuration) * 60;
    const nextState = {
      isRunning: false,
      isPaused: false,
      endTime: 0,
      duration: nextDuration,
      timeLeft: nextDuration
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
  };

  const resetTimer = () => {
    isCompletingRef.current = false;
    playSound('click');
    const targetMins = customDuration ? parseInt(customDuration, 10) : selectedDuration;
    const secs = targetMins * 60;
    const nextState = {
      isRunning: false,
      isPaused: false,
      duration: secs,
      timeLeft: secs,
      endTime: 0
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
  };

  const applyDuration = (mins) => {
    if (timerState.isRunning || timerState.isPaused) return;
    const secs = mins * 60;
    const nextState = {
      isRunning: false,
      isPaused: false,
      duration: secs,
      timeLeft: secs,
      endTime: 0
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!customTime) {
      alert("시작 시간을 선택해주세요.");
      return;
    }
    const mins = parseInt(customMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
      alert("올바른 수동 입력 시간을 입력해주세요.");
      return;
    }

    const [hours, minutesVal] = customTime.split(':').map(Number);
    const endTotalMins = (hours * 60 + minutesVal + mins) % 1440;
    const endH = Math.floor(endTotalMins / 60);
    const endM = endTotalMins % 60;
    const endTimeStr = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;

    storage.addCustomPomodoroWithMinutes(selectedDate, endTimeStr, mins, customTime);
    refreshData();
    window.dispatchEvent(new CustomEvent('xp-updated'));
    if (onUpdate) onUpdate();
    setCustomTime('');
    alert(`🍅 ${selectedDate} [${format12H(customTime)} ~ ${format12H(endTimeStr)}] (${mins}분) 공부 기록이 추가되었습니다!`);
  };

  const handleDeleteTimestamp = (index) => {
    if (window.confirm("이 기록을 삭제하시겠습니까? (XP도 차감됩니다)")) {
      storage.deletePomodoroTimestamp(selectedDate, index);
      refreshData();
      window.dispatchEvent(new CustomEvent('xp-updated'));
      if (onUpdate) onUpdate();
    }
  };

  const getSessionTimeRange = (ts) => {
    const timeLabel = typeof ts === 'string' ? ts : (ts.time || '');
    const minutesVal = typeof ts === 'object' && ts.minutes ? ts.minutes : 25;
    const timeOnly = timeLabel.includes('T') ? timeLabel.split('T')[1].substring(0, 5) : timeLabel.substring(0, 5);

    if (typeof ts === 'object' && ts.startTime && ts.endTime) {
      return {
        startTime: ts.startTime,
        endTime: ts.endTime,
        minutes: minutesVal
      };
    }

    // Fallback: calculate startTime from endTime - minutesVal
    const [endH, endM] = timeOnly.split(':').map(Number);
    const endTotalMins = (isNaN(endH) ? 0 : endH) * 60 + (isNaN(endM) ? 0 : endM);
    const startTotalMins = (endTotalMins - minutesVal + 1440) % 1440;
    const startH = Math.floor(startTotalMins / 60);
    const startM = startTotalMins % 60;
    const startStr = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;

    return {
      startTime: startStr,
      endTime: timeOnly,
      minutes: minutesVal
    };
  };

  const format12H = (hhmm) => {
    if (!hhmm) return '';
    const [hStr, mStr] = hhmm.split(':');
    const h = parseInt(hStr, 10);
    const ampm = h >= 12 ? '오후' : '오전';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${ampm} ${hour12.toString().padStart(2, '0')}:${mStr}`;
  };

  const formatTimeDisplay = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const activeMinutes = customDuration ? parseInt(customDuration, 10) : selectedDuration;

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-primary)' }}>
          <span>🎯</span> 공부 사냥터
        </h2>
        <div style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', fontWeight: 'bold' }}>
          오늘 집중: {Math.floor(todayData.totalMinutes / 60)}시간 {todayData.totalMinutes % 60}분
        </div>
      </div>

      {/* Notification Banner */}
      {notifPermission !== 'granted' && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '8px', padding: '0.6rem 0.85rem', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem'
        }}>
          <div style={{ fontSize: '0.8rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Bell size={15} color="#fbbf24" />
            <span>집중 완료 시 알림 팝업을 받으려면 알림 허용이 필요합니다.</span>
          </div>
          <button
            onClick={requestNotificationPermission}
            className="btn btn-secondary"
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: '#f59e0b', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            알림 허용하기
          </button>
        </div>
      )}

      {/* Main Timer Display */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 'var(--radius-sm)',
        padding: '1.5rem',
        textAlign: 'center',
        marginBottom: '1.5rem',
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ fontSize: '4rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--text-primary)', letterSpacing: '2px', textShadow: '0 0 20px rgba(16, 185, 129, 0.3)' }}>
          {formatTimeDisplay(timerState.timeLeft)}
        </div>

        {/* Preset Selector */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', marginBottom: '1.25rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>집중 시간:</span>
          {[25, 50].map(mins => (
            <button
              key={mins}
              onClick={() => {
                if (timerState.isRunning || timerState.isPaused) return;
                setSelectedDuration(mins);
                setCustomDuration('');
                applyDuration(mins);
              }}
              disabled={timerState.isRunning || timerState.isPaused}
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '20px',
                border: selectedDuration === mins && !customDuration ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                background: selectedDuration === mins && !customDuration ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                color: selectedDuration === mins && !customDuration ? '#000' : 'var(--text-secondary)',
                fontWeight: selectedDuration === mins && !customDuration ? 'bold' : 'normal',
                fontSize: '0.85rem',
                cursor: timerState.isRunning || timerState.isPaused ? 'not-allowed' : 'pointer'
              }}
            >
              {mins}분
            </button>
          ))}

          {/* Custom Duration Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            <input
              type="number"
              min="1"
              max="180"
              placeholder="직접"
              value={customDuration}
              disabled={timerState.isRunning || timerState.isPaused}
              onChange={(e) => {
                const val = e.target.value;
                setCustomDuration(val);
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed > 0) {
                  applyDuration(parsed);
                }
              }}
              style={{
                width: '60px',
                padding: '0.3rem 0.5rem',
                borderRadius: '4px',
                border: customDuration ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.4)',
                color: '#fff',
                fontSize: '0.85rem',
                textAlign: 'center'
              }}
            />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>분</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!timerState.isRunning ? (
            <button
              onClick={startTimer}
              className="btn btn-primary"
              style={{ padding: '0.65rem 2rem', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Play size={20} /> {timerState.isPaused ? '재개' : '시작'}
            </button>
          ) : (
            <button
              onClick={pauseTimer}
              className="btn btn-secondary"
              style={{ padding: '0.65rem 1.5rem', fontSize: '1rem', background: '#f59e0b', color: '#000', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Pause size={18} /> 일시정지
            </button>
          )}

          {(timerState.isRunning || timerState.isPaused) && (
            <button
              onClick={handleEarlyComplete}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.25rem', fontSize: '0.9rem', background: 'var(--accent-secondary)' }}
            >
              <Check size={18} /> 조기 완료
            </button>
          )}

          <button
            onClick={resetTimer}
            className="btn btn-secondary"
            style={{ padding: '0.65rem', borderRadius: '8px' }}
            title="타이머 리셋"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {/* Daily Timestamped Log & Manual Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.2rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 'bold' }}>
              <Clock size={17} color="var(--accent-primary)" /> 오늘 상세 공부 타임라인
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', background: 'rgba(16, 185, 129, 0.12)', padding: '0.2rem 0.6rem', borderRadius: '12px', fontWeight: 'bold', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              총 {todayData.timestamps?.length || 0}회차 집중 완료
            </span>
          </div>

          {/* Timestamps List */}
          <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.2rem' }}>
            {todayData.timestamps && todayData.timestamps.length > 0 ? (
              todayData.timestamps.map((ts, idx) => {
                const sessionInfo = getSessionTimeRange(ts);

                return (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(255,255,255,0.04)', padding: '0.55rem 0.85rem', borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.06)', transition: 'all 0.2s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.18)', color: '#34d399', fontSize: '0.72rem',
                        fontWeight: 'bold', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)'
                      }}>
                        {idx + 1}회차
                      </span>
                      <span style={{ fontWeight: '600', fontSize: '0.88rem', color: 'var(--text-primary)', letterSpacing: '0.3px' }}>
                        {format12H(sessionInfo.startTime)} ~ {format12H(sessionInfo.endTime)}
                      </span>
                      <span style={{
                        fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'rgba(16, 185, 129, 0.1)',
                        padding: '0.1rem 0.45rem', borderRadius: '4px', fontWeight: 'bold'
                      }}>
                        {sessionInfo.minutes}분 집중
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteTimestamp(idx)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                      title="기록 삭제"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', textAlign: 'center', padding: '1.25rem 0', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                🌱 아직 오늘 완료된 집중 기록이 없습니다. 타이머를 시작해보세요!
              </div>
            )}
          </div>

          {/* Manual Entry Form */}
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>누락 시간 직접 추가:</span>
            <input
              type="time"
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              title="시작 시간"
              style={{
                background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)',
                padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem'
              }}
            />
            <input
              type="number"
              min="1"
              max="180"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              title="집중 시간(분)"
              style={{
                width: '50px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)',
                padding: '0.3rem 0.5rem', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center'
              }}
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>분</span>
            <button type="submit" className="btn btn-secondary" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399', fontWeight: 'bold' }}>
              추가
            </button>
          </form>
        </div>

        {/* Weekly Stats Summary */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
            <CalendarDays size={18} color="var(--accent-secondary)" /> 이번 주 누적 공부시간
          </span>
          <span style={{ fontSize: '1.15rem', color: 'var(--accent-secondary)', fontWeight: 'bold', textShadow: '0 0 10px rgba(59, 130, 246, 0.3)' }}>
            총 {Math.floor(weeklyData.weeklyMinutes / 60)}시간 {weeklyData.weeklyMinutes % 60}분
          </span>
        </div>
      </div>
    </div>
  );
}
