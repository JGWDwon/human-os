import { useState, useEffect, useMemo } from 'react';
import { BarChart2, Trophy, Timer, Zap, Calendar, ArrowLeft, Flame, Sparkles, CheckCircle2, Clock } from 'lucide-react';
import { storage } from '../utils/storage';
import StudyTimetable from './StudyTimetable';

export default function InsightsDashboard({ onClose }) {
  const [stats, setStats] = useState(null);
  const [weeklyTrend, setWeeklyTrend] = useState([]);
  const [activeTab, setActiveTab] = useState('timetable'); // 'timetable' | 'trend'
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    const allStats = storage.getAllTimeStats();
    setStats(allStats);

    // Calculate last 7 days study focus trend using local ISO date string
    const pomoRaw = localStorage.getItem('human_os_pomodoro_v1');
    const pomoData = pomoRaw ? JSON.parse(pomoRaw) : {};

    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const dayName = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];

      const totalMins = pomoData[dateStr]?.totalMinutes || 0;
      const hoursNum = Number((totalMins / 60).toFixed(1));

      trend.push({
        dateStr,
        dayName,
        dateShort: `${d.getMonth() + 1}/${d.getDate()}`,
        dayLabel: `${dayName} (${d.getMonth() + 1}/${d.getDate()})`,
        minutes: totalMins,
        hours: hoursNum,
        isToday: i === 0
      });
    }
    setWeeklyTrend(trend);
  }, []);

  const formatTime = (minutes) => {
    if (!minutes || minutes <= 0) return '0분';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}시간 ${m > 0 ? m + '분' : ''}`;
    return `${m}분`;
  };

  if (!stats) return null;

  const recent7DaysMins = weeklyTrend.reduce((sum, item) => sum + item.minutes, 0);
  const dailyAvgMins = Math.round(recent7DaysMins / 7);
  const bestDay = weeklyTrend.reduce((best, cur) => (cur.minutes > (best?.minutes || 0) ? cur : best), null);
  const sproutDaysCount = weeklyTrend.filter(t => t.minutes >= 240).length;

  // Chart Y-axis max scale: at least 480 mins (8h), padded to full hours
  const rawMax = Math.max(...weeklyTrend.map(t => t.minutes), 0);
  const scaleMaxMins = Math.max(480, Math.ceil((rawMax + 30) / 60) * 60);

  // Selected day pomodoro sessions
  const activeDayForDetail = selectedDay || weeklyTrend.find(t => t.isToday) || weeklyTrend[weeklyTrend.length - 1];
  const activeDayPomo = activeDayForDetail ? storage.getPomodoroByDate(activeDayForDetail.dateStr) : null;

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '80vh' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
            <BarChart2 size={22} color="var(--accent-secondary)" />
            나의 공부 성장 리포트
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem', margin: 0 }}>
            핵심 공부 데이터와 주간 타임테이블을 한눈에 관찰합니다.
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '0.85rem 1.1rem', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Trophy size={14} color="#10b981" /> 총 출석일
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 'bold', color: 'var(--accent-primary)', marginTop: '0.15rem' }}>
              {stats.activeDays}일
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.85rem 1.1rem', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Zap size={14} color="#3b82f6" /> 누적 공부 시간
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 'bold', color: 'var(--accent-secondary)', marginTop: '0.15rem' }}>
              {formatTime(stats.totalFocusMins || 0)}
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(168, 85, 247, 0.1)', padding: '0.85rem 1.1rem', borderRadius: '10px', border: '1px solid rgba(168, 85, 247, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Timer size={14} color="#c084fc" /> 최근 7일 집중
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 'bold', color: '#c084fc', marginTop: '0.15rem' }}>
              {formatTime(recent7DaysMins)}
            </div>
          </div>
        </div>
      </div>

      {/* Clean View Tabs: 주간 타임테이블 vs 7일 트렌드 */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: 'rgba(0,0,0,0.3)', padding: '0.35rem', borderRadius: '10px' }}>
        <button
          onClick={() => setActiveTab('timetable')}
          style={{
            flex: 1,
            padding: '0.55rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: activeTab === 'timetable' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'timetable' ? '#000' : 'var(--text-secondary)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem'
          }}
        >
          <Calendar size={16} /> 🗓️ 주간 스터디 타임테이블
        </button>
        <button
          onClick={() => setActiveTab('trend')}
          style={{
            flex: 1,
            padding: '0.55rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: activeTab === 'trend' ? '#8b5cf6' : 'transparent',
            color: activeTab === 'trend' ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.4rem'
          }}
        >
          <BarChart2 size={16} /> 📊 최근 7일 공부시간 트렌드
        </button>
      </div>

      {/* Tab 1: Weekly Timetable */}
      {activeTab === 'timetable' && (
        <StudyTimetable />
      )}

      {/* Tab 2: Advanced 7-Day Trend Bar Chart */}
      {activeTab === 'trend' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* 3 Refined Trend Insight Chips */}
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

          {/* Main Chart Container with Y-Axis Guidelines */}
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1.25rem 1rem 0.75rem 1rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '0.98rem', margin: 0, color: 'var(--text-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={16} color="#8b5cf6" /> 최근 7일 일별 집중 시간
                </h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  막대를 클릭하면 해당 일자의 상세 집중 기록을 확인할 수 있습니다.
                </span>
              </div>

              {/* Goal Guideline Legend */}
              <div style={{ display: 'flex', gap: '0.6rem', fontSize: '0.7rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '8px', height: '8px', background: '#34d399', borderRadius: '2px' }}></span> 🌱 4시간
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '2px' }}></span> 🌲 8시간
                </span>
              </div>
            </div>

            {/* Chart Area with Relative Grid Lines */}
            <div style={{ position: 'relative', height: '240px', padding: '0 0.5rem 0 3rem' }}>
              
              {/* Horizontal Guidelines: 8h, 6h, 4h, 2h */}
              {[
                { mins: 480, label: '8시간 🌲', color: 'rgba(16, 185, 129, 0.35)', textColor: '#34d399' },
                { mins: 360, label: '6시간', color: 'rgba(255, 255, 255, 0.12)', textColor: 'var(--text-muted)' },
                { mins: 240, label: '4시간 🌱', color: 'rgba(52, 211, 153, 0.35)', textColor: '#34d399' },
                { mins: 120, label: '2시간', color: 'rgba(255, 255, 255, 0.1)', textColor: 'var(--text-muted)' }
              ].map(g => {
                if (g.mins > scaleMaxMins) return null;
                const bottomPercent = (g.mins / scaleMaxMins) * 100;
                return (
                  <div key={g.mins} style={{ position: 'absolute', left: 0, right: 0, bottom: `${bottomPercent}%`, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', left: '0', top: '-8px', fontSize: '0.65rem', color: g.textColor, fontWeight: 'bold' }}>
                      {g.label}
                    </div>
                    <div style={{ marginLeft: '2.8rem', borderBottom: `1px dashed ${g.color}` }} />
                  </div>
                );
              })}

              {/* 7 Bars Container */}
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: '100%', gap: '0.5rem', position: 'relative', zIndex: 2 }}>
                {weeklyTrend.map((item) => {
                  const isSelected = activeDayForDetail?.dateStr === item.dateStr;
                  const heightPercent = item.minutes > 0 ? Math.max(8, Math.min(100, Math.round((item.minutes / scaleMaxMins) * 100))) : 3;

                  // Dynamic gradient based on study duration
                  const barGradient = item.minutes >= 480
                    ? 'linear-gradient(180deg, #10b981 0%, #047857 100%)' // 8h+ (울창)
                    : item.minutes >= 360
                      ? 'linear-gradient(180deg, #34d399 0%, #059669 100%)' // 6h+ (성장)
                      : item.minutes >= 240
                        ? 'linear-gradient(180deg, #6ee7b7 0%, #10b981 100%)' // 4h+ (새싹)
                        : item.minutes > 0
                          ? 'linear-gradient(180deg, #93c5fd 0%, #3b82f6 100%)' // <4h (집중)
                          : 'rgba(255,255,255,0.06)';

                  return (
                    <div
                      key={item.dateStr}
                      onClick={() => setSelectedDay(item)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flex: 1,
                        height: '100%',
                        justifyContent: 'flex-end',
                        cursor: 'pointer',
                        padding: '0.2rem',
                        borderRadius: '8px',
                        background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                        transition: 'background 0.2s'
                      }}
                      title={`${item.dayLabel}: ${formatTime(item.minutes)} (클릭하여 상세 기록 확인)`}
                    >
                      {/* Top Time Badge */}
                      <div style={{
                        fontSize: '0.72rem',
                        fontWeight: 'bold',
                        color: item.minutes > 0 ? (item.isToday ? '#c084fc' : '#34d399') : 'rgba(255,255,255,0.25)',
                        marginBottom: '0.35rem',
                        textAlign: 'center',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.minutes > 0 ? formatTime(item.minutes) : '0분'}
                      </div>

                      {/* Bar Pillar */}
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '44px',
                          height: `${heightPercent}%`,
                          background: barGradient,
                          borderRadius: '8px 8px 3px 3px',
                          transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s',
                          boxShadow: item.minutes >= 240 ? '0 4px 15px rgba(16, 185, 129, 0.35)' : 'none',
                          border: item.isToday ? '1.5px solid #c084fc' : isSelected ? '1.5px solid #fff' : 'none',
                          transform: isSelected ? 'scaleY(1.03)' : 'none'
                        }}
                      />

                      {/* X-Axis Day & Date Labels */}
                      <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                        <div style={{
                          fontSize: '0.8rem',
                          fontWeight: 'bold',
                          color: item.isToday ? '#c084fc' : item.minutes > 0 ? '#fff' : 'var(--text-muted)'
                        }}>
                          {item.dayName}
                        </div>
                        <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)', marginTop: '0.05rem' }}>
                          {item.dateShort}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

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
                    return (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.74rem',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                          color: '#e2e8f0'
                        }}
                      >
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
      )}

    </div>
  );
}
