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
        return {
          ...parsed,
          timeLeft: remaining,
          isRunning: remaining > 0 ? parsed.isRunning : false
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

  const [notifPermission, setNotifPermission] = useState(
    (typeof window !== 'undefined' && 'Notification' in window) ? window.Notification.permission : 'default'
  );

  const intervalRef = useRef(null);
  const wakeLockRef = useRef(null);
  const bgAudioRef = useRef(null);

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
        
        // Instant catch-up if timer expired while suspended in background
        const remaining = Math.max(0, Math.round((timerState.endTime - Date.now()) / 1000));
        if (remaining <= 0) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          handleTimerComplete();
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
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === 'granted') {
        const title = '알림 활성화 완료! 🍅';
        const body = '집중이 완료되면 화면 상단 알림 팝업으로 알려드립니다.';
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, { body, icon: mushroomImg });
          }).catch(err => {
            console.error("Service worker notification error:", err);
            new Notification(title, { body, icon: mushroomImg });
          });
        } else {
          new Notification(title, { body, icon: mushroomImg });
        }
      }
    }
  };

  const sendSwTimerMessage = (type, extraData = {}) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type, ...extraData });
    }
  };

  const playSound = async (type = 'complete') => {
    if (type === 'complete') {
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
          // Fallback to HTML5 audio if decoding failed
          const audio = new Audio(bell2Sound);
          audio.volume = 1.0;
          audio.play().catch(e => console.log('Bell audio play failed:', e));
        }
      } catch (e) {
        console.log('Bell audio unavailable:', e);
      }
      return;
    }

    // Click sound via Web Audio API
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

  const handleTimerComplete = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    // Cancel native local notification
    if (Capacitor.isNativePlatform()) {
      try {
        LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
      } catch (e) {}
    }

    playSound('complete');

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

    // Auto log study record
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5); // "HH:mm"
    storage.addCustomPomodoroWithMinutes(selectedDate, timeStr, minutesCompleted);
    refreshData();
    window.dispatchEvent(new CustomEvent('xp-updated'));
    if (onUpdate) onUpdate();

    // Reset back to selected study time (No breaks)
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
    playSound('click');
    
    // Pre-create AudioContext and preload bell sound on user interaction
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
 
    const targetDuration = timerState.timeLeft;
    const endTime = Date.now() + (targetDuration * 1000);
    const minutesLeft = Math.round(targetDuration / 60);

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
                  schedule: { at: new Date(endTime) },
                  sound: 'bell2', // Falls back to system default if res/raw/bell2 is missing
                  vibration: [200, 100, 200, 100, 400],
                  actionTypeId: 'OPEN_APP'
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
    
    // Cancel native local notification
    if (Capacitor.isNativePlatform()) {
      try {
        LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
      } catch (e) {}
    }

    const nextState = {
      ...timerState,
      isRunning: false,
      isPaused: true,
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
  };

  const handleEarlyComplete = () => {
    playSound('click');
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    // Cancel native local notification
    if (Capacitor.isNativePlatform()) {
      try {
        LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
      } catch (e) {}
    }
    
    // Calculate elapsed minutes
    const elapsedSeconds = timerState.duration - timerState.timeLeft;
    const minutesCompleted = Math.floor(elapsedSeconds / 60);

    if (minutesCompleted <= 0) {
      alert("1분 이상 진행된 후 완료할 수 있습니다.");
      return;
    }

    // Auto log study record
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5); // "HH:mm"
    storage.addCustomPomodoroWithMinutes(selectedDate, timeStr, minutesCompleted);
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

  const resetTimer = () => {
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

  const handleAddCustom = () => {
    if (!customTime) return;
    const mins = parseInt(customMinutes, 10) || 25;
    storage.addCustomPomodoro(selectedDate, customTime, mins);
    refreshData();
    window.dispatchEvent(new CustomEvent('xp-updated'));
    if (onUpdate) onUpdate();
    setCustomTime('');
    setCustomMinutes('25');
    playSound('click');
  };



  const trigger5sTest = () => {
    playSound('click');
    if ('Notification' in window && Notification.permission === 'granted') {
      alert("확인 버튼을 누르고 5초 안에 화면을 잠그거나 홈 화면으로 나가보세요!");
      
      // Pre-load audio to be safe
      try {
        if (!globalAudioCtx && typeof window !== 'undefined') {
          globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
          globalAudioCtx.resume();
        }
        loadBellSound(globalAudioCtx);
      } catch(e) {}

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'testNotification',
          title: '성장의 숲 🍅',
          body: '🎉 5초 백그라운드 테스트 알림이 정상 작동합니다!'
        });
      }
    } else {
      alert("알림 권한을 먼저 허용해주세요!");
    }
  };

  const formatSecs = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}시간 ${m > 0 ? m + '분' : ''}`;
    return `${m}분`;
  };

  const dayNames = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '3px solid #ef4444', padding: '0.85rem', justifyContent: 'space-between' }}>
      
      {/* Title & Stats Summary (Sleek minimalist header) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: '700' }}>
          <img src={mushroomImg} alt="Mushroom" style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #ef4444' }} />
          공부 사냥터
          <button 
            onClick={trigger5sTest}
            style={{ fontSize: '0.65rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '0.15rem 0.4rem', cursor: 'pointer', marginLeft: '0.4rem' }}
          >
            백그라운드 테스트 (5초)
          </button>
        </h2>
        
        {/* Right Header Controls (Notif Bell + Today Total) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {notifPermission !== 'granted' && (
            <button 
              onClick={requestNotificationPermission}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }} 
              title="백그라운드 알림 허용"
            >
              <Bell size={15} style={{ animation: 'bounce 2s infinite' }} />
            </button>
          )}
          <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 'bold', background: 'rgba(239, 68, 68, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
            오늘: {formatTime(todayData.totalMinutes)} (🍅 {(todayData.timestamps || []).filter(ts => (typeof ts === 'string' ? 25 : (ts.minutes || 25)) >= 15).length})
          </span>
        </div>
      </div>

      {/* Unified Timer Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.15)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
        
        {/* Digital Clock Display */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0.1rem 0' }}>
          <div style={{ fontSize: '3.2rem', fontWeight: '800', fontFamily: 'monospace', color: 'var(--text-primary)', lineHeight: 1, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
            {timerState.isRunning && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />}
            {formatSecs(timerState.timeLeft)}
          </div>
        </div>

        {/* Preset & Custom Setting Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: (timerState.isRunning || timerState.isPaused) ? 0.3 : 1, transition: 'opacity 0.2s' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>집중 시간:</span>
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            {[25, 50].map(mins => (
              <button 
                key={mins}
                disabled={timerState.isRunning || timerState.isPaused}
                onClick={() => { setSelectedDuration(mins); setCustomDuration(''); applyDuration(mins); }}
                style={{ border: 'none', background: (selectedDuration === mins && !customDuration) ? '#ef4444' : 'rgba(255,255,255,0.05)', color: 'white', fontSize: '0.65rem', padding: '0.15rem 0.35rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {mins}분
              </button>
            ))}
            <input 
              type="number"
              disabled={timerState.isRunning || timerState.isPaused}
              placeholder="직접"
              value={customDuration}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setCustomDuration(e.target.value);
                if (val > 0) applyDuration(val);
              }}
              style={{ width: '38px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '0.65rem', padding: '0.1rem 0.2rem', borderRadius: '4px', textAlign: 'center' }}
            />
          </div>
        </div>

        {/* Timer Control Buttons */}
        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.2rem' }}>
          {!timerState.isRunning ? (
            <button 
              onClick={startTimer}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', background: '#ef4444', border: 'none', color: 'white', padding: '0.4rem 0', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              <Play size={12} /> 시작
            </button>
          ) : (
            <button 
              onClick={pauseTimer}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', background: '#eab308', border: 'none', color: 'white', padding: '0.4rem 0', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              <Pause size={12} /> 일시정지
            </button>
          )}

          {(timerState.duration > timerState.timeLeft) && (
            <button
              onClick={handleEarlyComplete}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', background: '#10b981', border: 'none', color: 'white', padding: '0.4rem 0', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem', cursor: 'pointer' }}
              title="지금까지의 시간 기록"
            >
              <Check size={12} /> 완료
            </button>
          )}

          <button 
            onClick={resetTimer}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
            title="리셋"
          >
            <RotateCcw size={12} />
          </button>
        </div>

      </div>

      {/* Bottom Timeline and Statistics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
        
        {/* Timeline Log List */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 'bold' }}>
            <Clock size={11} /> {selectedDate === new Date().toISOString().split('T')[0] ? '오늘' : '선택일'} 상세 공부 타임라인
          </div>
          
          <div style={{ maxHeight: '75px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingRight: '0.15rem' }}>
            {todayData.timestamps && todayData.timestamps.length > 0 ? todayData.timestamps.map((ts, idx) => {
              const target = ts;
              const timeVal = typeof target === 'string' ? target : (target.time || new Date().toISOString());
              const minutesVal = typeof target === 'string' ? 25 : (target.minutes || 25);
              const dateObj = new Date(timeVal);
              const timeString = dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.01)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)' }}>{timeString} ({minutesVal}분 완료)</span>
                  <button 
                    onClick={() => {
                      storage.removePomodoro(selectedDate, idx);
                      refreshData();
                      window.dispatchEvent(new CustomEvent('xp-updated'));
                      if (onUpdate) onUpdate();
                      playSound('click');
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '1px' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    title="삭제"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            }) : (
              <div style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', padding: '0.4rem 0' }}>
                기록이 없습니다.
              </div>
            )}
          </div>
          
          {/* Unified Compact Manual Add Controls */}
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', marginTop: '0.1rem' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>누락 추가:</span>
            <input 
              type="time" 
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', color: 'white', borderRadius: '4px', padding: '0.2rem', fontSize: '0.68rem', width: '70px' }}
            />
            <input 
              type="number"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              placeholder="분"
              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', color: 'white', borderRadius: '4px', padding: '0.2rem', fontSize: '0.68rem', width: '45px', textAlign: 'center' }}
            />
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>분</span>
            <button 
              onClick={handleAddCustom}
              style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.68rem' }}
            >
              추가
            </button>
          </div>
        </div>

        {/* Weekly Bar Chart */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <CalendarDays size={10} /> 이번 주 주간 통계
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-primary)' }}>
              총 <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{formatTime(weeklyData.weeklyMinutes)}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '42px', background: 'rgba(0,0,0,0.2)', padding: '0.25rem', borderRadius: '6px' }}>
            {weeklyData.weekData.map((day, idx) => {
              const maxMinutes = Math.max(...weeklyData.weekData.map(d => d.totalMinutes), 120); 
              const heightPct = Math.min((day.totalMinutes / maxMinutes) * 100, 100);
              
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1rem', flex: 1 }}>
                  <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', height: '8px' }}>{day.count > 0 ? `${day.count}` : ''}</div>
                  <div style={{ 
                    width: '100%', 
                    maxWidth: '10px', 
                    height: `${heightPct}%`, 
                    minHeight: day.totalMinutes > 0 ? '2px' : '0',
                    background: day.date === new Date().toISOString().split('T')[0] ? '#ef4444' : 'rgba(239, 68, 68, 0.35)',
                    borderRadius: '1px 1px 0 0',
                    transition: 'height 0.3s ease'
                  }} />
                  <div style={{ fontSize: '0.62rem', color: day.date === new Date().toISOString().split('T')[0] ? 'var(--text-primary)' : 'var(--text-muted)', scale: '0.85' }}>
                    {dayNames[idx]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
