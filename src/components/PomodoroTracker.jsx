import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, CalendarDays, Trash2, Clock, Play, Pause, RotateCcw, Bell, Check, BookOpen, Target, X, UtensilsCrossed, Headphones, Moon, Sun, Edit2, Bookmark, CheckSquare, Square, ExternalLink, Sparkles, Zap } from 'lucide-react';
import { storage, getSubjectColor, calculateSleepDuration } from '../utils/storage';
import mushroomImg from '../assets/mushroom.png';
import bell2Sound from '../assets/bell2.mp3';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import SubjectModal from './SubjectModal';
import confetti from 'canvas-confetti';

const PomodoroNative = registerPlugin('PomodoroNative');

let globalAudioCtx = null;
let decodedBellBuffer = null;

const loadBellSound = async (audioCtx) => {
  try {
    const response = await fetch(`${bell2Sound}?v=20261119_v2`, { cache: 'no-store' });
    const arrayBuffer = await response.arrayBuffer();
    decodedBellBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.error('Failed to load/decode bell2.mp3:', e);
  }
};

const cancelNativeAlarm = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await PomodoroNative.cancel();
    } catch (e) {}
    try {
      await LocalNotifications.cancel({ notifications: [{ id: 1001 }, { id: 1002 }] });
    } catch (e) {}
  }
};

const ensurePopupChannel = async () => {
  if (!Capacitor.isNativePlatform()) return null;
  const channelId = 'pomodoro-headsup-v5';
  try {
    await LocalNotifications.createChannel({
      id: channelId,
      name: 'Pomodoro Heads-Up Alarm (뽀모도로 알람 및 헤드업 팝업)',
      description: '뽀모도로 타이머 완료 시 상단에 내려오는 상태바 헤드업 알림 및 알람',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      sound: 'bell2'
    }).catch(() => {});
    return channelId;
  } catch (e) {
    console.warn('Failed to create popup channel:', e);
    return 'pomodoro-headsup-v5';
  }
};

