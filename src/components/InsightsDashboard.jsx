import { useState, useEffect } from 'react';
import { BarChart2, Trophy, Timer, Zap, Calendar, ArrowLeft } from 'lucide-react';
import { storage } from '../utils/storage';
import StudyTimetable from './StudyTimetable';

export default function InsightsDashboard({ onClose }) {
  const [stats, setStats] = useState(null);
  const [weeklyTrend, setWeeklyTrend] = useState([]);
  const [activeTab, setActiveTab] = useState('timetable'); // 'timetable' | 'trend'

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
  const maxMins = Math.max(...weeklyTrend.map(t => t.minutes), 60);

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
            핵심 공부 데이터와 타임테이블을 한눈에 관찰합니다.
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

      {/* Clean View Tabs: Timetable vs Trend Chart */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: 'rgba(0,0,0,0.3)', padding: '0.35rem', borderRadius: '10px' }}>
        <button
          onClick={() => setActiveTab('timetable')}
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: activeTab === 'timetable' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'timetable' ? '#000' : 'var(--text-secondary)',
            transition: 'all 0.2s'
          }}
        >
          🗓️ 스터디 플래너 타임테이블 (1·2·3단)
        </button>
        <button
          onClick={() => setActiveTab('trend')}
          style={{
            flex: 1,
            padding: '0.5rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: activeTab === 'trend' ? '#8b5cf6' : 'transparent',
            color: activeTab === 'trend' ? '#fff' : 'var(--text-secondary)',
            transition: 'all 0.2s'
          }}
        >
          📊 최근 7일 공부시간 트렌드 (막대 그래프)
        </button>
      </div>

      {/* Tab 1: 3-Tier Study Planner Timetable */}
      {activeTab === 'timetable' && (
        <StudyTimetable />
      )}

      {/* Tab 2: Weekly Study Trend Bar Chart */}
      {activeTab === 'trend' && (
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={17} color="#8b5cf6" /> 최근 7일 요일별 집중 시간
            </h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>최근 7일간 집중 시간 비교</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '0.75rem', height: '220px', padding: '1rem 0.5rem 0.5rem 0.5rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            {weeklyTrend.map((item) => {
              const heightPercent = item.minutes > 0 ? Math.max(12, Math.round((item.minutes / maxMins) * 100)) : 4;
              
              return (
                <div key={item.dateStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 'bold', color: item.minutes > 0 ? '#34d399' : 'rgba(255,255,255,0.25)', marginBottom: '0.35rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {formatTime(item.minutes)}
                  </div>

                  <div 
                    style={{ 
                      width: '100%', 
                      maxWidth: '42px', 
                      height: `${heightPercent}%`, 
                      background: item.minutes > 0 
                        ? (item.isToday ? 'linear-gradient(180deg, #c084fc 0%, #7c3aed 100%)' : 'linear-gradient(180deg, #34d399 0%, #059669 100%)') 
                        : 'rgba(255,255,255,0.06)', 
                      borderRadius: '6px 6px 2px 2px',
                      transition: 'all 0.3s ease',
                      boxShadow: item.minutes > 0 ? '0 4px 12px rgba(16, 185, 129, 0.25)' : 'none',
                      border: item.isToday ? '1px solid #c084fc' : 'none'
                    }} 
                    title={`${item.dayLabel}: ${formatTime(item.minutes)}`}
                  />

                  <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: item.isToday ? '#c084fc' : (item.minutes > 0 ? '#fff' : 'var(--text-muted)') }}>
                      {item.dayName}요일
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                      {item.dateShort}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
