import { useState, useEffect, useMemo } from 'react';
import { BarChart2, Trophy, Timer, Zap, Calendar, ArrowLeft, Flame, CheckCircle2, Clock, ChevronLeft, ChevronRight, RotateCcw, BookOpen, PieChart } from 'lucide-react';
import { storage } from '../utils/storage';
import StudyTimetable from './StudyTimetable';
import SubjectModal from './SubjectModal';

const SUBJECT_COLORS = [
  '#38bdf8', // Sky
  '#a855f7', // Purple
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#8b5cf6', // Violet
];

export default function InsightsDashboard({ onClose }) {
  const [stats, setStats] = useState(() => storage.getAllTimeStats());
  const [weekOffset, setWeekOffset] = useState(0); // 0: 이번 주, -1: 지난 주, +1: 다음 주
  const [selectedDay, setSelectedDay] = useState(null);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [subjects, setSubjects] = useState(() => storage.getSubjects());

  useEffect(() => {
    const allStats = storage.getAllTimeStats();
    setStats(allStats);

    const handleSubs = () => setSubjects(storage.getSubjects());
    window.addEventListener('subjects-updated', handleSubs);
    return () => window.removeEventListener('subjects-updated', handleSubs);
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

  // Subject Balance Breakdown for the current week (과목 편식 방지)
  const { subjectBreakdown, subjectTotalMins } = useMemo(() => {
    const pomoRaw = localStorage.getItem('human_os_pomodoro_v1');
    const pomoData = pomoRaw ? JSON.parse(pomoRaw) : {};
    const subMap = {};

    const safeSubjects = Array.isArray(subjects) ? subjects : [];
    // Initialize all registered subjects with 0 so the user sees all subjects
    safeSubjects.forEach(s => { subMap[s] = 0; });

    let total = 0;
    weeklyTrend.forEach(day => {
      const dayData = pomoData[day.dateStr];
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
        let colorIndex = registeredOrder.indexOf(name);
        if (colorIndex === -1) colorIndex = 7;
        const color = SUBJECT_COLORS[colorIndex % SUBJECT_COLORS.length];
        return { name, mins, pct, color };
      })
      .sort((a, b) => b.mins - a.mins);

    return { subjectBreakdown: breakdown, subjectTotalMins: total };
  }, [weeklyTrend, subjects]);

  const currentStats = stats || { activeDays: 0, totalFocusMins: 0 };
  const dailyAvgMins = Math.round(totalWeeklyMinutes / 7);
  const bestDay = weeklyTrend.reduce((best, cur) => (cur.minutes > (best?.minutes || 0) ? cur : best), null);
  const sproutDaysCount = weeklyTrend.filter(t => t.minutes >= 240).length;

  // Chart Y-axis max scale: comfortable headroom above max, milestone aligned
  const rawMax = Math.max(...weeklyTrend.map(t => t.minutes), 0);
  const scaleMaxMins = Math.max(480, Math.ceil((rawMax * 1.18) / 60) * 60);

  // Guidelines: 2h, 4h, 6h, 8h (and 10h if headroom allows)
  const guidelines = [
    { mins: 480, label: '8시간 🌲', color: 'rgba(16, 185, 129, 0.4)', textColor: '#34d399' },
    { mins: 360, label: '6시간 🌿', color: 'rgba(56, 189, 248, 0.35)', textColor: '#38bdf8' },
    { mins: 240, label: '4시간 🌱', color: 'rgba(52, 211, 153, 0.35)', textColor: '#34d399' },
    { mins: 120, label: '2시간', color: 'rgba(255, 255, 255, 0.08)', textColor: 'var(--text-muted)' }
  ];
  if (scaleMaxMins >= 660) {
    guidelines.unshift({ mins: 600, label: '10시간 🔥', color: 'rgba(249, 115, 22, 0.45)', textColor: '#f97316' });
  }

  // Selected day pomodoro sessions for drilldown
  const activeDayForDetail = selectedDay || weeklyTrend.find(t => t.isToday) || weeklyTrend[weeklyTrend.length - 1];
  const activeDayPomo = activeDayForDetail ? storage.getPomodoroByDate(activeDayForDetail.dateStr) : null;

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '80vh', gap: '1.25rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
            <BarChart2 size={22} color="var(--accent-secondary)" />
            나의 공부 성장 리포트
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem', margin: 0 }}>
            핵심 공부 데이터와 주간 스터디 타임테이블을 한눈에 관찰합니다.
          </p>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.35rem 0.85rem', borderRadius: '8px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>주간 총 공부 시간</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#34d399' }}>
            {formatTime(totalWeeklyMinutes)}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: 주간 공부시간 트렌드 막대그래프 (일~토) */}
      {/* ========================================================================= */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* 3 Trend Insight Chips */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.6rem' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>일평균 순공</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#38bdf8', marginTop: '0.15rem' }}>
              {formatTime(dailyAvgMins)}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Flame size={12} color="#f97316" /> 최고 집중일 (Best)
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#f97316', marginTop: '0.15rem' }}>
              {bestDay && bestDay.minutes > 0 ? `${bestDay.dayName} (${formatTime(bestDay.minutes)})` : '-'}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.65rem 0.85rem' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <CheckCircle2 size={12} color="#10b981" /> 4h+ 새싹 달성
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#10b981', marginTop: '0.15rem' }}>
              {sproutDaysCount}일 <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>/ 7일</span>
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
                막대를 클릭하면 해당 일자의 상세 집중 기록(타임스탬프)을 확인할 수 있습니다.
              </span>
            </div>

            {/* Goal Guideline Legend */}
            <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.7rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#34d399', borderRadius: '2px' }}></span> 🌱 4시간
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#38bdf8', borderRadius: '2px' }}></span> 🌿 6시간
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '2px' }}></span> 🌲 8시간
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

                // Dynamic gradient based on study duration
                const barGradient = item.minutes >= 480
                  ? 'linear-gradient(180deg, #10b981 0%, #047857 100%)' // 8h+ (울창)
                  : item.minutes >= 360
                    ? 'linear-gradient(180deg, #34d399 0%, #059669 100%)' // 6h+ (성장)
                    : item.minutes >= 240
                      ? 'linear-gradient(180deg, #6ee7b7 0%, #10b981 100%)' // 4h+ (새싹)
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

        {/* Selected Day Detail Card */}
        {activeDayForDetail && (
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            padding: '0.9rem 1.1rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={16} color="var(--accent-primary)" />
                <span style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#fff' }}>
                  {activeDayForDetail.dayLabel} 상세 집중 세션
                </span>
                {activeDayForDetail.isToday && (
                  <span style={{ fontSize: '0.68rem', color: '#c084fc', background: 'rgba(192, 132, 252, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    오늘
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: activeDayForDetail.minutes > 0 ? '#34d399' : 'var(--text-muted)' }}>
                총 {formatTime(activeDayForDetail.minutes)} ({activeDayPomo?.count || 0}회 집중)
              </div>
            </div>

            {/* Session list or empty message */}
            {activeDayPomo?.timestamps && activeDayPomo.timestamps.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxHeight: '120px', overflowY: 'auto' }}>
                {activeDayPomo.timestamps.map((ts, idx) => {
                  const timeStr = typeof ts === 'string' ? ts : ts.time;
                  const mins = typeof ts === 'object' && ts.minutes ? ts.minutes : 25;
                  const sub = typeof ts === 'object' && ts.subject ? ts.subject : null;
                  return (
                    <span
                      key={idx}
                      style={{
                        fontSize: '0.74rem',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '6px',
                        color: '#e2e8f0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      {sub && (
                        <span style={{ fontSize: '0.68rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)', padding: '0.05rem 0.35rem', borderRadius: '3px', fontWeight: 'bold' }}>
                          {sub}
                        </span>
                      )}
                      ⏱️ {timeStr} ({mins}분)
                    </span>
                  );
                })}
              </div>
            ) : (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                이 날짜에는 기록된 뽀모도로 집중 세션이 없습니다.
              </p>
            )}
          </div>
        )}

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

        {/* Multi-Segment Stacked Balance Bar */}
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

        {/* Subject Breakdown Badges */}
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
