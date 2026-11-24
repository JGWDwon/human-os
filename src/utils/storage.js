const STORAGE_KEYS = {
  QUESTS: 'human_os_quests_v1',
  DIARY: 'human_os_diary_v1',
  SETTINGS: 'human_os_settings',
  POMODORO: 'human_os_pomodoro_v1',
  USER_PROFILE: 'human_os_profile_v1',
  LECTURES: 'human_os_lectures_v1',
  VACATIONS: 'human_os_vacations_v1',
  STUDY_SESSIONS: 'human_os_study_sessions_v1',
  SUBJECTS: 'human_os_subjects_v1',
  DDAYS: 'human_os_ddays_v1',
  MEALS: 'human_os_meals_v1',
  DAILY_LOGS: 'human_os_daily_logs_v1',
  SUPPLEMENTARY_SLOTS: 'human_os_supplementary_slots_v1'
};

export function calculateSleepDuration(bedTime, wakeTime, bedDateType = null) {
  if (!bedTime || !wakeTime) return null;
  const bParts = bedTime.split(':').map(Number);
  const wParts = wakeTime.split(':').map(Number);
  if (bParts.length < 2 || wParts.length < 2) return null;
  const [bH, bM] = bParts;
  const [wH, wM] = wParts;
  if (isNaN(bH) || isNaN(bM) || isNaN(wH) || isNaN(wM)) return null;

  let bedMinutes = bH * 60 + bM;
  let wakeMinutes = wH * 60 + wM;

  if (bedDateType === 'prev') {
    // 전날 취침: 기상 시각에 24시간(1440분) 더함
    wakeMinutes += 24 * 60;
  } else if (bedDateType === 'same') {
    // 당일 취침: 당일 기상
    if (wakeMinutes <= bedMinutes) {
      wakeMinutes += 24 * 60;
    }
  } else {
    // 자동 판별 (자정 넘김)
    if (wakeMinutes <= bedMinutes) {
      wakeMinutes += 24 * 60;
    }
  }
  const diffMinutes = wakeMinutes - bedMinutes;
  const hours = Math.floor(diffMinutes / 60);
  const mins = diffMinutes % 60;
  return { hours, mins, totalMinutes: diffMinutes };
}

// --- Ebbinghaus 14-Day Achievement & Score System (100-Point System) ---
export const EBBINGHAUS_14_SCORES = {
  1: { high: 15, mid: 10, low: 5 },
  4: { high: 20, mid: 13, low: 6 },
  7: { high: 30, mid: 20, low: 10 },
  14: { high: 35, mid: 20, low: 10 }
};

export function normalizeAchievement(val) {
  if (!val) return 'mid';
  if (val === 'high' || val === 'mid' || val === 'low') return val;
  if (val === 'easy') return 'high';
  if (val === 'normal') return 'mid';
  if (val === 'hard') return 'low';
  return 'mid';
}

export function calculateLecture14Score(lec) {
  if (!lec || !lec.reviews) return null;
  const rev1 = lec.reviews.find(r => Number(r.dayOffset) === 1 && r.isCompleted);
  const rev4 = lec.reviews.find(r => Number(r.dayOffset) === 4 && r.isCompleted);
  const rev7 = lec.reviews.find(r => Number(r.dayOffset) === 7 && r.isCompleted);
  const rev14 = lec.reviews.find(r => Number(r.dayOffset) === 14 && r.isCompleted);

  // 1, 4, 7, 14일차가 모두 완료되어야 100점 만점 score14 계산
  if (!rev1 || !rev4 || !rev7 || !rev14) return null;

  const a1 = normalizeAchievement(rev1.achievement || rev1.difficulty);
  const a4 = normalizeAchievement(rev4.achievement || rev4.difficulty);
  const a7 = normalizeAchievement(rev7.achievement || rev7.difficulty);
  const a14 = normalizeAchievement(rev14.achievement || rev14.difficulty);

  const s1 = EBBINGHAUS_14_SCORES[1][a1] || 10;
  const s4 = EBBINGHAUS_14_SCORES[4][a4] || 13;
  const s7 = EBBINGHAUS_14_SCORES[7][a7] || 20;
  const s14 = EBBINGHAUS_14_SCORES[14][a14] || 20;

  const totalScore = s1 + s4 + s7 + s14;

  let verdict = 'pass';
  if (totalScore < 70) {
    verdict = 'required'; // 70점 미만: 🔴 재복습 필수
  } else if (totalScore < 80) {
    verdict = 'recommend'; // 70점 ~ 79점: 🟡 재복습 권장
  } else {
    verdict = 'pass'; // 80점 이상: 🟢 통과 (30일차 최종 인출 진행)
  }

  return {
    score14: totalScore,
    verdict,
    breakdown: {
      1: { achievement: a1, score: s1, maxScore: 15 },
      4: { achievement: a4, score: s4, maxScore: 20 },
      7: { achievement: a7, score: s7, maxScore: 30 },
      14: { achievement: a14, score: s14, maxScore: 35 }
    }
  };
}

function safeParse(str, fallback = {}) {
  try {
    if (!str) return fallback;
    if (typeof str === 'object') return str;
    // 혹시 오염된 데이터가 들어와 있으면 리턴
    if (str === '[object Object]') return fallback;
    return JSON.parse(str);
  } catch (e) {
    console.error("JSON parse error:", e);
    return fallback;
  }
}

// Initial Quest Template (Phase 1)
const INITIAL_QUESTS = [
  {
    id: 'q1',
    title: '환경 정돈: 책상 위 슥 닦기',
    description: '공부할 자리를 물티슈로 한 번 닦아주세요. 10초면 충분합니다.',
    type: 'main',
    isCompleted: false,
    skippedReason: null
  },
  {
    id: 'q2',
    title: '수분 & 산소: 물 한 잔 마시고 심호흡 3번',
    description: '뇌의 엔진을 켜기 위해 산소와 수분을 공급해줍니다. 기지개도 켜보세요.',
    type: 'main',
    isCompleted: false,
    skippedReason: null
  },
  {
    id: 'q3',
    title: '행동 개시: 5분 타이머 맞추기',
    description: '휴대폰 타이머 5분만 맞춰보세요. 5분 뒤에 바로 꺼도 누른 것 자체가 성공입니다.',
    type: 'main',
    isCompleted: false,
    skippedReason: null
  },
  {
    id: 'q4',
    title: '가벼운 환기: 방 창문 1분 열기',
    description: '신선한 공기를 방 안에 채워주세요.',
    type: 'sub',
    isCompleted: false,
    skippedReason: null
  },
  {
    id: 'q5',
    title: '기분 전환: 거울 보고 미소 짓기',
    description: '입꼬리만 살짝 올려도 뇌는 긍정적인 신호로 착각합니다.',
    type: 'sub',
    isCompleted: false,
    skippedReason: null
  }
];

export const SUBJECT_COLORS = [
  '#38bdf8', // 0: Sky (셈회)
  '#a855f7', // 1: Purple (행소)
  '#10b981', // 2: Emerald (재무)
  '#f43f5e', // 3: Rose Red (세법학 - 식사 오렌지와 완벽 분리)
  '#06b6d4', // 4: Cyan
  '#ec4899', // 5: Pink
  '#6366f1', // 6: Indigo
  '#14b8a6', // 7: Teal
  '#84cc16', // 8: Lime
];

export function getSubjectColor(subjectName, customSubjectsList = null) {
  if (!subjectName || subjectName === '기타/미지정' || subjectName === '일반') {
    return '#34d399'; // Default mint/emerald
  }
  const list = customSubjectsList || storage.getSubjects();
  const idx = list.indexOf(subjectName);
  if (idx !== -1) {
    return SUBJECT_COLORS[idx % SUBJECT_COLORS.length];
  }
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = (hash << 5) - hash + subjectName.charCodeAt(i);
  }
  return SUBJECT_COLORS[Math.abs(hash) % SUBJECT_COLORS.length];
}

