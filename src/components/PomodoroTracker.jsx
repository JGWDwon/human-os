import { useState, useEffect, useRef } from 'react';
import { Plus, CalendarDays, Trash2, Clock, Play, Pause, RotateCcw, Bell } from 'lucide-react';
import { storage } from '../utils/storage';
import mushroomImg from '../assets/mushroom.png';

export default function PomodoroTracker({ selectedDate }) {
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
    typeof window !== 'undefined' ? Notification.permission : 'default'
  );

  const intervalRef = useRef(null);

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

  const playSound = (type = 'complete') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = (freq, time, duration, wave = 'sine') => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(freq, time);
        gainNode.gain.setValueAtTime(0.15, time); // Louder volume (0.15)
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(time);
        oscillator.stop(time + duration);
      };

      if (type === 'complete') {
        // Melodic 6-note quest complete jingle (approx 2.4s)
        playBeep(659.25, audioCtx.currentTime, 0.25, 'triangle');
        playBeep(783.99, audioCtx.currentTime + 0.25, 0.25, 'triangle');
        playBeep(659.25, audioCtx.currentTime + 0.5, 0.25, 'triangle');
        playBeep(523.25, audioCtx.currentTime + 0.75, 0.35, 'sine');
        playBeep(587.33, audioCtx.currentTime + 1.1, 0.25, 'sine');
        playBeep(783.99, audioCtx.currentTime + 1.35, 0.8, 'sine');
      } else if (type === 'click') {
        playBeep(900, audioCtx.currentTime, 0.05, 'sine');
      }
    } catch (e) {
      console.log('Audio Context unavailable:', e);
    }
  };

  const handleTimerComplete = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    playSound('complete');

    const minutesCompleted = Math.round(timerState.duration / 60);

    // Send Browser Notification
    if (Notification.permission === 'granted') {
      const title = '집중 완료! 🍅';
      const body = `${minutesCompleted}분 동안의 모험을 마쳤습니다. 집중 시간이 기록되었습니다!`;
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

    // Auto log study record
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0].substring(0, 5); // "HH:mm"
    storage.addCustomPomodoroWithMinutes(selectedDate, timeStr, minutesCompleted);
    refreshData();
    window.dispatchEvent(new CustomEvent('xp-updated'));

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

    alert(`🎉 ${minutesCompleted}분 집중 완료! 기록이 안전하게 저장되었습니다.`);
  };

  const startTimer = () => {
    playSound('click');
    const targetDuration = timerState.timeLeft;
    const endTime = Date.now() + (targetDuration * 1000);

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
    const nextState = {
      ...timerState,
      isRunning: false,
      isPaused: true,
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
    setCustomTime('');
    setCustomMinutes('25');
    playSound('click');
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
            오늘: {formatTime(todayData.totalMinutes)} (🍅 {todayData.count})
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