export default function PomodoroTracker({ selectedDate, onUpdate, onOpenSupplementary }) {
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

  const [mealMenuInput, setMealMenuInput] = useState('');
  const [editingMealId, setEditingMealId] = useState(null);
  const [editingMealMenu, setEditingMealMenu] = useState('');
  const [todayMeals, setTodayMeals] = useState(() => storage.getMealsByDate(selectedDate));
  const [dailyLog, setDailyLog] = useState(() => storage.getDailyLogByDate(selectedDate));

  useEffect(() => {
    setTodayMeals(storage.getMealsByDate(selectedDate));
    setDailyLog(storage.getDailyLogByDate(selectedDate));

    const handleMeals = () => setTodayMeals(storage.getMealsByDate(selectedDate));
    const handleDailyLogs = (e) => {
      if (!e.detail || e.detail.date === selectedDate) {
        setDailyLog(storage.getDailyLogByDate(selectedDate));
      }
    };

    window.addEventListener('meals-updated', handleMeals);
    window.addEventListener('daily-logs-updated', handleDailyLogs);
    return () => {
      window.removeEventListener('meals-updated', handleMeals);
      window.removeEventListener('daily-logs-updated', handleDailyLogs);
    };
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
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [showEarlyCompleteModal, setShowEarlyCompleteModal] = useState(false);
  const [showCircuitBreakerCompleteModal, setShowCircuitBreakerCompleteModal] = useState(false);
  const [modalBedTime, setModalBedTime] = useState('23:30');
  const [modalWakeTime, setModalWakeTime] = useState('06:30');
  const [modalBedDateType, setModalBedDateType] = useState('prev');
  const pendingTimerStartRef = useRef(false);
  const selectedSubjectRef = useRef(selectedSubject);

  // New day check on mount: prompt sleep input if not recorded and not on vacation
  useEffect(() => {
    const actualToday = getTodayStr();
    const isVac = storage.isVacationDate(actualToday);
    const todayLog = storage.getDailyLogByDate(actualToday);
    const hasSleep = !!(todayLog && todayLog.bedTime && todayLog.wakeTime);
    if (!isVac && !hasSleep) {
      if (todayLog?.bedTime) setModalBedTime(todayLog.bedTime);
      if (todayLog?.wakeTime) setModalWakeTime(todayLog.wakeTime);
      if (todayLog?.bedDateType) setModalBedDateType(todayLog.bedDateType);
      else if (todayLog?.bedTime) {
        const [bH] = todayLog.bedTime.split(':').map(Number);
        setModalBedDateType(bH >= 12 ? 'prev' : 'same');
      }
      setShowSleepModal(true);
    }
  }, []);

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

  // Supplementary Slots (막힌 문제 킵)
  const [supplementarySlots, setSupplementarySlots] = useState(() => storage.getSupplementarySlots());
  const [quickSlotTitle, setQuickSlotTitle] = useState('');
  const [showWarmupModal, setShowWarmupModal] = useState(false);

  useEffect(() => {
    const handleSlotsUpdated = () => {
      setSupplementarySlots(storage.getSupplementarySlots());
    };
    window.addEventListener('supplementary-slots-updated', handleSlotsUpdated);
    return () => window.removeEventListener('supplementary-slots-updated', handleSlotsUpdated);
  }, []);

  const handleQuickAddSlot = (e) => {
    e?.preventDefault();
    const trimmed = quickSlotTitle.trim();
    if (!trimmed) return;

    const currentSub = selectedSubject || timerState.currentSubject || selectedSubjectRef.current || localStorage.getItem('human_os_selected_subject_v1') || (storage.getSubjects()[0] || '기타');

    storage.addSupplementarySlot({
      title: trimmed,
      subject: currentSub,
      memo: ''
    });
    setQuickSlotTitle('');
  };

  const handleQuickToggleSlot = (slotId) => {
    storage.toggleSupplementarySlot(slotId);
  };

  const handleQuickDeleteSlot = (slotId) => {
    storage.removeSupplementarySlot(slotId);
  };

  const handleOpenSupplementaryModal = () => {
    if (typeof onOpenSupplementary === 'function') {
      onOpenSupplementary();
    } else {
      window.dispatchEvent(new CustomEvent('open-supplementary-modal'));
    }
  };

  const pendingSlots = useMemo(() => {
    return (supplementarySlots || []).filter(s => !s.isCompleted);
  }, [supplementarySlots]);

  const checkAndTriggerWarmupModal = () => {
    if (activeTimerMode === 'meal') return false;
    const actualToday = getTodayStr();
    let alreadyDismissed = false;
    try {
      alreadyDismissed = sessionStorage.getItem(`human_os_warmup_dismissed_${actualToday}`) === 'true';
    } catch (e) {}

    const isFirstSessionOfDay = (todayData.timestamps || []).length === 0;
    const hasManyPendingSlots = pendingSlots.length >= 5;

    if (isFirstSessionOfDay && hasManyPendingSlots && !alreadyDismissed) {
      setShowWarmupModal(true);
      return true;
    }
    return false;
  };

  const handleDismissWarmupAndProceed = () => {
    const actualToday = getTodayStr();
    try {
      sessionStorage.setItem(`human_os_warmup_dismissed_${actualToday}`, 'true');
    } catch (e) {}
    setShowWarmupModal(false);
    setShowSubjectConfirmModal(true);
  };

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
          await ensurePopupChannel();
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
          const channelId = await ensurePopupChannel();
          await LocalNotifications.schedule({
            notifications: [{
              id: 9999,
              title: '알림 활성화 완료! 🍅',
              body: '집중이 완료되면 화면 상단 알림 팝업으로 알려드립니다.',
              channelId: channelId
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
      if (now - lastBellPlayTsRef.current < 2000) {
        console.log("Prevented duplicate bell sound playback within 2.0s");
        return;
      }
      lastBellPlayTsRef.current = now;

      let played = false;
      try {
        if (!globalAudioCtx && typeof window !== 'undefined') {
          globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
          await globalAudioCtx.resume();
        }
        const audioCtx = globalAudioCtx;
        if (audioCtx) {
          if (!decodedBellBuffer) {
            await loadBellSound(audioCtx);
          }
          if (decodedBellBuffer) {
            const source = audioCtx.createBufferSource();
            source.buffer = decodedBellBuffer;
            source.connect(audioCtx.destination);
            source.start(0);
            played = true;
          }
        }
      } catch (e) {
        console.warn('WebAudio playback failed, trying HTML5 Audio fallback:', e);
      }

      if (!played) {
        try {
          const audio = new Audio(`${bell2Sound}?v=20261119_v2`);
          audio.volume = 1.0;
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(e => console.warn('HTML5 Audio fallback play error:', e));
          }
        } catch (e) {
          console.warn('Audio fallback error:', e);
        }
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

  const handleTimerComplete = async (isFromCatchUp = false) => {
    if (isCompletingRef.current) return;
    isCompletingRef.current = true;

    if (intervalRef.current) clearInterval(intervalRef.current);

    const minutesCompleted = Math.round(timerState.duration / 60);
    const subjectToLog = timerState.currentSubject || selectedSubjectRef.current || localStorage.getItem('human_os_selected_subject_v1') || (storage.getSubjects()[0] || '공부');

    // 1. Trigger Native Status Bar Heads-Up Notification (상태바 헤드업 알림 팝업)
    if (Capacitor.isNativePlatform()) {
      try {
        const channelId = await ensurePopupChannel();
        await LocalNotifications.cancel({ notifications: [{ id: 1001 }] }).catch(() => {});
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 1002,
              title: '성장의 숲 🍅 집중 완료!',
              body: `🎉 [${subjectToLog}] ${minutesCompleted}분 집중 완료! 기록이 안전하게 저장되었습니다.`,
              channelId: channelId,
              sound: 'bell2',
              vibrationPattern: [200, 100, 200, 100, 400],
              actionTypeId: 'OPEN_APP',
              extra: { route: '/' }
            }
          ]
        });
      } catch (e) {
        console.error('Failed to trigger heads-up notification:', e);
      }

      // 2. Play STREAM_ALARM Sound (음소거/무음 모드 뚫기 & 인강 오디오 덕킹)
      try {
        await PomodoroNative.playAlarmSound();
      } catch (e) {
        console.error('Failed to play native alarm sound:', e);
      }
    }

    // 3. Play In-App Sound
    if (!isFromCatchUp) {
      playSound('complete');
    }

    // 3. Trigger celebration confetti
    try {
      confetti({
        particleCount: 65,
        spread: 75,
        origin: { y: 0.3 }
      });
    } catch (e) {}

    // 4. Haptic Vibration
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
    } catch (e) {}

    // 6. Web / ServiceWorker Notification (Browser / PWA fallback only)
    if (!Capacitor.isNativePlatform() && 'Notification' in window && Notification.permission === 'granted') {
      const title = '성장의 숲 🍅 집중 완료!';
      const body = `🎉 [${subjectToLog}] ${minutesCompleted}분 집중 완료! 기록이 안전하게 저장되었습니다.`;
      const iconUrl = new URL(mushroomImg, window.location.href).href;
      
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.getNotifications().then(notifications => {
            notifications.forEach(n => n.close());
            registration.showNotification(title, { 
              body, 
              icon: iconUrl,
              badge: iconUrl,
              vibrate: [200, 100, 200, 100, 400],
              requireInteraction: true,
              tag: 'pomodoro-' + Date.now()
            }).catch(err => {
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

    const activityTypeToLog = timerState.currentActivityType || (activeTimerMode === 'lecture' ? 'lecture' : 'review');
    const isCircuitBreakerSession = !!timerState.isCircuitBreaker;

    if (sessionStartTsRef.current) {
      const focusSecs = Math.round((Date.now() - sessionStartTsRef.current) / 1000);
      const focusMins = Math.max(1, Math.round(focusSecs / 60));
      const sStartStr = new Date(sessionStartTsRef.current).toTimeString().split(' ')[0].substring(0, 5);
      storage.logStudySession(actualToday, 'focus', sStartStr, endTimeStr, focusMins, subjectToLog, activityTypeToLog, 'completed', isCircuitBreakerSession);
      sessionStartTsRef.current = null;
    }

    storage.addCustomPomodoroWithMinutes(actualToday, endTimeStr, minutesCompleted, startTimeStr, subjectToLog, activityTypeToLog, 'completed');
    refreshData();
    window.dispatchEvent(new CustomEvent('xp-updated'));
    if (onUpdate) onUpdate();

    if (isCircuitBreakerSession) {
      setShowCircuitBreakerCompleteModal(true);
    }

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
      // Check if today's sleep is recorded (required unless today is vacation)
      const actualToday = getTodayStr();
      const isVac = storage.isVacationDate(actualToday);
      const todayLog = storage.getDailyLogByDate(actualToday);
      const hasSleep = !!(todayLog && todayLog.bedTime && todayLog.wakeTime);

      if (!isVac && !hasSleep) {
        if (todayLog?.bedTime) setModalBedTime(todayLog.bedTime);
        if (todayLog?.wakeTime) setModalWakeTime(todayLog.wakeTime);
        if (todayLog?.bedDateType) setModalBedDateType(todayLog.bedDateType);
        else if (todayLog?.bedTime) {
          const [bH] = todayLog.bedTime.split(':').map(Number);
          setModalBedDateType(bH >= 12 ? 'prev' : 'same');
        }
        pendingTimerStartRef.current = true;
        setShowSleepModal(true);
        return;
      }

      // Check if warmup is needed for first session of the day
      if (checkAndTriggerWarmupModal()) {
        return;
      }

      // Starting new session: prompt for subject confirmation/selection
      setShowSubjectConfirmModal(true);
    }
  };

  const handleSaveSleepFromModal = (e) => {
    if (e) e.preventDefault();
    if (!modalBedTime || !modalWakeTime) {
      alert("취침 시각과 기상 시각을 모두 입력해주세요.");
      return;
    }
    const actualToday = getTodayStr();
    storage.saveDailyLog(actualToday, {
      bedTime: modalBedTime,
      wakeTime: modalWakeTime,
      bedDateType: modalBedDateType
    });
    setShowSleepModal(false);
    playSound('click');

    // If timer was pending start, check warmup or proceed to subject selection
    if (pendingTimerStartRef.current) {
      pendingTimerStartRef.current = false;
      if (checkAndTriggerWarmupModal()) {
        return;
      }
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
      const sessionSubject = timerState.currentSubject || targetSubject || selectedSubjectRef.current || selectedSubject || localStorage.getItem('human_os_selected_subject_v1') || (storage.getSubjects()[0] || '');
      const sessionActivityType = timerState.currentActivityType || (activeTimerMode === 'lecture' ? 'lecture' : 'review');
      storage.logStudySession(actualToday, 'pause', pauseStartStr, timeStr, pauseMins, sessionSubject, sessionActivityType);
      pauseStartTsRef.current = null;
    }

    sessionStartTsRef.current = Date.now();
    const minutesLeft = Math.ceil(duration / 60);

    // Schedule native notification & alarm (백그라운드/화면 꺼짐 시에도 상태바 헤드업 팝업 + 음소거 뚫는 알람 소리)
    if (Capacitor.isNativePlatform()) {
      try {
        const channelId = await ensurePopupChannel();
        await LocalNotifications.cancel({ notifications: [{ id: 1001 }, { id: 1002 }] }).catch(() => {});

        const perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') {
          await LocalNotifications.requestPermissions();
        }

        // A. 상태바 헤드업 알림 팝업 예약 (LocalNotifications - 검증된 헤드업 슬라이드 팝업)
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 1001,
              title: '성장의 숲 🍅 집중 완료!',
              body: `🎉 [${targetSubject || '공부'}] ${minutesLeft}분 집중 완료! 기록이 안전하게 저장되었습니다.`,
              schedule: { at: new Date(endTime), allowWhileIdle: true },
              channelId: channelId,
              sound: 'bell2',
              vibrationPattern: [200, 100, 200, 100, 400],
              actionTypeId: 'OPEN_APP',
              extra: { route: '/' }
            }
          ]
        });

        // B. 음소거 뚫는 STREAM_ALARM 종소리 예약 (PomodoroNative AlarmManager)
        await PomodoroNative.schedule({
          triggerAtMillis: endTime
        });
      } catch (e) {
        console.error('Failed to schedule native notification/alarm:', e);
      }
    }

    const targetActivityType = (activeTimerMode === 'lecture') ? 'lecture' : 'review';
    const nextState = {
      ...timerState,
      isRunning: true,
      isPaused: false,
      endTime,
      currentSubject: targetSubject,
      currentActivityType: targetActivityType,
      isCircuitBreaker: false
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
  };

  // ⚡ 15분 서킷 브레이커: 원클릭 도피 충동 차단 비상 타이머
  const handleStartCircuitBreaker = async () => {
    playSound('click');
    cancelNativeAlarm();

    // 만약 기존 세션이 실행 중이었고 1분 이상 진행되었다면 선 기록
    if (timerState.isRunning && sessionStartTsRef.current) {
      const elapsedSeconds = timerState.duration - timerState.timeLeft;
      const minutesCompleted = Math.floor(elapsedSeconds / 60);
      if (minutesCompleted >= 1) {
        const now = new Date();
        const actualToday = getTodayStr();
        const endTimeStr = now.toTimeString().split(' ')[0].substring(0, 5);
        const sStartStr = new Date(sessionStartTsRef.current).toTimeString().split(' ')[0].substring(0, 5);
        const subjectToLog = timerState.currentSubject || selectedSubjectRef.current || selectedSubject || (storage.getSubjects()[0] || '기타');
        const activityTypeToLog = timerState.currentActivityType || (activeTimerMode === 'lecture' ? 'lecture' : 'review');
        storage.logStudySession(actualToday, 'focus', sStartStr, endTimeStr, minutesCompleted, subjectToLog, activityTypeToLog, 'completed_early', !!timerState.isCircuitBreaker);
        storage.addCustomPomodoroWithMinutes(actualToday, endTimeStr, minutesCompleted, sStartStr, subjectToLog, activityTypeToLog, 'completed_early');
      }
      sessionStartTsRef.current = null;
    }

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

    const duration = 15 * 60; // 15분 (900초)
    const endTime = Date.now() + duration * 1000;
    const targetSubject = timerState.currentSubject || selectedSubjectRef.current || selectedSubject || localStorage.getItem('human_os_selected_subject_v1') || (storage.getSubjects()[0] || '기타');
    const targetActivityType = (activeTimerMode === 'lecture') ? 'lecture' : 'review';

    sessionStartTsRef.current = Date.now();
    isCompletingRef.current = false;
    setCustomDuration('');

    // Native alarm / notification
    if (Capacitor.isNativePlatform()) {
      try {
        await ensurePopupChannel();
        await LocalNotifications.cancel({ notifications: [{ id: 1001 }, { id: 1002 }] }).catch(() => {});
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 1001,
              title: '⚡ 15분 버티기 방어 성공!',
              body: '도피 충동을 멋지게 극복했습니다! 계속 집중하시겠습니까?',
              schedule: { at: new Date(endTime) },
              sound: 'pomodoro_bell.wav',
              channelId: 'human_os_timer_channel',
              actionTypeId: 'OPEN_APP',
              extra: { route: '/' }
            }
          ]
        });
        await PomodoroNative.schedule({ triggerAtMillis: endTime });
      } catch (e) {
        console.error('Failed to schedule native alarm for circuit breaker:', e);
      }
    }

    const nextState = {
      isRunning: true,
      isPaused: false,
      endTime,
      duration,
      timeLeft: duration,
      currentSubject: targetSubject,
      currentActivityType: targetActivityType,
      isCircuitBreaker: true
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
      const sessionSubject = timerState.currentSubject || selectedSubjectRef.current || selectedSubject || localStorage.getItem('human_os_selected_subject_v1') || (storage.getSubjects()[0] || '');
      const sessionActivityType = timerState.currentActivityType || (activeTimerMode === 'lecture' ? 'lecture' : 'review');
      storage.logStudySession(actualToday, 'focus', startStr, nowStr, focusMins, sessionSubject, sessionActivityType);
      sessionStartTsRef.current = null;
    }
    pauseStartTsRef.current = Date.now();
    cancelNativeAlarm();

    const nextState = {
      ...timerState,
      isRunning: false,
      isPaused: true,
      currentSubject: timerState.currentSubject || selectedSubjectRef.current
    };
    setTimerState(nextState);
    localStorage.setItem('human_os_timer_state_v1', JSON.stringify(nextState));
  };

  const handleOpenEarlyComplete = () => {
    const elapsedSeconds = timerState.duration - timerState.timeLeft;
    const minutesCompleted = Math.floor(elapsedSeconds / 60);

    if (minutesCompleted <= 0) {
      alert("1분 이상 진행된 후 완료할 수 있습니다.");
      return;
    }
    setShowEarlyCompleteModal(true);
  };

  const executeEarlyComplete = (endReason = 'completed_early') => {
    setShowEarlyCompleteModal(false);
    playSound('complete');
    cancelNativeAlarm();
    
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

    if (sessionStartTsRef.current) {
      const focusSecs = Math.round((Date.now() - sessionStartTsRef.current) / 1000);
      const focusMins = Math.max(1, Math.round(focusSecs / 60));
      const sStartStr = new Date(sessionStartTsRef.current).toTimeString().split(' ')[0].substring(0, 5);
      storage.logStudySession(actualToday, 'focus', sStartStr, endTimeStr, focusMins, subjectToLog, activityTypeToLog, endReason, !!timerState.isCircuitBreaker);
      sessionStartTsRef.current = null;
    }

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.3 }
      });
    } catch (e) {}

    storage.addCustomPomodoroWithMinutes(actualToday, endTimeStr, minutesCompleted, startTimeStr, subjectToLog, activityTypeToLog, endReason);
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
    cancelNativeAlarm();
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

    storage.addMeal(actualToday, startTimeStr, endTimeStr, mins, mealMenuInput);
    setMealMenuInput('');
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

  const handleStartEditMeal = (meal) => {
    setEditingMealId(meal.id);
    setEditingMealMenu(meal.menu || '');
  };

  const handleSaveMealMenu = (mealId) => {
    storage.updateMeal(selectedDate, mealId, { menu: editingMealMenu.trim() });
    setEditingMealId(null);
    setEditingMealMenu('');
    refreshData();
    if (onUpdate) onUpdate();
  };

  const handleSleepTimeChange = (field, val) => {
    const updated = storage.saveDailyLog(selectedDate, { [field]: val });
    setDailyLog(updated);
    if (onUpdate) onUpdate();
  };

  const handleSatisfactionSelect = (level) => {
    const newLevel = dailyLog.satisfaction === level ? null : level;
    const updated = storage.saveDailyLog(selectedDate, { satisfaction: newLevel });
    setDailyLog(updated);
    if (newLevel) {
      playSound('click');
      if (newLevel === 'high') {
        confetti({
          particleCount: 35,
          spread: 55,
          origin: { y: 0.85 },
          colors: ['#f97316', '#ef4444', '#10b981']
        });
      }
    }
    if (onUpdate) onUpdate();
  };

  const activeMinutes = customDuration ? parseInt(customDuration, 10) : selectedDuration;

  const todayStudyMins = (todayData?.totalMinutes || 0);
  const dailyGoal = useMemo(() => storage.getDailyGoalStatus(todayStudyMins), [todayStudyMins]);
  const weeklyGoal = useMemo(() => storage.getWeeklyGoalInfo(0), [todayData, selectedDate]);

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

      {/* Dual Goal Progress HUD: 일간 목표 (6h~8h 차등) & 주간 목표 (36h~42h 휴가 반영) - 정밀 눈금 연동 */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.35)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '0.8rem 1rem',
        marginBottom: '0.9rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        {/* ========================================================================= */}
        {/* 1. 일간 순공 목표 카드 (선형 1:1 직관적 비례 롤백 + 4h 새싹 중간 마일스톤) */}
        {/* ========================================================================= */}
        {(() => {
          // 직관적인 100% 선형 비례 (총 480분 = 8시간 = 100%)
          // 4시간(240분): 50.0% (🌱 새싹 도약)
          // 6시간(360분): 75.0% (🌿 1단계 기본 달성)
          // 7시간(420분): 87.5% (🌳 2단계 우수 달성)
          // 8시간(480분): 100%  (🌲 3단계 울창 완벽)
          const dailyTotalScaleMins = 480;
          const dailyFillPct = Math.min(100, (todayStudyMins / dailyTotalScaleMins) * 100);

          let dailyBarGradient = 'linear-gradient(90deg, #0284c7, #38bdf8)';
          if (todayStudyMins >= 480) {
            dailyBarGradient = 'linear-gradient(90deg, #10b981, #34d399)'; // 8h+ 완벽
          } else if (todayStudyMins >= 420) {
            dailyBarGradient = 'linear-gradient(90deg, #059669, #10b981)'; // 7h+ 우수
          } else if (todayStudyMins >= 360) {
            dailyBarGradient = 'linear-gradient(90deg, #38bdf8, #10b981)'; // 6h+ 기본
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>🎯</span> 일간 순공 목표 (6~8h)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '4px',
                    fontWeight: 'bold',
                    background: dailyGoal.level === 3 ? 'rgba(16, 185, 129, 0.25)' : dailyGoal.level === 2 ? 'rgba(5, 150, 105, 0.25)' : dailyGoal.level === 1 ? 'rgba(56, 189, 248, 0.25)' : todayStudyMins >= 240 ? 'rgba(110, 231, 183, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: dailyGoal.level === 3 ? '#34d399' : dailyGoal.level === 2 ? '#10b981' : dailyGoal.level === 1 ? '#38bdf8' : todayStudyMins >= 240 ? '#6ee7b7' : 'var(--text-muted)'
                  }}>
                    {dailyGoal.level === 3 ? '🌲 3단계(8h) 완벽' : dailyGoal.level === 2 ? '🌳 2단계(7h) 우수' : dailyGoal.level === 1 ? '🌿 1단계(6h) 달성' : todayStudyMins >= 240 ? '🌱 새싹 도약(4h+)' : '🌱 도약 중'}
                  </span>
                  <span style={{ fontSize: '0.86rem', fontWeight: 'bold', color: '#fff' }}>
                    {dailyGoal.hours}h {dailyGoal.minsRemainder}m
                  </span>
                </div>
              </div>

              {/* 1:1 선형 비례 프로그레스 바 (4h: 50%, 6h: 75%, 7h: 87.5%) */}
              <div style={{
                position: 'relative',
                height: '9px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '5px',
                overflow: 'hidden',
                width: '100%',
                marginTop: '0.15rem'
              }}>
                {/* 진행 게이지 채움 */}
                <div style={{
                  width: `${dailyFillPct}%`,
                  height: '100%',
                  background: dailyBarGradient,
                  transition: 'width 0.3s ease'
                }} />

                {/* 4h (50%) 분할 구분선 - 성장의 숲 새싹 마일스톤 */}
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  bottom: 0,
                  width: '1.5px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  zIndex: 2
                }} />

                {/* 6h (75%) 분할 구분선 - 1단계 기본 목표 */}
                <div style={{
                  position: 'absolute',
                  left: '75%',
                  top: 0,
                  bottom: 0,
                  width: '1.5px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  zIndex: 2
                }} />

                {/* 7h (87.5%) 분할 구분선 - 2단계 우수 목표 */}
                <div style={{
                  position: 'absolute',
                  left: '87.5%',
                  top: 0,
                  bottom: 0,
                  width: '1.5px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  zIndex: 2
                }} />
              </div>

              {/* 눈금 라벨 (정확한 시간 비례 눈금) */}
              <div style={{ position: 'relative', height: '16px', fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.12rem' }}>
                <span style={{ position: 'absolute', left: 0 }}>0h</span>

                {/* 4h 새싹 마일스톤 (50% 지점 - 착시 해소) */}
                <span style={{
                  position: 'absolute',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: todayStudyMins >= 240 ? '#6ee7b7' : 'var(--text-muted)',
                  fontWeight: todayStudyMins >= 240 ? 'bold' : 'normal',
                  whiteSpace: 'nowrap'
                }}>
                  4h🌱
                </span>

                {/* 6h 1단계 (75% 지점) */}
                <span style={{
                  position: 'absolute',
                  left: '75%',
                  transform: 'translateX(-50%)',
                  color: todayStudyMins >= 360 ? '#38bdf8' : 'var(--text-muted)',
                  fontWeight: todayStudyMins >= 360 ? 'bold' : 'normal',
                  whiteSpace: 'nowrap'
                }}>
                  6h🌿
                </span>

                {/* 7h 2단계 (87.5% 지점) */}
                <span style={{
                  position: 'absolute',
                  left: '87.5%',
                  transform: 'translateX(-50%)',
                  color: todayStudyMins >= 420 ? '#10b981' : 'var(--text-muted)',
                  fontWeight: todayStudyMins >= 420 ? 'bold' : 'normal',
                  whiteSpace: 'nowrap'
                }}>
                  7h🌳
                </span>

                {/* 8h+ 3단계 (100% 지점) */}
                <span style={{
                  position: 'absolute',
                  right: 0,
                  color: todayStudyMins >= 480 ? '#34d399' : 'var(--text-muted)',
                  fontWeight: todayStudyMins >= 480 ? 'bold' : 'normal'
                }}>
                  8h+🌲
                </span>
              </div>

              {/* 일간 상태 메시지 */}
              <div style={{ fontSize: '0.7rem', color: dailyGoal.level > 0 ? '#34d399' : 'var(--text-muted)' }}>
                {dailyGoal.level === 3 ? (
                  <span>👑 8시간 울창 달성 완료! 최고의 집중도입니다.</span>
                ) : dailyGoal.level === 2 ? (
                  <span>🌳 2단계(7h) 우수 달성! 3단계(8h)까지 {dailyGoal.remainingMins}분 남음</span>
                ) : dailyGoal.level === 1 ? (
                  <span>🌿 1단계(6h) 달성 완료! 2단계(7h)까지 {dailyGoal.remainingMins}분 남음</span>
                ) : (
                  <span>⏳ 1단계(6h) 달성까지 {dailyGoal.remainingMins}분 남음</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* ========================================================================= */}
        {/* 2. 주간 목표 카드 (선형 1:1 직관적 비례 롤백 + 50% 반환점 마일스톤) */}
        {/* ========================================================================= */}
        {(() => {
          // 주간 기준: 최대 목표(targetMaxMins) = 100% 선형 매핑
          const maxMins = weeklyGoal.targetMaxMins || 2520;
          const minMins = weeklyGoal.targetMinMins || 2160;
          const weeklyMinPct = maxMins > 0 ? (minMins / maxMins) * 100 : 85.7;
          const weeklyFillPct = maxMins > 0 ? Math.min(100, (weeklyGoal.weeklyMinutes / maxMins) * 100) : 0;
          const basicAchievementPct = minMins > 0 ? Math.round((weeklyGoal.weeklyMinutes / minMins) * 100) : 100;

          // 기본 목표의 50% 중간 반환점
          const halfMinMins = Math.round(minMins / 2);
          const halfMinPct = maxMins > 0 ? (halfMinMins / maxMins) * 100 : 42.8;
          const halfMinHours = Math.round(weeklyGoal.targetMinHours / 2);

          let weeklyBarGradient = 'linear-gradient(90deg, #6366f1, #a855f7)';
          if (weeklyGoal.isMaxReached) {
            weeklyBarGradient = 'linear-gradient(90deg, #10b981, #34d399)'; // 최대 초과 달성
          } else if (weeklyGoal.isMinReached) {
            weeklyBarGradient = '#10b981'; // 기본 목표 달성
          }

          return (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.07)',
              paddingTop: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>📅</span> 주간 목표 ({weeklyGoal.targetMinHours}~{weeklyGoal.targetMaxHours}h)
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {weeklyGoal.vacationDaysCount > 0 && (
                    <span style={{
                      fontSize: '0.67rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      background: 'rgba(234, 179, 8, 0.18)',
                      color: '#facc15',
                      fontWeight: 'bold'
                    }}>
                      🌴 휴가 {weeklyGoal.vacationDaysCount}일 반영
                    </span>
                  )}
                  <span style={{ fontSize: '0.86rem', fontWeight: 'bold', color: weeklyGoal.isMinReached ? '#34d399' : '#fff' }}>
                    {weeklyGoal.weeklyHours}h
                  </span>
                </div>
              </div>

              {/* 정밀 1:1 선형 주간 프로그레스 바 (0~최대목표 기준, 50% 반환점 및 기본목표 분할선) */}
              <div style={{
                position: 'relative',
                height: '9px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '5px',
                overflow: 'hidden',
                width: '100%',
                marginTop: '0.15rem'
              }}>
                <div style={{
                  width: `${weeklyFillPct}%`,
                  height: '100%',
                  background: weeklyBarGradient,
                  transition: 'width 0.3s ease'
                }} />

                {/* 50% 반환점 분할선 */}
                <div style={{
                  position: 'absolute',
                  left: `${halfMinPct}%`,
                  top: 0,
                  bottom: 0,
                  width: '1.5px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  zIndex: 2
                }} />

                {/* 기본 목표 분할선 */}
                <div style={{
                  position: 'absolute',
                  left: `${weeklyMinPct}%`,
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  background: 'rgba(15, 23, 42, 0.85)',
                  zIndex: 2
                }} />
              </div>

              {/* 눈금 라벨 (0h -> 반환점 -> 기본목표 -> 최대목표) */}
              <div style={{ position: 'relative', height: '16px', fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.12rem' }}>
                <span style={{ position: 'absolute', left: 0 }}>0h</span>

                <span style={{
                  position: 'absolute',
                  left: `${halfMinPct}%`,
                  transform: 'translateX(-50%)',
                  color: weeklyGoal.weeklyMinutes >= halfMinMins ? '#a5b4fc' : 'var(--text-muted)',
                  fontWeight: weeklyGoal.weeklyMinutes >= halfMinMins ? 'bold' : 'normal',
                  whiteSpace: 'nowrap'
                }}>
                  {halfMinHours}h(50%)
                </span>

                <span style={{
                  position: 'absolute',
                  left: `${weeklyMinPct}%`,
                  transform: 'translateX(-50%)',
                  color: weeklyGoal.isMinReached ? '#34d399' : 'var(--text-muted)',
                  fontWeight: weeklyGoal.isMinReached ? 'bold' : 'normal',
                  whiteSpace: 'nowrap'
                }}>
                  기본 {weeklyGoal.targetMinHours}h
                </span>

                <span style={{
                  position: 'absolute',
                  right: 0,
                  color: weeklyGoal.isMaxReached ? '#34d399' : 'var(--text-muted)',
                  fontWeight: weeklyGoal.isMaxReached ? 'bold' : 'normal'
                }}>
                  최대 {weeklyGoal.targetMaxHours}h
                </span>
              </div>

              {/* 주간 정보 및 달성률 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>목표: {weeklyGoal.targetMinHours}h ~ {weeklyGoal.targetMaxHours}h</span>
                <span>기본 목표 달성률: <strong style={{ color: weeklyGoal.isMinReached ? '#34d399' : '#e2e8f0' }}>{basicAchievementPct}%</strong></span>
              </div>

              <div style={{ fontSize: '0.7rem', color: weeklyGoal.isMinReached ? '#34d399' : 'var(--text-muted)' }}>
                {weeklyGoal.isMaxReached ? (
                  <span>🎉 주간 최대 목표({weeklyGoal.targetMaxHours}h) 초과 달성!</span>
                ) : weeklyGoal.isMinReached ? (
                  <span>✨ 주간 기본 목표({weeklyGoal.targetMinHours}h) 달성 완료! ({weeklyGoal.targetMaxHours}h 도약 중)</span>
                ) : (
                  <span>🎯 주간 기본 목표({weeklyGoal.targetMinHours}h)까지 {Math.floor(weeklyGoal.remainingToMinMins / 60)}시간 {weeklyGoal.remainingToMinMins % 60}분 남음</span>
                )}
              </div>
            </div>
          );
        })()}
      </div>

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

            {/* Preset Selector (기본 30분 단일 선택 + 직접 입력) */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', marginBottom: '1.15rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {activeTimerMode === 'lecture' ? '🎧 강의 시간:' : '📖 복습 시간:'}
              </span>
              {(() => {
                const isSelected = selectedDuration === 30 && !customDuration;
                const activeColor = activeTimerMode === 'lecture' ? '#818cf8' : 'var(--accent-primary)';
                const activeTextColor = activeTimerMode === 'lecture' ? '#fff' : '#000';
                return (
                  <button
                    onClick={() => {
                      if (timerState.isRunning || timerState.isPaused) return;
                      setCustomDuration('');
                      applyDuration(30);
                    }}
                    disabled={timerState.isRunning || timerState.isPaused}
                    style={{
                      padding: '0.28rem 0.85rem',
                      borderRadius: '20px',
                      border: isSelected ? `1.5px solid ${activeColor}` : '1px solid rgba(255,255,255,0.15)',
                      background: isSelected ? activeColor : 'rgba(255,255,255,0.05)',
                      color: isSelected ? activeTextColor : 'var(--text-secondary)',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      fontSize: '0.82rem',
                      cursor: timerState.isRunning || timerState.isPaused ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    30분 (기본)
                  </button>
                );
              })()}

              {/* ⚡ 15분 버티기 비상 버튼 (도피 충동 원천 차단) */}
              <button
                type="button"
                onClick={handleStartCircuitBreaker}
                title="공부 중 도망치고 싶을 때 15분만 버티는 비상 타이머"
                style={{
                  padding: '0.28rem 0.85rem',
                  borderRadius: '20px',
                  border: timerState.isCircuitBreaker ? '1.5px solid #facc15' : '1px solid rgba(234, 179, 8, 0.45)',
                  background: timerState.isCircuitBreaker ? 'linear-gradient(135deg, #eab308, #ca8a04)' : 'rgba(234, 179, 8, 0.12)',
                  color: timerState.isCircuitBreaker ? '#000' : '#facc15',
                  fontWeight: 'bold',
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  boxShadow: timerState.isCircuitBreaker ? '0 0 10px rgba(234, 179, 8, 0.45)' : 'none'
                }}
              >
                <Zap size={14} />
                <span>15분 버티기</span>
              </button>

              {/* Custom Duration Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
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
                    padding: '0.25rem 0.45rem',
                    borderRadius: '6px',
                    border: customDuration ? (activeTimerMode === 'lecture' ? '1.5px solid #818cf8' : '1.5px solid var(--accent-primary)') : '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(0,0,0,0.4)',
                    color: '#fff',
                    fontSize: '0.82rem',
                    textAlign: 'center'
                  }}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>분</span>
              </div>
            </div>

            {/* ⚡ 15분 서킷 브레이커: 초저마찰 행동 가이드 3줄 */}
            {timerState.isCircuitBreaker && (
              <div style={{
                margin: '0 auto 1.15rem auto',
                maxWidth: '440px',
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1.5px solid rgba(234, 179, 8, 0.35)',
                boxShadow: '0 2px 10px rgba(234, 179, 8, 0.15)',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#facc15', fontWeight: 'bold', fontSize: '0.82rem', marginBottom: '0.4rem' }}>
                  <Zap size={15} /> 15분 초저마찰 행동 가이드
                </div>
                <div style={{ fontSize: '0.78rem', color: '#f1f5f9', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div>① 노트북LM [4일차/7일차] 마킹만 하기</div>
                  <div>② 이미 맞힌 문제 해설 눈으로 3번 훑기</div>
                  <div>③ 세법학 키워드 소리 내어 5번 읽기</div>
                </div>
              </div>
            )}

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
                  onClick={handleOpenEarlyComplete}
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

            {mealTimerState.isRunning && (
              <p style={{ fontSize: '0.82rem', color: '#fb923c', margin: '0 0 0.75rem 0', fontWeight: 'bold' }}>
                시작: {mealTimerState.startTimeStr}
              </p>
            )}

            {/* Optional Meal Menu Input Field */}
            <div style={{ maxWidth: '320px', margin: '0 auto 1rem auto', width: '100%' }}>
              <input
                type="text"
                placeholder="식사 메뉴 (선택, 예: 키토김밥, 계란2개)"
                value={mealMenuInput}
                onChange={(e) => setMealMenuInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.82rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(249, 115, 22, 0.35)',
                  background: 'rgba(0, 0, 0, 0.35)',
                  color: '#fff',
                  outline: 'none',
                  textAlign: 'center',
                  boxSizing: 'border-box'
                }}
              />
            </div>

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
                  {todayMeals.map((m) => {
                    const isEditing = editingMealId === m.id;

                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          fontSize: '0.75rem',
                          background: 'rgba(251, 146, 60, 0.12)',
                          border: isEditing ? '1px solid #fb923c' : '1px solid rgba(251, 146, 60, 0.3)',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '6px',
                          color: '#fdba74'
                        }}
                      >
                        {isEditing ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.72rem' }}>🍱 {m.startTime}~{m.endTime}</span>
                            <input
                              autoFocus
                              type="text"
                              value={editingMealMenu}
                              onChange={(e) => setEditingMealMenu(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveMealMenu(m.id);
                                if (e.key === 'Escape') setEditingMealId(null);
                              }}
                              placeholder="식사 메뉴 입력"
                              style={{
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid #fb923c',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '0.72rem',
                                padding: '0.15rem 0.4rem',
                                width: '130px'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveMealMenu(m.id)}
                              style={{
                                background: '#ea580c',
                                border: 'none',
                                borderRadius: '3px',
                                color: '#fff',
                                fontSize: '0.68rem',
                                padding: '0.15rem 0.4rem',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingMealId(null)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                fontSize: '0.68rem',
                                cursor: 'pointer'
                              }}
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <>
                            <span
                              onClick={() => handleStartEditMeal(m)}
                              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                              title="클릭하여 메뉴 수정"
                            >
                              <span>🍱 {m.startTime} ~ {m.endTime} ({m.minutes}분)</span>
                              {m.menu ? (
                                <strong style={{ color: '#fff', borderBottom: '1px dashed rgba(251, 146, 60, 0.5)' }}>
                                  · {m.menu}
                                </strong>
                              ) : (
                                <span style={{
                                  color: '#facc15',
                                  background: 'rgba(234, 179, 8, 0.18)',
                                  padding: '0.05rem 0.35rem',
                                  borderRadius: '3px',
                                  fontSize: '0.68rem',
                                  fontWeight: 'bold'
                                }}>
                                  + 메뉴 입력
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleStartEditMeal(m)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#fb923c',
                                cursor: 'pointer',
                                padding: '0 0.15rem',
                                display: 'flex',
                                alignItems: 'center',
                                opacity: 0.85
                              }}
                              title="메뉴 수정"
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              type="button"
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
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Daily Timestamped Log & Collapsible Manual Input */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
        {/* Supplementary Problem Slot (막힌 문제 보충 슬롯 - 나중에 풀기/주말 보충) */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          padding: '0.85rem 1rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Bookmark size={16} color="#f59e0b" />
              <h3 style={{ fontSize: '0.92rem', color: '#f8fafc', margin: 0, fontWeight: 'bold' }}>
                막힌 문제 보충 슬롯
              </h3>
              <span style={{
                fontSize: '0.7rem',
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.15)',
                padding: '0.12rem 0.45rem',
                borderRadius: '10px',
                fontWeight: 'bold'
              }}>
                대기 {pendingSlots.length}건
              </span>
            </div>

            <button
              type="button"
              onClick={handleOpenSupplementaryModal}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                fontSize: '0.72rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                transition: 'all 0.15s'
              }}
              title="전체 보충 슬롯 관리"
            >
              <span>전체 관리</span>
              <ExternalLink size={12} />
            </button>
          </div>

          {/* 5개 이상 누적 시 워밍업 권장 배너 */}
          {pendingSlots.length >= 5 && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '6px',
              padding: '0.4rem 0.65rem',
              marginBottom: '0.65rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.74rem', color: '#fbbf24' }}>
                <Sparkles size={14} color="#f59e0b" />
                <span>보충 문제가 <strong>{pendingSlots.length}개</strong> 누적되었습니다! 2~3개를 먼저 해결해보세요.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowWarmupModal(true)}
                style={{
                  background: '#f59e0b',
                  color: '#000',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                워밍업 풀기
              </button>
            </div>
          )}

          {/* Quick Input Bar */}
          <form onSubmit={handleQuickAddSlot} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.65rem' }}>
            <input
              type="text"
              placeholder={selectedSubject ? `막힌 문제 킵 (예: ${selectedSubject}12장05번)` : '막힌 문제 킵 (예: 셈회12장05번)'}
              value={quickSlotTitle}
              onChange={(e) => setQuickSlotTitle(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '0.4rem 0.7rem',
                borderRadius: '6px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                color: '#fff',
                fontSize: '0.82rem',
                outline: 'none'
              }}
            />

            <button
              type="submit"
              className="btn btn-primary"
              style={{
                padding: '0.4rem 0.9rem',
                fontSize: '0.8rem',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
            >
              <Plus size={15} /> 킵
            </button>
          </form>

          {/* Quick Pending Slots List */}
          {pendingSlots.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {pendingSlots.slice(0, 3).map((slot) => {
                const subCol = getSubjectColor(slot.subject, subjects);
                return (
                  <div
                    key={slot.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '6px',
                      padding: '0.35rem 0.55rem',
                      fontSize: '0.78rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0, flex: 1 }}>
                      <button
                        type="button"
                        onClick={() => handleQuickToggleSlot(slot.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#94a3b8'
                        }}
                        title="해결 완료로 체크"
                      >
                        <Square size={16} />
                      </button>

                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 'bold',
                        padding: '0.08rem 0.35rem',
                        borderRadius: '3px',
                        color: subCol,
                        background: `${subCol}1f`,
                        border: `1px solid ${subCol}40`,
                        whiteSpace: 'nowrap'
                      }}>
                        {slot.subject}
                      </span>

                      <span style={{
                        color: '#f1f5f9',
                        fontWeight: 'bold',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {slot.title}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleQuickDeleteSlot(slot.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '0.1rem',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="삭제"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}

              {pendingSlots.length > 3 && (
                <button
                  type="button"
                  onClick={handleOpenSupplementaryModal}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f59e0b',
                    fontSize: '0.72rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    fontWeight: 'bold'
                  }}
                >
                  + 외 {pendingSlots.length - 3}건 더 보기 (전체 관리)
                </button>
              )}
            </div>
          ) : (
            <div style={{
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '0.35rem 0',
              fontStyle: 'italic'
            }}>
              💡 복습 중 막히는 문제는 대충 넘기지 말고 1초 만에 여기에 킵해두세요.
            </div>
          )}
        </div>

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

      {/* Daily Sleep Input Modal (새로운 하루 시작 및 뽀모도로 시작 전 필수 입력) */}
      {showSleepModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10003,
          padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '430px',
            width: '100%',
            background: '#0f172a',
            border: '2px solid #8b5cf6',
            borderRadius: '18px',
            padding: '1.75rem',
            boxShadow: '0 15px 40px rgba(0,0,0,0.7), 0 0 25px rgba(139, 92, 246, 0.35)',
            textAlign: 'center'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🛌</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#c084fc', fontWeight: 800 }}>
                  오늘의 수면 기록
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  pendingTimerStartRef.current = false;
                  setShowSleepModal(false);
                }}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.5rem', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
              새로운 하루 공부를 시작하기 전, 규칙적인 생활 패턴과 컨디션 분석을 위해 <strong>어젯밤 취침 시각</strong>과 <strong>오늘 기상 시각</strong>을 입력해주세요.
            </p>

            <form onSubmit={handleSaveSleepFromModal}>
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <label style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 'bold' }}>
                        🌙 취침 시각
                      </label>
                      <div style={{
                        display: 'inline-flex',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        border: '1px solid rgba(139, 92, 246, 0.4)',
                        background: 'rgba(0, 0, 0, 0.4)'
                      }}>
                        <button
                          type="button"
                          onClick={() => setModalBedDateType('prev')}
                          title="전날 밤 취침"
                          style={{
                            background: modalBedDateType === 'prev' ? '#8b5cf6' : 'transparent',
                            color: modalBedDateType === 'prev' ? '#fff' : 'rgba(255, 255, 255, 0.55)',
                            border: 'none',
                            padding: '0.12rem 0.45rem',
                            fontSize: '0.66rem',
                            fontWeight: modalBedDateType === 'prev' ? 'bold' : 'normal',
                            cursor: 'pointer'
                          }}
                        >
                          전날
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalBedDateType('same')}
                          title="당일 새벽 취침"
                          style={{
                            background: modalBedDateType === 'same' ? '#8b5cf6' : 'transparent',
                            color: modalBedDateType === 'same' ? '#fff' : 'rgba(255, 255, 255, 0.55)',
                            border: 'none',
                            borderLeft: '1px solid rgba(139, 92, 246, 0.35)',
                            padding: '0.12rem 0.45rem',
                            fontSize: '0.66rem',
                            fontWeight: modalBedDateType === 'same' ? 'bold' : 'normal',
                            cursor: 'pointer'
                          }}
                        >
                          당일
                        </button>
                      </div>
                    </div>
                    <input
                      type="time"
                      required
                      value={modalBedTime}
                      onChange={(e) => {
                        const val = e.target.value;
                        setModalBedTime(val);
                        if (val) {
                          const [h] = val.split(':').map(Number);
                          setModalBedDateType(h >= 12 ? 'prev' : 'same');
                        }
                      }}
                      style={{
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1.5px solid rgba(139, 92, 246, 0.5)',
                        borderRadius: '8px',
                        color: '#fff',
                        padding: '0.45rem 0.65rem',
                        fontSize: '0.95rem',
                        fontWeight: 'bold',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem', marginTop: '1.2rem' }}>~</span>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <label style={{ fontSize: '0.75rem', color: '#a78bfa', fontWeight: 'bold' }}>
                        ☀️ 기상 시각
                      </label>
                      <span style={{
                        fontSize: '0.66rem',
                        color: '#a78bfa',
                        background: 'rgba(139, 92, 246, 0.15)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '4px',
                        padding: '0.1rem 0.35rem',
                        fontWeight: 'bold'
                      }}>
                        당일
                      </span>
                    </div>
                    <input
                      type="time"
                      required
                      value={modalWakeTime}
                      onChange={(e) => setModalWakeTime(e.target.value)}
                      style={{
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1.5px solid rgba(139, 92, 246, 0.5)',
                        borderRadius: '8px',
                        color: '#fff',
                        padding: '0.45rem 0.65rem',
                        fontSize: '0.95rem',
                        fontWeight: 'bold',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Live calculated sleep duration */}
                {(() => {
                  const dur = calculateSleepDuration(modalBedTime, modalWakeTime, modalBedDateType);
                  return (
                    <div style={{ marginTop: '0.85rem' }}>
                      {dur ? (
                        <span style={{
                          fontSize: '0.82rem',
                          color: '#c084fc',
                          background: 'rgba(139, 92, 246, 0.2)',
                          border: '1px solid rgba(139, 92, 246, 0.4)',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '14px',
                          fontWeight: 'bold',
                          display: 'inline-block'
                        }}>
                          💤 총 {dur.hours}시간 {dur.mins > 0 ? `${dur.mins}분 ` : ''}수면
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          취침과 기상 시각을 입력하면 수면 시간이 계산됩니다.
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '0.95rem',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                  border: 'none',
                  color: '#fff',
                  boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.45rem'
                }}
              >
                <Check size={18} /> 수면 기록 저장하고 집중 시작하기
              </button>
            </form>

            <div style={{ marginTop: '0.85rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              🌴 휴가 기간에는 수면 기록 없이도 뽀모도로를 바로 시작할 수 있습니다.
            </div>
          </div>
        </div>
      )}

      {/* 5개 이상 누적 시: 다음 날 첫 공부 시작 전 워밍업 모달 */}
      {showWarmupModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10003,
          padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '460px',
            width: '100%',
            background: '#0f172a',
            border: '1.5px solid #f59e0b',
            borderRadius: '16px',
            padding: '1.4rem',
            boxShadow: '0 15px 40px rgba(0,0,0,0.7)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  padding: '0.35rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Sparkles size={20} />
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#f59e0b', fontWeight: 'bold' }}>
                    첫 공부 전 워밍업 알림
                  </h3>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    보충 문제가 5개 이상 쌓였습니다! (현재 {pendingSlots.length}건 대기)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissWarmupAndProceed}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Motivation Guidance Box */}
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              borderRadius: '8px',
              padding: '0.65rem 0.8rem',
              fontSize: '0.78rem',
              color: '#fef3c7',
              lineHeight: 1.45
            }}>
              💡 오늘 새로운 공부를 시작하기 전, 막혀서 보류했던 문제 중 <strong>2~3개를 먼저 가볍게 풀고 지우면</strong> 뇌가 확실하게 예열되어 본 공부 효율이 극대화됩니다!
            </div>

            {/* Interactive Problem List (Pending slots) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              maxHeight: '220px',
              overflowY: 'auto',
              paddingRight: '0.2rem'
            }}>
              {pendingSlots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', color: '#34d399', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  🎉 모든 보충 문제를 해결했습니다! 상쾌하게 공부를 시작하세요.
                </div>
              ) : (
                pendingSlots.map((slot) => {
                  const subCol = getSubjectColor(slot.subject, subjects);
                  return (
                    <div
                      key={slot.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '0.45rem 0.65rem',
                        fontSize: '0.82rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleSlot(slot.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            color: '#94a3b8'
                          }}
                          title="해결 완료로 체크"
                        >
                          <Square size={18} color="#f59e0b" />
                        </button>

                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 'bold',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          color: subCol,
                          background: `${subCol}1f`,
                          border: `1px solid ${subCol}40`,
                          whiteSpace: 'nowrap'
                        }}>
                          {slot.subject}
                        </span>

                        <span style={{
                          color: '#f1f5f9',
                          fontWeight: 'bold',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {slot.title}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuickDeleteSlot(slot.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '0.15rem'
                        }}
                        title="삭제"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.35rem' }}>
              <button
                type="button"
                onClick={handleDismissWarmupAndProceed}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  fontSize: '0.88rem',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                <Check size={18} /> 워밍업 완료! 오늘 공부 시작하기
              </button>

              <button
                type="button"
                onClick={handleDismissWarmupAndProceed}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  padding: '0.3rem',
                  textAlign: 'center'
                }}
              >
                나중에 풀고 바로 시작하기 ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subject Management Modal */}
      <SubjectModal isOpen={showSubjectModal} onClose={() => setShowSubjectModal(false)} />

      {/* Early Complete Reason Modal */}
      {showEarlyCompleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '380px',
            width: '100%',
            background: '#13151f',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '1.25rem',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
          }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              ⏱️ 집중 세션 조기 완료
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: '1.4' }}>
              현재까지 진행된 집중 시간을 저장합니다.<br />
              종료 사유를 선택해 주세요:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => executeEarlyComplete('completed_early')}
                style={{
                  padding: '0.85rem 1rem',
                  background: activeTimerMode === 'lecture'
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid #10b981',
                  borderRadius: '10px',
                  color: '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                    🎓 {activeTimerMode === 'lecture' ? '강의 종료 / 목표 달성' : '목표 달성 (정상 완료)'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: activeTimerMode === 'lecture' ? '#d1fae5' : 'var(--text-muted)', marginTop: '2px' }}>
                    {activeTimerMode === 'lecture' ? '강의가 계획보다 일찍 끝남' : '계획한 공부 분량을 마침'}
                  </div>
                </div>
                {activeTimerMode === 'lecture' && (
                  <span style={{ fontSize: '0.65rem', background: '#047857', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    추천
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => executeEarlyComplete('interrupted')}
                style={{
                  padding: '0.85rem 1rem',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '10px',
                  color: '#fca5a5',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                  ⚡ 집중 저하 · 흐름 중단
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.55)', marginTop: '2px' }}>
                  피로, 집중 흐트러짐, 급한 용무 등
                </div>
              </button>
            </div>

            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setShowEarlyCompleteModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  padding: '0.4rem 0.6rem'
                }}
              >
                취소 (계속 진행)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ⚡ 15분 서킷 브레이커 방어 성공 선택창 모달 */}
      {showCircuitBreakerCompleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '430px',
            width: '100%',
            background: '#0f172a',
            border: '2px solid #eab308',
            borderRadius: '16px',
            padding: '1.75rem',
            boxShadow: '0 10px 30px rgba(234, 179, 8, 0.35)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #eab308, #ca8a04)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
              color: '#000',
              boxShadow: '0 4px 15px rgba(234, 179, 8, 0.4)'
            }}>
              <Zap size={32} />
            </div>

            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#facc15', fontWeight: 'bold' }}>
              ⚡ 15분 방어 성공!
            </h3>

            <p style={{ fontSize: '0.9rem', color: '#e2e8f0', lineHeight: 1.55, margin: '0 0 1.5rem 0' }}>
              도피 충동을 극복하고 정상 학습 15분을 완주했습니다.<br />
              <strong style={{ color: '#fef08a' }}>계속 이어가시겠습니까, 아니면 합법적으로 종료하시겠습니까?</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => {
                  setShowCircuitBreakerCompleteModal(false);
                  handleStartCircuitBreaker();
                }}
                className="btn btn-primary"
                style={{
                  padding: '0.75rem',
                  fontSize: '0.92rem',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #eab308, #f59e0b)',
                  border: 'none',
                  color: '#000',
                  boxShadow: '0 4px 12px rgba(234, 179, 8, 0.35)',
                  cursor: 'pointer'
                }}
              >
                🔥 계속 이어가기 (+15분 더 버티기)
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCircuitBreakerCompleteModal(false);
                  resetTimer();
                }}
                className="btn btn-secondary"
                style={{
                  padding: '0.75rem',
                  fontSize: '0.9rem',
                  fontWeight: 'bold',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#cbd5e1',
                  cursor: 'pointer'
                }}
              >
                🛡️ 합법적으로 종료 (휴식하기)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
