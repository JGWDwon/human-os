import { useState, useEffect, useRef } from 'react';
import { TreePine, Trophy, Flame, ChevronLeft, ChevronRight, Moon, Check, Edit3, Save } from 'lucide-react';
import { storage, calculateSleepDuration } from '../utils/storage';
import confetti from 'canvas-confetti';

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const changeDayBy = (dateStr, delta) => {
  if (!dateStr) return getLocalDateString();
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  target.setDate(target.getDate() + delta);
  return getLocalDateString(target);
};

export default function ForestPixelMap({ refreshTrigger, selectedDate, onDateSelect }) {
  const todayStr = getLocalDateString();
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ totalTrees: 0, currentStreak: 0 });
  const [calendarInfo, setCalendarInfo] = useState({ year: 2026, month: 8, firstDay: 0 }); // month is 0-indexed
  const [viewDate, setViewDate] = useState(() => new Date());
  const [dailyLog, setDailyLog] = useState(() => storage.getDailyLogByDate(selectedDate));
  const [diaryText, setDiaryText] = useState(() => {
    const l = storage.getDailyLogByDate(selectedDate);
    return l?.diary || l?.note || '';
  });
  const [diarySavedStatus, setDiarySavedStatus] = useState(false);
  const diaryInputRef = useRef(null);

  const handlePrevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleTodayMonth = () => {
    setViewDate(new Date());
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return viewDate.getFullYear() === now.getFullYear() && viewDate.getMonth() === now.getMonth();
  };

  useEffect(() => {
    const log = storage.getDailyLogByDate(selectedDate);
    setDailyLog(log);
    setDiaryText(log?.diary || log?.note || '');
    setDiarySavedStatus(false);
  }, [selectedDate, refreshTrigger]);

  // 선택한 날짜의 월과 캘린더 뷰 월 동기화
  useEffect(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-').map(Number);
      if (parts.length === 3) {
        const [y, m] = parts;
        setViewDate(prev => {
          if (prev.getFullYear() !== y || prev.getMonth() !== (m - 1)) {
            return new Date(y, m - 1, 1);
          }
          return prev;
        });
      }
    }
  }, [selectedDate]);

  useEffect(() => {
    const handleDailyLogsUpdate = (e) => {
      if (!e.detail || e.detail.date === selectedDate) {
        const log = storage.getDailyLogByDate(selectedDate);
        setDailyLog(log);
        setDiaryText(log?.diary || log?.note || '');
      }
    };
    window.addEventListener('daily-logs-updated', handleDailyLogsUpdate);
    return () => window.removeEventListener('daily-logs-updated', handleDailyLogsUpdate);
  }, [selectedDate]);

  const handleSleepTimeChange = (field, value) => {
    const updated = storage.saveDailyLog(selectedDate, { [field]: value });
    setDailyLog(updated);
  };

  // 일기는 자동 저장하지 않고 상태만 갱신
  const handleDiaryChange = (value) => {
    setDiaryText(value);
    setDiarySavedStatus(false);
  };

  // 수동 저장 버튼 클릭 또는 Ctrl+Enter 시에만 저장
  const handleManualSaveDiary = () => {
    const updated = storage.saveDailyLog(selectedDate, { diary: diaryText, note: diaryText });
    setDailyLog(updated);
    setDiarySavedStatus(true);
    setTimeout(() => setDiarySavedStatus(false), 2000);
  };

  const getDiaryPlaceholder = (satisfaction) => {
    if (satisfaction === 'high') {
      return '🔥 대만족! 오늘 가장 몰입되고 뿌듯했던 순간이나 배운 점을 한 줄로 기록해보세요.';
    }
    if (satisfaction === 'mid') {
      return '🌿 적당함! 꾸준히 나아간 오늘 하루, 기억하고 싶은 생각이나 내일의 계획을 적어보세요.';
    }
    if (satisfaction === 'low') {
      return '🌱 아쉬움! 지치거나 아쉬웠던 점, 또는 내일 다시 시작할 다짐을 가볍게 남겨보세요.';
    }
    return '오늘 하루의 한줄평이나 짧은 공부 일기를 자유롭게 남겨보세요. (저장 버튼 또는 Ctrl+Enter)';
  };

  const handleSelectSatisfaction = (level) => {
    const newLevel = dailyLog?.satisfaction === level ? null : level;
    const updated = storage.saveDailyLog(selectedDate, { satisfaction: newLevel });
    setDailyLog(updated);
    if (newLevel) {
      if (newLevel === 'high') {
        confetti({
          particleCount: 35,
          spread: 55,
          origin: { y: 0.85 },
          colors: ['#f97316', '#ef4444', '#10b981']
        });
      }
      setTimeout(() => {
        if (diaryInputRef.current) {
          diaryInputRef.current.focus();
        }
      }, 80);
    }
  };

  useEffect(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    // Get data for the calendar view
    const monthlyHist = storage.getMonthlyHistory(year, month);
    const recentHist = storage.getQuestHistory(30); 
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    
    setCalendarInfo({ year, month, firstDay });
    setHistory(monthlyHist);
    
    // Calculate simple stats for focus trees (6h+ = 1 tree point)
    let totalTrees = 0;
    let streak = 0;
    let isStreakActive = true;
    
    for (let i = recentHist.length - 1; i >= 0; i--) {
      const mins = recentHist[i].totalMinutes || 0;
      if (mins >= 360) { // 일간 목표(6시간) 이상 달성 시
        totalTrees++;
        if (isStreakActive) streak++;
      } else if (recentHist[i].status === 'hibernation') {
        // 휴가는 스트릭 보존
      } else {
        isStreakActive = false;
      }
    }
    
    setStats({ totalTrees, currentStreak: streak });
  }, [refreshTrigger, viewDate, dailyLog]);

  const getColor = (status) => {
    switch(status) {
      case 'completed': return '#10b981'; // 8h+ (3단계 완벽 🌲)
      case 'level2': return '#059669'; // 7h+ (2단계 우수 🌳)
      case 'partial': return 'rgba(16, 185, 129, 0.65)'; // 6h+ (1단계 성장 🌿)
      case 'sprout': return 'rgba(52, 211, 153, 0.4)'; // 4h+ (새싹 🌱)
      case 'hibernation': return 'var(--accent-hibernation)'; // 🌴 휴가/휴면
      case 'none': default: return 'rgba(0,0,0,0.3)';
    }
  };

  const getTooltip = (dayData) => {
    const totalMins = dayData.totalMinutes || 0;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    const timeDisplay = totalMins === 0 ? '0분' : h > 0 ? `${h}시간 ${m > 0 ? `${m}분` : ''}` : `${m}분`;
    
    let base = '';
    if (dayData.status === 'hibernation') base = `🌴 휴무/휴가 일자 (집중시간: ${timeDisplay})`;
    else if (totalMins >= 480) base = `🌲 3단계(8h+) 완벽 달성! (울창, 집중: ${timeDisplay})`;
    else if (totalMins >= 420) base = `🌳 2단계(7h+) 우수 달성! (도약, 집중: ${timeDisplay})`;
    else if (totalMins >= 360) base = `🌿 1단계(6h+) 기본 달성! (성장, 집중: ${timeDisplay})`;
    else if (totalMins >= 240) base = `🌱 4시간 달성 (새싹, 집중: ${timeDisplay})`;
    else base = `집중시간: ${timeDisplay} (6시간 달성 시 1단계 🌿)`;

    const dLog = storage.getDailyLogByDate(dayData.date);
    const extras = [];
    if (dLog?.bedTime && dLog?.wakeTime) {
      extras.push(`수면: ${dLog.bedTime}~${dLog.wakeTime}`);
    }
    if (dLog?.satisfaction) {
      const satText = dLog.satisfaction === 'high' ? '🔥 상' : dLog.satisfaction === 'mid' ? '🌿 중' : '🌱 하';
      extras.push(`성취도: ${satText}`);
    }
    if (dLog?.diary || dLog?.note) {
      const d = (dLog.diary || dLog.note).trim();
      extras.push(`한줄평: "${d.length > 20 ? d.slice(0, 20) + '...' : d}"`);
    }
    if (extras.length > 0) {
      return `${base} · ${extras.join(' · ')}`;
    }
    return base;
  };

  const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const sleepDur = calculateSleepDuration(dailyLog?.bedTime, dailyLog?.wakeTime);

  return (
    <div className="glass-panel" style={{ width: '100%', display: 'flex', flexDirection: 'column', borderTop: '3px solid var(--accent-primary)', height: '100%', gap: '0.75rem' }}>
      
      {/* 1. Header (Month Navigation & Streak Stats) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
            <TreePine size={20} color="var(--accent-primary)" />
            {calendarInfo.year}년 {monthNames[calendarInfo.month]} 성장의 숲
          </h3>
          
          {/* Month Navigation */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '2px 4px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button 
              onClick={handlePrevMonth}
              title="이전 달"
              aria-label="이전 달"
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={handleTodayMonth}
              title="이번 달로 이동"
              style={{
                background: isCurrentMonth() ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.08)',
                border: isCurrentMonth() ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255,255,255,0.1)',
                color: isCurrentMonth() ? 'var(--accent-primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '0.72rem',
                borderRadius: '4px',
                fontWeight: 'bold'
              }}
            >
              이번달
            </button>
            <button 
              onClick={handleNextMonth}
              title="다음 달"
              aria-label="다음 달"
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '3px 5px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        
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
      
      {/* 2. Calendar Grid (Top-aligned, No wasted vertical space) */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {/* Day of Week Headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', width: '100%', marginBottom: '0.4rem' }}>
          {dayNames.map(day => (
            <div key={day} style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {day}
            </div>
          ))}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', width: '100%' }}>
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

            // Emoji based on focus study time (6h, 7h, 8h 차등)
            let emoji = '';
            if (day.status === 'hibernation') emoji = '🌴';
            else if (day.status === 'completed') emoji = '🌲'; // 8h+ (3단계 완벽)
            else if (day.status === 'level2') emoji = '🌳';    // 7h+ (2단계 우수)
            else if (day.status === 'partial') emoji = '🌿';   // 6h+ (1단계 달성)
            else if (day.status === 'sprout') emoji = '🌱';    // 4h+ (새싹)

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
                  fontSize: '0.62rem', 
                  fontWeight: 600, 
                  alignSelf: 'flex-start',
                  lineHeight: 1,
                  color: day.status === 'none' ? 'var(--text-muted)' : 'rgba(255,255,255,0.85)',
                  opacity: day.status === 'none' ? 0.4 : 1
                }}>
                  {day.day}
                </span>
                
                {/* Center emoji */}
                <span style={{ fontSize: '0.92rem', lineHeight: 1 }}>
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
      
      {/* 3. Compact Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.65rem', padding: '0.2rem 0', fontSize: '0.7rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>🌲 8h+ (3단계 완벽)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>🌳 7h+ (2단계 우수)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>🌿 6h+ (1단계 달성)</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>🌱 4h+ (새싹)</span>
      </div>

      {/* 4. Integrated Daily Log: 수면 기록 직접 기입, 성취도 & 오늘의 한줄평/일기 (자연스러운 높이 연동) */}
      <div style={{
        marginTop: '0.4rem',
        padding: '0.75rem 0.95rem',
        borderRadius: '10px',
        background: 'rgba(0, 0, 0, 0.35)',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <h4 style={{
              fontSize: '0.88rem',
              color: '#c084fc',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontWeight: 800
            }}>
              <Moon size={15} color="#c084fc" /> 하루 마무리 · 수면 & 성취도
            </h4>
            {selectedDate !== todayStr && (
              <span style={{
                fontSize: '0.68rem',
                color: '#fbbf24',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                padding: '0.1rem 0.45rem',
                borderRadius: '4px',
                fontWeight: 'bold'
              }}>
                {selectedDate < todayStr ? '과거 기록 작성 중' : '미래 일자'}
              </span>
            )}
          </div>

          {/* 날짜 빠른 선택 (전날/오늘/다음날) 및 직접 날짜 Picker */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            background: 'rgba(0, 0, 0, 0.45)',
            padding: '0.15rem 0.35rem',
            borderRadius: '6px',
            border: '1px solid rgba(139, 92, 246, 0.35)'
          }}>
            <button
              type="button"
              onClick={() => onDateSelect && onDateSelect(changeDayBy(selectedDate, -1))}
              title="전날 기록으로 이동"
              style={{
                background: 'none',
                border: 'none',
                color: '#c084fc',
                cursor: 'pointer',
                padding: '2px 5px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                borderRadius: '4px'
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#c084fc'}
            >
              <ChevronLeft size={14} />
              <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>전날</span>
            </button>

            {/* 날짜 직접 선택 Input */}
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value && onDateSelect) {
                  onDateSelect(e.target.value);
                }
              }}
              title="클릭하여 날짜 직접 선택"
              style={{
                background: 'rgba(139, 92, 246, 0.18)',
                border: '1px solid rgba(139, 92, 246, 0.5)',
                borderRadius: '4px',
                color: '#f1f5f9',
                padding: '0.12rem 0.35rem',
                fontSize: '0.74rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            />

            <button
              type="button"
              onClick={() => onDateSelect && onDateSelect(todayStr)}
              title="오늘 날짜로 이동"
              style={{
                background: selectedDate === todayStr ? 'rgba(139, 92, 246, 0.35)' : 'rgba(255, 255, 255, 0.08)',
                border: selectedDate === todayStr ? '1px solid #c084fc' : '1px solid rgba(255, 255, 255, 0.1)',
                color: selectedDate === todayStr ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px 6px',
                fontSize: '0.68rem',
                borderRadius: '4px',
                fontWeight: 'bold'
              }}
            >
              오늘
            </button>

            <button
              type="button"
              onClick={() => onDateSelect && onDateSelect(changeDayBy(selectedDate, 1))}
              title="다음날 기록으로 이동"
              style={{
                background: 'none',
                border: 'none',
                color: '#c084fc',
                cursor: 'pointer',
                padding: '2px 5px',
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                borderRadius: '4px'
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#c084fc'}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>다음날</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* 수면 시간 직접 기입 (취침 ~ 기상) */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '0.55rem 0.75rem',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.76rem', color: '#e2e8f0', fontWeight: 'bold' }}>
              🛌 수면 시간 기록
            </span>
            {sleepDur ? (
              <span style={{
                fontSize: '0.72rem',
                color: '#a78bfa',
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                padding: '0.1rem 0.5rem',
                borderRadius: '10px',
                fontWeight: 'bold'
              }}>
                💤 총 {sleepDur.hours}시간 {sleepDur.mins > 0 ? `${sleepDur.mins}분 ` : ''}수면
              </span>
            ) : (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                취침·기상 시각 직접 입력
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>취침:</span>
              <input
                type="time"
                value={dailyLog?.bedTime || ''}
                onChange={(e) => handleSleepTimeChange('bedTime', e.target.value)}
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(139, 92, 246, 0.35)',
                  borderRadius: '5px',
                  color: '#fff',
                  padding: '0.2rem 0.4rem',
                  fontSize: '0.75rem'
                }}
              />
            </div>

            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>~</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>기상:</span>
              <input
                type="time"
                value={dailyLog?.wakeTime || ''}
                onChange={(e) => handleSleepTimeChange('wakeTime', e.target.value)}
                style={{
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(139, 92, 246, 0.35)',
                  borderRadius: '5px',
                  color: '#fff',
                  padding: '0.2rem 0.4rem',
                  fontSize: '0.75rem'
                }}
              />
            </div>

            {(dailyLog?.bedTime || dailyLog?.wakeTime) && (
              <button
                type="button"
                onClick={() => {
                  handleSleepTimeChange('bedTime', '');
                  handleSleepTimeChange('wakeTime', '');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.68rem',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                  textDecoration: 'underline'
                }}
              >
                초기화
              </button>
            )}
          </div>
        </div>

        {/* 오늘의 성취도 (상 / 중 / 하 3단계 버튼) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.76rem', color: '#e2e8f0', fontWeight: 'bold' }}>
              ⭐ {selectedDate === todayStr ? '오늘의 공부 성취도' : `${selectedDate} 공부 성취도`}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              하루를 마무리하며 평가 (클릭 시 일기 작성)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
            <button
              type="button"
              onClick={() => handleSelectSatisfaction('high')}
              style={{
                padding: '0.45rem 0.3rem',
                borderRadius: '7px',
                border: dailyLog?.satisfaction === 'high' ? '1.5px solid #f97316' : '1px solid rgba(255, 255, 255, 0.08)',
                background: dailyLog?.satisfaction === 'high' ? 'rgba(249, 115, 22, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                color: dailyLog?.satisfaction === 'high' ? '#fdba74' : 'var(--text-muted)',
                fontWeight: dailyLog?.satisfaction === 'high' ? 'bold' : 'normal',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.15rem',
                boxShadow: dailyLog?.satisfaction === 'high' ? '0 0 10px rgba(249, 115, 22, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '1rem' }}>🔥</span>
              <span style={{ fontSize: '0.74rem' }}>상 (대만족)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectSatisfaction('mid')}
              style={{
                padding: '0.45rem 0.3rem',
                borderRadius: '7px',
                border: dailyLog?.satisfaction === 'mid' ? '1.5px solid #10b981' : '1px solid rgba(255, 255, 255, 0.08)',
                background: dailyLog?.satisfaction === 'mid' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                color: dailyLog?.satisfaction === 'mid' ? '#6ee7b7' : 'var(--text-muted)',
                fontWeight: dailyLog?.satisfaction === 'mid' ? 'bold' : 'normal',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.15rem',
                boxShadow: dailyLog?.satisfaction === 'mid' ? '0 0 10px rgba(16, 185, 129, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '1rem' }}>🌿</span>
              <span style={{ fontSize: '0.74rem' }}>중 (적당함)</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectSatisfaction('low')}
              style={{
                padding: '0.45rem 0.3rem',
                borderRadius: '7px',
                border: dailyLog?.satisfaction === 'low' ? '1.5px solid #64748b' : '1px solid rgba(255, 255, 255, 0.08)',
                background: dailyLog?.satisfaction === 'low' ? 'rgba(100, 116, 139, 0.3)' : 'rgba(255, 255, 255, 0.04)',
                color: dailyLog?.satisfaction === 'low' ? '#cbd5e1' : 'var(--text-muted)',
                fontWeight: dailyLog?.satisfaction === 'low' ? 'bold' : 'normal',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.15rem',
                boxShadow: dailyLog?.satisfaction === 'low' ? '0 0 8px rgba(100, 116, 139, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '1rem' }}>🌱</span>
              <span style={{ fontSize: '0.74rem' }}>하 (아쉬움)</span>
            </button>
          </div>
        </div>

        {/* 오늘의 한줄평 · 짧은 일기 */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          padding: '0.55rem 0.75rem',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: '105px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.76rem', color: '#e2e8f0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Edit3 size={13} color="#c084fc" /> {selectedDate === todayStr ? '오늘의 한줄평 · 짧은 일기' : `${selectedDate} 한줄평 · 일기`}
            </span>
            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
              {(diaryText || '').length}자
            </span>
          </div>

          <textarea
            ref={diaryInputRef}
            value={diaryText}
            onChange={(e) => handleDiaryChange(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleManualSaveDiary();
              }
            }}
            placeholder={getDiaryPlaceholder(dailyLog?.satisfaction)}
            style={{
              width: '100%',
              flex: 1,
              minHeight: '65px',
              resize: 'none',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '0.78rem',
              lineHeight: '1.45',
              padding: '0.45rem 0.55rem',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'all 0.15s ease'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#c084fc';
              e.target.style.boxShadow = '0 0 8px rgba(192, 132, 252, 0.25)';
            }}
            onBlurCapture={(e) => {
              e.target.style.borderColor = 'rgba(139, 92, 246, 0.25)';
              e.target.style.boxShadow = 'none';
            }}
          />

          {/* 저장 버튼 및 피드백 알림 행 (수동 저장 시에만 '저장 완료' 표시) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
            <div>
              {diarySavedStatus ? (
                <span style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Check size={12} /> 저장 완료
                </span>
              ) : (
                <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)' }}>
                  Ctrl+Enter로도 저장 가능
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleManualSaveDiary}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                border: '1px solid rgba(192, 132, 252, 0.4)',
                borderRadius: '5px',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 'bold',
                padding: '0.25rem 0.65rem',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(124, 58, 237, 0.35)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
            >
              <Save size={12} /> 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}