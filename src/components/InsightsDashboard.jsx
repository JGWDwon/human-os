import { useState, useEffect, useMemo } from 'react';
import { BarChart2, Trophy, Timer, Zap, Calendar, ArrowLeft, Flame, CheckCircle2, Clock, ChevronLeft, ChevronRight, RotateCcw, BookOpen, PieChart, Target } from 'lucide-react';
import { storage, getSubjectColor, SUBJECT_COLORS, calculateSleepDuration } from '../utils/storage';
import StudyTimetable from './StudyTimetable';
import SubjectModal from './SubjectModal';

export default function InsightsDashboard({ onClose }) {
  const [stats, setStats] = useState(() => storage.getAllTimeStats());
  const [weekOffset, setWeekOffset] = useState(0); // 0: 이번 주, -1: 지난 주, +1: 다음 주
  const [selectedDay, setSelectedDay] = useState(null);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjects, setSubjects] = useState(() => storage.getSubjects());
  const [mealTick, setMealTick] = useState(0);
  const [dailyLogTick, setDailyLogTick] = useState(0);

  useEffect(() => {
    const allStats = storage.getAllTimeStats();
    setStats(allStats);

    const handleSubs = () => setSubjects(storage.getSubjects());
    const handleMeals = () => setMealTick(p => p + 1);
    const handleDailyLogs = () => setDailyLogTick(p => p + 1);
    window.addEventListener('subjects-updated', handleSubs);
    window.addEventListener('meals-updated', handleMeals);
    window.addEventListener('daily-logs-updated', handleDailyLogs);
    return () => {
      window.removeEventListener('subjects-updated', handleSubs);
      window.removeEventListener('meals-updated', handleMeals);
      window.removeEventListener('daily-logs-updated', handleDailyLogs);
    };
  }, []);

  const formatTime = (minutes) => {
    if (!minutes || minutes <= 0) return '0분';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}시간 ${m > 0 ? m + '분' : ''}`;
    return `${m}분`;
  };

  const todayObj = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const d = todayObj;
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  }, [todayObj]);

  // Selected week Sun ~ Sat based on weekOffset (달력 주기: 일요일 ~ 토요일)
  const { weekRangeLabel, weeklyTrend, totalWeeklyMinutes } = useMemo(() => {
    const now = new Date(todayObj);
    now.setDate(now.getDate() + weekOffset * 7);

    // 0 is Sunday, 1 is Monday ... 6 is Saturday
    const dayOfWeek = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dayOfWeek);

    const pomoRaw = localStorage.getItem('human_os_pomodoro_v1');
    const pomoData = pomoRaw ? JSON.parse(pomoRaw) : {};

    const trend = [];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    let totalMins = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const isToday = dateStr === todayStr;

      const dayMins = pomoData[dateStr]?.totalMinutes || 0;
      const hoursNum = Number((dayMins / 60).toFixed(1));
      totalMins += dayMins;

      trend.push({
        dateStr,
        dayName: dayNames[i],
        dateShort: `${d.getMonth() + 1}/${d.getDate()}`,
        dayLabel: `${dayNames[i]}요일 (${d.getMonth() + 1}/${d.getDate()})`,
        minutes: dayMins,
        hours: hoursNum,
        isToday
      });
    }

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    const rangeLabel = `${sunday.getFullYear()}년 ${sunday.getMonth() + 1}월 ${sunday.getDate()}일 ~ ${saturday.getMonth() + 1}월 ${saturday.getDate()}일`;

    return { weekRangeLabel: rangeLabel, weeklyTrend: trend, totalWeeklyMinutes: totalMins };
  }, [todayObj, todayStr, weekOffset]);

  // Selected day for drilldown (used across balance cards and timetable/session details)
  const activeDayForDetail = selectedDay || weeklyTrend.find(t => t.isToday) || weeklyTrend[weeklyTrend.length - 1];
  const activeDayPomo = activeDayForDetail ? storage.getPomodoroByDate(activeDayForDetail.dateStr) : null;

  // Helper: Compute subject balance breakdown for a list of dates
  const computeSubjectBreakdown = (dateStrList) => {
    const pomoRaw = localStorage.getItem('human_os_pomodoro_v1');
    const pomoData = pomoRaw ? JSON.parse(pomoRaw) : {};
    const subMap = {};

    const safeSubjects = Array.isArray(subjects) ? subjects : [];
    safeSubjects.forEach(s => { subMap[s] = 0; });

    let total = 0;
    dateStrList.forEach(dStr => {
      const dayData = pomoData[dStr];
      if (dayData && Array.isArray(dayData.timestamps)) {
        dayData.timestamps.forEach(ts => {
          const sub = (typeof ts === 'object' && ts.subject) ? ts.subject : '기타/미지정';
          const mins = (typeof ts === 'object' && ts.minutes) ? Number(ts.minutes) : 25;
          subMap[sub] = (subMap[sub] || 0) + mins;
          total += mins;
        });
      }
    });

    const registeredOrder = [...safeSubjects];
    const breakdown = Object.entries(subMap)
      .map(([name, mins]) => {
        const pct = total > 0 ? Math.round((mins / total) * 100) : 0;
        const color = getSubjectColor(name, registeredOrder);
        return { name, mins, pct, color };
      })
      .sort((a, b) => b.mins - a.mins);

    return { breakdown, totalMins: total };
  };

  // Subject Balance Breakdown: Weekly & Selected Day
  const { subjectBreakdown, subjectTotalMins } = useMemo(
    () => computeSubjectBreakdown(weeklyTrend.map(d => d.dateStr)),
    [weeklyTrend, subjects]
  );

  const { daySubjectBreakdown, daySubjectTotalMins } = useMemo(() => {
    if (!activeDayForDetail) return { daySubjectBreakdown: [], daySubjectTotalMins: 0 };
    const res = computeSubjectBreakdown([activeDayForDetail.dateStr]);
    return { daySubjectBreakdown: res.breakdown, daySubjectTotalMins: res.totalMins };
  }, [activeDayForDetail, subjects]);

  const currentStats = stats || { activeDays: 0, totalFocusMins: 0 };
  const dailyAvgMins = Math.round(totalWeeklyMinutes / 7);
  const bestDay = weeklyTrend.reduce((best, cur) => (cur.minutes > (best?.minutes || 0) ? cur : best), null);
  
  // Daily goals count (6h, 7h, 8h 차등)
  const dailyGoal6hCount = weeklyTrend.filter(t => t.minutes >= 360).length;
  const dailyGoal7hCount = weeklyTrend.filter(t => t.minutes >= 420).length;
  const dailyGoal8hCount = weeklyTrend.filter(t => t.minutes >= 480).length;

  // Weekly goal info with vacation days consideration
  const weeklyGoal = useMemo(() => {
    return storage.getWeeklyGoalInfo(weekOffset);
  }, [weekOffset, totalWeeklyMinutes]);

  // Weekly Meal Total
  const weeklyMealTotalMins = useMemo(() => {
    let sum = 0;
    weeklyTrend.forEach(d => {
      const ms = storage.getMealsByDate(d.dateStr) || [];
      ms.forEach(m => { sum += (m.minutes || 0); });
    });
    return sum;
  }, [weeklyTrend, mealTick]);

  // Weekly Sleep Total
  const { weeklySleepTotalMins, weeklySleepRecordedDays } = useMemo(() => {
    let sum = 0;
    let daysWithSleep = 0;
    weeklyTrend.forEach(d => {
      const dLog = storage.getDailyLogByDate(d.dateStr);
      if (dLog && dLog.bedTime && dLog.wakeTime) {
        const dur = calculateSleepDuration(dLog.bedTime, dLog.wakeTime);
        if (dur && dur.totalMinutes > 0) {
          sum += dur.totalMinutes;
          daysWithSleep++;
        }
      }
    });
    return { weeklySleepTotalMins: sum, weeklySleepRecordedDays: daysWithSleep };
  }, [weeklyTrend, dailyLogTick]);

  // Helper: Compute Lecture vs Review mins for given dates
  const computeInputOutput = (dateStrList) => {
    const pomoRaw = localStorage.getItem('human_os_pomodoro_v1');
    const pomoData = pomoRaw ? JSON.parse(pomoRaw) : {};
    let lectureMins = 0;
    let reviewMins = 0;
    dateStrList.forEach(dStr => {
      const dayData = pomoData[dStr];
      if (dayData && Array.isArray(dayData.timestamps)) {
        dayData.timestamps.forEach(ts => {
          const mins = (typeof ts === 'object' && ts.minutes) ? Number(ts.minutes) : 25;
          const type = (typeof ts === 'object' && ts.activityType) ? ts.activityType : 'review';
          if (type === 'lecture') {
            lectureMins += mins;
          } else {
            reviewMins += mins;
          }
        });
      }
    });
    return { lectureMins, reviewMins, totalMins: lectureMins + reviewMins };
  };

  // Weekly & Selected Day Lecture vs Review Breakdown
  const { weeklyLectureMins, weeklyReviewMins } = useMemo(() => {
    const res = computeInputOutput(weeklyTrend.map(d => d.dateStr));
    return { weeklyLectureMins: res.lectureMins, weeklyReviewMins: res.reviewMins };
  }, [weeklyTrend]);

  const { dayLectureMins, dayReviewMins, dayInputOutputTotalMins } = useMemo(() => {
    if (!activeDayForDetail) return { dayLectureMins: 0, dayReviewMins: 0, dayInputOutputTotalMins: 0 };
    const res = computeInputOutput([activeDayForDetail.dateStr]);
    return {
      dayLectureMins: res.lectureMins,
      dayReviewMins: res.reviewMins,
      dayInputOutputTotalMins: res.totalMins
    };
  }, [activeDayForDetail]);

  // Chart Y-axis max scale: comfortable headroom above max, milestone aligned
  const rawMax = Math.max(...weeklyTrend.map(t => t.minutes), 0);
  const scaleMaxMins = Math.max(480, Math.ceil((rawMax * 1.18) / 60) * 60);

  // Guidelines: 2h, 4h, 6h(1단계), 7h(2단계), 8h(3단계) (and 10h if headroom allows)
  const guidelines = [
    { mins: 480, label: '8시간 🌲', color: 'rgba(16, 185, 129, 0.45)', textColor: '#34d399' },
    { mins: 420, label: '7시간 🌳', color: 'rgba(5, 150, 105, 0.4)', textColor: '#10b981' },
    { mins: 360, label: '6시간 🌿', color: 'rgba(56, 189, 248, 0.4)', textColor: '#38bdf8' },
    { mins: 240, label: '4시간 🌱', color: 'rgba(52, 211, 153, 0.3)', textColor: '#6ee7b7' },
    { mins: 120, label: '2시간', color: 'rgba(255, 255, 255, 0.08)', textColor: 'var(--text-muted)' }
  ];
  if (scaleMaxMins >= 660) {
    guidelines.unshift({ mins: 600, label: '10시간 🔥', color: 'rgba(249, 115, 22, 0.45)', textColor: '#f97316' });
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '80vh', gap: '1.25rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
            <BarChart2 size={22} color="var(--accent-secondary)" />
            나의 공부 성장 리포트
          </h2>
        </div>

        <button 
          onClick={onClose} 
          className="btn btn-secondary" 
          style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <ArrowLeft size={16} /> 메인으로 돌아가기
        </button>
      </div>

      {/* Top 3 Slim Summary Stat Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.85rem 1.1rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Trophy size={14} color="#10b981" /> 총 출석일
              <span style={{ fontSize: '0.67rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>10/11부터</span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 'bold', color: 'var(--accent-primary)', marginTop: '0.15rem' }}>
              {currentStats.activeDays}일
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.85rem 1.1rem', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Zap size={14} color="#3b82f6" /> 누적 공부 시간
              <span style={{ fontSize: '0.67rem', color: '#38bdf8', background: 'rgba(59, 130, 246, 0.15)', padding: '0.05rem 0.35rem', borderRadius: '4px' }}>10/11부터</span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 'bold', color: 'var(--accent-secondary)', marginTop: '0.15rem' }}>
              {formatTime(currentStats.totalFocusMins || 0)}
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '0.85rem 1.1rem', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Timer size={14} color="#c084fc" /> 이번 주 집중 (일~토)
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 'bold', color: '#c084fc', marginTop: '0.15rem' }}>
              {formatTime(totalWeeklyMinutes)}
            </div>
          </div>
        </div>
      </div>

      {/* Week Navigation Bar (일~토 달력 주기 연동) */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        padding: '0.75rem 1rem',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            title="지난주 보기"
          >
            <ChevronLeft size={16} /> 이전 주
          </button>
          
          <span style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#fff', minWidth: '220px', textAlign: 'center' }}>
            {weekRangeLabel} {weekOffset === 0 && <span style={{ fontSize: '0.72rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: '0.3rem' }}>이번 주</span>}
          </span>

          <button
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            title="다음주 보기"
          >
            다음 주 <ChevronRight size={16} />
          </button>

          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
            >
              <RotateCcw size={13} style={{ marginRight: '0.25rem' }} /> 이번 주로
            </button>
          )}
        </div>

        {/* Weekly Total Time Badge with Lecture / Review Split */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.35rem 0.75rem', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>주간 총 공부:</span>
            <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#34d399' }}>
              {formatTime(totalWeeklyMinutes)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(129, 140, 248, 0.3)', padding: '0.35rem 0.6rem', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#a5b4fc', fontWeight: 'bold' }}>
              🎧 강의 {formatTime(weeklyLectureMins)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '0.35rem 0.6rem', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 'bold' }}>
              📖 복습 {formatTime(weeklyReviewMins)}
            </span>
          </div>
          {weeklyMealTotalMins > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(251, 146, 60, 0.12)', border: '1px solid rgba(251, 146, 60, 0.3)', padding: '0.35rem 0.6rem', borderRadius: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: '#fdba74', fontWeight: 'bold' }}>
                🍱 식사 {formatTime(weeklyMealTotalMins)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: 주간 공부시간 트렌드 및 지표 요약 (빈 공간 없는 2단 균형 배치) */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        
        {/* Tier 1: 핵심 공부 & 목표 지표 (4개 균등 배치) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.65rem' }}>
          {/* 주간 목표 달성 카드 (36h~42h + 휴가기간 보정) */}
          <div style={{ background: weeklyGoal.isMinReached ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)', border: weeklyGoal.isMinReached ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(129, 140, 248, 0.3)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
            <div style={{ fontSize: '0.72rem', color: weeklyGoal.isMinReached ? '#34d399' : '#a5b4fc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Target size={12} /> 주간 목표 ({weeklyGoal.targetMinHours}~{weeklyGoal.targetMaxHours}h)
              </span>
              {weeklyGoal.vacationDaysCount > 0 && (
                <span style={{ fontSize: '0.65rem', color: '#facc15', background: 'rgba(234, 179, 8, 0.18)', padding: '0.05rem 0.3rem', borderRadius: '4px' }}>
                  🌴 휴가 {weeklyGoal.vacationDaysCount}일
                </span>
              )}
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: weeklyGoal.isMinReached ? '#34d399' : '#fff', marginTop: '0.15rem' }}>
              {weeklyGoal.weeklyHours}h
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '0.3rem' }}>
                ({weeklyGoal.progressPct}%)
              </span>
            </div>
            <div style={{ fontSize: '0.68rem', color: weeklyGoal.isMinReached ? '#34d399' : 'var(--text-muted)', marginTop: '0.15rem' }}>
              {weeklyGoal.isMaxReached ? '🎉 주간 최대 목표 초과 달성' : weeklyGoal.isMinReached ? '✨ 주간 기본 목표 달성 완료' : `🎯 기본 목표까지 ${Math.floor(weeklyGoal.remainingToMinMins / 60)}h ${weeklyGoal.remainingToMinMins % 60}m 남음`}
            </div>
          </div>

          {/* 일간 목표(6h+) 달성일 */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span>🌿</span> 일간 목표(6h+) 달성일
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.15rem' }}>
              {dailyGoal6hCount}일 / 7일
            </div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              7h+ {dailyGoal7hCount}일 · 8h+ {dailyGoal8hCount}일
            </div>
          </div>

          {/* 일평균 순공 */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>일평균 순공</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.15rem' }}>
              {formatTime(dailyAvgMins)}
            </div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              이번 주 7일 평균
            </div>
          </div>

          {/* 최고 집중일 (Best) */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Flame size={12} color="#f97316" /> 최고 집중일 (Best)
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f97316', marginTop: '0.15rem' }}>
              {bestDay && bestDay.minutes > 0 ? `${bestDay.dayName} (${formatTime(bestDay.minutes)})` : '-'}
            </div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {bestDay && bestDay.minutes > 0 ? `${bestDay.dateShort} 최다 기록` : '기록 없음'}
            </div>
          </div>
        </div>

        {/* Tier 2: 밸런스 & 라이프 케어 지표 (3개 균등 배치, 빈 공간 0%) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.65rem' }}>
          {/* Input vs Output Balance Card (주간 + 해당 요일) */}
          <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(129, 140, 248, 0.25)', borderRadius: '8px', padding: '0.65rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#a5b4fc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>인풋 vs 아웃풋 밸런스 (주간)</span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>강의:복습</span>
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#fff', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#818cf8' }}>🎧 {totalWeeklyMinutes > 0 ? Math.round((weeklyLectureMins / totalWeeklyMinutes) * 100) : 0}%</span>
                <span style={{ color: 'var(--text-muted)' }}>:</span>
                <span style={{ color: '#34d399' }}>📖 {totalWeeklyMinutes > 0 ? Math.round((weeklyReviewMins / totalWeeklyMinutes) * 100) : 0}%</span>
              </div>
              <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', marginTop: '0.3rem', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${totalWeeklyMinutes > 0 ? Math.round((weeklyLectureMins / totalWeeklyMinutes) * 100) : 0}%`, background: '#818cf8', transition: 'width 0.3s' }} />
                <div style={{ width: `${totalWeeklyMinutes > 0 ? Math.round((weeklyReviewMins / totalWeeklyMinutes) * 100) : 0}%`, background: '#34d399', transition: 'width 0.3s' }} />
              </div>
            </div>

            {/* Selected Day Input vs Output */}
            {activeDayForDetail && (
              <div style={{ borderTop: '1px dashed rgba(255,255,255,0.12)', paddingTop: '0.4rem' }}>
                <div style={{ fontSize: '0.68rem', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    📅 {activeDayForDetail.dayName}요일 ({activeDayForDetail.dateShort}){activeDayForDetail.isToday ? ' · 오늘' : ''}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {dayInputOutputTotalMins > 0 ? formatTime(dayInputOutputTotalMins) : '기록 없음'}
                  </span>
                </div>
                {dayInputOutputTotalMins > 0 ? (
                  <>
                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ color: '#a5b4fc' }}>
                        🎧 {Math.round((dayLectureMins / dayInputOutputTotalMins) * 100)}% ({formatTime(dayLectureMins)})
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>:</span>
                      <span style={{ color: '#6ee7b7' }}>
                        📖 {Math.round((dayReviewMins / dayInputOutputTotalMins) * 100)}% ({formatTime(dayReviewMins)})
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', marginTop: '0.25rem', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${Math.round((dayLectureMins / dayInputOutputTotalMins) * 100)}%`, background: '#818cf8', transition: 'width 0.3s' }} />
                      <div style={{ width: `${Math.round((dayReviewMins / dayInputOutputTotalMins) * 100)}%`, background: '#34d399', transition: 'width 0.3s' }} />
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    🎧 0% : 📖 0%
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Weekly Meal Card */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              🍱 식사 시간 (주간)
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fb923c', marginTop: '0.15rem' }}>
              {formatTime(weeklyMealTotalMins)}
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '0.25rem' }}>
                (일평균 {Math.round(weeklyMealTotalMins / 7)}분)
              </span>
            </div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              식사 루틴 규칙성 유지
            </div>
          </div>

          {/* Weekly Sleep Card */}
          <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              💤 수면 시간 (주간)
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#a78bfa', marginTop: '0.15rem' }}>
              {weeklySleepTotalMins > 0 ? formatTime(weeklySleepTotalMins) : '-'}
              {weeklySleepRecordedDays > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'normal', marginLeft: '0.25rem' }}>
                  (일평균 {(weeklySleepTotalMins / weeklySleepRecordedDays / 60).toFixed(1)}h)
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              {weeklySleepRecordedDays > 0 ? `기록 ${weeklySleepRecordedDays}일 반영` : '취침·기상 시각 직접 입력'}
            </div>
          </div>
        </div>

        {/* Main Chart Container with Exact Y-Axis Baseline Alignment */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1.25rem 1rem 0.85rem 1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '0.98rem', margin: 0, color: 'var(--text-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calendar size={16} color="#8b5cf6" /> 주간 일별 집중 시간 트렌드 (일~토)
              </h3>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                요일별 순공 시간과 단계별 목표 달성 현황을 한눈에 확인할 수 있습니다.
              </span>
            </div>

            {/* Goal Guideline Legend */}
            <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.7rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#38bdf8', borderRadius: '2px' }}></span> 🌿 6시간 (1단계)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#059669', borderRadius: '2px' }}></span> 🌳 7시간 (2단계)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '2px' }}></span> 🌲 8시간 (3단계)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#6ee7b7', borderRadius: '2px' }}></span> 🌱 4시간
              </span>
            </div>
          </div>

          {/* Chart Plotting Area: exactly 210px, guidelines and bars share the exact same baseline (bottom: 0) */}
          <div style={{ position: 'relative', height: '210px', margin: '0.5rem 0.5rem 0 3.4rem' }}>
            
            {/* Horizontal Guideline Lines */}
            {guidelines.map(g => {
              if (g.mins > scaleMaxMins) return null;
              const bottomPct = (g.mins / scaleMaxMins) * 100;
              return (
                <div 
                  key={g.mins} 
                  style={{ 
                    position: 'absolute', 
                    left: '-3.4rem', 
                    right: 0, 
                    bottom: `${bottomPct}%`, 
                    display: 'flex', 
                    alignItems: 'center', 
                    pointerEvents: 'none',
                    transform: 'translateY(50%)'
                  }}
                >
                  <span style={{ width: '3.2rem', fontSize: '0.67rem', color: g.textColor, fontWeight: 'bold', textAlign: 'right', paddingRight: '0.4rem', whiteSpace: 'nowrap' }}>
                    {g.label}
                  </span>
                  <div style={{ flex: 1, borderBottom: `1px dashed ${g.color}` }} />
                </div>
              );
            })}

            {/* Baseline: 0h line */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, borderBottom: '1px solid rgba(255,255,255,0.15)' }} />

            {/* 7 Bars Container - perfectly flush at bottom: 0 */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '100%', position: 'relative', zIndex: 2 }}>
              {weeklyTrend.map((item) => {
                const isSelected = activeDayForDetail?.dateStr === item.dateStr;
                const heightPct = (item.minutes / scaleMaxMins) * 100;

                // Dynamic gradient based on study duration (6h, 7h, 8h 차등)
                const barGradient = item.minutes >= 480
                  ? 'linear-gradient(180deg, #10b981 0%, #047857 100%)' // 8h+ (3단계 완벽 🌲)
                  : item.minutes >= 420
                    ? 'linear-gradient(180deg, #059669 0%, #065f46 100%)' // 7h+ (2단계 우수 🌳)
                    : item.minutes >= 360
                      ? 'linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)' // 6h+ (1단계 달성 🌿)
                      : item.minutes >= 240
                        ? 'linear-gradient(180deg, #6ee7b7 0%, #10b981 100%)' // 4h+ (새싹 🌱)
                        : item.minutes > 0
                          ? 'linear-gradient(180deg, #93c5fd 0%, #3b82f6 100%)' // <4h (집중)
                          : 'rgba(255,255,255,0.05)';

                return (
                  <div
                    key={item.dateStr}
                    onClick={() => setSelectedDay(item)}
                    style={{
                      flex: 1,
                      height: '100%',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: '0 4px',
                      position: 'relative'
                    }}
                    title={`${item.dayLabel}: ${formatTime(item.minutes)} (클릭하여 상세 기록 확인)`}
                  >
                    {/* The Bar Pillar */}
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '38px',
                        height: item.minutes > 0 ? `${Math.max(4, heightPct)}%` : '3px',
                        background: barGradient,
                        borderRadius: item.minutes > 0 ? '6px 6px 2px 2px' : '2px',
                        border: item.isToday ? '1.5px solid #c084fc' : isSelected ? '1.5px solid #fff' : 'none',
                        boxShadow: item.minutes >= 240 ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
                        position: 'relative',
                        transition: 'height 0.3s ease, transform 0.15s'
                      }}
                    >
                      {/* Exact Top Floating Badge (does not push the bar down) */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '100%',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          marginBottom: '5px',
                          fontSize: '0.68rem',
                          fontWeight: 'bold',
                          whiteSpace: 'nowrap',
                          color: item.minutes > 0 ? (item.isToday ? '#c084fc' : '#34d399') : 'rgba(255,255,255,0.25)',
                          pointerEvents: 'none'
                        }}
                      >
                        {item.minutes > 0 ? formatTime(item.minutes) : '0분'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Dedicated X-Axis Row below the Plotting Area */}
          <div style={{ display: 'flex', justifyContent: 'space-around', margin: '0.6rem 0.5rem 0 3.4rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.5rem' }}>
            {weeklyTrend.map((item) => {
              const isSelected = activeDayForDetail?.dateStr === item.dateStr;
              const isSunday = item.dayName === '일';
              const isSaturday = item.dayName === '토';
              const dayColor = item.isToday 
                ? '#c084fc' 
                : isSunday 
                  ? '#f87171' 
                  : isSaturday 
                    ? '#60a5fa' 
                    : 'var(--text-secondary)';

              return (
                <div
                  key={item.dateStr}
                  onClick={() => setSelectedDay(item)}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    cursor: 'pointer',
                    padding: '3px 0',
                    borderRadius: '6px',
                    background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                    transition: 'background 0.15s'
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: dayColor }}>
                    {item.dayName} {item.isToday && <span style={{ fontSize: '0.65rem', color: '#c084fc' }}>(오늘)</span>}
                  </div>
                  <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.05rem' }}>
                    {item.dateShort}
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: 과목별 공부시간 밸런스 바 (과목 편식 방지) */}
      {/* ========================================================================= */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        padding: '1.15rem 1.25rem',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '0.98rem', margin: 0, color: 'var(--text-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <PieChart size={17} color="#38bdf8" /> 과목별 공부시간 밸런스 (과목 편식 방지)
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              주간 과목별 집중 비율을 점검하여 특정 과목에 편중되지 않도록 균형을 유지하세요.
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowSubjectModal(true)}
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
          >
            <BookOpen size={13} /> 과목 관리
          </button>
        </div>

        {/* 1) 주간 과목별 공부시간 밸런스 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#93c5fd' }}>
              📊 주간 전체 밸런스 ({formatTime(subjectTotalMins)})
            </span>
          </div>
          <div style={{
            height: '20px',
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '10px',
            overflow: 'hidden',
            display: 'flex',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)'
          }}>
            {subjectTotalMins > 0 ? (
              subjectBreakdown.filter(s => s.mins > 0).map((s) => {
                const widthPct = (s.mins / subjectTotalMins) * 100;
                return (
                  <div
                    key={s.name}
                    style={{
                      width: `${widthPct}%`,
                      height: '100%',
                      background: s.color,
                      transition: 'width 0.4s ease',
                      position: 'relative'
                    }}
                    title={`${s.name}: ${formatTime(s.mins)} (${s.pct}%)`}
                  />
                );
              })
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                이번 주 기록된 과목별 집중 시간이 없습니다. 타이머 시작 시 과목을 선택해주세요.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {subjectBreakdown.map((s) => (
              <div
                key={s.name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '8px',
                  background: s.mins > 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${s.mins > 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}`,
                  opacity: s.mins > 0 ? 1 : 0.6
                }}
              >
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fff' }}>{s.name}</span>
                <span style={{ fontSize: '0.75rem', color: s.mins > 0 ? '#38bdf8' : 'var(--text-muted)' }}>
                  {formatTime(s.mins)}
                </span>
                {s.mins > 0 && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.08)', padding: '0.05rem 0.35rem', borderRadius: '4px', fontWeight: 'bold' }}>
                    {s.pct}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 2) 해당 요일(선택된 날짜) 과목별 공부시간 밸런스 */}
        {activeDayForDetail && (
          <div style={{ borderTop: '1px dashed rgba(255,255,255,0.12)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: '#6ee7b7' }}>
                📅 {activeDayForDetail.dayName}요일 ({activeDayForDetail.dateShort}){activeDayForDetail.isToday ? ' · 오늘' : ''} 밸런스 ({daySubjectTotalMins > 0 ? formatTime(daySubjectTotalMins) : '0분'})
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                상단 그래프에서 다른 요일 클릭 시 즉시 전환
              </span>
            </div>

            <div style={{
              height: '16px',
              width: '100%',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '8px',
              overflow: 'hidden',
              display: 'flex',
              border: '1px solid rgba(255,255,255,0.08)'
            }}>
              {daySubjectTotalMins > 0 ? (
                daySubjectBreakdown.filter(s => s.mins > 0).map((s) => {
                  const widthPct = (s.mins / daySubjectTotalMins) * 100;
                  return (
                    <div
                      key={s.name}
                      style={{
                        width: `${widthPct}%`,
                        height: '100%',
                        background: s.color,
                        transition: 'width 0.4s ease'
                      }}
                      title={`${s.name}: ${formatTime(s.mins)} (${s.pct}%)`}
                    />
                  );
                })
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  해당 요일에 기록된 공부 시간이 없습니다.
                </div>
              )}
            </div>

            {daySubjectTotalMins > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {daySubjectBreakdown.filter(s => s.mins > 0).map((s) => (
                  <div
                    key={s.name}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.25rem 0.55rem',
                      borderRadius: '7px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                    <span style={{ fontSize: '0.76rem', fontWeight: 'bold', color: '#fff' }}>{s.name}</span>
                    <span style={{ fontSize: '0.72rem', color: '#6ee7b7' }}>{formatTime(s.mins)}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.08)', padding: '0.03rem 0.3rem', borderRadius: '4px', fontWeight: 'bold' }}>
                      {s.pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: 주간 스터디 타임테이블 (10분 그리드 · 5분 반칸 지원) (일~토) */}
      {/* ========================================================================= */}
      <StudyTimetable 
        weekOffset={weekOffset} 
        setWeekOffset={setWeekOffset} 
        hideNav={true} 
      />

      {/* Subject Management Modal */}
      <SubjectModal isOpen={showSubjectModal} onClose={() => setShowSubjectModal(false)} />

    </div>
  );
}
