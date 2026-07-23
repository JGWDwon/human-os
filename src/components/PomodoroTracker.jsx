import { useState, useEffect, useRef } from 'react';
import { Timer, Plus, CalendarDays, Trash2, Clock, Play, Pause, RotateCcw, Volume2, Bell } from 'lucide-react';
import { storage } from '../utils/storage';
import mushroomImg from '../assets/mushroom.png';

export default function PomodoroTracker({ selectedDate }) {
  // Tab Mode: 'timer' or 'manual'
  const [activeTab, setActiveTab] = useState('timer');

  // Manual Mode State
  const [todayData, setTodayData] = useState({ count: 0, totalMinutes: 0, timestamps: [] });
  const [weeklyData, setWeeklyData] = useState({ weeklyCount: 0, weeklyMinutes: 0, weekData: [] });
  const [customTime, setCustomTime] = useState('');

  // Timer Settings State
  const [focusPreset, setFocusPreset] = useState(25); // minutes
  const [customFocus, setCustomFocus] = useState('');
  const [breakPreset, setBreakPreset] = useState(5); // minutes
  const [customBreak, setCustomBreak] = useState('');

  // Active Timer State (Persistent)
  const [timerState, setTimerState] = useState(() => {
    const saved = localStorage.getItem('human_os_timer_state_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      // If it was running, recalculate remaining time
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
      mode: 'focus', // 'focus' or 'break'
    };
  });

  const [notifPermission, setNotifPermission] = useState(
    typeof window !== 'undefined' ? Notification.permission : 'default'
  );

  const intervalRef = useRef(null);

  // Sync data on mount or date change
  useEffect(() => {
    refreshData();
  }, [selectedDate]);

  // Keep timer ticking if running
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

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === 'granted') {
        new Notification('알림 허용 완료! 🍅', {
          body: '타이머가 끝나면 이 팝업을 통해 알려드립니다.',
          icon: mushroomImg
        });
      }
    }
  };

  // Sound generator
  const playSound = (type = 'complete') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playBeep = (freq, time, duration, wave = 'sine') => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = wave;
        oscillator.frequency.setValueAtTime(freq, time);
        gainNode.gain.setValueAtTime(0.08, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(time);
        oscillator.stop(time + duration);
      };

      if (type === 'complete') {
        // Ascending chime (C5 -> E5 -> G5)
        playBeep(523.25, audioCtx.currentTime, 0.15, 'triangle');
        playBeep(659.25, audioCtx.currentTime + 0.15, 0.15, 'triangle');
        playBeep(783.99, audioCtx.currentTime + 0.3, 0.4, 'sine');
      } else if (type === 'click') {
        playBeep(800, audioCtx.currentTime, 0.05, 'sine');
      }
    } catch (e) {
      console.log('Audio Context error:', e);
    }
  };

  // Timer complete logic
  const handleTimerComplete = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    playSound('complete');

    const minutesCompleted = Math.round(timerState.duration / 60);

    if (timerState.mode === 'focus') {
      // Trigger Notification
      if (Notification.permission === 'granted') {
        new Notification('집중 완료! 🍅', {
          body: `${minutesCompleted}분 동안의 집중이 무사히 완료되었습니다. 수고하셨습니다!`,
          icon: mushroomImg
        });
      }

      // Format current HH:mm
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0].substring(0, 5); // "HH:mm"

      // Automatically log custom Pomodoro to local storage
      storage.addCustomPomodoroWithMinutes(selectedDate, timeStr, minutesCompleted);
      refreshData();
      
      // Update UI and trigger XP refresh
      window.dispatchEvent(new CustomEvent('xp-updated'));

      // Switch mode to break
      const breakDuration = (customBreak ? parseInt(customBreak, 10) : breakPreset) * 60;
      const nextState = {
        isRunning: false,
        isPaused: false,
        endTime: 0,
        duration: breakDuration,
        timeLeft: breakDuration,
        mode: 'break'
      };
      setTimerState(nextState);
      localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
      alert(`${minutesCompleted}분 집중 완료! 기록에 반영되었습니다. 휴식 시간으로 전환합니다.`);
    } else {
      // Break mode complete
      if (Notification.permission === 'granted') {
        new Notification('휴식 종료! 🍀', {
          body: '휴식 시간이 끝났습니다. 다시 모험을 시작할 시간입니다!',
          icon: mushroomImg
        });
      }

      const focusDuration = (customFocus ? parseInt(customFocus, 10) : focusPreset) * 60;
      const nextState = {
        isRunning: false,
        isPaused: false,
        endTime: 0,
        duration: focusDuration,
        timeLeft: focusDuration,
        mode: 'focus'
      };
      setTimerState(nextState);
      localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
      alert('휴식이 끝났습니다! 다시 집중 모드로 전환됩니다.');
    }
  };

  // Timer Controls
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
    const defaultMins = timerState.mode === 'focus' 
      ? (customFocus ? parseInt(customFocus, 10) : focusPreset)
      : (customBreak ? parseInt(customBreak, 10) : breakPreset);
    
    const duration = defaultMins * 60;
    const nextState = {
      ...timerState,
      isRunning: false,
      isPaused: false,
      duration,
      timeLeft: duration,
      endTime: 0
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
  };

  // Set Timer Configuration (only allowed when timer not running)
  const applySettings = (type, value) => {
    if (timerState.isRunning || timerState.isPaused) return;

    if (type === 'focus') {
      const secs = value * 60;
      setTimerState(prev => {
        const next = { ...prev, duration: secs, timeLeft: secs, mode: 'focus' };
        localStorage.setItem('human_os_timer_state_v1', JSON.stringify(next));
        return next;
      });
    } else {
      const secs = value * 60;
      setTimerState(prev => {
        const next = { ...prev, duration: secs, timeLeft: secs, mode: 'break' };
        localStorage.setItem('human_os_timer_state_v1', JSON.stringify(next));
        return next;
      });
    }
  };

  // Manual Entry Handlers
  const handleAddPomodoro = () => {
    storage.addPomodoroByDate(selectedDate);
    refreshData();
    window.dispatchEvent(new CustomEvent('xp-updated'));
    playSound('click');
  };

  const handleDelete = (index) => {
    storage.removePomodoro(selectedDate, index);
    refreshData();
    window.dispatchEvent(new CustomEvent('xp-updated'));
    playSound('click');
  };

  const handleAddCustom = () => {
    if (!customTime) return;
    storage.addCustomPomodoro(selectedDate, customTime);
    refreshData();
    window.dispatchEvent(new CustomEvent('xp-updated'));
    setCustomTime('');
    playSound('click');
  };

  // Format Helper: Seconds to MM:SS
  const formatSecs = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format Helper: Total Focus Minutes to H시간 M분
  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}시간 ${m > 0 ? m + '분' : ''}`;
    return `${m}분`;
  };

  const dayNames = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '3px solid #ef4444', justifyContent: 'space-between', padding: '1.25rem' }}>
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
          <img src={mushroomImg} alt="Mushroom" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #ef4444' }} />
          뽀모도로 공부 사냥터
        </h2>
        
        {/* Tab Buttons */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '6px' }}>
          <button 
            onClick={() => setActiveTab('timer')}
            style={{ border: 'none', background: activeTab === 'timer' ? '#ef4444' : 'transparent', color: activeTab === 'timer' ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
          >
            ⏱️ 타이머
          </button>
          <button 
            onClick={() => setActiveTab('manual')}
            style={{ border: 'none', background: activeTab === 'manual' ? '#ef4444' : 'transparent', color: activeTab === 'manual' ? 'white' : 'var(--text-muted)', fontSize: '0.8rem', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
          >
            ✍️ 수동 사냥터
          </button>
        </div>
      </div>

      {/* Main Core Window */}
      {activeTab === 'timer' ? (
        // --- REAL TIME TIMER INTERFACE ---
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(239, 68, 68, 0.02)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
          
          {/* Notification Alert Status */}
          {notifPermission !== 'granted' && (
            <button 
              onClick={requestNotificationPermission}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%', padding: '0.4rem', border: '1px dashed #ef4444', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}
            >
              <Bell size={14} /> 태블릿 백그라운드 알림 허용하기
            </button>
          )}

          {/* Time Display and Mode indicator */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0.5rem 0' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: timerState.mode === 'focus' ? '#ef4444' : '#10b981', background: timerState.mode === 'focus' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', padding: '0.2rem 0.8rem', borderRadius: '1rem', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
              {timerState.mode === 'focus' ? '🔥 FOCUS TIME' : '🍀 BREAK TIME'}
            </span>
            <div style={{ fontSize: '4rem', fontWeight: '800', fontFamily: 'monospace', color: 'var(--text-primary)', lineHeight: 1 }}>
              {formatSecs(timerState.timeLeft)}
            </div>
          </div>

          {/* Preset / Config Grid (only clickable when timer stopped) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: (timerState.isRunning || timerState.isPaused) ? 0.4 : 1, transition: 'opacity 0.2s' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>집중:</span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {[25, 50].map(mins => (
                  <button 
                    key={mins}
                    disabled={timerState.isRunning || timerState.isPaused}
                    onClick={() => { setFocusPreset(mins); setCustomFocus(''); applySettings('focus', mins); }}
                    style={{ border: '1px solid rgba(255,255,255,0.1)', background: (focusPreset === mins && !customFocus) ? '#ef4444' : 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    {mins}분
                  </button>
                ))}
                <input 
                  type="number"
                  disabled={timerState.isRunning || timerState.isPaused}
                  placeholder="직접"
                  value={customFocus}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setCustomFocus(e.target.value);
                    if (val > 0) applySettings('focus', val);
                  }}
                  style={{ width: '45px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.75rem', padding: '0.2rem', borderRadius: '4px', textAlign: 'center' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: (timerState.isRunning || timerState.isPaused) ? 0.4 : 1, transition: 'opacity 0.2s' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>휴식:</span>
              <div style={{ display: 'flex', gap: '0.3rem' }}>
                {[5, 10].map(mins => (
                  <button 
                    key={mins}
                    disabled={timerState.isRunning || timerState.isPaused}
                    onClick={() => { setBreakPreset(mins); setCustomBreak(''); applySettings('break', mins); }}
                    style={{ border: '1px solid rgba(255,255,255,0.1)', background: (breakPreset === mins && !customBreak) ? '#10b981' : 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    {mins}분
                  </button>
                ))}
                <input 
                  type="number"
                  disabled={timerState.isRunning || timerState.isPaused}
                  placeholder="직접"
                  value={customBreak}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setCustomBreak(e.target.value);
                    if (val > 0) applySettings('break', val);
                  }}
                  style={{ width: '45px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: '0.75rem', padding: '0.2rem', borderRadius: '4px', textAlign: 'center' }}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            {!timerState.isRunning ? (
              <button 
                onClick={startTimer}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: '#ef4444', border: 'none', color: 'white', padding: '0.6rem 0', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', cursor: 'pointer' }}
              >
                <Play size={16} /> 시작
              </button>
            ) : (
              <button 
                onClick={pauseTimer}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: '#eab308', border: 'none', color: 'white', padding: '0.6rem 0', borderRadius: 'var(--radius-sm)', fontWeight: 'bold', cursor: 'pointer' }}
              >
                <Pause size={16} /> 일시정지
              </button>
            )}
            <button 
              onClick={resetTimer}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '50px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
              title="리셋"
            >
              <RotateCcw size={16} />
            </button>
          </div>

        </div>
      ) : (
        // --- MANUAL HUNTING GROUND INTERFACE ---
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', background: 'rgba(239, 68, 68, 0.03)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
          
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              {selectedDate === new Date().toISOString().split('T')[0] ? '오늘' : '선택일'} 수동 기록 집중 시간
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '800', color: '#ef4444', lineHeight: 1.2 }}>
              {formatTime(todayData.totalMinutes)}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontWeight: '500' }}>
              🍅 {todayData.count} 뽀모도로 완료
            </div>
          </div>

          <button 
            onClick={handleAddPomodoro}
            className="btn"
            style={{ 
              backgroundColor: '#ef4444', 
              color: 'white', 
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1.25rem',
              borderRadius: '2rem',
              fontSize: '0.95rem',
              fontWeight: 'bold',
              width: '100%',
              maxWidth: '180px',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
              cursor: 'pointer'
            }}
          >
            <Plus size={18} />
            25분 추가하기
          </button>
        </div>
      )}

      {/* Bottom Timeline History & Weekly Distribution */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.8rem' }}>
        
        {/* Timeline Log List */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 'bold' }}>
            <Clock size={14} /> {selectedDate === new Date().toISOString().split('T')[0] ? '오늘' : '선택일'} 상세 공부 타임라인
          </div>
          
          <div style={{ maxHeight: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingRight: '0.25rem' }}>
            {todayData.timestamps && todayData.timestamps.length > 0 ? todayData.timestamps.map((ts, idx) => {
              const dateObj = new Date(ts);
              const timeString = dateObj.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '0.35rem 0.75rem', borderRadius: '4px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{timeString} (25분 집중완료)</span>
                  <button 
                    onClick={() => handleDelete(idx)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            }) : (
              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.75rem 0' }}>
                공부 기록이 없습니다. 집중을 시작해 보세요!
              </div>
            )}
          </div>
          
          {/* Custom Time Add Form */}
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
            <input 
              type="time" 
              value={customTime}
              onChange={(e) => setCustomTime(e.target.value)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', borderRadius: '4px', padding: '0.4rem', fontSize: '0.8rem' }}
            />
            <button 
              onClick={handleAddCustom}
              style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '0 0.8rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}
            >
              기록 추가
            </button>
          </div>
        </div>

        {/* Weekly Bar Chart */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <CalendarDays size={12} /> 이번 주 주간 통계
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
              총 <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{formatTime(weeklyData.weeklyMinutes)}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '65px', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
            {weeklyData.weekData.map((day, idx) => {
              const maxMinutes = Math.max(...weeklyData.weekData.map(d => d.totalMinutes), 120); 
              const heightPct = Math.min((day.totalMinutes / maxMinutes) * 100, 100);
              
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', flex: 1 }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{day.count > 0 ? `${day.count}` : ''}</div>
                  <div style={{ 
                    width: '100%', 
                    maxWidth: '16px', 
                    height: `${heightPct}%`, 
                    minHeight: day.totalMinutes > 0 ? '4px' : '0',
                    background: day.date === new Date().toISOString().split('T')[0] ? '#ef4444' : 'rgba(239, 68, 68, 0.35)',
                    borderRadius: '2px 2px 0 0',
                    transition: 'height 0.3s ease'
                  }} />
                  <div style={{ fontSize: '0.7rem', color: day.date === new Date().toISOString().split('T')[0] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
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