export const storage = {
  _dispatchSync() {
    window.dispatchEvent(new CustomEvent('cloud-sync-needed'));
  },

  // --- Quests ---
  getCustomQuests() {
    const raw = localStorage.getItem('human-os-custom-quests');
    return safeParse(raw, INITIAL_QUESTS);
  },

  saveCustomQuests(quests) {
    localStorage.setItem('human-os-custom-quests', JSON.stringify(quests));
    this._dispatchSync();
  },

  getQuestsByDate(dateStr) {
    const rawData = localStorage.getItem(STORAGE_KEYS.QUESTS);
    const data = safeParse(rawData, {});
    
    // Default to today if not provided
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    
    if (!data[dateStr]) {
      // Clone from Custom Quests instead of INITIAL_QUESTS
      data[dateStr] = safeParse(JSON.stringify(this.getCustomQuests()), []);
      localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(data));
    } else {
      // Legacy Support: Pad if only 3 quests exist
      if (data[dateStr].length === 3) {
        const custom = this.getCustomQuests();
        data[dateStr].push(custom[3]);
        data[dateStr].push(custom[4]);
        localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(data));
      }
    }
    
    return data[dateStr];
  },
  
  saveQuestsByDate(dateStr, quests) {
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    const rawData = localStorage.getItem(STORAGE_KEYS.QUESTS);
    let data = safeParse(rawData, {});
    
    data[dateStr] = quests;
    localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(data));
    this._dispatchSync();
  },
  
  // Get history for the Pixel Map (4h: sprout, 6h: partial, 8h: completed)
  getQuestHistory(days = 30) {
    const pomoRaw = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const pomoData = safeParse(pomoRaw, {});
    
    const history = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      
      const pomo = pomoData[dateStr] || { totalMinutes: 0 };
      const totalMins = pomo.totalMinutes || 0;
      const isVac = this.isVacationDate(dateStr);
      
      let status = 'none';
      if (totalMins >= 480) {
        status = 'completed'; // 8h+ (울창)
      } else if (totalMins >= 360) {
        status = 'partial'; // 6h+ (성장)
      } else if (totalMins >= 240) {
        status = 'sprout'; // 4h+ (새싹)
      } else if (isVac) {
        status = 'hibernation';
      }
      
      history.push({ date: dateStr, status, totalMinutes: totalMins });
    }
    
    return history;
  },

  getMonthlyHistory(year, month) {
    const pomoRaw = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const pomoData = safeParse(pomoRaw, {});
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const history = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      
      const pomo = pomoData[dateStr] || { count: 0, totalMinutes: 0, timestamps: [] };
      const totalMins = pomo.totalMinutes || 0;
      const isVac = this.isVacationDate(dateStr);
      
      let status = 'none';
      if (totalMins >= 480) {
        status = 'completed'; // 8h+ (3단계 울창 🌲)
      } else if (totalMins >= 420) {
        status = 'level2'; // 7h+ (2단계 도약 🌳)
      } else if (totalMins >= 360) {
        status = 'partial'; // 6h+ (1단계 성장 🌿)
      } else if (totalMins >= 240) {
        status = 'sprout'; // 4h+ (새싹 🌱)
      } else if (isVac) {
        status = 'hibernation';
      }
      
      history.push({
        date: dateStr, 
        day, 
        status,
        totalMinutes: totalMins
      });
    }
    
    return history;
  },

  // --- Diary ---
  getDiary() {
    const raw = localStorage.getItem(STORAGE_KEYS.DIARY);
    return safeParse(raw, []);
  },

  getDiaryByDate(dateStr) {
    const allEntries = this.getDiary();
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    return allEntries.filter(e => e.dateStr === dateStr || (e.date && e.date.startsWith(dateStr)));
  },
  
  addDiaryEntry(dateStr, entry) {
    const current = this.getDiary();
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    const newEntry = {
      id: Date.now().toString(),
      dateStr: dateStr,
      timestamp: new Date().toISOString(),
      ...entry
    };
    localStorage.setItem(STORAGE_KEYS.DIARY, JSON.stringify([newEntry, ...current]));
    this._dispatchSync();
    return newEntry;
  },



  // --- Pomodoro ---
  getPomodoroByDate(dateStr) {
    const rawData = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const data = safeParse(rawData, {});
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    return data[dateStr] || { count: 0, totalMinutes: 0 };
  },

  addPomodoroByDate(dateStr, activityType = 'review') {
    const rawData = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const data = safeParse(rawData, {});
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    
    if (!data[dateStr]) {
      data[dateStr] = { count: 0, totalMinutes: 0, timestamps: [] };
    }
    
    if (!data[dateStr].timestamps) {
      data[dateStr].timestamps = [];
    }
    
    data[dateStr].count += 1;
    data[dateStr].totalMinutes += 25; // 1 Pomodoro = 25 mins
    data[dateStr].timestamps.push({ time: new Date().toISOString(), minutes: 25, activityType: activityType || 'review' });
    
    localStorage.setItem(STORAGE_KEYS.POMODORO, JSON.stringify(data));
    
    // 뽀모도로 완료 시 25 XP 지급
    this.addXP(25);
    
    this._dispatchSync();
    return data[dateStr];
  },

  removePomodoro(dateStr, timestampIndex) {
    const rawData = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const data = safeParse(rawData, {});
    if (!data[dateStr] || !data[dateStr].timestamps || data[dateStr].timestamps.length <= timestampIndex) return false;
    
    const target = data[dateStr].timestamps[timestampIndex];
    const minutes = typeof target === 'string' ? 25 : (target.minutes || 25);
    let countToRemove = 0;
    if (minutes >= 15) {
      countToRemove = Math.max(1, Math.round(minutes / 25));
    }

    data[dateStr].timestamps.splice(timestampIndex, 1);
    data[dateStr].count = Math.max(0, data[dateStr].count - countToRemove);
    data[dateStr].totalMinutes = Math.max(0, data[dateStr].totalMinutes - minutes);
    
    localStorage.setItem(STORAGE_KEYS.POMODORO, JSON.stringify(data));
    
    // Deduct XP
    this.addXP(-minutes);
    
    this._dispatchSync();
    return data[dateStr];
  },

  addCustomPomodoro(dateStr, timeStr, minutes = 25, startTimeStr = null, subject = null, activityType = 'review', endReason = null) {
    const rawData = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const data = safeParse(rawData, {});
    
    if (!data[dateStr]) {
      data[dateStr] = { count: 0, totalMinutes: 0, timestamps: [] };
    }
    if (!data[dateStr].timestamps) {
      data[dateStr].timestamps = [];
    }

    const fullTimeStr = `${dateStr}T${timeStr}:00`;

    // Deduplication safety check: Prevent logging duplicate session at the exact same minute
    const isDuplicate = data[dateStr].timestamps.some(ts => {
      const tsTime = typeof ts === 'string' ? ts : (ts.time || '');
      const tsMins = typeof ts === 'object' && ts.minutes ? ts.minutes : 25;
      return tsTime === fullTimeStr && tsMins === minutes;
    });

    if (isDuplicate) {
      console.warn("Prevented duplicate pomodoro logging for:", fullTimeStr);
      return data[dateStr];
    }
    
    // Create Date object assuming local time
    const [hours, minutesVal] = timeStr.split(':');
    const d = new Date(dateStr);
    d.setHours(parseInt(hours, 10), parseInt(minutesVal, 10), 0, 0);

    // Calculate start time if not provided
    let calculatedStart = startTimeStr;
    if (!calculatedStart) {
      const endTotalMins = parseInt(hours, 10) * 60 + parseInt(minutesVal, 10);
      const startTotalMins = (endTotalMins - minutes + 1440) % 1440;
      const startH = Math.floor(startTotalMins / 60);
      const startM = startTotalMins % 60;
      calculatedStart = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
    }
    
    let countToAdd = 0;
    if (minutes >= 15) {
      countToAdd = Math.max(1, Math.round(minutes / 25));
    }
    data[dateStr].count += countToAdd;
    data[dateStr].totalMinutes += minutes;
    data[dateStr].timestamps.push({
      time: fullTimeStr,
      minutes: minutes,
      startTime: calculatedStart,
      endTime: timeStr,
      subject: subject || null,
      activityType: activityType || 'review',
      endReason: endReason || (minutes >= 25 ? 'completed' : 'completed_early')
    });
    
    // Sort timestamps chronologically
    data[dateStr].timestamps.sort((a, b) => {
      const timeA = typeof a === 'string' ? a : (a.time || '');
      const timeB = typeof b === 'string' ? b : (b.time || '');
      return new Date(timeA) - new Date(timeB);
    });
    
    localStorage.setItem(STORAGE_KEYS.POMODORO, JSON.stringify(data));
    this.addXP(minutes);

    // Check for daily goal milestones bonus XP (4h: +50XP, 6h: +100XP, 8h: +150XP)
    const currentDayTotal = data[dateStr].totalMinutes;
    const prevDayTotal = currentDayTotal - minutes;
    const milestonesRaw = localStorage.getItem('human_os_daily_milestones_awarded');
    const milestonesAwarded = safeParse(milestonesRaw, {});
    if (!milestonesAwarded[dateStr]) milestonesAwarded[dateStr] = {};

    const milestoneChecks = [
      { threshold: 240, bonus: 40, icon: '🌱', label: '새싹 달성 (4시간 집중)' },
      { threshold: 360, bonus: 80, icon: '🌿', label: '1단계 일간 목표 (6시간 집중) 달성' },
      { threshold: 420, bonus: 120, icon: '🌳', label: '2단계 우수 목표 (7시간 집중) 달성' },
      { threshold: 480, bonus: 160, icon: '🌲', label: '3단계 완벽 목표 (8시간 울창) 달성' },
    ];

    milestoneChecks.forEach(m => {
      if (prevDayTotal < m.threshold && currentDayTotal >= m.threshold && !milestonesAwarded[dateStr][m.threshold]) {
        milestonesAwarded[dateStr][m.threshold] = true;
        localStorage.setItem('human_os_daily_milestones_awarded', JSON.stringify(milestonesAwarded));
        this.addXP(m.bonus);
        window.dispatchEvent(new CustomEvent('milestone-achieved', {
          detail: {
            threshold: m.threshold,
            bonus: m.bonus,
            icon: m.icon,
            label: m.label,
            totalMinutes: currentDayTotal
          }
        }));
      }
    });

    this._dispatchSync();
    
    return data[dateStr];
  },

  addCustomPomodoroWithMinutes(dateStr, timeStr, minutes, startTimeStr = null, subject = null, activityType = 'review', endReason = null) {
    return this.addCustomPomodoro(dateStr, timeStr, minutes, startTimeStr, subject, activityType, endReason);
  },

  getActivityStats(dateStr) {
    const data = this.getPomodoroByDate(dateStr);
    let lectureMins = 0;
    let reviewMins = 0;
    if (data && Array.isArray(data.timestamps)) {
      data.timestamps.forEach(ts => {
        const mins = (typeof ts === 'object' && ts.minutes) ? Number(ts.minutes) : 25;
        const type = (typeof ts === 'object' && ts.activityType) ? ts.activityType : 'review';
        if (type === 'lecture') {
          lectureMins += mins;
        } else {
          reviewMins += mins;
        }
      });
    }
    return {
      lectureMins,
      reviewMins,
      totalMins: data?.totalMinutes || (lectureMins + reviewMins)
    };
  },

  deletePomodoroTimestamp(dateStr, index) {
    const rawData = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const data = safeParse(rawData, {});

    if (!data[dateStr] || !data[dateStr].timestamps || !data[dateStr].timestamps[index]) {
      return null;
    }

    const removedItem = data[dateStr].timestamps.splice(index, 1)[0];
    const minutesToRemove = typeof removedItem === 'object' && removedItem.minutes ? removedItem.minutes : 25;
    
    let countToRemove = 0;
    if (minutesToRemove >= 15) {
      countToRemove = Math.max(1, Math.round(minutesToRemove / 25));
    }

    data[dateStr].totalMinutes = Math.max(0, (data[dateStr].totalMinutes || 0) - minutesToRemove);
    data[dateStr].count = Math.max(0, (data[dateStr].count || 0) - countToRemove);

    localStorage.setItem(STORAGE_KEYS.POMODORO, JSON.stringify(data));

    // Revert XP
    this.addXP(-minutesToRemove);

    // Remove matching session log if present
    const rawSessions = localStorage.getItem(STORAGE_KEYS.STUDY_SESSIONS);
    const studySessions = safeParse(rawSessions, {});
    if (studySessions[dateStr] && Array.isArray(studySessions[dateStr])) {
      const timeStr = typeof removedItem === 'string' ? removedItem : (removedItem.time || '');
      const timeOnly = timeStr.includes('T') ? timeStr.split('T')[1].substring(0, 5) : timeStr.substring(0, 5);
      
      const sIdx = studySessions[dateStr].findIndex(s => s.startTime === timeOnly || s.endTime === timeOnly);
      if (sIdx !== -1) {
        studySessions[dateStr].splice(sIdx, 1);
        localStorage.setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify(studySessions));
      }
    }

    this._dispatchSync();
    return data[dateStr];
  },

  getPomodoroTimeDistribution(days = 30) {
    const rawData = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const data = safeParse(rawData, {});
    
    // Create buckets for 0-23 hours
    const distribution = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}시`,
      minutes: 0
    }));

    const now = new Date();
    
    Object.keys(data).forEach(dateStr => {
       const entryDate = new Date(dateStr);
       const diffTime = Math.abs(now - entryDate);
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
       
       if (diffDays <= days && data[dateStr].timestamps) {
         data[dateStr].timestamps.forEach(ts => {
           const timeStr = typeof ts === 'string' ? ts : (ts.time || new Date().toISOString());
           const mins = typeof ts === 'object' && ts.minutes ? ts.minutes : 25;
           const hour = new Date(timeStr).getHours();
           if (hour >= 0 && hour < 24) {
             distribution[hour].minutes += mins;
           }
         });
       }
    });

    return distribution;
  },

  getTimeSlotSummary(days = 30) {
    const distribution = this.getPomodoroTimeDistribution(days);
    
    // 3시간 간격 8개 시간대
    const slotDefs = [
      { id: 'midnight',    label: '심야 (00~03시)',   icon: '🌌', start: 0,  end: 3 },
      { id: 'dawn',        label: '새벽 (03~06시)',   icon: '🌠', start: 3,  end: 6 },
      { id: 'earlyMorn',   label: '아침 (06~09시)',   icon: '🌅', start: 6,  end: 9 },
      { id: 'morning',     label: '오전 (09~12시)',   icon: '☀️', start: 9,  end: 12 },
      { id: 'earlyAftn',   label: '이른오후 (12~15시)', icon: '🍽️', start: 12, end: 15 },
      { id: 'afternoon',   label: '오후 (15~18시)',   icon: '📚', start: 15, end: 18 },
      { id: 'evening',     label: '저녁 (18~21시)',   icon: '🌙', start: 18, end: 21 },
      { id: 'night',       label: '밤 (21~24시)',     icon: '🌃', start: 21, end: 24 },
    ];

    let total = 0;
    const slots = slotDefs.map(def => {
      let mins = 0;
      for (let h = def.start; h < def.end; h++) {
        mins += distribution[h].minutes;
      }
      total += mins;
      return { ...def, minutes: mins };
    });

    // Calculate percentages after total is known
    slots.forEach(slot => {
      slot.percent = total > 0 ? Math.round((slot.minutes / total) * 100) : 0;
    });

    // Find golden time (highest minutes)
    const topSlot = [...slots].sort((a, b) => b.minutes - a.minutes)[0];

    return { totalMinutes: total, slots, topSlot };
  },

  getWeeklyPomodoroStats() {
    const rawData = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const data = safeParse(rawData, {});
    
    // Get Monday to Sunday of the current week
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // 1=Mon, 7=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    
    let weeklyCount = 0;
    let weeklyMinutes = 0;
    const weekData = [];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      
      const dayData = data[dateStr] || { count: 0, totalMinutes: 0, timestamps: [] };
      const validCount = (dayData.timestamps || []).filter(ts => (typeof ts === 'string' ? 25 : (ts.minutes || 25)) >= 15).length;
      weeklyCount += validCount;
      weeklyMinutes += dayData.totalMinutes;
      weekData.push({ date: dateStr, ...dayData, count: validCount });
    }
    
    return { weeklyCount, weeklyMinutes, weekData };
  },

  // --- Data Backup & Stats ---
  getAllData() {
    // Normalise vacations to ensure date, reservedAt, countsTowardQuota explicitly exist
    const rawVacations = safeParse(localStorage.getItem(STORAGE_KEYS.VACATIONS), []);
    const normalisedVacations = rawVacations.map(vac => ({
      ...vac,
      date: vac.date || vac.startDate,
      reservedAt: vac.reservedAt || vac.appliedAt || null,
      countsTowardQuota: vac.countsTowardQuota === true
    }));

    // Normalise dailyLogs to ensure defenseStatus explicitly exists
    const rawLogs = safeParse(localStorage.getItem(STORAGE_KEYS.DAILY_LOGS), {});
    const normalisedLogs = {};
    for (const [dateKey, log] of Object.entries(rawLogs)) {
      normalisedLogs[dateKey] = {
        ...log,
        defenseStatus: log.defenseStatus || 'none'
      };
    }

    return {
      quests: localStorage.getItem(STORAGE_KEYS.QUESTS),
      customQuests: localStorage.getItem('human-os-custom-quests'),
      pomodoro: localStorage.getItem(STORAGE_KEYS.POMODORO),
      diary: localStorage.getItem(STORAGE_KEYS.DIARY),
      lectures: localStorage.getItem(STORAGE_KEYS.LECTURES),
      vacations: JSON.stringify(normalisedVacations),
      studySessions: localStorage.getItem(STORAGE_KEYS.STUDY_SESSIONS),
      subjects: localStorage.getItem(STORAGE_KEYS.SUBJECTS),
      ddays: localStorage.getItem(STORAGE_KEYS.DDAYS),
      selectedSubject: localStorage.getItem('human_os_selected_subject_v1'),
      meals: localStorage.getItem(STORAGE_KEYS.MEALS),
      dailyLogs: JSON.stringify(normalisedLogs),
      supplementarySlots: localStorage.getItem(STORAGE_KEYS.SUPPLEMENTARY_SLOTS),
      theme: localStorage.getItem('dairy_theme'),
      profile: localStorage.getItem(STORAGE_KEYS.USER_PROFILE),
      version: '1.4'
    };
  },

  importData(jsonData) {
    if (!jsonData || typeof jsonData !== 'object') return false;
    
    // 파이어베이스에서 객체 형태로 직접 다운로드되었을 경우를 대비하여 stringify 처리
    const ensureString = (val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'object') return JSON.stringify(val);
      return val;
    };

    if (jsonData.quests) localStorage.setItem(STORAGE_KEYS.QUESTS, ensureString(jsonData.quests));
    if (jsonData.customQuests) localStorage.setItem('human-os-custom-quests', ensureString(jsonData.customQuests));
    if (jsonData.pomodoro) localStorage.setItem(STORAGE_KEYS.POMODORO, ensureString(jsonData.pomodoro));
    if (jsonData.diary) localStorage.setItem(STORAGE_KEYS.DIARY, ensureString(jsonData.diary));
    if (jsonData.lectures) localStorage.setItem(STORAGE_KEYS.LECTURES, ensureString(jsonData.lectures));
    if (jsonData.vacations) localStorage.setItem(STORAGE_KEYS.VACATIONS, ensureString(jsonData.vacations));
    if (jsonData.studySessions) localStorage.setItem(STORAGE_KEYS.STUDY_SESSIONS, ensureString(jsonData.studySessions));
    if (jsonData.subjects) localStorage.setItem(STORAGE_KEYS.SUBJECTS, ensureString(jsonData.subjects));
    if (jsonData.ddays) localStorage.setItem(STORAGE_KEYS.DDAYS, ensureString(jsonData.ddays));
    if (jsonData.selectedSubject) localStorage.setItem('human_os_selected_subject_v1', ensureString(jsonData.selectedSubject));
    if (jsonData.meals) localStorage.setItem(STORAGE_KEYS.MEALS, ensureString(jsonData.meals));
    if (jsonData.dailyLogs) localStorage.setItem(STORAGE_KEYS.DAILY_LOGS, ensureString(jsonData.dailyLogs));
    if (jsonData.supplementarySlots) localStorage.setItem(STORAGE_KEYS.SUPPLEMENTARY_SLOTS, ensureString(jsonData.supplementarySlots));
    if (jsonData.theme) localStorage.setItem('dairy_theme', ensureString(jsonData.theme));
    
    if (jsonData.profile) {
      const localRaw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      const localProfile = safeParse(localRaw, { totalXP: 0 });
      const cloudProfile = safeParse(ensureString(jsonData.profile), { totalXP: 0 });
      
      // 경험치가 더 높은 쪽을 유지합니다 (다운그레이드 방지)
      if (cloudProfile.totalXP >= localProfile.totalXP) {
        localStorage.setItem(STORAGE_KEYS.USER_PROFILE, ensureString(jsonData.profile));
      } else {
        // 로컬 경험치가 더 높다면 로컬을 유지하고, 클라우드에 로컬 값을 덮어씌웁니다.
        jsonData.profile = localRaw;
      }
    }
    
    this._dispatchSync();
    return true;
  },

  getAllTimeStats(startDate = '2026-10-11') {
    // Total Pomodoro
    const pomoRaw = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const pomoData = safeParse(pomoRaw, {});
    let totalPomodoroMins = 0;
    
    Object.entries(pomoData).forEach(([dateStr, day]) => {
      if (!startDate || dateStr >= startDate) {
        totalPomodoroMins += day.totalMinutes || 0;
      }
    });
    
    // Total Quests
    const questsRaw = localStorage.getItem(STORAGE_KEYS.QUESTS);
    const questsData = safeParse(questsRaw, {});
    let totalCompletedQuests = 0;
    
    Object.entries(questsData).forEach(([dateStr, dayQuests]) => {
      if (!startDate || dateStr >= startDate) {
        if (Array.isArray(dayQuests)) {
          totalCompletedQuests += dayQuests.filter(q => q.isCompleted).length;
        }
      }
    });
    
    // Total Diary Entries
    const diaryRaw = localStorage.getItem(STORAGE_KEYS.DIARY);
    const diaryData = safeParse(diaryRaw, []);
    const filteredDiary = diaryData.filter(e => {
      const d = e.dateStr || (e.date ? e.date.substring(0, 10) : '');
      return !startDate || (d && d >= startDate);
    });
    const totalDiaryEntries = filteredDiary.length;

    // Active days (days with at least pomodoro or quest or diary)
    const activeDaysSet = new Set([
      ...Object.keys(pomoData).filter(d => (!startDate || d >= startDate) && (pomoData[d].totalMinutes || 0) > 0),
      ...Object.keys(questsData).filter(d => (!startDate || d >= startDate) && Array.isArray(questsData[d]) && questsData[d].some(q => q.isCompleted || q.skippedReason)),
      ...filteredDiary.map(e => e.dateStr || (e.date ? e.date.substring(0, 10) : '')).filter(Boolean)
    ]);

    return {
      totalFocusMins: totalPomodoroMins,
      totalCompletedQuests,
      totalPomodoroMins,
      totalDiaryEntries,
      activeDays: activeDaysSet.size,
      startDate: startDate || null
    };
  },

  // Custom Subjects Management
  getSubjects() {
    const raw = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
    if (raw) {
      const parsed = safeParse(raw, null);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // Scan existing lectures to pre-populate with user's actual subjects
    const lectures = this.getLectures();
    const existing = new Set(['세화', '행소', '재무', '원가']);
    lectures.forEach(l => {
      if (l.subject && l.subject.trim()) existing.add(l.subject.trim());
    });
    return Array.from(existing);
  },

  saveSubjects(subjects) {
    if (!Array.isArray(subjects)) return;
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
    this._dispatchSync();
    window.dispatchEvent(new CustomEvent('subjects-updated'));
  },

  addSubject(name) {
    const trimmed = name?.trim();
    if (!trimmed) return;
    const list = this.getSubjects();
    if (!list.includes(trimmed)) {
      list.push(trimmed);
      this.saveSubjects(list);
    }
  },

  deleteSubject(name) {
    const list = this.getSubjects().filter(s => s !== name);
    this.saveSubjects(list);
  },

  getSubjectColor(name, customList = null) {
    return getSubjectColor(name, customList || this.getSubjects());
  },

  // Custom D-Days Management (1차, 2차 시험 등)
  getDDays() {
    const raw = localStorage.getItem(STORAGE_KEYS.DDAYS);
    const fallback = [
      { id: 'd1', label: '1차 시험', targetDate: '2027-02-28' },
      { id: 'd2', label: '2차 시험', targetDate: '2027-06-27' }
    ];
    return safeParse(raw, fallback);
  },

  saveDDays(ddays) {
    if (!Array.isArray(ddays)) return;
    localStorage.setItem(STORAGE_KEYS.DDAYS, JSON.stringify(ddays));
    this._dispatchSync();
    window.dispatchEvent(new CustomEvent('ddays-updated'));
  },

  // --- Meal Tracking (식사 시간 스톱워치 & 통계) ---
  getMeals() {
    const raw = localStorage.getItem(STORAGE_KEYS.MEALS);
    return safeParse(raw, {});
  },

  getMealsByDate(dateStr) {
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    const all = this.getMeals();
    return all[dateStr] || [];
  },

  addMeal(dateStr, startTime, endTime, minutes, menu = '') {
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    const all = this.getMeals();
    if (!all[dateStr]) all[dateStr] = [];

    const newMeal = {
      id: `meal_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      startTime: startTime || '12:00',
      endTime: endTime || '12:30',
      minutes: Math.max(1, Math.round(minutes)),
      menu: (menu || '').trim(),
      timestamp: Date.now()
    };

    all[dateStr].push(newMeal);
    all[dateStr].sort((a, b) => a.startTime.localeCompare(b.startTime));
    localStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(all));
    this._dispatchSync();
    window.dispatchEvent(new CustomEvent('meals-updated'));
    return newMeal;
  },

  removeMeal(dateStr, mealId) {
    const all = this.getMeals();
    if (!all[dateStr]) return false;
    all[dateStr] = all[dateStr].filter(m => m.id !== mealId);
    localStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(all));
    this._dispatchSync();
    window.dispatchEvent(new CustomEvent('meals-updated'));
    return true;
  },

  updateMeal(dateStr, mealId, updates) {
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    const all = this.getMeals();
    if (!all[dateStr]) return null;
    const idx = all[dateStr].findIndex(m => m.id === mealId);
    if (idx === -1) return null;
    all[dateStr][idx] = {
      ...all[dateStr][idx],
      ...updates,
      updatedAt: Date.now()
    };
    if (updates.startTime) {
      all[dateStr].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    localStorage.setItem(STORAGE_KEYS.MEALS, JSON.stringify(all));
    this._dispatchSync();
    window.dispatchEvent(new CustomEvent('meals-updated'));
    return all[dateStr][idx];
  },

  getWeeklyMealMinutes(sundayDateStr) {
    const all = this.getMeals();
    let total = 0;
    const start = new Date(sundayDateStr);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const list = all[ds] || [];
      list.forEach(m => { total += (m.minutes || 0); });
    }
    return total;
  },

  // --- Daily Logs (수면 기록 bedTime / wakeTime & 오늘의 성취도 satisfaction) ---
  getDailyLogs() {
    const raw = localStorage.getItem(STORAGE_KEYS.DAILY_LOGS);
    return safeParse(raw, {});
  },

  getDailyLogByDate(dateStr) {
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    const all = this.getDailyLogs();
    return all[dateStr] || { bedTime: '', wakeTime: '', satisfaction: null, diary: '', note: '' };
  },

  saveDailyLog(dateStr, logData) {
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    const all = this.getDailyLogs();
    const existing = all[dateStr] || { bedTime: '', wakeTime: '', satisfaction: null, diary: '', note: '' };
    const nextLog = {
      ...existing,
      ...logData,
      updatedAt: Date.now()
    };

    // 수면 시간(bedTime, wakeTime)이 입력된 경우, 취침일(bedDate)과 기상일(wakeDate)을 판별하여 JSON에 명시 기록
    const finalBedTime = nextLog.bedTime;
    const finalWakeTime = nextLog.wakeTime;
    if (finalBedTime && finalWakeTime) {
      const [bH, bM] = finalBedTime.split(':').map(Number);
      const [wH, wM] = finalWakeTime.split(':').map(Number);
      if (!isNaN(bH) && !isNaN(wH)) {
        const bTotal = bH * 60 + (bM || 0);
        const wTotal = wH * 60 + (wM || 0);
        
        // 사용자가 명시적으로 선택한 bedDateType('prev' | 'same')이 있으면 최우선 적용,
        // 없으면 bTotal > wTotal 또는 12:00 이후 취침 시 전날(prev)로 기본 추론
        let bedDateType = nextLog.bedDateType;
        if (!bedDateType || (bedDateType !== 'prev' && bedDateType !== 'same')) {
          bedDateType = (bTotal > wTotal || bH >= 12) ? 'prev' : 'same';
        }
        nextLog.bedDateType = bedDateType;

        if (bedDateType === 'prev') {
          const [y, m, d] = dateStr.split('-').map(Number);
          const prevDate = new Date(y, m - 1, d - 1);
          const prevDateStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
          nextLog.bedDate = prevDateStr;
          nextLog.wakeDate = dateStr;
        } else {
          nextLog.bedDate = dateStr;
          nextLog.wakeDate = dateStr;
        }
      }
    } else if (!finalBedTime && !finalWakeTime) {
      delete nextLog.bedDate;
      delete nextLog.wakeDate;
      delete nextLog.bedDateType;
    }

    all[dateStr] = nextLog;
    localStorage.setItem(STORAGE_KEYS.DAILY_LOGS, JSON.stringify(all));
    this._dispatchSync();
    window.dispatchEvent(new CustomEvent('daily-logs-updated', { detail: { date: dateStr, log: all[dateStr] } }));
    return all[dateStr];
  },

  setSatisfaction(dateStr, satisfaction) {
    return this.saveDailyLog(dateStr, { satisfaction });
  },

  setSleepTimes(dateStr, bedTime, wakeTime, bedDateType = null) {
    const payload = { bedTime, wakeTime };
    if (bedDateType) payload.bedDateType = bedDateType;
    return this.saveDailyLog(dateStr, payload);
  },

  // --- Daily Defense Mission Status (최저 방어선 & 정상 주행) ---
  getDailyDefenseStatus(dateStr) {
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }

    const isVac = this.isVacationDate(dateStr);
    const lectures = this.getLectures();
    const todayReviews = [];
    lectures.forEach(lec => {
      (lec.reviews || []).forEach(rev => {
        if (rev.targetDate === dateStr) {
          todayReviews.push(rev);
        }
      });
    });

    const totalReviews = todayReviews.length;
    const completedReviews = todayReviews.filter(r => r.isCompleted).length;

    // 1단계 [최저 방어선]: 오늘 예정된 에빙하우스 복습 100% 완료
    const isStep1Cleared = totalReviews > 0 && completedReviews === totalReviews;

    // 2단계 [정상 주행]: 오늘 새 강의 수강 + 해당 강의 1일차 복습 완료
    const dailySessions = this.getDailySessions(dateStr);
    const hasLectureStudySession = (dailySessions || []).some(s => s.activityType === 'lecture' && s.type === 'focus');
    const lecturesCreatedToday = lectures.filter(lec => lec.createdAt === dateStr);
    const hasNewLecture = lecturesCreatedToday.length > 0 || hasLectureStudySession;

    // 해당 강의 1일차 복습 완료: 오늘 생성된 강의 중 1일차(dayOffset === 1) 복습이 완료되었는지 확인
    const hasDay1ReviewCompleted = lecturesCreatedToday.some(lec =>
      (lec.reviews || []).some(r => r.dayOffset === 1 && r.isCompleted)
    );

    const isStep2Cleared = isStep1Cleared && hasNewLecture && hasDay1ReviewCompleted;

    let status = 'none';
    if (isStep2Cleared) {
      status = 'full_cleared';
    } else if (isStep1Cleared) {
      status = 'review_cleared';
    }

    // dailyLogs[dateStr]에 defenseStatus 저장 (하위 호환 및 백업/내보내기 필드)
    const allLogs = this.getDailyLogs();
    const existingLog = allLogs[dateStr];
    if (!existingLog || existingLog.defenseStatus !== status) {
      const updatedLog = {
        ...(existingLog || { bedTime: '', wakeTime: '', satisfaction: null, diary: '', note: '' }),
        defenseStatus: status,
        updatedAt: Date.now()
      };
      allLogs[dateStr] = updatedLog;
      localStorage.setItem(STORAGE_KEYS.DAILY_LOGS, JSON.stringify(allLogs));
    }

    return {
      status,
      isStep1Cleared,
      isStep2Cleared,
      totalReviews,
      completedReviews,
      hasNewLecture,
      hasDay1ReviewCompleted,
      isVacation: isVac
    };
  },

  // --- Supplementary Slots (막힌 문제 보충 슬롯 - 나중에 풀기/주말 보충) ---
  getSupplementarySlots() {
    const raw = localStorage.getItem(STORAGE_KEYS.SUPPLEMENTARY_SLOTS);
    const slots = safeParse(raw, []);
    // 과거 날짜순(오래된 등록일순 오름차순: 과거 날짜의 문제가 가장 먼저 보이도록 정렬)
    return slots.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0);
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0);
      if (timeA && timeB && timeA !== timeB) return timeA - timeB;
      const idA = parseInt((a.id || '').split('_')[1], 10) || 0;
      const idB = parseInt((b.id || '').split('_')[1], 10) || 0;
      return idA - idB;
    });
  },

  addSupplementarySlot({ title, subject = '', memo = '' }) {
    if (!title || !title.trim()) return null;
    const slots = this.getSupplementarySlots();
    const now = new Date();
    const dateStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    
    // Auto-detect subject from title if not explicitly given
    let resolvedSubject = (subject || '').trim();
    if (!resolvedSubject || resolvedSubject === '기타') {
      const subjects = this.getSubjects();
      for (const s of subjects) {
        if (title.includes(s)) {
          resolvedSubject = s;
          break;
        }
      }
    }
    // Fall back to currently selected subject if still empty or '기타'
    if (!resolvedSubject || resolvedSubject === '기타') {
      const currentSelected = localStorage.getItem('human_os_selected_subject_v1');
      if (currentSelected && currentSelected.trim()) {
        resolvedSubject = currentSelected.trim();
      } else {
        const subjects = this.getSubjects();
        if (subjects && subjects.length > 0) {
          resolvedSubject = subjects[0];
        }
      }
    }

    const newSlot = {
      id: `slot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: title.trim(),
      subject: resolvedSubject || '기타',
      memo: (memo || '').trim(),
      date: dateStr,
      isCompleted: false,
      completedAt: null,
      createdAt: now.toISOString()
    };

    slots.unshift(newSlot);
    localStorage.setItem(STORAGE_KEYS.SUPPLEMENTARY_SLOTS, JSON.stringify(slots));
    this._dispatchSync();
    window.dispatchEvent(new CustomEvent('supplementary-slots-updated'));
    return newSlot;
  },

  toggleSupplementarySlot(slotId) {
    const slots = this.getSupplementarySlots();
    const idx = slots.findIndex(s => s.id === slotId);
    if (idx === -1) return null;
    const isNowCompleted = !slots[idx].isCompleted;
    slots[idx].isCompleted = isNowCompleted;
    slots[idx].completedAt = isNowCompleted ? new Date().toISOString() : null;
    slots[idx].updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.SUPPLEMENTARY_SLOTS, JSON.stringify(slots));
    this._dispatchSync();
    window.dispatchEvent(new CustomEvent('supplementary-slots-updated'));
    return slots[idx];
  },

  removeSupplementarySlot(slotId) {
    let slots = this.getSupplementarySlots();
    slots = slots.filter(s => s.id !== slotId);
    localStorage.setItem(STORAGE_KEYS.SUPPLEMENTARY_SLOTS, JSON.stringify(slots));
    this._dispatchSync();
    window.dispatchEvent(new CustomEvent('supplementary-slots-updated'));
    return true;
  },

  updateSupplementarySlot(slotId, updates) {
    const slots = this.getSupplementarySlots();
    const idx = slots.findIndex(s => s.id === slotId);
    if (idx === -1) return null;
    const nextItem = { ...slots[idx], ...updates, updatedAt: new Date().toISOString() };
    if (updates && updates.isCompleted !== undefined) {
      if (updates.isCompleted && !nextItem.completedAt) {
        nextItem.completedAt = new Date().toISOString();
      } else if (!updates.isCompleted) {
        nextItem.completedAt = null;
      }
    }
    slots[idx] = nextItem;
    localStorage.setItem(STORAGE_KEYS.SUPPLEMENTARY_SLOTS, JSON.stringify(slots));
    this._dispatchSync();
    window.dispatchEvent(new CustomEvent('supplementary-slots-updated'));
    return slots[idx];
  },

  // --- Daily Goals (일간 목표 6h, 7h, 8h 차등) & Weekly Goals (주간 목표 36~42h + 휴가 반영) ---
  getDailyGoalStatus(totalMinutes) {
    const mins = Math.max(0, totalMinutes || 0);
    // 6h: 360m (1단계), 7h: 420m (2단계), 8h: 480m (3단계)
    let level = 0;
    if (mins >= 480) level = 3;
    else if (mins >= 420) level = 2;
    else if (mins >= 360) level = 1;

    let nextTarget = 360;
    let nextLabel = '1단계(6h)';
    let remainingMins = Math.max(0, 360 - mins);

    if (level === 1) {
      nextTarget = 420;
      nextLabel = '2단계(7h)';
      remainingMins = Math.max(0, 420 - mins);
    } else if (level === 2) {
      nextTarget = 480;
      nextLabel = '3단계(8h 울창)';
      remainingMins = Math.max(0, 480 - mins);
    } else if (level === 3) {
      nextTarget = 480;
      nextLabel = '3단계(8h 완벽) 달성 완료';
      remainingMins = 0;
    }

    return {
      totalMinutes: mins,
      hours: Math.floor(mins / 60),
      minsRemainder: mins % 60,
      level,
      is6hReached: mins >= 360,
      is7hReached: mins >= 420,
      is8hReached: mins >= 480,
      nextTarget,
      nextLabel,
      remainingMins
    };
  },

  getWeeklyGoalInfo(weekOffset = 0, refDate = new Date()) {
    const now = new Date(refDate);
    now.setDate(now.getDate() + weekOffset * 7);

    // Sun to Sat calendar week matching timetable and insights
    const dayOfWeek = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dayOfWeek);
    sunday.setHours(0, 0, 0, 0);

    const rawPomo = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const pomoData = safeParse(rawPomo, {});

    let weeklyMinutes = 0;
    let vacationDaysCount = 0;
    const weekDays = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const ds = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const dayMins = pomoData[ds]?.totalMinutes || 0;
      const isVac = this.isVacationDate(ds);

      weeklyMinutes += dayMins;
      if (isVac) vacationDaysCount++;

      weekDays.push({
        dateStr: ds,
        dayName: ['일', '월', '화', '수', '목', '금', '토'][i],
        minutes: dayMins,
        isVacation: isVac
      });
    }

    // Weekly Target with vacation consideration:
    // Standard week: 6 study days (with 1 day off) -> 36h (6h*6) to 42h (7h*6)
    // When vacation days V exist in this week:
    // Effective study days = Math.max(0, 6 - vacationDaysCount)
    const standardStudyDays = 6;
    const effectiveStudyDays = Math.max(0, standardStudyDays - vacationDaysCount);

    const targetMinHours = effectiveStudyDays * 6; // e.g. 36h, 30h, 24h ...
    const targetMaxHours = effectiveStudyDays * 7; // e.g. 42h, 35h, 28h ...

    const targetMinMins = targetMinHours * 60;
    const targetMaxMins = targetMaxHours * 60;

    const isMinReached = targetMinMins > 0 ? weeklyMinutes >= targetMinMins : true;
    const isMaxReached = targetMaxMins > 0 ? weeklyMinutes >= targetMaxMins : true;

    const progressPct = targetMinMins > 0
      ? Math.min(100, Math.round((weeklyMinutes / targetMinMins) * 100))
      : 100;

    const remainingToMinMins = Math.max(0, targetMinMins - weeklyMinutes);

    return {
      weeklyMinutes,
      weeklyHours: Number((weeklyMinutes / 60).toFixed(1)),
      vacationDaysCount,
      effectiveStudyDays,
      targetMinHours,
      targetMaxHours,
      targetMinMins,
      targetMaxMins,
      isMinReached,
      isMaxReached,
      progressPct,
      remainingToMinMins,
      weekDays
    };
  },

  getWeeklyGraphData(weeks = 8) {
    const rawQuests = localStorage.getItem(STORAGE_KEYS.QUESTS);
    const questsData = safeParse(rawQuests, {});
    
    const rawPomo = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const pomoData = safeParse(rawPomo, {});
    
    const now = new Date();
    const currentDayOfWeek = now.getDay() || 7; // 1-7 (Mon-Sun)
    const currentMonday = new Date(now);
    currentMonday.setDate(now.getDate() - currentDayOfWeek + 1);
    currentMonday.setHours(0, 0, 0, 0);

    const result = [];
    
    for (let w = weeks - 1; w >= 0; w--) {
      let mainQuestsCount = 0;
      let subQuestsCount = 0;
      let pomoMins = 0;
      
      const startDay = new Date(currentMonday);
      startDay.setDate(currentMonday.getDate() - w * 7);
      const endDay = new Date(startDay);
      endDay.setDate(startDay.getDate() + 6);
      
      const label = `${startDay.getMonth()+1}/${startDay.getDate()}~${endDay.getMonth()+1}/${endDay.getDate()}`;
      
      for(let i=0; i<7; i++) {
         const d = new Date(startDay);
         d.setDate(startDay.getDate() + i);
         const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
         
         if (questsData[dateStr]) {
           if(Array.isArray(questsData[dateStr])) {
             mainQuestsCount += questsData[dateStr].filter(q => q.isCompleted && q.type !== 'sub').length;
             // subquests are ignored
           }
         }
         if (pomoData[dateStr]) {
           pomoMins += pomoData[dateStr].totalMinutes || 0;
         }
      }
      
      result.push({
        name: label,
        mainQuests: mainQuestsCount,
        subQuests: subQuestsCount,
        pomodoroMins: pomoMins
      });
    }
    return result;
  },

  // --- Detailed Study Sessions & Time Waste Analysis ---
  logStudySession(dateStr, type, startTimeStr, endTimeStr, durationMins, subject = null, activityType = null, endReason = null, isCircuitBreaker = false) {
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    const raw = localStorage.getItem(STORAGE_KEYS.STUDY_SESSIONS);
    const data = safeParse(raw, {});
    if (!data[dateStr]) data[dateStr] = [];

    // Auto-resolve subject: explicit -> localStorage selected subject -> first registered subject
    let resolvedSubject = (subject || '').trim();
    if (!resolvedSubject) {
      const currentSelected = localStorage.getItem('human_os_selected_subject_v1');
      if (currentSelected && currentSelected.trim()) {
        resolvedSubject = currentSelected.trim();
      } else {
        const subjects = this.getSubjects();
        if (subjects && subjects.length > 0) {
          resolvedSubject = subjects[0];
        }
      }
    }

    // Auto-resolve activityType: explicit -> localStorage timer mode -> 'review'
    let resolvedActivityType = activityType;
    if (!resolvedActivityType) {
      resolvedActivityType = localStorage.getItem('human_os_timer_mode_v1') || 'review';
    }

    // Auto-resolve endReason: 'completed' | 'completed_early' | 'interrupted' | 'pause'
    let resolvedEndReason = endReason;
    if (!resolvedEndReason) {
      resolvedEndReason = type === 'pause' ? 'pause' : 'completed';
    }

    const newSession = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type, // 'focus' | 'pause'
      startTime: startTimeStr, // "14:00"
      endTime: endTimeStr,     // "14:25"
      durationMins: Math.max(1, Math.round(durationMins)),
      timestamp: Date.now(),
      subject: resolvedSubject || '기타',
      activityType: resolvedActivityType,
      endReason: resolvedEndReason,
      ...(isCircuitBreaker ? { isCircuitBreaker: true } : {})
    };

    data[dateStr].push(newSession);
    localStorage.setItem(STORAGE_KEYS.STUDY_SESSIONS, JSON.stringify(data));
    this._dispatchSync();
    return newSession;
  },

  getDailySessions(dateStr) {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDY_SESSIONS);
    const data = safeParse(raw, {});
    return data[dateStr] || [];
  },

  getDailySessionTimeline(dateStr) {
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    const sessions = this.getDailySessions(dateStr);
    const pomodoroData = this.getPomodoroByDate(dateStr);

    // Create 144 slots (10-minute granularity for 24 hours)
    const slots = Array.from({ length: 144 }, (_, idx) => {
      const hour = Math.floor(idx / 6);
      const minute = (idx % 6) * 10;
      const hourStr = hour.toString().padStart(2, '0');
      const minStr = minute.toString().padStart(2, '0');
      
      const nextTotalMins = (idx + 1) * 10;
      const nextHour = Math.floor(nextTotalMins / 60) % 24;
      const nextMin = nextTotalMins % 60;
      const nextHourStr = nextHour.toString().padStart(2, '0');
      const nextMinStr = nextMin.toString().padStart(2, '0');
      
      const isSleepTime = hour >= 23 || hour < 5;

      return {
        idx,
        hour,
        minute,
        label: `${hourStr}:${minStr}`,
        fullRangeLabel: `${hourStr}:${minStr} ~ ${nextHourStr}:${nextMinStr}`,
        isSleepTime,
        focusMins: 0,
        pauseMins: 0,
        capacityMins: 10
      };
    });

    // 1. Detailed study sessions
    if (sessions && sessions.length > 0) {
      sessions.forEach(sess => {
        if (!sess.startTime) return;
        const [hStr, mStr] = sess.startTime.split(':');
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr || '0', 10);
        if (!isNaN(h) && h >= 0 && h < 24) {
          const slotIdx = h * 6 + Math.min(5, Math.floor(m / 10));
          const mins = Math.min(10, sess.durationMins || 1);
          if (sess.type === 'focus') {
            slots[slotIdx].focusMins = Math.min(10, slots[slotIdx].focusMins + mins);
          } else if (sess.type === 'pause') {
            slots[slotIdx].pauseMins = Math.min(10, slots[slotIdx].pauseMins + mins);
          }
        }
      });
    }

    // 2. Legacy Pomodoro timestamps backward compatibility integration
    if (pomodoroData && pomodoroData.timestamps && pomodoroData.timestamps.length > 0) {
      pomodoroData.timestamps.forEach(ts => {
        let hour = -1;
        let minute = 0;
        let mins = 25;

        let timeStr = typeof ts === 'string' ? ts : (ts && ts.time ? ts.time : '');
        mins = (typeof ts === 'object' && ts.minutes) ? ts.minutes : 25;

        if (timeStr) {
          if (timeStr.includes('T')) {
            const timePart = timeStr.split('T')[1];
            if (timePart && timePart.includes(':')) {
              const parts = timePart.split(':');
              hour = parseInt(parts[0], 10);
              minute = parseInt(parts[1], 10);
              if (timeStr.endsWith('Z')) {
                const dObj = new Date(timeStr);
                hour = dObj.getHours();
                minute = dObj.getMinutes();
              }
            }
          } else if (timeStr.includes(':')) {
            const parts = timeStr.split(':');
            hour = parseInt(parts[0], 10);
            minute = parseInt(parts[1] || '0', 10);
          }
        }

        if (!isNaN(hour) && hour >= 0 && hour < 24) {
          // The recorded time is the COMPLETION time. Calculate actual START time.
          const completionTotalMins = hour * 60 + (isNaN(minute) ? 0 : minute);
          const startTotalMins = Math.max(0, completionTotalMins - mins);
          const startHour = Math.floor(startTotalMins / 60);
          const startMin = startTotalMins % 60;
          const startSlotIdx = Math.min(143, startHour * 6 + Math.floor(startMin / 10));
          
          let remaining = mins;
          for (let currIdx = startSlotIdx; currIdx < 144 && remaining > 0; currIdx++) {
            const alloc = Math.min(10 - slots[currIdx].focusMins, remaining);
            if (alloc > 0) {
              slots[currIdx].focusMins += alloc;
              remaining -= alloc;
            }
          }
        }
      });
    }

    // 3. Fallback: If totalMinutes in pomodoroData exceeds timeline focusMins, auto-allocate remaining mins
    if (pomodoroData && pomodoroData.totalMinutes > 0) {
      const currentTimelineFocusMins = slots.reduce((sum, slot) => sum + slot.focusMins, 0);
      if (pomodoroData.totalMinutes > currentTimelineFocusMins) {
        let remainingToDistribute = pomodoroData.totalMinutes - currentTimelineFocusMins;
        // Distribute fallback to active daytime 10-min slots starting from 09:00 (slots 54 to 137)
        for (let idx = 54; idx <= 137 && remainingToDistribute > 0; idx++) {
          const add = Math.min(10 - slots[idx].focusMins, remainingToDistribute);
          if (add > 0) {
            slots[idx].focusMins += add;
            remainingToDistribute -= add;
          }
        }
      }
    }

    slots.forEach(slot => {
      slot.idleMins = Math.max(0, 10 - slot.focusMins - slot.pauseMins);
      if (slot.focusMins > 0) {
        slot.status = 'focus';
      } else if (slot.pauseMins > 0) {
        slot.status = 'pause';
      } else if (slot.isSleepTime) {
        slot.status = 'sleep';
      } else {
        slot.status = 'idle';
      }
    });

    return slots;
  },

  getTimeWasteAnalysis(daysCount = 7) {
    const dailyTrends = [];
    // 144 slots aggregate
    const slotAggregate = Array.from({ length: 144 }, (_, idx) => {
      const hour = Math.floor(idx / 6);
      const minute = (idx % 6) * 10;
      const hourStr = hour.toString().padStart(2, '0');
      const minStr = minute.toString().padStart(2, '0');

      const nextTotalMins = (idx + 1) * 10;
      const nextHour = Math.floor(nextTotalMins / 60) % 24;
      const nextMin = nextTotalMins % 60;
      const nextHourStr = nextHour.toString().padStart(2, '0');
      const nextMinStr = nextMin.toString().padStart(2, '0');

      return {
        idx,
        hour,
        minute,
        label: `${hourStr}:${minStr} ~ ${nextHourStr}:${nextMinStr}`,
        isSleepTime: hour >= 23 || hour < 5,
        totalFocusMins: 0,
        totalPauseMins: 0,
        totalIdleMins: 0
      };
    });

    const today = new Date();
    let totalAllFocusMins = 0;
    let totalAllPauseMins = 0;
    let totalAllIdleMins = 0;

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const dayName = ['일','월','화','수','목','금','토'][d.getDay()];

      const timeline = this.getDailySessionTimeline(dateStr);
      let dayFocus = 0;
      let dayPause = 0;

      // Active waking hours: 05:00 ~ 23:00 (slots 30 to 137 = 108 slots * 10m = 1,080m = 18시간)
      const activeWindowSlots = timeline.filter(s => !s.isSleepTime);
      activeWindowSlots.forEach(slot => {
        dayFocus += slot.focusMins;
        dayPause += slot.pauseMins;

        slotAggregate[slot.idx].totalFocusMins += slot.focusMins;
        slotAggregate[slot.idx].totalPauseMins += slot.pauseMins;
        const wasteInSlot = Math.max(0, 10 - slot.focusMins - slot.pauseMins);
        slotAggregate[slot.idx].totalIdleMins += wasteInSlot;
      });

      // 18시간(1,080분) 중 공부/휴식 안 한 비어있는 시간 = 낭비 시간 (취침시간 23:00~05:00 6시간 제외)
      const dayWaste = Math.max(0, 1080 - dayFocus - dayPause);

      totalAllFocusMins += dayFocus;
      totalAllPauseMins += dayPause;
      totalAllIdleMins += dayWaste;

      dailyTrends.push({
        date: dateStr.substring(5),
        fullDate: dateStr,
        dayName,
        focusMins: dayFocus,
        pauseMins: dayPause,
        wasteMins: dayWaste
      });
    }

    // Top 3 waste slots among active waking hours (Calculated based on 1-HOUR intervals for practical insights)
    const hourlyAggregate = Array.from({ length: 24 }, (_, hour) => {
      let timeLabel = '';
      if (hour >= 5 && hour < 12) timeLabel = '오전';
      else if (hour >= 12 && hour < 18) timeLabel = '오후';
      else if (hour >= 18 && hour < 23) timeLabel = '저녁';
      else timeLabel = '밤/취침';

      const nextHourStr = (hour + 1).toString().padStart(2, '0');
      const hourStr = hour.toString().padStart(2, '0');

      return {
        hour,
        label: `${timeLabel} ${hourStr}:00 ~ ${nextHourStr}:00`,
        isSleepTime: hour >= 23 || hour < 5,
        totalFocusMins: 0,
        totalPauseMins: 0,
        totalIdleMins: 0
      };
    });

    // Sum up 10-min slots into 1-hour buckets for active waking hours
    slotAggregate.filter(s => !s.isSleepTime).forEach(slot => {
      hourlyAggregate[slot.hour].totalFocusMins += slot.totalFocusMins;
      hourlyAggregate[slot.hour].totalPauseMins += slot.totalPauseMins;
      hourlyAggregate[slot.hour].totalIdleMins += slot.totalIdleMins;
    });

    const activeHourlyAgg = hourlyAggregate.filter(h => !h.isSleepTime);
    const sortedByWaste = [...activeHourlyAgg].sort((a, b) => b.totalIdleMins - a.totalIdleMins);

    const topIdleSlots = sortedByWaste.slice(0, 3).map(slot => {
      const avgIdleMins = Math.round(slot.totalIdleMins / daysCount);
      return {
        hour: slot.hour,
        label: slot.label,
        avgIdleMins,
        totalFocusMins: slot.totalFocusMins
      };
    });

    return {
      dailyTrends,
      topIdleSlots,
      totalFocusMins: totalAllFocusMins,
      totalPauseMins: totalAllPauseMins,
      totalWasteMins: totalAllIdleMins,
      avgDailyFocusMins: Math.round(totalAllFocusMins / daysCount),
      avgDailyWasteMins: Math.round(totalAllIdleMins / daysCount)
    };
  },

  triggerBackupDownload() {
    const data = this.getAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const localDateStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    a.href = url;
    a.download = `human-os-backup-${localDateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // --- Theme Management ---
  getTheme() {
    return localStorage.getItem('dairy_theme') || 'theme-pixel';
  },

  setTheme(themeName) {
    localStorage.setItem('dairy_theme', themeName);
  },

  // --- RPG Gamification ---
  getUserProfile() {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    if (!raw || raw === '[object Object]') {
       // 최초 진입 시 혹시 과거 기록이 있으면 모두 모아서 계산
       this.recalculateTotalXP();
    }
    const updatedRaw = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
    return safeParse(updatedRaw, { totalXP: 0 });
  },

  recalculateTotalXP() {
    // 저장된 모든 퀘스트와 뽀모도로를 긁어모아 정확한 XP를 재계산합니다. (오류 복구용)
    const { totalCompletedQuests, totalPomodoroMins } = this.getAllTimeStats(null);
    // 메인=10, 서브=5 지만, stats에서 구분이 어려우면 일괄 재계산
    
    const questsRaw = localStorage.getItem(STORAGE_KEYS.QUESTS);
    const questsData = safeParse(questsRaw, {});
    let calculatedXP = 0;
    
    Object.values(questsData).forEach(dayQuests => {
      if (Array.isArray(dayQuests)) {
        const mainQuests = dayQuests.filter(q => q.type === 'main' || !q.type);
        dayQuests.forEach(q => {
          if (q.isCompleted) {
            if (q.type === 'sub') {
              calculatedXP += 5;
            } else {
              const idx = mainQuests.findIndex(mq => mq.id === q.id);
              calculatedXP += (idx + 1) * 10;
            }
          }
        });
      }
    });

    const pomoRaw = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const pomoData = safeParse(pomoRaw, {});
    Object.values(pomoData).forEach(day => {
      if (day) {
        if (day.timestamps && day.timestamps.length > 0) {
          day.timestamps.forEach(ts => {
            const minutes = typeof ts === 'string' ? 25 : (ts.minutes || 25);
            calculatedXP += minutes;
          });
        } else if (typeof day.count === 'number') {
          calculatedXP += (day.count * 25);
        }
      }
    });

    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify({ totalXP: calculatedXP }));
    this._dispatchSync();
    return calculatedXP;
  },

  addXP(points) {
    const profile = this.getUserProfile();
    const oldLevelInfo = this.getLevelInfo(profile.totalXP);
    
    profile.totalXP += points;
    if (profile.totalXP < 0) profile.totalXP = 0; // 마이너스 방지
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    this._dispatchSync();

    if (points > 0) {
      const newLevelInfo = this.getLevelInfo(profile.totalXP);
      if (newLevelInfo.level > oldLevelInfo.level) {
        // Dispatch level-up event for celebration fanfare
        window.dispatchEvent(new CustomEvent('level-up', {
          detail: {
            oldLevel: oldLevelInfo.level,
            newLevel: newLevelInfo.level,
            title: newLevelInfo.title,
            tier: newLevelInfo.tier,
            tierName: newLevelInfo.tierName,
            tierColor: newLevelInfo.tierColor,
            avatarRank: newLevelInfo.avatarRank
          }
        }));
      }
    }

    return profile.totalXP;
  },

  getLevelInfo(totalXP) {
    let level = 1;
    let accumulatedXP = 0;
    let xpIntoLevel = totalXP;
    let xpForNextLevel = 0;
    
    while (true) {
      // RPG Curve: Fast early game, slow late game.
      let currentTotal = Math.floor(7.5 * Math.pow(level, 2.05));
      let nextTotal = Math.floor(7.5 * Math.pow(level + 1, 2.05));
      let requiredForNext = nextTotal - currentTotal;
      
      if (xpIntoLevel >= requiredForNext) {
        xpIntoLevel -= requiredForNext;
        accumulatedXP += requiredForNext;
        level++;
      } else {
        xpForNextLevel = requiredForNext;
        break;
      }
    }
    
    // 5 Tiers with Divisions
    let tier = 'bronze';
    let tierName = '브론즈';
    let tierColor = '#cd7f32';
    let title = '🥉 브론즈 III (시작하는 도전자)';
    let avatarRank = 0; // 0: adventurer, 1: rank1, 2: rank2, 3: rank3, 4: rank4

    if (level < 4) {
      tier = 'bronze'; tierName = '브론즈 III'; tierColor = '#cd7f32'; title = '🥉 브론즈 III (시작하는 도전자)'; avatarRank = 0;
    } else if (level < 7) {
      tier = 'bronze'; tierName = '브론즈 II'; tierColor = '#cd7f32'; title = '🥉 브론즈 II (습관 형성러)'; avatarRank = 0;
    } else if (level < 10) {
      tier = 'bronze'; tierName = '브론즈 I'; tierColor = '#cd7f32'; title = '🥉 브론즈 I (집중 루키)'; avatarRank = 0;
    } else if (level < 16) {
      tier = 'silver'; tierName = '실버 III'; tierColor = '#94a3b8'; title = '🥈 실버 III (열정 수험생)'; avatarRank = 1;
    } else if (level < 23) {
      tier = 'silver'; tierName = '실버 II'; tierColor = '#94a3b8'; title = '🥈 실버 II (지식 탐구자)'; avatarRank = 1;
    } else if (level < 30) {
      tier = 'silver'; tierName = '실버 I'; tierColor = '#94a3b8'; title = '🥈 실버 I (흔들림 없는 러너)'; avatarRank = 1;
    } else if (level < 43) {
      tier = 'gold'; tierName = '골드 III'; tierColor = '#f59e0b'; title = '🥇 골드 III (정예 수험생)'; avatarRank = 2;
    } else if (level < 56) {
      tier = 'gold'; tierName = '골드 II'; tierColor = '#f59e0b'; title = '🥇 골드 II (고수 회독러)'; avatarRank = 2;
    } else if (level < 70) {
      tier = 'gold'; tierName = '골드 I'; tierColor = '#f59e0b'; title = '🥇 골드 I (합격 안정권)'; avatarRank = 2;
    } else if (level < 86) {
      tier = 'platinum'; tierName = '플래티넘 III'; tierColor = '#06b6d4'; title = '💎 플래티넘 III (회독 장인)'; avatarRank = 3;
    } else if (level < 103) {
      tier = 'platinum'; tierName = '플래티넘 II'; tierColor = '#06b6d4'; title = '💎 플래티넘 II (절대 집중자)'; avatarRank = 3;
    } else if (level < 120) {
      tier = 'platinum'; tierName = '플래티넘 I'; tierColor = '#06b6d4'; title = '💎 플래티넘 I (합격 수석권)'; avatarRank = 3;
    } else {
      tier = 'master'; tierName = '그랜드 마스터'; tierColor = '#a855f7'; title = '👑 그랜드 마스터 (최종 합격 · 예비 세무사)'; avatarRank = 4;
    }

    const progressPercent = Math.min(100, Math.floor((xpIntoLevel / xpForNextLevel) * 100));

    return {
      level,
      tier,
      tierName,
      tierColor,
      title,
      avatarRank,
      totalXP,
      xpIntoLevel,
      xpNeededForLevel: xpForNextLevel,
      progressPercent
    };
  },

  // --- Phase 2: Ebbinghaus Lectures ---
  getLectures() {
    const raw = localStorage.getItem(STORAGE_KEYS.LECTURES);
    return safeParse(raw, []);
  },

  isVacationDate(dateStr) {
    if (!dateStr) return false;
    const vacations = this.getVacations();
    return vacations.some(vac => dateStr >= vac.startDate && dateStr <= vac.endDate);
  },

  _dateToStr(d) {
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  },

  getAdjustedTargetDate(dateStr) {
    let currentStr = dateStr;
    const vacations = this.getVacations();
    if (!vacations || vacations.length === 0) return currentStr;

    let safetyCounter = 0;
    while (this.isVacationDate(currentStr) && safetyCounter < 365) {
      const d = new Date(currentStr + 'T00:00:00');
      d.setDate(d.getDate() + 1);
      currentStr = this._dateToStr(d);
      safetyCounter++;
    }
    return currentStr;
  },

  // Core: Count `offset` non-vacation days from startDateStr
  // Vacation days are treated as "non-existent" and don't count toward the interval
  getDateAfterNonVacationDays(startDateStr, offset) {
    const current = new Date(startDateStr + 'T00:00:00');
    let counted = 0;
    let safety = 0;
    while (counted < offset && safety < 730) {
      current.setDate(current.getDate() + 1);
      const str = this._dateToStr(current);
      if (!this.isVacationDate(str)) {
        counted++;
      }
      safety++;
    }
    return this._dateToStr(current);
  },

  // Get target review date: 1일차 is same day (당일 시작), 4/7/14/30 are spaced by non-vacation days
  getTargetDateForReview(baseDateStr, offset) {
    if (offset === 1) {
      // 1일차 복습: 공부한 당일 시작
      return this.getAdjustedTargetDate(baseDateStr);
    }
    return this.getDateAfterNonVacationDays(baseDateStr, offset);
  },

  addLecture(subject, title, dateStr) {
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    
    const lectures = this.getLectures();
    
    // Ebbinghaus intervals: 1(당일), 4, 7, 14, 30 days (vacation days are invisible/skipped)
    const intervals = [1, 4, 7, 14, 30];
    
    const reviews = intervals.map(offset => {
      // 1일차는 공부한 당일(0일 뒤), 이후 4, 7, 14, 30은 해당 일수 뒤
      const targetDateStr = this.getTargetDateForReview(dateStr, offset);

      return {
        id: `rev_${Date.now()}_${offset}`,
        dayOffset: offset,
        targetDate: targetDateStr,
        isCompleted: false,
        completedAt: null
      };
    });

    const newLecture = {
      id: `lec_${Date.now()}`,
      dateAdded: dateStr,
      subject: subject || '기타',
      title: title,
      reviews: reviews
    };

    lectures.push(newLecture);
    localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
    this._dispatchSync();
    return newLecture;
  },

  deleteLecture(lectureId) {
    let lectures = this.getLectures();
    // Revert XP for any completed reviews
    const target = lectures.find(l => l.id === lectureId);
    if (target) {
      let xpToRevert = 0;
      target.reviews.forEach(r => {
        if (r.isCompleted) xpToRevert += 15; // 15 XP per review
      });
      if (xpToRevert > 0) this.addXP(-xpToRevert);
    }
    lectures = lectures.filter(l => l.id !== lectureId);
    localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
    this._dispatchSync();
  },

  completeReview(lectureId, reviewId, achievement = 'mid') {
    const lectures = this.getLectures();
    let found = false;
    let score14Result = null;
    const now = new Date();
    const actualCompletedDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const normAch = normalizeAchievement(achievement);

    lectures.forEach(lec => {
      if (lec.id === lectureId) {
        lec.reviews.forEach(rev => {
          if (rev.id === reviewId) {
            rev.isCompleted = true;
            rev.completedAt = now.toISOString();
            rev.completedDate = actualCompletedDate;
            rev.scheduledDate = rev.targetDate;

            if (rev.targetDate && actualCompletedDate > rev.targetDate) {
              const [tY, tM, tD] = rev.targetDate.split('-').map(Number);
              const [cY, cM, cD] = actualCompletedDate.split('-').map(Number);
              const diffDays = Math.max(1, Math.round((new Date(cY, cM - 1, cD) - new Date(tY, tM - 1, tD)) / (1000 * 60 * 60 * 24)));
              rev.isDelayed = true;
              rev.delayedDays = diffDays;
              rev.delayNote = `${rev.targetDate} 복습 과제를 ${actualCompletedDate}에 ${diffDays}일 지연 완료함`;
            } else {
              rev.isDelayed = false;
              rev.delayedDays = 0;
            }

            rev.achievement = normAch; // "high" | "mid" | "low"
            // 하위 호환 difficulty 필드 동기화
            rev.difficulty = normAch === 'high' ? 'easy' : (normAch === 'low' ? 'hard' : 'normal');
            found = true;
          }
        });

        // 14일차 포함 1,4,7,14 채점 계산
        const evalResult = calculateLecture14Score(lec);
        if (evalResult) {
          lec.score14 = evalResult.score14;
          lec.verdict14 = evalResult.verdict;
          lec.score14CalculatedAt = now.toISOString();
          lec.score14Breakdown = evalResult.breakdown;
          score14Result = {
            lectureId: lec.id,
            subject: lec.subject,
            title: lec.title,
            ...evalResult
          };
        }
      }
    });

    if (found) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
      this.addXP(15);
      this._dispatchSync();
    }
    return { lectures, score14Result };
  },

  setReviewAchievement(lectureId, reviewId, achievement) {
    const lectures = this.getLectures();
    let found = false;
    let score14Result = null;
    const now = new Date();
    const normAch = normalizeAchievement(achievement);

    lectures.forEach(lec => {
      if (lec.id === lectureId) {
        lec.reviews.forEach(rev => {
          if (rev.id === reviewId) {
            rev.achievement = normAch;
            rev.difficulty = normAch === 'high' ? 'easy' : (normAch === 'low' ? 'hard' : 'normal');
            found = true;
          }
        });

        const evalResult = calculateLecture14Score(lec);
        if (evalResult) {
          lec.score14 = evalResult.score14;
          lec.verdict14 = evalResult.verdict;
          lec.score14CalculatedAt = now.toISOString();
          lec.score14Breakdown = evalResult.breakdown;
          score14Result = {
            lectureId: lec.id,
            subject: lec.subject,
            title: lec.title,
            ...evalResult
          };
        }
      }
    });

    if (found) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
      this._dispatchSync();
    }
    return { lectures, score14Result };
  },

  setReviewDifficulty(lectureId, reviewId, difficulty = null) {
    return this.setReviewAchievement(lectureId, reviewId, difficulty);
  },

  undoReview(lectureId, reviewId) {
    const lectures = this.getLectures();
    let found = false;
    
    lectures.forEach(lec => {
      if (lec.id === lectureId) {
        lec.reviews.forEach(rev => {
          if (rev.id === reviewId && rev.isCompleted) {
            rev.isCompleted = false;
            rev.completedAt = null;
            delete rev.completedDate;
            delete rev.scheduledDate;
            delete rev.isDelayed;
            delete rev.delayedDays;
            delete rev.delayNote;
            delete rev.difficulty;
            delete rev.achievement;
            delete rev.needsReReview;
            delete rev.reReviewStatus;
            delete rev.hardRecordedAt;
            delete rev.easyRecordedAt;
            delete rev.normalRecordedAt;
            delete rev.reReviewCompletedAt;
            found = true;
          }
        });

        // 4개 회차 중 일부가 취소되면 score14 재계산 또는 정리
        const evalResult = calculateLecture14Score(lec);
        if (evalResult) {
          lec.score14 = evalResult.score14;
          lec.verdict14 = evalResult.verdict;
          lec.score14Breakdown = evalResult.breakdown;
        } else {
          delete lec.score14;
          delete lec.verdict14;
          delete lec.score14CalculatedAt;
          delete lec.score14Breakdown;
        }
      }
    });

    if (found) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
      this.addXP(-15);
      this._dispatchSync();
    }
    return lectures;
  },

  // 4. [+ 재복습 등록] 원클릭 복제 기능
  registerReReviewLecture(lectureId) {
    const lectures = this.getLectures();
    const target = lectures.find(l => l.id === lectureId);
    if (!target) return null;

    const d = new Date();
    const todayStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

    // 제목 앞에 [재복습] 붙이기
    let baseTitle = target.title.trim();
    let newTitle = '';
    if (!baseTitle.startsWith('[재복습]')) {
      newTitle = `[재복습] ${baseTitle}`;
    } else {
      // 이미 [재복습]이 붙어있는 경우 [재복습 2회차] 등으로 깔끔하게 확장
      const roundMatch = baseTitle.match(/^\[재복습\s*(\d+)회차\]\s*(.*)$/);
      if (roundMatch) {
        const nextRound = parseInt(roundMatch[1], 10) + 1;
        newTitle = `[재복습 ${nextRound}회차] ${roundMatch[2]}`;
      } else {
        const pureTitle = baseTitle.replace(/^\[재복습\]\s*/, '');
        newTitle = `[재복습 2회차] ${pureTitle}`;
      }
    }

    // 원본 강의에 재복습 생성 플래그 기록
    target.hasReReviewRegistered = true;
    target.reReviewRegisteredAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));

    // 오늘 날짜를 기준으로 새로운 1-4-7-14-30 복습 스케줄 생성
    const newLec = this.addLecture(target.subject, newTitle, todayStr);
    return newLec;
  },

  // 하위 호환용 stubs (기존 수동 재복습 UI 삭제에 따른 안전 처리)
  getReReviewList() {
    return [];
  },

  toggleReReviewComplete(lectureId, reviewId) {
    return this.getLectures();
  },

  removeReReview(lectureId, reviewId) {
    return this.getLectures();
  },

  getReviewsForDate(dateStr) {
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    const lectures = this.getLectures();
    const todaysReviews = [];
    
    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        if (rev.targetDate === dateStr) {
          todaysReviews.push({
            lectureId: lec.id,
            subject: lec.subject,
            title: lec.title,
            ...rev
          });
        }
      });
    });
    
    return todaysReviews;
  },

  postponeReview(lectureId, reviewId, days = 1) {
    const shiftDays = Number(days) || 1;
    const lectures = this.getLectures();
    lectures.forEach(lec => {
      if (lec.id === lectureId) {
        lec.reviews.forEach(rev => {
          if (rev.id === reviewId) {
            if (shiftDays > 0) {
              rev.targetDate = this.getDateAfterNonVacationDays(rev.targetDate, shiftDays);
            } else if (shiftDays < 0) {
              const prevDate = this.getNonVacationDayBefore(rev.targetDate, Math.abs(shiftDays));
              if (lec.dateAdded && prevDate < lec.dateAdded) {
                rev.targetDate = lec.dateAdded;
              } else {
                rev.targetDate = prevDate;
              }
            }
          }
        });
      }
    });
    localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
    this._dispatchSync();
  },

  moveAllOverdueToToday() {
    const todayStr = this._dateToStr(new Date());
    const adjustedTodayStr = this.getAdjustedTargetDate(todayStr);
    const lectures = this.getLectures();
    let count = 0;
    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        if (!rev.isCompleted && rev.targetDate < todayStr) {
          rev.targetDate = adjustedTodayStr;
          count++;
        }
      });
    });
    if (count > 0) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
      this._dispatchSync();
    }
    return count;
  },

  distributeOverdueReviews(maxPerDay = 2) {
    const todayStr = this._dateToStr(new Date());
    const lectures = this.getLectures();
    
    // Collect all uncompleted overdue reviews
    const overdueList = [];
    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        if (!rev.isCompleted && rev.targetDate < todayStr) {
          overdueList.push(rev);
        }
      });
    });

    if (overdueList.length === 0) return 0;

    let currentStr = this.getAdjustedTargetDate(todayStr);
    let countInCurrentDay = 0;

    overdueList.forEach(rev => {
      if (countInCurrentDay >= maxPerDay) {
        currentStr = this.getDateAfterNonVacationDays(currentStr, 1);
        countInCurrentDay = 0;
      }

      rev.targetDate = currentStr;
      countInCurrentDay++;
    });

    localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
    this._dispatchSync();
    return overdueList.length;
  },

  // Aliases for overdue redistribution
  redistributeOverdueReviews(maxPerDay = 2) {
    return this.distributeOverdueReviews(maxPerDay);
  },

  redistributeOverdueReviewsSmart(maxPerDay = 3) {
    return this.smartEbbinghausRedistribute(maxPerDay);
  },

  moveOverdueReviewsToDate(dateStr) {
    return this.moveAllOverdueToToday();
  },

  reanchorEbbinghausFromToday(stagger = false) {
    const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const lectures = this.getLectures();
    let resetCount = 0;

    lectures.forEach((lec, lecIdx) => {
      lec.reviews.sort((a, b) => a.dayOffset - b.dayOffset);
      const completedCount = lec.reviews.filter(r => r.isCompleted).length;

      lec.reviews.forEach((r, idx) => {
        const shouldBeCompleted = idx < completedCount;
        if (r.isCompleted !== shouldBeCompleted) {
          r.isCompleted = shouldBeCompleted;
          r.completedAt = shouldBeCompleted ? (r.completedAt || new Date().toISOString()) : null;
          resetCount++;
        }
      });

      const uncompleted = lec.reviews.filter(r => !r.isCompleted);
      if (uncompleted.length === 0) return;

      const baseStart = new Date(todayStr + 'T00:00:00');
      if (stagger) {
        baseStart.setDate(baseStart.getDate() + lecIdx);
      }

      const firstOffset = uncompleted[0].dayOffset;
      uncompleted.forEach(rev => {
        const relativeOffset = Math.max(0, rev.dayOffset - firstOffset);
        const targetDate = new Date(baseStart);
        targetDate.setDate(baseStart.getDate() + relativeOffset);
        
        const rawTargetStr = new Date(targetDate.getTime() - (targetDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const adjustedTargetStr = this.getAdjustedTargetDate(rawTargetStr);

        if (rev.targetDate !== adjustedTargetStr) {
          rev.targetDate = adjustedTargetStr;
          resetCount++;
        }
      });
    });

    if (resetCount > 0) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
      this._dispatchSync();
    }
    return resetCount;
  },

  smartEbbinghausRedistribute(maxPerDay = 3) {
    const todayStr = this._dateToStr(new Date());
    const lectures = this.getLectures();
    let resetCount = 0;

    // ---- Step 1: Pull overdue reviews forward to today while STRICTLY PRESERVING relative 14714 offsets ----
    lectures.forEach(lec => {
      lec.reviews.sort((a, b) => a.dayOffset - b.dayOffset);
      const uncompleted = lec.reviews.filter(r => !r.isCompleted);
      if (uncompleted.length === 0) return;

      const firstUncompleted = uncompleted[0];

      // Calculate ideal vacation-aware date for first uncompleted review
      let idealFirstDate = this.getTargetDateForReview(lec.dateAdded, firstUncompleted.dayOffset);
      let anchorDate = idealFirstDate < todayStr ? this.getAdjustedTargetDate(todayStr) : idealFirstDate;

      const effFirst = firstUncompleted.dayOffset === 1 ? 0 : firstUncompleted.dayOffset;

      uncompleted.forEach(rev => {
        // Gap in 14714 offset days from the first uncompleted review
        const effRev = rev.dayOffset === 1 ? 0 : rev.dayOffset;
        const gapOffset = effRev - effFirst;

        // Target date is `anchorDate` + `gapOffset` non-vacation days!
        // This guarantees that relative 14714 intervals (e.g. 7d -> 14d gap = 7 days) are 100% PRESERVED even when pulled forward!
        const targetDate = gapOffset === 0 ? anchorDate : this.getDateAfterNonVacationDays(anchorDate, gapOffset);

        if (rev.targetDate !== targetDate) {
          rev.targetDate = targetDate;
          resetCount++;
        }
      });
    });

    // ---- Step 2: Smooth daily load (max N per day, default 3) without compressing relative spacing ----
    const uncompletedReviews = [];
    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        if (!rev.isCompleted) {
          uncompletedReviews.push({
            lecDateAdded: lec.dateAdded,
            lecId: lec.id,
            rev: rev
          });
        }
      });
    });

    uncompletedReviews.sort((a, b) => {
      if (a.rev.targetDate !== b.rev.targetDate) {
        return a.rev.targetDate.localeCompare(b.rev.targetDate);
      }
      if (a.lecId !== b.lecId) {
        return a.lecId.localeCompare(b.lecId);
      }
      return a.rev.dayOffset - b.rev.dayOffset;
    });

    const dateCounts = {};
    const lastAssignedForLec = {};

    uncompletedReviews.forEach(item => {
      let targetStr = item.rev.targetDate;
      if (targetStr < todayStr) targetStr = this.getAdjustedTargetDate(todayStr);

      // Ensure minimum 1 non-vacation day spacing from previous review of the SAME lecture
      if (lastAssignedForLec[item.lecId]) {
        const minNext = this.getDateAfterNonVacationDays(lastAssignedForLec[item.lecId], 1);
        if (targetStr < minNext) {
          targetStr = minNext;
        }
      }

      // Respect daily limit (maxPerDay = 3)
      while ((dateCounts[targetStr] || 0) >= maxPerDay) {
        targetStr = this.getDateAfterNonVacationDays(targetStr, 1);
      }

      if (item.rev.targetDate !== targetStr) {
        item.rev.targetDate = targetStr;
        resetCount++;
      }
      dateCounts[targetStr] = (dateCounts[targetStr] || 0) + 1;
      lastAssignedForLec[item.lecId] = targetStr;
    });

    if (resetCount > 0) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
      this._dispatchSync();
    }
    return resetCount;
  },

  recalculateAllReviews() {
    const lectures = this.getLectures();
    const intervals = [1, 4, 7, 14, 30];
    let resetCount = 0;

    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        // PRESERVE completed reviews - never touch them
        if (rev.isCompleted) return;

        const offset = rev.dayOffset;
        if (!intervals.includes(offset)) return;

        // Calculate exact target date: 1일차 is 당일, 4/7/14/30 are non-vacation days from start date
        const pureTargetDate = this.getTargetDateForReview(lec.dateAdded, offset);

        if (rev.targetDate !== pureTargetDate) {
          rev.targetDate = pureTargetDate;
          resetCount++;
        }
      });
    });

    if (resetCount > 0) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
      this._dispatchSync();
    }
    return resetCount;
  },

  // Auto-migrate uncompleted 1일차 reviews that were scheduled on next day to same day (당일 시작)
  // Gated with a one-time migration key so user manual +1 shifts are not repeatedly reset
  migrateReviewsToSameDay() {
    const MIGRATION_KEY = 'human_os_migrated_sameday_v1';
    try {
      if (localStorage.getItem(MIGRATION_KEY)) {
        return false;
      }
    } catch (e) {}

    const lectures = this.getLectures();
    let updated = false;

    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        // Only uncompleted 1일차 reviews that were scheduled on dateAdded + 1
        if (!rev.isCompleted && rev.dayOffset === 1) {
          const nextDayTarget = this.getDateAfterNonVacationDays(lec.dateAdded, 1);
          if (rev.targetDate === nextDayTarget) {
            rev.targetDate = this.getAdjustedTargetDate(lec.dateAdded);
            updated = true;
          }
        }
      });
    });

    if (updated) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
      this._dispatchSync();
    }
    try {
      localStorage.setItem(MIGRATION_KEY, 'true');
    } catch (e) {}
    return updated;
  },

  shiftAllUpcomingReviews(days) {
    if (!days || days <= 0) return 0;
    const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const lectures = this.getLectures();
    let count = 0;
    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        if (!rev.isCompleted && rev.targetDate >= todayStr) {
          const current = new Date(rev.targetDate);
          current.setDate(current.getDate() + days);
          rev.targetDate = new Date(current.getTime() - (current.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
          count++;
        }
      });
    });
    if (count > 0) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
      this._dispatchSync();
    }
    return count;
  },

  getVacations() {
    const raw = localStorage.getItem(STORAGE_KEYS.VACATIONS);
    return safeParse(raw, []);
  },

  // 사유 불문 월간 단일 쿼터 (월 2회 한도)
  // 소급 적용 금지: countsTowardQuota === true인 항목만 쿼터 차감 (기존 11월 데이터는 0/2일에서 시작)
  getMonthlyVacationQuota(monthStr) {
    const targetMonth = monthStr || this._dateToStr(new Date()).substring(0, 7);
    const vacations = this.getVacations();
    
    let used = 0;
    vacations.forEach(vac => {
      if (vac.countsTowardQuota) {
        const s = new Date(vac.startDate + 'T00:00:00');
        const e = new Date((vac.endDate || vac.startDate) + 'T00:00:00');
        let cur = new Date(s);
        while (cur <= e) {
          const curMonth = this._dateToStr(cur).substring(0, 7);
          if (curMonth === targetMonth) {
            used++;
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
    });

    const max = 2; // 월 2회(일) 한도
    const remaining = Math.max(0, max - used);
    return { max, used, remaining };
  },

  // 전날 밤 22:00 이전 사전 예약제: 가장 빠른 예약 가능 일자 반환
  // 현재 시각이 22:00 이상이면 내일(D+1)은 마감되었으므로 모레(D+2)부터 가능
  getEarliestVacationDate(now = new Date()) {
    const todayStr = this._dateToStr(now);
    const d = new Date(todayStr + 'T00:00:00');
    if (now.getHours() >= 22) {
      d.setDate(d.getDate() + 2);
    } else {
      d.setDate(d.getDate() + 1);
    }
    return this._dateToStr(d);
  },

  // 휴가 등록 가능 여부 및 사유 검증
  canRegisterVacation(startDate, endDate, now = new Date()) {
    if (!startDate || !endDate) {
      return { allowed: false, reason: '시작일과 종료일을 입력해주세요.' };
    }
    if (endDate < startDate) {
      return { allowed: false, reason: '종료일은 시작일보다 빠를 수 없습니다.' };
    }

    const todayStr = this._dateToStr(now);
    // 당일 휴가 원천 차단 (예외 없음): 오늘 및 과거 날짜 금지
    if (startDate <= todayStr) {
      return { allowed: false, reason: '당일 및 지난 날짜는 휴가를 등록할 수 없습니다. (당일 즉흥 휴가 원천 차단)' };
    }

    // 전날 밤 22:00 이전 사전 예약제 검증
    const startD = new Date(startDate + 'T00:00:00');
    const deadline = new Date(startD);
    deadline.setDate(deadline.getDate() - 1);
    deadline.setHours(22, 0, 0, 0);

    if (now.getTime() >= deadline.getTime()) {
      return {
        allowed: false,
        reason: `${startDate} 휴가는 전날(${this._dateToStr(deadline)}) 22:00 이전에만 사전 예약이 가능합니다.`
      };
    }

    // 사유 불문 월간 단일 쿼터 (월 2회 한도) 검증
    const endD = new Date(endDate + 'T00:00:00');
    const monthCounts = {};
    let cur = new Date(startD);
    while (cur <= endD) {
      const m = this._dateToStr(cur).substring(0, 7);
      monthCounts[m] = (monthCounts[m] || 0) + 1;
      cur.setDate(cur.getDate() + 1);
    }

    for (const [m, count] of Object.entries(monthCounts)) {
      const quota = this.getMonthlyVacationQuota(m);
      if (count > quota.remaining) {
        return {
          allowed: false,
          reason: `${m}월의 잔여 휴가(${quota.remaining}일)를 초과하여 등록할 수 없습니다. (신청: ${count}일, 한도: 월 2일)`
        };
      }
    }

    const diffTime = endD.getTime() - startD.getTime();
    const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return { allowed: true, days };
  },

  addVacation(startDate, endDate, reason = '', now = new Date()) {
    if (!startDate || !endDate) return { success: false, reason: '시작일과 종료일을 입력해주세요.', days: 0, count: 0 };
    
    const check = this.canRegisterVacation(startDate, endDate, now);
    if (!check.allowed) {
      return { success: false, reason: check.reason, days: 0, count: 0 };
    }

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const diffTime = end.getTime() - start.getTime();
    const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // 1. Store the vacation period first
    const vacations = this.getVacations();
    const newVacation = {
      id: 'vac_' + Date.now(),
      startDate,
      endDate,
      date: startDate, // 스키마 필드명: date(휴가 해당일)
      days,
      reason: (reason || '').trim(),
      appliedAt: now.toISOString(),
      reservedAt: now.toISOString(), // 스키마 필드명: reservedAt (사전 예약 타임스탬프)
      countsTowardQuota: true // 스키마 필드명: countsTowardQuota (2026-11-21 이후 등록분은 true)
    };
    vacations.unshift(newVacation);
    localStorage.setItem(STORAGE_KEYS.VACATIONS, JSON.stringify(vacations));

    // 2. Exactly shift all uncompleted reviews scheduled on or after startDate forward by `days` (하루면 1칸, 이틀이면 2칸)
    const lectures = this.getLectures();
    let count = 0;

    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        // 미완료 복습 중 휴가 시작일 이후에 예정된 복습만 정확히 휴가 일수(days)만큼 연기
        if (!rev.isCompleted && rev.targetDate >= startDate) {
          const d = new Date(rev.targetDate + 'T00:00:00');
          d.setDate(d.getDate() + days);
          let newDateStr = this._dateToStr(d);

          // 만약 이동한 날짜가 다른 기존 휴가 기간에 걸리면 다음 비휴가일로 보정
          newDateStr = this.getAdjustedTargetDate(newDateStr);

          rev.targetDate = newDateStr;
          count++;
        }
      });
    });

    if (count > 0) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
    }

    this._dispatchSync();
    return { success: true, days, count };
  },

  revertVacation(vacationId) {
    const vacations = this.getVacations();
    const vacIndex = vacations.findIndex(v => v.id === vacationId);
    if (vacIndex === -1) return { days: 0, count: 0 };

    const vac = vacations[vacIndex];
    const { startDate, days } = vac;

    // 1. Remove the vacation from the list
    vacations.splice(vacIndex, 1);
    localStorage.setItem(STORAGE_KEYS.VACATIONS, JSON.stringify(vacations));

    // 2. Shift all uncompleted reviews backward by `days`
    //    휴가 등록 시 startDate 이상이던 복습들은 startDate + days 이상으로 이동했으므로,
    //    startDate + days 이상의 미완료 복습들을 정확히 days만큼 앞당김
    const thresholdDate = new Date(startDate + 'T00:00:00');
    thresholdDate.setDate(thresholdDate.getDate() + days);
    const thresholdStr = this._dateToStr(thresholdDate);

    const lectures = this.getLectures();
    let count = 0;

    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        if (!rev.isCompleted && rev.targetDate >= thresholdStr) {
          const d = new Date(rev.targetDate + 'T00:00:00');
          d.setDate(d.getDate() - days);
          let newDateStr = this._dateToStr(d);

          // 만약 앞당긴 날짜가 다른 잔여 휴가에 걸리면 비휴가일로 보정
          newDateStr = this.getAdjustedTargetDate(newDateStr);

          rev.targetDate = newDateStr;
          count++;
        }
      });
    });

    if (count > 0) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
    }

    this._dispatchSync();
    return { days, count };
  },

  reset30DaysHibernationAndFreshStart() {
    const now = new Date();
    const todayStr = this._dateToStr(now);
    
    const d30 = new Date(now);
    d30.setDate(d30.getDate() - 30);
    const startStr = this._dateToStr(d30);
    
    const dYesterday = new Date(now);
    dYesterday.setDate(dYesterday.getDate() - 1);
    const endStr = this._dateToStr(dYesterday);

    this.addVacation(startStr, endStr);
    const resetCount = this.smartEbbinghausRedistribute(3);

    return { days: 30, resetCount };
  },

  resetOverdueAndStartFreshFromToday() {
    const todayStr = this._dateToStr(new Date());
    const lectures = this.getLectures();
    let resetCount = 0;

    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        if (!rev.isCompleted && rev.targetDate < todayStr) {
          rev.targetDate = todayStr;
          resetCount++;
        }
      });
    });

    this.smartEbbinghausRedistribute(2);
    return resetCount;
  },

  clearAllOverdueReviewsAndStartPure() {
    const todayStr = this._dateToStr(new Date());
    const lectures = this.getLectures();
    let removedCount = 0;

    lectures.forEach(lec => {
      const beforeCount = lec.reviews.length;
      lec.reviews = lec.reviews.filter(rev => rev.isCompleted || rev.targetDate >= todayStr);
      removedCount += (beforeCount - lec.reviews.length);
    });

    localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
    this._dispatchSync();
    return removedCount;
  },

  resetAllLectures14714FromToday(maxPerDay = 3) {
    const todayStr = this._dateToStr(new Date());
    const lectures = this.getLectures();
    if (lectures.length === 0) return 0;

    const intervals = [1, 4, 7, 14, 30];
    const dateCounts = {};

    lectures.forEach(lec => {
      let startDateStr = todayStr;

      while (true) {
        let isValid = true;
        for (const offset of intervals) {
          const target = this.getTargetDateForReview(startDateStr, offset);
          if ((dateCounts[target] || 0) >= maxPerDay) {
            isValid = false;
            break;
          }
        }

        if (isValid) {
          break;
        } else {
          startDateStr = this.getDateAfterNonVacationDays(startDateStr, 1);
        }
      }

      lec.dateAdded = startDateStr;
      lec.reviews = intervals.map(offset => {
        const targetDateStr = this.getTargetDateForReview(startDateStr, offset);
        dateCounts[targetDateStr] = (dateCounts[targetDateStr] || 0) + 1;

        return {
          id: `rev_${Date.now()}_${offset}_${Math.random().toString(36).substring(2, 6)}`,
          dayOffset: offset,
          targetDate: targetDateStr,
          isCompleted: false,
          completedAt: null
        };
      });
    });

    localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
    this._dispatchSync();
    return lectures.length;
  },

  getNonVacationDayBefore(dateStr, days = 1) {
    const current = new Date(dateStr + 'T00:00:00');
    let counted = 0;
    let safety = 0;
    while (counted < days && safety < 730) {
      current.setDate(current.getDate() - 1);
      const str = this._dateToStr(current);
      if (!this.isVacationDate(str)) {
        counted++;
      }
      safety++;
    }
    return this._dateToStr(current);
  },

  /**
   * Generates a curriculum review schedule with intelligent smoothing and daily review cap
   */
  generateCurriculumSchedule({
    subject = '재무',
    totalLectures = 54,
    chunkSize = 3,
    perDay = 2,
    intervals = [1, 4, 7, 14, 30],
    startToday = true,
    maxReviewsPerDay = 2
  } = {}) {
    const todayStr = this._dateToStr(new Date());

    // Build chunks/units
    const units = [];
    for (let i = 1; i <= totalLectures; i += chunkSize) {
      const end = Math.min(i + chunkSize - 1, totalLectures);
      const title = i === end ? `${i}강` : `${i}~${end}강`;
      units.push({ start: i, end, title });
    }

    const startDayBaseOffset = startToday ? 0 : 1;
    const baseRef = todayStr;

    // Create tasks for all units and milestones
    const allTasks = [];
    units.forEach((unit, unitIdx) => {
      const studyDayOffset = startDayBaseOffset + Math.floor(unitIdx / perDay);
      intervals.forEach((intervalOffset, mIdx) => {
        // 1일차 복습 (intervalOffset === 1) is same day as study (idealDayOffset = studyDayOffset)
        // Subsequent reviews (4, 7, 14, 30) are studyDayOffset + intervalOffset
        const idealDayOffset = intervalOffset === 1 ? studyDayOffset : studyDayOffset + intervalOffset;
        allTasks.push({
          unitIdx,
          unitTitle: unit.title,
          milestone: mIdx + 1,
          intervalOffset,
          studyDayOffset,
          idealDayOffset
        });
      });
    });

    // Sort tasks: prioritize ideal day, then milestone (1st round first), then unit index
    allTasks.sort((a, b) => {
      if (a.idealDayOffset !== b.idealDayOffset) return a.idealDayOffset - b.idealDayOffset;
      if (a.milestone !== b.milestone) return a.milestone - b.milestone;
      return a.unitIdx - b.unitIdx;
    });

    const dayCounts = {};
    const lastUnitAssignedDay = {};
    const assignedReviews = {};
    const scheduleByDate = {}; // dateStr -> array of { title, milestone, dayOffset }

    allTasks.forEach(task => {
      let candidateDayOffset = Math.max(task.idealDayOffset, 0);
      const prevMilestoneDay = lastUnitAssignedDay[task.unitIdx];
      if (prevMilestoneDay !== undefined && candidateDayOffset <= prevMilestoneDay) {
        candidateDayOffset = prevMilestoneDay + 1;
      }

      // Smooth forward while count >= maxReviewsPerDay
      while ((dayCounts[candidateDayOffset] || 0) >= maxReviewsPerDay) {
        candidateDayOffset++;
      }

      dayCounts[candidateDayOffset] = (dayCounts[candidateDayOffset] || 0) + 1;
      lastUnitAssignedDay[task.unitIdx] = candidateDayOffset;

      const targetDateStr = candidateDayOffset === 0
        ? this.getAdjustedTargetDate(baseRef)
        : this.getDateAfterNonVacationDays(baseRef, candidateDayOffset);

      if (!assignedReviews[task.unitIdx]) {
        assignedReviews[task.unitIdx] = [];
      }

      assignedReviews[task.unitIdx].push({
        id: `rev_${Date.now()}_${task.unitIdx}_${task.milestone}_${Math.random().toString(36).substring(2, 6)}`,
        dayOffset: task.intervalOffset,
        milestone: task.milestone,
        targetDate: targetDateStr,
        isCompleted: false,
        completedAt: null
      });

      if (!scheduleByDate[targetDateStr]) {
        scheduleByDate[targetDateStr] = [];
      }
      scheduleByDate[targetDateStr].push({
        subject: subject,
        unitTitle: task.unitTitle,
        milestone: task.milestone,
        dayOffset: task.intervalOffset
      });
    });

    const newLectures = units.map((unit, unitIdx) => {
      const studyDayOffset = startDayBaseOffset + Math.floor(unitIdx / perDay);
      const displayDateStr = studyDayOffset === 0
        ? this.getAdjustedTargetDate(todayStr)
        : this.getDateAfterNonVacationDays(todayStr, studyDayOffset);

      const unitReviews = (assignedReviews[unitIdx] || []).sort((a, b) => a.milestone - b.milestone);

      return {
        id: `lec_${Date.now()}_${unitIdx}_${Math.random().toString(36).substring(2, 6)}`,
        dateAdded: displayDateStr,
        subject: subject,
        title: unit.title,
        reviews: unitReviews
      };
    });

    const dates = Object.keys(scheduleByDate).sort();

    return {
      units,
      newLectures,
      scheduleByDate,
      dates,
      totalUnits: units.length,
      totalReviews: allTasks.length,
      totalDays: dates.length
    };
  },

  initializeCurriculumReview(options = {}) {
    const { mode = 'replace_all', subject = '재무' } = options;
    let lectures = this.getLectures();

    if (mode === 'replace_all') {
      lectures = [];
    } else if (mode === 'replace_subject') {
      lectures = lectures.filter(l => l.subject !== subject);
    }

    const { newLectures } = this.generateCurriculumSchedule(options);
    const combined = [...lectures, ...newLectures];
    localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(combined));
    this._dispatchSync();
    return newLectures.length;
  }
};

