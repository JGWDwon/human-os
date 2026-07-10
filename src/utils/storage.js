const STORAGE_KEYS = {
  QUESTS: 'human_os_quests_v1',
  DIARY: 'human_os_diary_v1',
  SETTINGS: 'human_os_settings',
  POMODORO: 'human_os_pomodoro_v1',
  USER_PROFILE: 'human_os_profile_v1'
};

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
  // --- Quests ---
  getCustomQuests() {
    const raw = localStorage.getItem('human-os-custom-quests');
    if (raw) return JSON.parse(raw);
    return INITIAL_QUESTS;
  },

  saveCustomQuests(quests) {
    localStorage.setItem('human-os-custom-quests', JSON.stringify(quests));
  },

  getQuestsByDate(dateStr) {
    const rawData = localStorage.getItem(STORAGE_KEYS.QUESTS);
    const data = rawData ? JSON.parse(rawData) : {};
    
    // Default to today if not provided
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    
    if (!data[dateStr]) {
      // Clone from Custom Quests instead of INITIAL_QUESTS
      data[dateStr] = JSON.parse(JSON.stringify(this.getCustomQuests()));
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
    let data = rawData ? JSON.parse(rawData) : {};
    
    data[dateStr] = quests;
    localStorage.setItem(STORAGE_KEYS.QUESTS, JSON.stringify(data));
  },
  
  // Get history for the Pixel Map
  // Returns { date: 'YYYY-MM-DD', status: 'completed' | 'partial' | 'hibernation' | 'none' }
  getQuestHistory(days = 30) {
    const rawData = localStorage.getItem(STORAGE_KEYS.QUESTS);
    const data = rawData ? JSON.parse(rawData) : {};
    
    const history = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      const dayQuests = data[dateStr];
      if (!dayQuests) {
        history.push({ date: dateStr, status: 'none' });
        continue;
      }
      
      const total = dayQuests.length;
      const completed = dayQuests.filter(q => q.isCompleted).length;
      const skipped = dayQuests.filter(q => q.skippedReason).length;
      
      if (completed === total) {
        history.push({ date: dateStr, status: 'completed' });
      } else if (completed > 0) {
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
    const data = rawData ? JSON.parse(rawData) : {};
    
    // month is 0-indexed (0 = Jan, 11 = Dec)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const history = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      // Create date string YYYY-MM-DD
      const d = new Date(year, month, day);
      // Adjust for local timezone offset to get correct YYYY-MM-DD
      const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      
      const dayQuests = data[dateStr];
      if (!dayQuests) {
        history.push({ date: dateStr, day, status: 'none' });
        continue;
      }
      
      const total = dayQuests.length;
      const completed = dayQuests.filter(q => q.isCompleted).length;
      const skipped = dayQuests.filter(q => q.skippedReason).length;
      
      if (completed === total) {
        history.push({ date: dateStr, day, status: 'completed', quests: dayQuests });
      } else if (completed > 0) {
        history.push({ date: dateStr, day, status: 'partial', quests: dayQuests });
      } else if (skipped > 0) {
        history.push({ date: dateStr, day, status: 'hibernation', quests: dayQuests });
      } else {
        history.push({ date: dateStr, day, status: 'none', quests: dayQuests });
      }
    }
    
    return history;
  },

  // --- Diary ---
  getDiary() {
    const raw = localStorage.getItem(STORAGE_KEYS.DIARY);
    return raw ? JSON.parse(raw) : [];
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
    return newEntry;
  },



  // --- Pomodoro ---
  getPomodoroByDate(dateStr) {
    const rawData = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const data = rawData ? JSON.parse(rawData) : {};
    if (!dateStr) {
      const d = new Date();
      dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    return data[dateStr] || { count: 0, totalMinutes: 0 };
  },

  addPomodoroByDate(dateStr) {
    const rawData = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const data = rawData ? JSON.parse(rawData) : {};
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
    data[dateStr].timestamps.push(new Date().toISOString());
    
    localStorage.setItem(STORAGE_KEYS.POMODORO, JSON.stringify(data));
    return data[dateStr];
  },

  getPomodoroTimeDistribution(days = 30) {
    const rawData = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const data = rawData ? JSON.parse(rawData) : {};
    
    // Create buckets for 0-23 hours
    const distribution = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}시`,
      count: 0
    }));

    const now = new Date();
    
    Object.keys(data).forEach(dateStr => {
       const entryDate = new Date(dateStr);
       const diffTime = Math.abs(now - entryDate);
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
       
       if (diffDays <= days && data[dateStr].timestamps) {
         data[dateStr].timestamps.forEach(ts => {
           const hour = new Date(ts).getHours();
           if (hour >= 0 && hour < 24) {
             distribution[hour].count += 1;
           }
         });
       }
    });

    return distribution;
  },

  getWeeklyPomodoroStats() {
    const rawData = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const data = rawData ? JSON.parse(rawData) : {};
    
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
      
      const dayData = data[dateStr] || { count: 0, totalMinutes: 0 };
      weeklyCount += dayData.count;
      weeklyMinutes += dayData.totalMinutes;
      weekData.push({ date: dateStr, ...dayData });
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
      theme: localStorage.getItem('dairy_theme'),
      version: '1.0'
    };
  },

  importData(jsonData) {
    if (!jsonData || typeof jsonData !== 'object') return false;
    
    if (jsonData.quests) localStorage.setItem(STORAGE_KEYS.QUESTS, jsonData.quests);
    if (jsonData.customQuests) localStorage.setItem('human-os-custom-quests', jsonData.customQuests);
    if (jsonData.pomodoro) localStorage.setItem(STORAGE_KEYS.POMODORO, jsonData.pomodoro);
    if (jsonData.diary) localStorage.setItem(STORAGE_KEYS.DIARY, jsonData.diary);
    if (jsonData.theme) localStorage.setItem('dairy_theme', jsonData.theme);
    
    return true;
  },

  getAllTimeStats() {
    // Total Quests
    const questsRaw = localStorage.getItem(STORAGE_KEYS.QUESTS);
    const questsData = questsRaw ? JSON.parse(questsRaw) : {};
    let totalCompletedQuests = 0;
    
    Object.values(questsData).forEach(dayQuests => {
      totalCompletedQuests += dayQuests.filter(q => q.isCompleted).length;
    });

    // Total Pomodoro
    const pomoRaw = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const pomoData = pomoRaw ? JSON.parse(pomoRaw) : {};
    let totalPomodoroMins = 0;
    
    Object.values(pomoData).forEach(day => {
      totalPomodoroMins += day.totalMinutes || 0;
    });
    
    // Total Diary Entries
    const diaryRaw = localStorage.getItem(STORAGE_KEYS.DIARY);
    const diaryData = diaryRaw ? JSON.parse(diaryRaw) : [];
    const totalDiaryEntries = diaryData.length;

    // Active days (days with at least one quest completed or pomodoro or diary)
    const activeDaysSet = new Set([
      ...Object.keys(questsData).filter(d => questsData[d].some(q => q.isCompleted || q.skippedReason)),
      ...Object.keys(pomoData).filter(d => pomoData[d].count > 0),
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
    const questsData = rawQuests ? JSON.parse(rawQuests) : {};
    
    const rawPomo = localStorage.getItem(STORAGE_KEYS.POMODORO);
    const pomoData = rawPomo ? JSON.parse(rawPomo) : {};
    
    const now = new Date();
    const result = [];
    
    for (let w = weeks - 1; w >= 0; w--) {
      let questsCount = 0;
      let pomoMins = 0;
      
      const endDay = new Date(now);
      endDay.setDate(now.getDate() - w * 7);
      const startDay = new Date(now);
      startDay.setDate(now.getDate() - w * 7 - 6);
      
      const label = `${startDay.getMonth()+1}/${startDay.getDate()}~${endDay.getMonth()+1}/${endDay.getDate()}`;
      
      for(let i=6; i>=0; i--) {
         const d = new Date(now);
         d.setDate(now.getDate() - w * 7 - i);
         const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
         
         if (questsData[dateStr]) {
           questsCount += questsData[dateStr].filter(q => q.isCompleted).length;
         }
         if (pomoData[dateStr]) {
           pomoMins += pomoData[dateStr].totalMinutes || 0;
         }
      }
      
      result.push({
        name: label,
        quests: questsCount,
        pomodoroMins: pomoMins
      });
    }
    return result;
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
    return raw ? JSON.parse(raw) : { totalXP: 0 };
  },

  addXP(points) {
    const profile = this.getUserProfile();
    profile.totalXP += points;
    localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    return profile.totalXP;
  },

  getLevelInfo(totalXP) {
    let level = 1;
    let xpForNextLevel = 50; 
    let accumulatedXP = 0;
    let xpIntoLevel = totalXP;
    
    while (true) {
      // New Curve: (level^2)*20 + level*30
      // Lv 1->2 = 50 XP
      // Lv 2->3 = 140 XP
      // Lv 3->4 = 270 XP
      let requiredForNext = (level * level * 20) + (level * 30);
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
    if (level >= 10 && level < 30) title = '🗡️ 1차 전직: 수련 기사';
    else if (level >= 30 && level < 70) title = '⚔️ 2차 전직: 정예 기사';
    else if (level >= 70 && level < 120) title = '🛡️ 3차 전직: 성기사';
    else if (level >= 120) title = '👑 4차 전직: 전설의 영웅';

    const progressPercent = Math.min(100, Math.floor((xpIntoLevel / xpForNextLevel) * 100));

    return {
      level,
      title,
      totalXP,
      xpIntoLevel,
      xpNeededForLevel: xpForNextLevel,
      progressPercent
    };
  }
};
