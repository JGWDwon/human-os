import { useState, useEffect } from 'react';
import { TreePine, Trophy, Flame } from 'lucide-react';
import { storage } from '../utils/storage';

export default function ForestPixelMap({ refreshTrigger, selectedDate, onDateSelect }) {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ totalCompleted: 0, currentStreak: 0 });
  const [calendarInfo, setCalendarInfo] = useState({ year: 2026, month: 5, firstDay: 0 }); // month is 0-indexed

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Get data for the calendar view
    const monthlyHist = storage.getMonthlyHistory(year, month);
    
    // Get historical data for the 30-day streak stats
    const recentHist = storage.getQuestHistory(30); 
    
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    
    setCalendarInfo({ year, month, firstDay });
    setHistory(monthlyHist);
    
    // Calculate simple stats for dopamine
    let completed = 0;
    let streak = 0;
    let isStreakActive = true;
    
    for (let i = recentHist.length - 1; i >= 0; i--) {
      if (recentHist[i].status === 'completed' || recentHist[i].status === 'partial') {
        completed++;
        if (isStreakActive) streak++;
      } else if (recentHist[i].status === 'hibernation') {
        // Hibernation preserves streak but doesn't add to it
      } else {
        if (i < recentHist.length - 1) isStreakActive = false; 
      }
    }
    
    setStats({ totalCompleted: completed, currentStreak: streak });
  }, [refreshTrigger, selectedDate]);

  const getColor = (status) => {
    switch(status) {
      case 'completed': return 'var(--accent-primary)';
      case 'partial': return 'rgba(16, 185, 129, 0.4)';
      case 'hibernation': return 'var(--accent-hibernation)';
      case 'none': default: return 'rgba(0,0,0,0.3)';
    }
  };

  const getTooltip = (dayData) => {
    if (!dayData || dayData.status === 'none') return "성장의 씨앗을 심어주세요";
    if (dayData.status === 'hibernation') return "전략적 동면(휴식) 중입니다 💤";
    
    const mainQuests = dayData.quests ? dayData.quests.filter(q => q.type === 'main' || !q.type) : [];
    const completedCount = mainQuests.filter(q => q.isCompleted).length;
    const pomoCount = dayData.pomoCount || 0;
    const pomoLevel = pomoCount >= 5 ? 3 : pomoCount >= 3 ? 2 : pomoCount >= 1 ? 1 : 0;
    const finalLevel = Math.max(completedCount, pomoLevel);
    
    return `달성 단계: ${finalLevel}단계 (${finalLevel === 1 ? '새싹 🌱' : finalLevel === 2 ? '성장 🌿' : '울창 🌲'}) (메인퀘 ${completedCount}개, 뽀모도로 ${pomoCount}회)`;
  };

  const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="glass-panel" style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '3px solid var(--accent-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
          <TreePine size={20} color="var(--accent-primary)" />
          {calendarInfo.year}년 {monthNames[calendarInfo.month]} 성장의 숲
        </h3>
        
        {/* Stats for pride */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-primary)', fontSize: '0.85rem' }}>
            <Trophy size={14} /> <span style={{ fontWeight: 'bold' }}>{stats.totalCompleted}</span>그루
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#f97316', fontSize: '0.85rem' }}>
            <Flame size={14} /> <span style={{ fontWeight: 'bold' }}>{stats.currentStreak}</span>일 연속
          </div>
        </div>
      </div>
      
      {/* Calendar Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        {/* Day of Week Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', width: '100%', marginBottom: '0.5rem' }}>
          {dayNames.map(day => (
            <div key={day} style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {day}
            </div>
          ))}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', width: '100%', gridAutoRows: '1fr' }}>
          {/* Empty cells for days before the 1st of the month */}
          {Array.from({ length: calendarInfo.firstDay }).map((_, i) => (
            <div key={`empty-${i}`} style={{ aspectRatio: '1/1' }} />
          ))}
          
          {/* Calendar Days */}
          {history.map((day) => {
            const mainQuests = day.quests ? day.quests.filter(q => q.type === 'main' || !q.type) : [];
            const completedCount = mainQuests.filter(q => q.isCompleted).length;
            const pomoCount = day.pomoCount || 0;
            const totalMins = pomoCount * 25;
            const h = Math.floor(totalMins / 60);
            const m = totalMins % 60;
            const timeLabel = totalMins === 0 ? '' : h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`;

            // Emoji is ONLY based on main quest completion count
            let emoji = '';
            if (day.status === 'hibernation') emoji = '💤';
            else if (completedCount === 1) emoji = '🌱'; // 새싹
            else if (completedCount === 2) emoji = '🌿'; // 풍
            else if (completedCount >= 3) emoji = '🌲'; // 나무

            return (
              <div 
                key={day.day}
                title={getTooltip(day)}
                style={{
                  aspectRatio: '1/1',
                  backgroundColor: getColor(day.status),
                  borderRadius: '8px',
                  border: day.date === selectedDate ? '2px solid white' : (day.status === 'none' ? '1px solid rgba(255,255,255,0.05)' : 'none'),
                  boxShadow: day.date === selectedDate ? '0 0 10px rgba(255,255,255,0.5)' : (day.status === 'completed' ? '0 0 8px rgba(16, 185, 129, 0.4)' : 'none'),
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '3px 4px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onClick={() => onDateSelect && onDateSelect(day.date)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.15) translateY(-2px)';
                  e.currentTarget.style.zIndex = 10;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1) translateY(0)';
                  e.currentTarget.style.zIndex = 1;
                }}
              >
                {/* Date number top-left */}
                <span style={{ 
                  fontSize: '0.6rem', 
                  fontWeight: 600, 
                  alignSelf: 'flex-start',
                  lineHeight: 1,
                  color: day.status === 'none' ? 'var(--text-muted)' : 'rgba(255,255,255,0.7)',
                  opacity: day.status === 'none' ? 0.4 : 1
                }}>
                  {day.day}
                </span>
                
                {/* Center emoji */}
                <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>
                  {emoji || ' '}
                </span>

                {/* Study time bottom */}
                <span style={{
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  lineHeight: 1,
                  color: day.status === 'none' ? 'transparent' : 'rgba(255,255,255,0.85)',
                  letterSpacing: '-0.02em'
                }}>
                  {timeLabel || ' '}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🌲 3개 완료 (울창)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🌿 2개 완료 (성장)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🌱 1개 완료 (새싹)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>💤 전략적 휴식</span>
      </div>
    </div>
  );
}
