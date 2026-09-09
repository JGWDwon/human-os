import { useState, useEffect } from 'react';
import { TreePine, Trophy, Flame } from 'lucide-react';
import { storage } from '../utils/storage';

export default function ForestPixelMap({ refreshTrigger, selectedDate, onDateSelect }) {
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ totalTrees: 0, currentStreak: 0 });
  const [calendarInfo, setCalendarInfo] = useState({ year: 2026, month: 8, firstDay: 0 }); // month is 0-indexed

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Get data for the calendar view
    const monthlyHist = storage.getMonthlyHistory(year, month);
    const recentHist = storage.getQuestHistory(30); 
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    
    setCalendarInfo({ year, month, firstDay });
    setHistory(monthlyHist);
    
    // Calculate simple stats for focus trees (4h+ = 1 tree point)
    let totalTrees = 0;
    let streak = 0;
    let isStreakActive = true;
    
    for (let i = recentHist.length - 1; i >= 0; i--) {
      const mins = recentHist[i].totalMinutes || 0;
      if (mins >= 240) { // 4시간 이상 달성 시
        totalTrees++;
        if (isStreakActive) streak++;
      } else if (recentHist[i].status === 'hibernation') {
        // Hibernation preserves streak
      } else {
        if (i < recentHist.length - 1) isStreakActive = false; 
      }
    }
    
    setStats({ totalTrees, currentStreak: streak });
  }, [refreshTrigger, selectedDate]);

  const getColor = (status) => {
    switch(status) {
      case 'completed': return '#10b981'; // 8h+ (울창)
      case 'partial': return 'rgba(16, 185, 129, 0.65)'; // 6h+ (성장)
      case 'sprout': return 'rgba(52, 211, 153, 0.4)'; // 4h+ (새싹)
      case 'hibernation': return 'var(--accent-hibernation)'; // 🌴 휴가/휴면
      case 'none': default: return 'rgba(0,0,0,0.3)';
    }
  };

  const getTooltip = (dayData) => {
    if (!dayData) return "오늘의 공부 목표를 향해 달려보세요!";
    const totalMins = dayData.totalMinutes || 0;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    const timeDisplay = totalMins === 0 ? '0분' : h > 0 ? `${h}시간 ${m > 0 ? m + '분' : ''}` : `${m}분`;
    
    if (dayData.status === 'hibernation') return `🌴 휴무/휴가 일자 (집중시간: ${timeDisplay})`;
    if (totalMins >= 480) return `🌲 8시간 이상 달성! (울창, 집중시간: ${timeDisplay})`;
    if (totalMins >= 360) return `🌿 6시간 이상 달성! (성장, 집중시간: ${timeDisplay})`;
    if (totalMins >= 240) return `🌱 4시간 이상 달성! (새싹, 집중시간: ${timeDisplay})`;
    return `집중시간: ${timeDisplay} (4시간 달성 시 새싹 🌱)`;
  };

  const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className="glass-panel" style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '3px solid var(--accent-primary)', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
          <TreePine size={20} color="var(--accent-primary)" />
          {calendarInfo.year}년 {monthNames[calendarInfo.month]} 성장의 숲
        </h3>
        
        {/* Stats */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-primary)', fontSize: '0.85rem' }}>
            <Trophy size={14} /> <span style={{ fontWeight: 'bold' }}>{stats.totalTrees}</span>달성
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
            const totalMins = day.totalMinutes || 0;
            const h = Math.floor(totalMins / 60);
            const m = totalMins % 60;
            const timeLabel = totalMins === 0 ? '' : h > 0 ? `${h}h${m > 0 ? m + 'm' : ''}` : `${m}m`;

            // Emoji based ONLY on focus study time
            let emoji = '';
            if (day.status === 'hibernation') emoji = '🌴';
            else if (day.status === 'completed') emoji = '🌲'; // 8h+
            else if (day.status === 'partial') emoji = '🌿';   // 6h+
            else if (day.status === 'sprout') emoji = '🌱';    // 4h+

            return (
              <div 
                key={day.day}
                title={getTooltip(day)}
                style={{
                  aspectRatio: '1/1',
                  backgroundColor: getColor(day.status),
                  borderRadius: '8px',
                  border: day.date === selectedDate ? '2px solid white' : (day.status === 'none' ? '1px solid rgba(255,255,255,0.05)' : 'none'),
                  boxShadow: day.date === selectedDate ? '0 0 10px rgba(255,255,255,0.5)' : (day.status === 'completed' ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none'),
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
                  color: day.status === 'none' ? 'var(--text-muted)' : 'rgba(255,255,255,0.85)',
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
                  fontSize: '0.62rem',
                  fontWeight: 800,
                  lineHeight: 1,
                  color: totalMins > 0 ? '#34d399' : 'transparent',
                  background: totalMins > 0 ? 'rgba(0,0,0,0.55)' : 'transparent',
                  padding: totalMins > 0 ? '1px 3px' : '0',
                  borderRadius: '3px',
                  letterSpacing: '-0.02em',
                  boxShadow: totalMins > 0 ? '0 1px 3px rgba(0,0,0,0.5)' : 'none'
                }}>
                  {timeLabel || ' '}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.85rem', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🌲 8시간 이상 (울창)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🌿 6시간 이상 (성장)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>🌱 4시간 이상 (새싹)</span>
      </div>
    </div>
  );
}
