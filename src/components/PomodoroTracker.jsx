import { useState, useEffect, useRef } from 'react';
import { Plus, CalendarDays, Trash2, Clock, Play, Pause, RotateCcw, Bell, Check, BookOpen, Target, X, UtensilsCrossed, Headphones } from 'lucide-react';
import { storage, getSubjectColor } from '../utils/storage';
import mushroomImg from '../assets/mushroom.png';
import bell2Sound from '../assets/bell2.mp3';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import SubjectModal from './SubjectModal';
import confetti from 'canvas-confetti';

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
  // Timer Mode: 'lecture' (🎧 강의 수강) | 'review' (📖 복습·자습) | 'meal' (🍱 식사 시간)
  const [activeTimerMode, setActiveTimerMode] = useState(() => {
    const saved = localStorage.getItem('human_os_timer_mode_v1');
    if (saved === 'lecture' || saved === 'meal') return saved;
    return 'review'; // default to review (covers legacy 'study' as well)
  });

  // Separate duration presets for Lecture vs Review
  const [lectureDuration, setLectureDuration] = useState(() => {
    const saved = localStorage.getItem('human_os_lecture_duration_v1');
    if (!saved || saved === '60') return 30; // 30 min default for lectures
    return parseInt(saved, 10);
  });

  const [reviewDuration, setReviewDuration] = useState(() => {
    const saved = localStorage.getItem('human_os_review_duration_v1');
    return saved ? parseInt(saved, 10) : 30; // 30 min default for review
  });

  // Manual input activity type
  const [manualActivityType, setManualActivityType] = useState('review');

  // Meal StopWatch State (시간이 차오르는 스톱워치 형태)
  const [mealTimerState, setMealTimerState] = useState(() => {
    try {
      const saved = localStorage.getItem('human_os_meal_timer_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.isRunning && parsed.startTimeMs) {
          const elapsed = Math.max(0, Math.floor((Date.now() - parsed.startTimeMs) / 1000));
          return { ...parsed, elapsedSeconds: elapsed };
        }
        return parsed;
      }
    } catch (e) {}
    return { isRunning: false, startTimeMs: null, startTimeStr: null, elapsedSeconds: 0 };
  });

  const [todayMeals, setTodayMeals] = useState(() => storage.getMealsByDate(selectedDate));

  useEffect(() => {
    setTodayMeals(storage.getMealsByDate(selectedDate));
    const handleMeals = () => setTodayMeals(storage.getMealsByDate(selectedDate));
    window.addEventListener('meals-updated', handleMeals);
    return () => window.removeEventListener('meals-updated', handleMeals);
  }, [selectedDate]);

  // Meal Timer ticker
  useEffect(() => {
    let interval = null;
    if (mealTimerState.isRunning && mealTimerState.startTimeMs) {
      interval = setInterval(() => {
        const elapsed = Math.max(0, Math.floor((Date.now() - mealTimerState.startTimeMs) / 1000));
        setMealTimerState(prev => {
          const next = { ...prev, elapsedSeconds: elapsed };
          localStorage.setItem('human_os_meal_timer_v1', JSON.stringify(next));
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mealTimerState.isRunning, mealTimerState.startTimeMs]);

  // Manual input states
  const [todayData, setTodayData] = useState({ count: 0, totalMinutes: 0, timestamps: [] });
  const [weeklyData, setWeeklyData] = useState({ weeklyCount: 0, weeklyMinutes: 0, weekData: [] });
  const [customTime, setCustomTime] = useState('');
  const [customMinutes, setCustomMinutes] = useState('30');
  const selectedDuration = activeTimerMode === 'lecture' ? lectureDuration : reviewDuration;
  const [customDuration, setCustomDuration] = useState('');
  const [showManualForm, setShowManualForm] = useState(false);
  const [subjects, setSubjects] = useState(() => storage.getSubjects());
  const [selectedSubject, setSelectedSubject] = useState(() => {
    try {
      const saved = localStorage.getItem('human_os_selected_subject_v1');
      const list = storage.getSubjects();
      if (saved && list.includes(saved)) return saved;
      return list[0] || '';
    } catch (e) {
      return storage.getSubjects()[0] || '';
    }
  });
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [showSubjectConfirmModal, setShowSubjectConfirmModal] = useState(false);
  const selectedSubjectRef = useRef(selectedSubject);

  const handleSelectSubject = (sub) => {
    if (!sub) return;
    setSelectedSubject(sub);
    selectedSubjectRef.current = sub;
    try {
      localStorage.setItem('human_os_selected_subject_v1', sub);
    } catch (e) {}
  };

  useEffect(() => {
    selectedSubjectRef.current = selectedSubject;
    try {
      if (selectedSubject) {
        localStorage.setItem('human_os_selected_subject_v1', selectedSubject);
      }
    } catch (e) {}
  }, [selectedSubject]);

  useEffect(() => {
    const handleSubjectsUpdated = () => {
      const list = storage.getSubjects();
      setSubjects(list);
      try {
        const savedSub = localStorage.getItem('human_os_selected_subject_v1');
        if (savedSub && list.includes(savedSub)) {
          setSelectedSubject(savedSub);
          selectedSubjectRef.current = savedSub;
        } else if (!list.includes(selectedSubjectRef.current)) {
          const nextSub = list[0] || '';
          setSelectedSubject(nextSub);
          selectedSubjectRef.current = nextSub;
          if (nextSub) localStorage.setItem('human_os_selected_subject_v1', nextSub);
        }
      } catch (e) {}
    };
    window.addEventListener('subjects-updated', handleSubjectsUpdated);
    return () => window.removeEventListener('subjects-updated', handleSubjectsUpdated);
  }, []);

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
      try {
        const parsed = JSON.parse(saved);
        if (parsed.currentSubject) {
          selectedSubjectRef.current = parsed.currentSubject;
        }
        if (parsed.mode === 'break') {
          parsed.mode = 'focus';
          parsed.duration = 1800;
          parsed.timeLeft = 1800;
          parsed.isRunning = false;
          parsed.isPaused = false;
        }
        // Migrate legacy 25m or 50m when idle
        if (!parsed.isRunning && !parsed.isPaused) {
          if (parsed.duration === 1500 || !parsed.duration) {
            parsed.duration = 1800;
            parsed.timeLeft = 1800;
          } else if (parsed.duration === 3000) {
            parsed.duration = 3600;
            parsed.timeLeft = 3600;
          }
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
        if (!parsed.isRunning && !parsed.isPaused) {
          if (parsed.currentActivityType === 'lecture' && (parsed.duration === 3600 || !parsed.duration)) {
            return {
              ...parsed,
              duration: 1800,
              timeLeft: 1800
            };
          }
        }
        return parsed;
      } catch (e) {}
    }
    return {
      isRunning: false,
      isPaused: false,
      endTime: 0,
      duration: (activeTimerMode === 'lecture' ? lectureDuration : reviewDuration) * 60,
      timeLeft: (activeTimerMode === 'lecture' ? lectureDuration : reviewDuration) * 60,
      currentActivityType: activeTimerMode === 'lecture' ? 'lecture' : 'review'
    };
  });

  const handleSwitchMode = (mode) => {
    if (mode === activeTimerMode) return;

    if (mode === 'meal') {
      if (timerState.isRunning) {
        alert("공부 타이머가 진행 중입니다. 먼저 일시정지하거나 완료해주세요.");
        return;
      }
      setActiveTimerMode('meal');
      try { localStorage.setItem('human_os_timer_mode_v1', 'meal'); } catch(e) {}
      return;
    }

    // Switching between 'lecture' and 'review'
    if (timerState.isRunning || timerState.isPaused) {
      const currentModeLabel = (timerState.currentActivityType === 'lecture' || activeTimerMode === 'lecture') ? '🎧 강의 수강' : '📖 복습·자습';
      const targetModeLabel = mode === 'lecture' ? '🎧 강의 수강' : '📖 복습·자습';
      
      const confirmChange = window.confirm(`현재 ${currentModeLabel} 타이머가 진행 중입니다.\n진행 중인 세션 유형을 [${targetModeLabel}]으로 변경하시겠습니까?`);
      if (confirmChange) {
        const nextState = {
          ...timerState,
          currentActivityType: mode
        };
        setTimerState(nextState);
        localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
        setActiveTimerMode(mode);
        try { localStorage.setItem('human_os_timer_mode_v1', mode); } catch(e) {}
      }
      return;
    }

    // If timer is idle: seamlessly switch mode & set to that mode's saved duration
    setActiveTimerMode(mode);
    try { localStorage.setItem('human_os_timer_mode_v1', mode); } catch(e) {}

    const targetDurationMins = mode === 'lecture' ? lectureDuration : reviewDuration;
    const secs = targetDurationMins * 60;
    const nextState = {
      isRunning: false,
      isPaused: false,
      duration: secs,
      timeLeft: secs,
      endTime: 0,
      currentSubject: selectedSubjectRef.current || timerState.currentSubject,
      currentActivityType: mode
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
    setCustomDuration('');
  };

  const [notifPermission, setNotifPermission] = useState('default');

  // Handle pending auto-log when timer completed in background/while app was closed
  useEffect(() => {
    if (timerState.pendingAutoLog) {
      const targetEndTimeMs = timerState.autoLogEndTime || Date.now();
      const endObj = new Date(targetEndTimeMs);
      const actualToday = new Date(endObj.getTime() - (endObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const endTimeStr = endObj.toTimeString().split(' ')[0].substring(0, 5);
      const mins = timerState.autoLogMins || 30;

      const startObj = new Date(targetEndTimeMs - mins * 60 * 1000);
      const startTimeStr = startObj.toTimeString().split(' ')[0].substring(0, 5);

      const subjectToLog = timerState.currentSubject || selectedSubjectRef.current || localStorage.getItem('human_os_selected_subject_v1') || (storage.getSubjects()[0] || null);
      const activityTypeToLog = timerState.currentActivityType || (activeTimerMode === 'lecture' ? 'lecture' : 'review');

      storage.addCustomPomodoroWithMinutes(actualToday, endTimeStr, mins, startTimeStr, subjectToLog, activityTypeToLog);
      refreshData();
      window.dispatchEvent(new CustomEvent('xp-updated'));
      if (onUpdate) onUpdate();

      const nextDuration = timerState.duration || 1800;
      const nextState = {
        isRunning: false,
        isPaused: false,
        endTime: 0,
        duration: nextDuration,
        timeLeft: nextDuration,
        currentSubject: subjectToLog,
        currentActivityType: activityTypeToLog
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

    const subjectToLog = timerState.currentSubject || selectedSubjectRef.current || localStorage.getItem('human_os_selected_subject_v1') || (storage.getSubjects()[0] || null);
    const activityTypeToLog = timerState.currentActivityType || (activeTimerMode === 'lecture' ? 'lecture' : 'review');

    storage.addCustomPomodoroWithMinutes(actualToday, endTimeStr, minutesCompleted, startTimeStr, subjectToLog, activityTypeToLog);
    refreshData();
    window.dispatchEvent(new CustomEvent('xp-updated'));
    if (onUpdate) onUpdate();

    // Reset back to selected study time
    const curDuration = activeTimerMode === 'lecture' ? lectureDuration : reviewDuration;
    const nextDuration = (customDuration ? parseInt(customDuration, 10) : curDuration) * 60;
    const nextState = {
      isRunning: false,
      isPaused: false,
      endTime: 0,
      duration: nextDuration,
      timeLeft: nextDuration,
      currentSubject: subjectToLog,
      currentActivityType: activityTypeToLog
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
  };

  const handleStartButtonClick = () => {
    if (timerState.isRunning) return;
    if (timerState.isPaused) {
      // Resuming existing paused session
      executeStartTimer();
    } else {
      // Starting new session: prompt for subject confirmation/selection
      setShowSubjectConfirmModal(true);
    }
  };

  const executeStartTimer = async (chosenSubject = null) => {
    if (timerState.isRunning) return;
    const targetSubject = chosenSubject || timerState.currentSubject || selectedSubjectRef.current || selectedSubject || (storage.getSubjects()[0] || '');
    handleSelectSubject(targetSubject);
    setShowSubjectConfirmModal(false);
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
                  body: `🎉 [${targetSubject || '공부'}] ${minutesLeft}분 집중 완료! 기록이 안전하게 저장되었습니다.`,
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

    const targetActivityType = (activeTimerMode === 'lecture') ? 'lecture' : 'review';
    const nextState = {
      ...timerState,
      isRunning: true,
      isPaused: false,
      endTime,
      currentSubject: targetSubject,
      currentActivityType: targetActivityType
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
      isPaused: true,
      currentSubject: timerState.currentSubject || selectedSubjectRef.current
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

    const subjectToLog = timerState.currentSubject || selectedSubjectRef.current || localStorage.getItem('human_os_selected_subject_v1') || (storage.getSubjects()[0] || null);
    const activityTypeToLog = timerState.currentActivityType || (activeTimerMode === 'lecture' ? 'lecture' : 'review');

    storage.addCustomPomodoroWithMinutes(actualToday, endTimeStr, minutesCompleted, startTimeStr, subjectToLog, activityTypeToLog);
    refreshData();
    window.dispatchEvent(new CustomEvent('xp-updated'));
    if (onUpdate) onUpdate();

    const curDuration = activeTimerMode === 'lecture' ? lectureDuration : reviewDuration;
    const nextDuration = (customDuration ? parseInt(customDuration, 10) : curDuration) * 60;
    const nextState = {
      isRunning: false,
      isPaused: false,
      endTime: 0,
      duration: nextDuration,
      timeLeft: nextDuration,
      currentSubject: subjectToLog,
      currentActivityType: activityTypeToLog
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
  };

  const resetTimer = () => {
    isCompletingRef.current = false;
    playSound('click');
    const curDuration = activeTimerMode === 'lecture' ? lectureDuration : reviewDuration;
    const targetMins = customDuration ? parseInt(customDuration, 10) : curDuration;
    const secs = targetMins * 60;
    const nextState = {
      isRunning: false,
      isPaused: false,
      duration: secs,
      timeLeft: secs,
      endTime: 0,
      currentSubject: selectedSubjectRef.current || timerState.currentSubject,
      currentActivityType: activeTimerMode === 'lecture' ? 'lecture' : 'review'
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
  };

  const applyDuration = (mins) => {
    if (timerState.isRunning || timerState.isPaused) return;
    const secs = mins * 60;
    if (activeTimerMode === 'lecture') {
      setLectureDuration(mins);
      try { localStorage.setItem('human_os_lecture_duration_v1', mins.toString()); } catch(e) {}
    } else {
      setReviewDuration(mins);
      try { localStorage.setItem('human_os_review_duration_v1', mins.toString()); } catch(e) {}
    }
    const nextState = {
      isRunning: false,
      isPaused: false,
      duration: secs,
      timeLeft: secs,
      endTime: 0,
      currentSubject: selectedSubjectRef.current || timerState.currentSubject,
      currentActivityType: activeTimerMode === 'lecture' ? 'lecture' : 'review'
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

    const subjectToLog = selectedSubject || selectedSubjectRef.current || localStorage.getItem('human_os_selected_subject_v1') || (storage.getSubjects()[0] || null);

    storage.addCustomPomodoroWithMinutes(selectedDate, endTimeStr, mins, customTime, subjectToLog, manualActivityType);
    refreshData();
    window.dispatchEvent(new CustomEvent('xp-updated'));
    if (onUpdate) onUpdate();
    setCustomTime('');
    const subLabel = subjectToLog ? `[${subjectToLog}] ` : '';
    const typeLabel = manualActivityType === 'lecture' ? '🎧 강의' : '📖 복습';
    alert(`⏱️ ${selectedDate} ${subLabel}${typeLabel} [${format12H(customTime)} ~ ${format12H(endTimeStr)}] (${mins}분) 공부 기록이 추가되었습니다!`);
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
    const subject = typeof ts === 'object' && ts.subject ? ts.subject : null;
    const activityType = typeof ts === 'object' && ts.activityType ? ts.activityType : 'review';

    if (typeof ts === 'object' && ts.startTime && ts.endTime) {
      return {
        startTime: ts.startTime,
        endTime: ts.endTime,
        minutes: minutesVal,
        subject,
        activityType
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
      minutes: minutesVal,
      subject,
      activityType
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

  const formatMealTimeDisplay = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartMeal = () => {
    const now = new Date();
    const startTimeStr = now.toTimeString().split(' ')[0].substring(0, 5);
    const newState = {
      isRunning: true,
      startTimeMs: Date.now(),
      startTimeStr,
      elapsedSeconds: 0
    };
    setMealTimerState(newState);
    localStorage.setItem('human_os_meal_timer_v1', JSON.stringify(newState));
    playSound('click');
  };

  const handleStopMeal = () => {
    if (!mealTimerState.isRunning) return;
    const elapsedSec = mealTimerState.elapsedSeconds;
    const mins = Math.max(1, Math.round(elapsedSec / 60));

    const now = new Date();
    const endTimeStr = now.toTimeString().split(' ')[0].substring(0, 5);
    const startTimeStr = mealTimerState.startTimeStr || new Date(mealTimerState.startTimeMs || (now.getTime() - mins * 60 * 1000)).toTimeString().split(' ')[0].substring(0, 5);
    const actualToday = getTodayStr();

    storage.addMeal(actualToday, startTimeStr, endTimeStr, mins);
    playSound('complete');

    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#fb923c', '#f59e0b', '#34d399']
    });

    const resetState = {
      isRunning: false,
      startTimeMs: null,
      startTimeStr: null,
      elapsedSeconds: 0
    };
    setMealTimerState(resetState);
    localStorage.removeItem('human_os_meal_timer_v1');
    refreshData();
    if (onUpdate) onUpdate();
  };

  const handleResetMeal = () => {
    if (mealTimerState.isRunning && !window.confirm("식사 타이머를 기록하지 않고 초기화하시겠습니까?")) {
      return;
    }
    const resetState = {
      isRunning: false,
      startTimeMs: null,
      startTimeStr: null,
      elapsedSeconds: 0
    };
    setMealTimerState(resetState);
    localStorage.removeItem('human_os_meal_timer_v1');
  };

  const handleDeleteMeal = (mealId) => {
    if (window.confirm("이 식사 기록을 삭제하시겠습니까?")) {
      storage.removeMeal(selectedDate, mealId);
      refreshData();
      if (onUpdate) onUpdate();
    }
  };

  const activeMinutes = customDuration ? parseInt(customDuration, 10) : selectedDuration;

  const todayLectureMins = (todayData.timestamps || []).reduce((s, ts) => (ts.activityType === 'lecture' ? s + (ts.minutes || 25) : s), 0);
  const todayReviewMins = (todayData.timestamps || []).reduce((s, ts) => (ts.activityType !== 'lecture' ? s + (ts.minutes || 25) : s), 0);
  const todayMealMins = (todayMeals || []).reduce((s, m) => s + (m.minutes || 0), 0);

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--text-primary)' }}>
          <span>🎯</span> 공부 사냥터
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#818cf8', background: 'rgba(99, 102, 241, 0.15)', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
            🎧 강의 {Math.floor(todayLectureMins / 60)}h {todayLectureMins % 60}m
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
            📖 복습 {Math.floor(todayReviewMins / 60)}h {todayReviewMins % 60}m
          </div>
          {todayMealMins > 0 && (
            <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#fb923c', background: 'rgba(251, 146, 60, 0.15)', padding: '0.2rem 0.55rem', borderRadius: '6px' }}>
              🍱 식사 {todayMealMins}m
            </div>
          )}
        </div>
      </div>

      {/* Notification Banner (Simplified) */}
      {notifPermission !== 'granted' && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.09)', border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '8px', padding: '0.45rem 0.75rem', marginBottom: '0.85rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem'
        }}>
          <div style={{ fontSize: '0.78rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Bell size={14} color="#fbbf24" />
            <span>완료 시 알림 팝업 받기</span>
          </div>
          <button
            onClick={requestNotificationPermission}
            className="btn btn-secondary"
            style={{ padding: '0.2rem 0.55rem', fontSize: '0.72rem', background: '#f59e0b', color: '#000', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            알림 허용
          </button>
        </div>
      )}

      {/* Mode Selector: [🎧 강의 수강] vs [📖 복습·자습] vs [🍱 식사 시간] */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem' }}>
        <div style={{
          display: 'inline-flex',
          background: 'rgba(0,0,0,0.45)',
          padding: '0.25rem',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.08)',
          gap: '0.25rem'
        }}>
          <button
            type="button"
            onClick={() => handleSwitchMode('lecture')}
            style={{
              padding: '0.35rem 0.95rem',
              borderRadius: '20px',
              border: 'none',
              background: activeTimerMode === 'lecture' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
              color: activeTimerMode === 'lecture' ? '#a5b4fc' : 'var(--text-muted)',
              fontWeight: 'bold',
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s',
              boxShadow: activeTimerMode === 'lecture' ? '0 0 10px rgba(99, 102, 241, 0.25)' : 'none'
            }}
          >
            <Headphones size={13} color={activeTimerMode === 'lecture' ? '#a5b4fc' : 'var(--text-muted)'} /> 강의 수강
            {(timerState.isRunning && (timerState.currentActivityType === 'lecture' || activeTimerMode === 'lecture')) && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#818cf8', display: 'inline-block' }} />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('review')}
            style={{
              padding: '0.35rem 0.95rem',
              borderRadius: '20px',
              border: 'none',
              background: activeTimerMode === 'review' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
              color: activeTimerMode === 'review' ? '#34d399' : 'var(--text-muted)',
              fontWeight: 'bold',
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s',
              boxShadow: activeTimerMode === 'review' ? '0 0 10px rgba(16, 185, 129, 0.2)' : 'none'
            }}
          >
            <BookOpen size={13} color={activeTimerMode === 'review' ? '#34d399' : 'var(--text-muted)'} /> 복습·자습
            {(timerState.isRunning && (timerState.currentActivityType === 'review' || (!timerState.currentActivityType && activeTimerMode === 'review'))) && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('meal')}
            style={{
              padding: '0.35rem 0.95rem',
              borderRadius: '20px',
              border: 'none',
              background: activeTimerMode === 'meal' ? 'rgba(249, 115, 22, 0.25)' : 'transparent',
              color: activeTimerMode === 'meal' ? '#fb923c' : 'var(--text-muted)',
              fontWeight: 'bold',
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s',
              boxShadow: activeTimerMode === 'meal' ? '0 0 10px rgba(249, 115, 22, 0.2)' : 'none'
            }}
          >
            <UtensilsCrossed size={13} color={activeTimerMode === 'meal' ? '#fb923c' : 'var(--text-muted)'} /> 식사 시간
            {mealTimerState.isRunning && (
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fb923c', display: 'inline-block' }} />
            )}
          </button>
        </div>
      </div>

      {/* Main Timer Display */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        borderRadius: 'var(--radius-sm)',
        padding: '1.25rem 1rem',
        textAlign: 'center',
        marginBottom: '1.25rem',
        border: activeTimerMode === 'meal'
          ? '1px solid rgba(249, 115, 22, 0.25)'
          : (activeTimerMode === 'lecture' ? '1px solid rgba(129, 140, 248, 0.3)' : '1px solid rgba(16, 185, 129, 0.25)')
      }}>
        {activeTimerMode !== 'meal' ? (
          <>
            {/* Subject Indicator / Selection Chips */}
            {timerState.isRunning || timerState.isPaused ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(15, 23, 42, 0.85)',
                border: `1.5px solid ${getSubjectColor(timerState.currentSubject || selectedSubject, subjects)}`,
                padding: '0.35rem 0.95rem',
                borderRadius: '20px',
                marginBottom: '1rem',
                boxShadow: `0 0 15px ${getSubjectColor(timerState.currentSubject || selectedSubject, subjects)}30`
              }}>
                <span style={{
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  background: getSubjectColor(timerState.currentSubject || selectedSubject, subjects),
                  display: 'inline-block',
                  boxShadow: `0 0 8px ${getSubjectColor(timerState.currentSubject || selectedSubject, subjects)}`
                }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff' }}>
                  {activeTimerMode === 'lecture' ? '🎧 강의' : '📖 복습'} 과목: <span style={{ color: getSubjectColor(timerState.currentSubject || selectedSubject, subjects) }}>{(timerState.currentSubject || selectedSubject) || '미지정'}</span>
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <BookOpen size={12} /> 과목:
                </span>
                {subjects.map(s => {
                  const isSelected = selectedSubject === s;
                  const col = getSubjectColor(s, subjects);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSelectSubject(s)}
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: '12px',
                        border: isSelected ? `1px solid ${col}` : '1px solid rgba(255,255,255,0.1)',
                        background: isSelected ? `${col}25` : 'rgba(255,255,255,0.04)',
                        color: isSelected ? col : 'var(--text-secondary)',
                        fontWeight: isSelected ? 'bold' : 'normal',
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(true)}
                  style={{
                    padding: '0.15rem 0.45rem',
                    borderRadius: '10px',
                    border: '1px dashed rgba(56, 189, 248, 0.4)',
                    background: 'transparent',
                    color: '#38bdf8',
                    fontSize: '0.72rem',
                    cursor: 'pointer'
                  }}
                  title="과목 추가/관리"
                >
                  + 관리
                </button>
              </div>
            )}

            <div style={{
              fontSize: '3.8rem',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              color: 'var(--text-primary)',
              letterSpacing: '2px',
              textShadow: activeTimerMode === 'lecture' ? '0 0 20px rgba(129, 140, 248, 0.4)' : '0 0 20px rgba(16, 185, 129, 0.3)',
              lineHeight: 1
            }}>
              {formatTimeDisplay(timerState.timeLeft)}
            </div>

            {/* Preset Selector */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '1rem', marginBottom: '1.15rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {activeTimerMode === 'lecture' ? '🎧 강의 시간:' : '📖 복습 시간:'}
              </span>
              {(activeTimerMode === 'lecture' ? [25, 30, 45, 50, 60, 90] : [15, 25, 30, 45, 60]).map(mins => {
                const isSelected = selectedDuration === mins && !customDuration;
                const activeColor = activeTimerMode === 'lecture' ? '#818cf8' : 'var(--accent-primary)';
                const activeTextColor = activeTimerMode === 'lecture' ? '#fff' : '#000';
                return (
                  <button
                    key={mins}
                    onClick={() => {
                      if (timerState.isRunning || timerState.isPaused) return;
                      setCustomDuration('');
                      applyDuration(mins);
                    }}
                    disabled={timerState.isRunning || timerState.isPaused}
                    style={{
                      padding: '0.28rem 0.65rem',
                      borderRadius: '20px',
                      border: isSelected ? `1px solid ${activeColor}` : '1px solid rgba(255,255,255,0.1)',
                      background: isSelected ? activeColor : 'rgba(255,255,255,0.05)',
                      color: isSelected ? activeTextColor : 'var(--text-secondary)',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      fontSize: '0.82rem',
                      cursor: timerState.isRunning || timerState.isPaused ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {mins}분
                  </button>
                );
              })}

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
                    width: '55px',
                    padding: '0.25rem 0.45rem',
                    borderRadius: '4px',
                    border: customDuration ? (activeTimerMode === 'lecture' ? '1px solid #818cf8' : '1px solid var(--accent-primary)') : '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.4)',
                    color: '#fff',
                    fontSize: '0.82rem',
                    textAlign: 'center'
                  }}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>분</span>
              </div>
            </div>

            {/* Control Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {!timerState.isRunning ? (
                <button
                  onClick={handleStartButtonClick}
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

              <button
                onClick={() => playSound('complete')}
                className="btn btn-secondary"
                style={{ padding: '0.65rem', borderRadius: '8px', color: '#fbbf24' }}
                title="종소리 미리듣기 (테스트)"
              >
                <Bell size={18} />
              </button>
            </div>
          </>
        ) : (
          /* ========================================================= */
          /* Meal Stopwatch Mode (시간이 차오르는 스톱워치 형태) */
          /* ========================================================= */
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'rgba(249, 115, 22, 0.12)',
              border: '1px solid rgba(249, 115, 22, 0.35)',
              padding: '0.35rem 0.95rem',
              borderRadius: '20px',
              marginBottom: '0.85rem'
            }}>
              <UtensilsCrossed size={14} color="#fb923c" />
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fed7aa' }}>
                {mealTimerState.isRunning ? '🍱 식사 진행 중 (시간이 차오르는 중)' : '🍱 식사 대기 중 (스톱워치)'}
              </span>
            </div>

            <div style={{
              fontSize: '3.8rem',
              fontWeight: 'bold',
              fontFamily: 'monospace',
              color: '#fb923c',
              letterSpacing: '2px',
              textShadow: '0 0 25px rgba(249, 115, 22, 0.45)',
              lineHeight: 1,
              margin: '0.5rem 0 0.85rem 0'
            }}>
              {formatMealTimeDisplay(mealTimerState.elapsedSeconds)}
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0' }}>
              {mealTimerState.isRunning
                ? `시작: ${mealTimerState.startTimeStr} ~ 맛있게 식사하시고 완료를 눌러주세요 🍽️`
                : '식사 시작을 누르면 스톱워치가 차오르며, 멈추면 성장일지 및 JSON에 자동 기록됩니다.'}
            </p>

            {/* Meal Control Buttons */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {!mealTimerState.isRunning ? (
                <button
                  onClick={handleStartMeal}
                  className="btn btn-primary"
                  style={{
                    padding: '0.65rem 2.2rem',
                    fontSize: '1.05rem',
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    borderColor: '#ea580c',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 'bold'
                  }}
                >
                  <Play size={20} /> 식사 시작
                </button>
              ) : (
                <button
                  onClick={handleStopMeal}
                  className="btn btn-primary"
                  style={{
                    padding: '0.65rem 2rem',
                    fontSize: '1rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderColor: '#059669',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 'bold'
                  }}
                >
                  <Check size={20} /> 식사 완료 및 기록 ({Math.max(1, Math.round(mealTimerState.elapsedSeconds / 60))}분)
                </button>
              )}

              {mealTimerState.isRunning && (
                <button
                  onClick={handleResetMeal}
                  className="btn btn-secondary"
                  style={{ padding: '0.65rem', borderRadius: '8px' }}
                  title="식사 타이머 초기화"
                >
                  <RotateCcw size={18} />
                </button>
              )}
            </div>

            {/* Today's Meal Summary & Logs */}
            {todayMeals && todayMeals.length > 0 && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                    오늘 식사 기록 ({todayMeals.length}회)
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#fb923c', fontWeight: 'bold' }}>
                    총 {todayMeals.reduce((s, m) => s + (m.minutes || 0), 0)}분
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center' }}>
                  {todayMeals.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        fontSize: '0.75rem',
                        background: 'rgba(251, 146, 60, 0.12)',
                        border: '1px solid rgba(251, 146, 60, 0.3)',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        color: '#fdba74'
                      }}
                    >
                      <span>🍱 {m.startTime} ~ {m.endTime} ({m.minutes}분)</span>
                      <button
                        onClick={() => handleDeleteMeal(m.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          padding: '0 0.1rem',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="기록 삭제"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Daily Timestamped Log & Collapsible Manual Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem 1.1rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Clock size={16} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '0.92rem', color: 'var(--text-primary)', margin: 0, fontWeight: 'bold' }}>
                오늘 집중 타임라인
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', background: 'rgba(16, 185, 129, 0.12)', padding: '0.15rem 0.5rem', borderRadius: '10px', fontWeight: 'bold' }}>
                집중 {todayData.timestamps?.length || 0}회
              </span>
              {todayMeals && todayMeals.length > 0 && (
                <span style={{ fontSize: '0.72rem', color: '#fb923c', background: 'rgba(251, 146, 60, 0.12)', padding: '0.15rem 0.5rem', borderRadius: '10px', fontWeight: 'bold' }}>
                  식사 {todayMeals.length}회 ({todayMeals.reduce((s, m) => s + (m.minutes || 0), 0)}분)
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowManualForm(!showManualForm)}
              style={{
                background: showManualForm ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: showManualForm ? '#34d399' : 'var(--text-muted)',
                fontSize: '0.75rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                transition: 'all 0.15s'
              }}
            >
              <Plus size={13} /> {showManualForm ? '접기' : '수동 추가'}
            </button>
          </div>

          {/* Timestamps List */}
          <div style={{ maxHeight: '190px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '0.2rem' }}>
            {todayData.timestamps && todayData.timestamps.length > 0 ? (
              todayData.timestamps.map((ts, idx) => {
                const sessionInfo = getSessionTimeRange(ts);

                return (
                  <div key={idx} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(255,255,255,0.03)', padding: '0.45rem 0.75rem', borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.2s'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{
                        background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', fontSize: '0.7rem',
                        fontWeight: 'bold', padding: '0.1rem 0.4rem', borderRadius: '4px'
                      }}>
                        {idx + 1}회
                      </span>
                      {sessionInfo.activityType === 'lecture' ? (
                        <span style={{
                          background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', fontSize: '0.7rem',
                          fontWeight: 'bold', padding: '0.1rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(129, 140, 248, 0.35)'
                        }}>
                          🎧 강의
                        </span>
                      ) : (
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.18)', color: '#6ee7b7', fontSize: '0.7rem',
                          fontWeight: 'bold', padding: '0.1rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                          📖 복습
                        </span>
                      )}
                      {sessionInfo.subject && (
                        <span style={{
                          background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '0.7rem',
                          fontWeight: 'bold', padding: '0.1rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)'
                        }}>
                          {sessionInfo.subject}
                        </span>
                      )}
                      <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {format12H(sessionInfo.startTime)} ~ {format12H(sessionInfo.endTime)}
                      </span>
                      <span style={{
                        fontSize: '0.72rem', color: sessionInfo.activityType === 'lecture' ? '#a5b4fc' : 'var(--accent-primary)', background: sessionInfo.activityType === 'lecture' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(16, 185, 129, 0.1)',
                        padding: '0.08rem 0.4rem', borderRadius: '4px', fontWeight: 'bold'
                      }}>
                        {sessionInfo.minutes}분
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteTimestamp(idx)}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                      title="기록 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                🌱 오늘 완료된 집중 기록이 없습니다.
              </div>
            )}
          </div>

          {/* Collapsible Manual Entry Form */}
          {showManualForm && (
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', animation: 'fadeIn 0.2s ease', flexWrap: 'wrap' }}>
              {/* Activity Type Toggle for Manual Input */}
              <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.5)', padding: '0.15rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', gap: '0.2rem' }}>
                <button
                  type="button"
                  onClick={() => setManualActivityType('lecture')}
                  style={{
                    padding: '0.2rem 0.45rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: manualActivityType === 'lecture' ? 'rgba(99, 102, 241, 0.35)' : 'transparent',
                    color: manualActivityType === 'lecture' ? '#a5b4fc' : 'var(--text-muted)',
                    fontSize: '0.72rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  🎧 강의
                </button>
                <button
                  type="button"
                  onClick={() => setManualActivityType('review')}
                  style={{
                    padding: '0.2rem 0.45rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: manualActivityType === 'review' ? 'rgba(16, 185, 129, 0.35)' : 'transparent',
                    color: manualActivityType === 'review' ? '#34d399' : 'var(--text-muted)',
                    fontSize: '0.72rem',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  📖 복습
                </button>
              </div>

              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>시작:</span>
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                title="시작 시간"
                style={{
                  background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)',
                  padding: '0.25rem 0.45rem', borderRadius: '4px', fontSize: '0.78rem'
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
                  width: '45px', background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)',
                  padding: '0.25rem 0.4rem', borderRadius: '4px', fontSize: '0.78rem', textAlign: 'center'
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>분</span>
              {selectedSubject && (
                <span style={{ fontSize: '0.72rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 'bold' }}>
                  {selectedSubject}
                </span>
              )}
              <button type="submit" className="btn btn-secondary" style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399', fontWeight: 'bold' }}>
                추가
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Subject Confirmation Modal before Timer Start */}
      {showSubjectConfirmModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10002,
          padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '430px',
            width: '100%',
            background: '#0f172a',
            border: '1.5px solid #38bdf8',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 12px 35px rgba(0,0,0,0.7)',
            textAlign: 'center'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Target size={20} color="#38bdf8" /> 집중할 과목을 확인해주세요
              </h3>
              <button
                type="button"
                onClick={() => setShowSubjectConfirmModal(false)}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.85rem' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: activeTimerMode === 'lecture' ? 'rgba(99, 102, 241, 0.18)' : 'rgba(16, 185, 129, 0.18)',
                border: activeTimerMode === 'lecture' ? '1px solid rgba(129, 140, 248, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                padding: '0.3rem 0.85rem',
                borderRadius: '20px'
              }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: activeTimerMode === 'lecture' ? '#a5b4fc' : '#6ee7b7' }}>
                  {activeTimerMode === 'lecture' ? '🎧 강의 수강 세션' : '📖 복습·자습 세션'} ({activeMinutes}분)
                </span>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0', lineHeight: 1.45 }}>
              공부할 과목을 선택하면 타이머가 즉시 시작됩니다.
            </p>

            {/* Subject Selection Buttons Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem', marginBottom: '1.25rem' }}>
              {subjects.map(s => {
                const isSelected = selectedSubject === s;
                const col = getSubjectColor(s, subjects);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      handleSelectSubject(s);
                      executeStartTimer(s);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 0.9rem',
                      borderRadius: '10px',
                      border: isSelected ? `2px solid ${col}` : '1px solid rgba(255,255,255,0.1)',
                      background: isSelected ? `${col}22` : 'rgba(255,255,255,0.03)',
                      color: isSelected ? '#fff' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: isSelected ? `0 0 12px ${col}40` : 'none'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = col;
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                        e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: col, display: 'inline-block' }} />
                      <span style={{ color: isSelected ? col : 'inherit', fontWeight: isSelected ? 'bold' : 'normal' }}>{s}</span>
                    </div>
                    {isSelected ? (
                      <span style={{ fontSize: '0.72rem', color: col, fontWeight: 'bold' }}>✓ 선택됨</span>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>시작 ▶</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={() => executeStartTimer(selectedSubject)}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.45rem',
                marginBottom: '0.75rem',
                background: `linear-gradient(135deg, ${getSubjectColor(selectedSubject, subjects)}, #10b981)`,
                color: '#000',
                boxShadow: `0 4px 15px ${getSubjectColor(selectedSubject, subjects)}40`
              }}
            >
              <Play size={18} /> "{selectedSubject || '선택 과목'}" 과목으로 시작하기
            </button>

            {/* Footer link to manage subjects */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                onClick={() => {
                  setShowSubjectConfirmModal(false);
                  setShowSubjectModal(true);
                }}
                style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
              >
                + 과목 추가 / 관리
              </button>
              <button
                type="button"
                onClick={() => setShowSubjectConfirmModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subject Management Modal */}
      <SubjectModal isOpen={showSubjectModal} onClose={() => setShowSubjectModal(false)} />
    </div>
  );
}
