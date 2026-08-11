const STORAGE_KEYS = {
  QUESTS: 'human_os_quests_v1',
  DIARY: 'human_os_diary_v1',
  SETTINGS: 'human_os_settings',
  POMODORO: 'human_os_pomodoro_v1',
  USER_PROFILE: 'human_os_profile_v1',
  LECTURES: 'human_os_lectures_v1',
  VACATIONS: 'human_os_vacations_v1',
  STUDY_SESSIONS: 'human_os_study_sessions_v1'
};

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
  
  // Get history for the Pixel Map
  // Returns { date: 'YYYY-MM-DD', status: 'completed' | 'partial' | 'hibernation' | 'none' }
  getQuestHistory(days = 30) {
    const rawData = localStorage.getItem(STORAGE_KEYS.QUESTS);
    const data = safeParse(rawData, {});
    
    const pomoRaw = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const pomoData = safeParse(pomoRaw, {});
    
    const history = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayQuests = data[dateStr] || [];
      const mainQuests = dayQuests.filter(q => q.type === 'main' || !q.type);
      const completed = mainQuests.filter(q => q.isCompleted).length;
      const skipped = mainQuests.filter(q => q.skippedReason).length;
      
      const pomo = pomoData[dateStr] || { count: 0, timestamps: [] };
      const validPomoCount = (pomo.timestamps || []).filter(ts => (typeof ts === 'string' ? 25 : (ts.minutes || 25)) >= 15).length;
      const pomoLevel = validPomoCount >= 5 ? 3 : validPomoCount >= 3 ? 2 : validPomoCount >= 1 ? 1 : 0;
      const finalLevel = Math.max(completed, pomoLevel);
      
      if (finalLevel >= 3) {
        history.push({ date: dateStr, status: 'completed' });
      } else if (finalLevel > 0) {
        history.push({ date: dateStr, status: 'partial' });
      } else if (skipped > 0) {
        history.push({ date: dateStr, status: 'hibernation' });
      } else {
        history.push({ date: dateStr, status: 'none' });
      }
    }
    
    return history;
  },

  getMonthlyHistory(year, month) {
    const rawData = localStorage.getItem(STORAGE_KEYS.QUESTS);
    const data = safeParse(rawData, {});
    
    const pomoRaw = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const pomoData = safeParse(pomoRaw, {});
    
    // month is 0-indexed (0 = Jan, 11 = Dec)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const history = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      // Create date string YYYY-MM-DD
      const d = new Date(year, month, day);
      // Adjust for local timezone offset to get correct YYYY-MM-DD
      const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      
      const dayQuests = data[dateStr] || [];
      const mainQuests = dayQuests.filter(q => q.type === 'main' || !q.type);
      const completed = mainQuests.filter(q => q.isCompleted).length;
      const skipped = mainQuests.filter(q => q.skippedReason).length;
      
      const pomo = pomoData[dateStr] || { count: 0, totalMinutes: 0, timestamps: [] };
      const validPomoCount2 = (pomo.timestamps || []).filter(ts => (typeof ts === 'string' ? 25 : (ts.minutes || 25)) >= 15).length;
      const pomoLevel = validPomoCount2 >= 5 ? 3 : validPomoCount2 >= 3 ? 2 : validPomoCount2 >= 1 ? 1 : 0;
      const finalLevel = Math.max(completed, pomoLevel);
      
      const dayResult = {
        date: dateStr, 
        day, 
        quests: dayQuests, 
        pomoCount: validPomoCount2,
        totalMinutes: pomo.totalMinutes || 0
      };

      if (finalLevel >= 3) {
        history.push({ ...dayResult, status: 'completed' });
      } else if (finalLevel > 0) {
        history.push({ ...dayResult, status: 'partial' });
      } else if (skipped > 0) {
        history.push({ ...dayResult, status: 'hibernation' });
      } else {
        history.push({ ...dayResult, status: 'none' });
      }
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

  addPomodoroByDate(dateStr) {
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
    data[dateStr].timestamps.push({ time: new Date().toISOString(), minutes: 25 });
    
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

  addCustomPomodoro(dateStr, timeStr, minutes = 25) {
    const rawData = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const data = safeParse(rawData, {});
    
    if (!data[dateStr]) {
      data[dateStr] = { count: 0, totalMinutes: 0, timestamps: [] };
    }
    if (!data[dateStr].timestamps) {
      data[dateStr].timestamps = [];
    }
    
    // Create Date object assuming local time
    const [hours, minutesVal] = timeStr.split(':');
    const d = new Date(dateStr);
    d.setHours(parseInt(hours, 10), parseInt(minutesVal, 10), 0, 0);
    
    let countToAdd = 0;
    if (minutes >= 15) {
      countToAdd = Math.max(1, Math.round(minutes / 25));
    }
    data[dateStr].count += countToAdd;
    data[dateStr].totalMinutes += minutes;
    const fullTimeStr = `${dateStr}T${timeStr}:00`;
    data[dateStr].timestamps.push({ time: fullTimeStr, minutes: minutes });
    
    // Sort timestamps chronologically
    data[dateStr].timestamps.sort((a, b) => {
      const timeA = typeof a === 'string' ? a : (a.time || '');
      const timeB = typeof b === 'string' ? b : (b.time || '');
      return new Date(timeA) - new Date(timeB);
    });
    
    localStorage.setItem(STORAGE_KEYS.POMODORO, JSON.stringify(data));
    this.addXP(minutes);
    this._dispatchSync();
    
    return data[dateStr];
  },

  addCustomPomodoroWithMinutes(dateStr, timeStr, minutes) {
    return this.addCustomPomodoro(dateStr, timeStr, minutes);
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
    return {
      quests: localStorage.getItem(STORAGE_KEYS.QUESTS),
      customQuests: localStorage.getItem('human-os-custom-quests'),
      pomodoro: localStorage.getItem(STORAGE_KEYS.POMODORO),
      diary: localStorage.getItem(STORAGE_KEYS.DIARY),
      lectures: localStorage.getItem(STORAGE_KEYS.LECTURES),
      vacations: localStorage.getItem(STORAGE_KEYS.VACATIONS),
      studySessions: localStorage.getItem(STORAGE_KEYS.STUDY_SESSIONS),
      theme: localStorage.getItem('dairy_theme'),
      profile: localStorage.getItem(STORAGE_KEYS.USER_PROFILE),
      version: '1.0'
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

  getAllTimeStats() {
    // Total Quests
    const questsRaw = localStorage.getItem(STORAGE_KEYS.QUESTS);
    const questsData = safeParse(questsRaw, {});
    let totalCompletedQuests = 0;
    
    Object.values(questsData).forEach(dayQuests => {
      totalCompletedQuests += dayQuests.filter(q => q.isCompleted).length;
    });

    // Total Pomodoro
    const pomoRaw = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const pomoData = safeParse(pomoRaw, {});
    let totalPomodoroMins = 0;
    
    Object.values(pomoData).forEach(day => {
      totalPomodoroMins += day.totalMinutes || 0;
    });
    
    // Total Diary Entries
    const diaryRaw = localStorage.getItem(STORAGE_KEYS.DIARY);
    const diaryData = safeParse(diaryRaw, []);
    const totalDiaryEntries = diaryData.length;

    // Active days (days with at least one quest completed or pomodoro or diary)
    const activeDaysSet = new Set([
      ...Object.keys(questsData).filter(d => questsData[d].some(q => q.isCompleted || q.skippedReason)),
      ...Object.keys(pomoData).filter(d => (pomoData[d].timestamps || []).filter(ts => (typeof ts === 'string' ? 25 : (ts.minutes || 25)) >= 15).length > 0),
      ...diaryData.map(e => e.dateStr)
    ]);

    return {
      totalCompletedQuests,
      totalPomodoroMins,
      totalDiaryEntries,
      activeDays: activeDaysSet.size
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
  logStudySession(dateStr, type, startTimeStr, endTimeStr, durationMins) {
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    const raw = localStorage.getItem(STORAGE_KEYS.STUDY_SESSIONS);
    const data = safeParse(raw, {});
    if (!data[dateStr]) data[dateStr] = [];

    const newSession = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type, // 'focus' | 'pause'
      startTime: startTimeStr, // "14:00"
      endTime: endTimeStr,     // "14:25"
      durationMins: Math.max(1, Math.round(durationMins)),
      timestamp: Date.now()
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
    a.href = url;
    a.download = `human-os-backup-${new Date().toISOString().split('T')[0]}.json`;
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
    const { totalCompletedQuests, totalPomodoroMins } = this.getAllTimeStats();
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
    profile.totalXP += points;
    if (profile.totalXP < 0) profile.totalXP = 0; // 마이너스 방지
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    this._dispatchSync();
    return profile.totalXP;
  },

  getLevelInfo(totalXP) {
    let level = 1;
    let accumulatedXP = 0;
    let xpIntoLevel = totalXP;
    let xpForNextLevel = 0;
    
    while (true) {
      // RPG Curve: Fast early game, slow late game.
      // Total XP for Level L = 7.5 * L^2.05
      // Lv 10 (1차 전직) needs ~840 XP (can be reached in 3-4 days)
      // Lv 30 (2차 전직) needs ~7,950 XP (can be reached in ~3 weeks)
      // Lv 70 (3차 전직) needs ~45,345 XP (can be reached in ~4.5 months)
      // Lv 120 (4차 전직) needs ~135,982 XP (can be reached in ~1 year)
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
    
    let title = '🥚 초보자';
    if (level >= 10 && level < 30) title = '🗡️ 1차 전직: 세린이';
    else if (level >= 30 && level < 70) title = '⚔️ 2차 전직: 세청년';
    else if (level >= 70 && level < 120) title = '🛡️ 3차 전직: 회독돌이';
    else if (level >= 120) title = '👑 4차 전직: 예비 세무사';

    const progressPercent = Math.min(100, Math.floor((xpIntoLevel / xpForNextLevel) * 100));

    return {
      level,
      title,
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

  addLecture(subject, title, dateStr) {
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    
    const lectures = this.getLectures();
    
    // Ebbinghaus intervals: 1, 4, 7, 14, 30 days (vacation days are invisible/skipped)
    const intervals = [1, 4, 7, 14, 30];
    
    const reviews = intervals.map(offset => {
      // Count `offset` non-vacation days from study date
      const targetDateStr = this.getDateAfterNonVacationDays(dateStr, offset);

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

  completeReview(lectureId, reviewId) {
    const lectures = this.getLectures();
    let found = false;
    
    lectures.forEach(lec => {
      if (lec.id === lectureId) {
        lec.reviews.forEach(rev => {
          if (rev.id === reviewId && !rev.isCompleted) {
            rev.isCompleted = true;
            rev.completedAt = new Date().toISOString();
            found = true;
          }
        });
      }
    });

    if (found) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
      this.addXP(15); // Reward 15 XP for a review
      this._dispatchSync();
    }
    return lectures;
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
            found = true;
          }
        });
      }
    });

    if (found) {
      localStorage.setItem(STORAGE_KEYS.LECTURES, JSON.stringify(lectures));
      this.addXP(-15);
      this._dispatchSync();
    }
    return lectures;
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
    const lectures = this.getLectures();
    lectures.forEach(lec => {
      if (lec.id === lectureId) {
        lec.reviews.forEach(rev => {
          if (rev.id === reviewId) {
            const current = new Date(rev.targetDate + 'T00:00:00');
            current.setDate(current.getDate() + days);
            const rawTargetStr = new Date(current.getTime() - (current.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            rev.targetDate = this.getAdjustedTargetDate(rawTargetStr);
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

  smartEbbinghausRedistribute(maxPerDay = 2) {
    const todayStr = this._dateToStr(new Date());
    const lectures = this.getLectures();
    let resetCount = 0;

    // ---- Step 1: Recalculate uncompleted reviews with vacation-aware 14714 intervals ----
    // Ensure strict minimum 1-day spacing between consecutive reviews of the SAME lecture
    lectures.forEach(lec => {
      lec.reviews.sort((a, b) => a.dayOffset - b.dayOffset);
      let minAllowedDate = lec.dateAdded;

      lec.reviews.forEach(rev => {
        if (rev.isCompleted) {
          if (rev.targetDate > minAllowedDate) {
            minAllowedDate = rev.targetDate;
          }
          return; // PRESERVE completed reviews
        }

        // Ideal 14714 target date
        let correctDate = this.getDateAfterNonVacationDays(lec.dateAdded, rev.dayOffset);

        // Ensure this review is scheduled at least 1 non-vacation day AFTER the previous review of the same lecture
        const minNextDate = this.getDateAfterNonVacationDays(minAllowedDate, 1);
        const earliestAllowed = minNextDate > todayStr ? minNextDate : this.getAdjustedTargetDate(todayStr);

        if (correctDate < earliestAllowed) {
          correctDate = earliestAllowed;
        }

        const adjusted = this.getAdjustedTargetDate(correctDate);
        minAllowedDate = adjusted;

        if (rev.targetDate !== adjusted) {
          rev.targetDate = adjusted;
          resetCount++;
        }
      });
    });

    // ---- Step 2: Smooth daily piles (no day exceeds maxPerDay reviews) ----
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

      // Never assign two reviews of the SAME lecture on the same date!
      if (lastAssignedForLec[item.lecId]) {
        const minNext = this.getDateAfterNonVacationDays(lastAssignedForLec[item.lecId], 1);
        if (targetStr < minNext) {
          targetStr = minNext;
        }
      }

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
      lec.reviews.sort((a, b) => a.dayOffset - b.dayOffset);
      let minAllowedDate = lec.dateAdded;

      lec.reviews.forEach(rev => {
        if (rev.isCompleted) {
          if (rev.targetDate > minAllowedDate) {
            minAllowedDate = rev.targetDate;
          }
          return;
        }

        const offset = rev.dayOffset;
        if (!intervals.includes(offset)) return;

        let newTargetDate = this.getDateAfterNonVacationDays(lec.dateAdded, offset);
        const minNextDate = this.getDateAfterNonVacationDays(minAllowedDate, 1);

        if (newTargetDate < minNextDate) {
          newTargetDate = minNextDate;
        }

        newTargetDate = this.getAdjustedTargetDate(newTargetDate);
        minAllowedDate = newTargetDate;

        if (rev.targetDate !== newTargetDate) {
          rev.targetDate = newTargetDate;
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

  addVacation(startDate, endDate) {
    if (!startDate || !endDate) return { days: 0, count: 0 };
    
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    if (end < start) return { days: 0, count: 0 };

    const diffTime = end.getTime() - start.getTime();
    const days = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // 1. Store the vacation period first
    const vacations = this.getVacations();
    const newVacation = {
      id: 'vac_' + Date.now(),
      startDate,
      endDate,
      days,
      appliedAt: new Date().toISOString()
    };
    vacations.unshift(newVacation);
    localStorage.setItem(STORAGE_KEYS.VACATIONS, JSON.stringify(vacations));

    // 2. Recalculate ALL uncompleted reviews with vacation-aware intervals
    //    Vacation days are now "invisible" — 14714 intervals skip them entirely
    //    Completed reviews are PRESERVED
    const count = this.recalculateAllReviews();

    this._dispatchSync();
    return { days, count };
  },

  revertVacation(vacationId) {
    const vacations = this.getVacations();
    const vacIndex = vacations.findIndex(v => v.id === vacationId);
    if (vacIndex === -1) return { days: 0, count: 0 };

    const vac = vacations[vacIndex];
    const { days } = vac;

    // 1. Remove the vacation from the list
    vacations.splice(vacIndex, 1);
    localStorage.setItem(STORAGE_KEYS.VACATIONS, JSON.stringify(vacations));

    // 2. Recalculate all uncompleted reviews without the removed vacation
    //    Completed reviews are PRESERVED
    const count = this.recalculateAllReviews();

    this._dispatchSync();
    return { days, count };
  }
};
