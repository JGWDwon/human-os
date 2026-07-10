import { useState, useEffect } from 'react';
import { Timer, Plus, CalendarDays } from 'lucide-react';
import { storage } from '../utils/storage';
import mushroomImg from '../assets/mushroom.png';

export default function PomodoroTracker({ selectedDate }) {
  const [todayData, setTodayData] = useState({ count: 0, totalMinutes: 0 });
  const [weeklyData, setWeeklyData] = useState({ weeklyCount: 0, weeklyMinutes: 0, weekData: [] });

  useEffect(() => {
    refreshData();
  }, [selectedDate]);

  const refreshData = () => {
    setTodayData(storage.getPomodoroByDate(selectedDate));
    setWeeklyData(storage.getWeeklyPomodoroStats());
  };

  const handleAddPomodoro = () => {
    storage.addPomodoroByDate(selectedDate);
    refreshData();
    
    // Add XP
    storage.addXP(50);
    window.dispatchEvent(new CustomEvent('xp-updated'));
    
    // Play a mechanical "double beep" sound for Pomodoro
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      const playBeep = (freq, time, duration) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'square'; // slightly more mechanical/digital sound
        oscillator.frequency.setValueAtTime(freq, time);
        
        gainNode.gain.setValueAtTime(0.05, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start(time);
        oscillator.stop(time + duration);
      };

      // C6 then E6 (ascending double beep)
      playBeep(1046.50, audioCtx.currentTime, 0.1); 
      playBeep(1318.51, audioCtx.currentTime + 0.15, 0.15); 
    } catch (e) {
      console.log('Audio not supported or blocked');
    }
  };

  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}시간 ${m > 0 ? m + '분' : ''}`;
    return `${m}분`;
  };

  const dayNames = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '3px solid #ef4444', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
          <img src={mushroomImg} alt="Mushroom" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #ef4444' }} />
          수동 뽀모도로 사냥터
        </h2>
        {selectedDate !== new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0] && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
            📅 {selectedDate} 과거 기록 수정
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '1.5rem', background: 'rgba(239, 68, 68, 0.03)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
        
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            {selectedDate === new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0] ? '오늘' : '선택된 날짜'} 집중한 시간
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#ef4444', lineHeight: 1.2, textShadow: '0 0 20px rgba(239, 68, 68, 0.3)' }}>
            {formatTime(todayData.totalMinutes)}
          </div>
          <div style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: '500' }}>
            🍅 {todayData.count} 뽀모도로 완료
          </div>
        </div>

        <button 
          onClick={handleAddPomodoro}
          className="btn"
          style={{ 
            backgroundColor: '#ef4444', 
            color: 'white', 
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.8rem 1.5rem',
            borderRadius: '2rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            width: '100%',
            maxWidth: '200px',
            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.4)';
          }}
        >
          <Plus size={20} />
          25분 추가하기
        </button>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <CalendarDays size={14} /> 이번 주 요일별 기록
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            총 <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{formatTime(weeklyData.weeklyMinutes)}</span>
          </div>
        </div>
        
        {/* Weekly Bar Chart */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '80px', background: 'rgba(0,0,0,0.2)', padding: '1rem 0.5rem 0.5rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
          {weeklyData.weekData.map((day, idx) => {
            // Find max for scaling
            const maxMinutes = Math.max(...weeklyData.weekData.map(d => d.totalMinutes), 120); // Scale relative to at least 2 hours
            const heightPct = Math.min((day.totalMinutes / maxMinutes) * 100, 100);
            
            return (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', flex: 1 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{day.count > 0 ? day.count : ''}</div>
                <div style={{ 
                  width: '100%', 
                  maxWidth: '20px', 
                  height: `${heightPct}%`, 
                  minHeight: day.totalMinutes > 0 ? '4px' : '0',
                  background: day.date === new Date().toISOString().split('T')[0] ? '#ef4444' : 'rgba(239, 68, 68, 0.4)',
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 0.5s ease'
                }} />
                <div style={{ fontSize: '0.75rem', color: day.date === new Date().toISOString().split('T')[0] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {dayNames[idx]}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
