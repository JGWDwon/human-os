import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { storage, getSubjectColor } from '../utils/storage';

// 24 Hours starting at 06:00 to 05:00 next morning (matching traditional Korean 10-minute study planner)
const PLANNER_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5];

const getHourDisplayLabel = (h) => {
  if (h === 0 || h === 12) return '12';
  if (h > 12) return String(h - 12);
  return String(h);
};

const formatTimeRange = (minutes) => {
  if (!minutes || minutes <= 0) return '0분';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}시간 ${m > 0 ? m + '분' : ''}`;
  return `${m}분`;
};

// Extract or compute session time range
const getSessionRange = (ts) => {
  const timeLabel = typeof ts === 'string' ? ts : (ts.time || '');
  const minutesVal = typeof ts === 'object' && ts.minutes ? ts.minutes : 25;
  const timeOnly = timeLabel.includes('T') ? timeLabel.split('T')[1].substring(0, 5) : timeLabel.substring(0, 5);

  if (typeof ts === 'object' && ts.startTime && ts.endTime) {
    return {
      startTime: ts.startTime,
      endTime: ts.endTime,
      minutes: minutesVal
    };
  }

  // Fallback: calculate startTime from endTime - minutesVal
  const [endH, endM] = timeOnly.split(':').map(Number);
  const endTotalMins = (isNaN(endH) ? 0 : endH) * 60 + (isNaN(endM) ? 0 : endM);
  const startTotalMins = (endTotalMins - minutesVal + 1440) % 1440;
  const startH = Math.floor(startTotalMins / 60);
  const startM = startTotalMins % 60;
  const startStr = `${startH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;

  return {
    startTime: startStr,
    endTime: timeOnly,
    minutes: minutesVal
  };
};

// Build 24x6 active matrix for a given date with 5-minute half-block resolution and subject colors
const buildActiveMatrixForDate = (dateStr, subjectsList = null) => {
  const dayData = storage.getPomodoroByDate(dateStr);
  const timestamps = dayData?.timestamps || [];

  // matrix[hour_0_to_23][block_0_to_5] = { left, right, leftColor, rightColor, leftSubject, rightSubject }
  const matrix = Array.from({ length: 24 }, () =>
    Array.from({ length: 6 }, () => ({
      left: false,
      right: false,
      leftColor: null,
      rightColor: null,
      leftSubject: null,
      rightSubject: null
    }))
  );

  timestamps.forEach(ts => {
    const { startTime, endTime } = getSessionRange(ts);
    const subject = typeof ts === 'object' && ts.subject ? ts.subject : null;
    const color = getSubjectColor(subject, subjectsList);

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    if (isNaN(startH) || isNaN(endH)) return;

    const startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;
    if (endTotal < startTotal) {
      endTotal += 1440; // crosses midnight
    }

    for (let h = 0; h < 24; h++) {
      for (let b = 0; b < 6; b++) {
        const blockStart = h * 60 + b * 10;

        // Left half (:00 ~ :05 of this 10-minute block)
        const leftStart = blockStart;
        const leftEnd = blockStart + 5;
        const leftOverlap = Math.max(0, Math.min(endTotal, leftEnd) - Math.max(startTotal, leftStart));
        const leftWrapped = endTotal > 1440
          ? Math.max(0, Math.min(endTotal - 1440, leftEnd) - Math.max(startTotal - 1440, leftStart))
          : 0;

        if (leftOverlap >= 2.5 || leftWrapped >= 2.5) {
          matrix[h][b].left = true;
          matrix[h][b].leftColor = color;
          matrix[h][b].leftSubject = subject;
        }

        // Right half (:05 ~ :10 of this 10-minute block)
        const rightStart = blockStart + 5;
        const rightEnd = blockStart + 10;
        const rightOverlap = Math.max(0, Math.min(endTotal, rightEnd) - Math.max(startTotal, rightStart));
        const rightWrapped = endTotal > 1440
          ? Math.max(0, Math.min(endTotal - 1440, rightEnd) - Math.max(startTotal - 1440, rightStart))
          : 0;

        if (rightOverlap >= 2.5 || rightWrapped >= 2.5) {
          matrix[h][b].right = true;
          matrix[h][b].rightColor = color;
          matrix[h][b].rightSubject = subject;
        }
      }
    }
  });

  // Map meal sessions onto timetable in distinct warm orange
  const meals = storage.getMealsByDate(dateStr) || [];
  let totalMealMinutes = 0;
  meals.forEach(m => {
    const startTime = m.startTime || '12:00';
    const endTime = m.endTime || '12:30';
    const subject = '식사';
    const color = '#fb923c'; // Warm Orange for meals
    totalMealMinutes += (m.minutes || 0);

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    if (isNaN(startH) || isNaN(endH)) return;

    const startTotal = startH * 60 + startM;
    let endTotal = endH * 60 + endM;
    if (endTotal < startTotal) {
      endTotal += 1440;
    }

    for (let h = 0; h < 24; h++) {
      for (let b = 0; b < 6; b++) {
        const blockStart = h * 60 + b * 10;

        const leftStart = blockStart;
        const leftEnd = blockStart + 5;
        const leftOverlap = Math.max(0, Math.min(endTotal, leftEnd) - Math.max(startTotal, leftStart));
        const leftWrapped = endTotal > 1440
          ? Math.max(0, Math.min(endTotal - 1440, leftEnd) - Math.max(startTotal - 1440, leftStart))
          : 0;

        if (leftOverlap >= 2.5 || leftWrapped >= 2.5) {
          matrix[h][b].left = true;
          matrix[h][b].leftColor = color;
          matrix[h][b].leftSubject = subject;
        }

        const rightStart = blockStart + 5;
        const rightEnd = blockStart + 10;
        const rightOverlap = Math.max(0, Math.min(endTotal, rightEnd) - Math.max(startTotal, rightStart));
        const rightWrapped = endTotal > 1440
          ? Math.max(0, Math.min(endTotal - 1440, rightEnd) - Math.max(startTotal - 1440, rightStart))
          : 0;

        if (rightOverlap >= 2.5 || rightWrapped >= 2.5) {
          matrix[h][b].right = true;
          matrix[h][b].rightColor = color;
          matrix[h][b].rightSubject = subject;
        }
      }
    }
  });

  return {
    totalMinutes: dayData?.totalMinutes || 0,
    totalMealMinutes,
    sessionCount: timestamps.length,
    matrix
  };
};

// Generate informative tooltip for each block with subject info
const getBlockTooltip = (prefix, h, b, cell) => {
  const startMin = b * 10;
  const endMin = (b + 1) * 10;
  const startStr = `${h}:${startMin.toString().padStart(2, '0')}`;
  const endStr = `${h}:${endMin.toString().padStart(2, '0')}`;
  const sub = cell.leftSubject || cell.rightSubject;

  if (sub === '식사') {
    return `${prefix} [🍱 식사] ${startStr} ~ ${endStr}`;
  }

  const subTag = sub ? `[${sub}] ` : '';

  if (cell.left && cell.right) {
    return `${prefix} ${subTag}${startStr} ~ ${endStr} (10분 집중)`;
  }
  if (cell.left && !cell.right) {
    const halfEnd = `${h}:${(startMin + 5).toString().padStart(2, '0')}`;
    return `${prefix} ${subTag}${startStr} ~ ${halfEnd} (반 칸 / 5분 집중)`;
  }
  if (!cell.left && cell.right) {
    const halfStart = `${h}:${(startMin + 5).toString().padStart(2, '0')}`;
    return `${prefix} ${subTag}${halfStart} ~ ${endStr} (반 칸 / 5분 집중)`;
  }
  return `${prefix} ${startStr} ~ ${endStr} (휴식)`;
};

// Subcomponent for rendering a 10-minute block with 5-minute half-block capability and subject colors
function TimetableBlock({ cell, fallbackColor, inactiveBg = 'rgba(255,255,255,0.04)', tooltip = '' }) {
  const left = !!cell?.left;
  const right = !!cell?.right;
  const isFull = left && right;
  const hasActive = left || right;

  const leftColor = cell?.leftColor || fallbackColor;
  const rightColor = cell?.rightColor || fallbackColor;
  const borderColor = isFull
    ? (leftColor === rightColor ? leftColor : 'rgba(255,255,255,0.45)')
    : (hasActive ? (left ? leftColor : rightColor) : 'rgba(255,255,255,0.05)');

  return (
    <div
      title={tooltip}
      style={{
        flex: 1,
        height: '100%',
        display: 'flex',
        background: inactiveBg,
        border: hasActive
          ? `1px solid ${borderColor}`
          : '1px solid rgba(255,255,255,0.05)',
        borderRadius: '2px',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Left 5-min half */}
      <div
        style={{
          width: '50%',
          height: '100%',
          background: left ? leftColor : 'transparent',
          borderRight: isFull ? '1px solid rgba(0,0,0,0.15)' : '1px dashed rgba(255,255,255,0.12)',
          transition: 'background 0.15s'
        }}
      />
      {/* Right 5-min half */}
      <div
        style={{
          width: '50%',
          height: '100%',
          background: right ? rightColor : 'transparent',
          transition: 'background 0.15s'
        }}
      />
    </div>
  );
}

export default function StudyTimetable({ 
  weekOffset: externalOffset, 
  setWeekOffset: externalSetOffset,
  hideNav = false 
}) {
  const [internalOffset, setInternalOffset] = useState(0);
  const weekOffset = externalOffset !== undefined ? externalOffset : internalOffset;
  const setWeekOffset = externalSetOffset !== undefined ? externalSetOffset : setInternalOffset;

  const [registeredSubjects, setRegisteredSubjects] = useState(() => storage.getSubjects());
  const [mealTick, setMealTick] = useState(0);

  useEffect(() => {
    const handleSubs = () => setRegisteredSubjects(storage.getSubjects());
    const handleMeals = () => setMealTick(prev => prev + 1);
    window.addEventListener('subjects-updated', handleSubs);
    window.addEventListener('meals-updated', handleMeals);
    return () => {
      window.removeEventListener('subjects-updated', handleSubs);
      window.removeEventListener('meals-updated', handleMeals);
    };
  }, []);

  // Dates computation
  const todayObj = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const d = todayObj;
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  }, [todayObj]);

  // Selected week Sun ~ Sat based on weekOffset (달력 주기: 일요일 ~ 토요일)
  const { weekDays, weekRangeLabel } = useMemo(() => {
    const now = new Date(todayObj);
    now.setDate(now.getDate() + weekOffset * 7);

    // 0 is Sun, 1 is Mon ... 6 is Sat
    const dayOfWeek = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dayOfWeek);

    const days = [];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const isToday = dateStr === todayStr;

      days.push({
        dateStr,
        dayName: dayNames[i],
        dateShort: `${d.getMonth() + 1}/${d.getDate()}`,
        isToday,
        data: buildActiveMatrixForDate(dateStr, registeredSubjects)
      });
    }

    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    const rangeLabel = `${sunday.getFullYear()}년 ${sunday.getMonth() + 1}월 ${sunday.getDate()}일 ~ ${saturday.getMonth() + 1}월 ${saturday.getDate()}일`;

    return { weekDays: days, weekRangeLabel: rangeLabel };
  }, [todayObj, todayStr, weekOffset, registeredSubjects, mealTick]);

  const totalWeeklyMinutes = useMemo(() => {
    return weekDays.reduce((sum, d) => sum + (d.data?.totalMinutes || 0), 0);
  }, [weekDays]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: hideNav ? '0' : '1rem' }}>
      
      {/* 주간 네비게이션 & 요약 바 */}
      {!hideNav && (
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
          {/* Week navigation buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
              title="지난주 보기"
            >
              <ChevronLeft size={16} /> 이전 주
            </button>
            
            <span style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#fff', minWidth: '200px', textAlign: 'center' }}>
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

          {/* Weekly Total Time Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.35rem 0.85rem', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>주간 총 공부 시간</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#34d399' }}>
              {formatTimeRange(totalWeeklyMinutes)}
            </span>
          </div>
        </div>
      )}

      {/* Main Weekly Timetable Container */}
      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)', fontWeight: 'bold' }}>
              일~토 주간 타임테이블 (10분 그리드 · 5분 반칸 지원)
            </h3>
          </div>
            {/* Legend showing Full, Half (25m/50m), and Break */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '12px', height: '11px', background: '#34d399', borderRadius: '2px', display: 'inline-block' }}></span>
                10분 (풀칸)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{
                  width: '12px',
                  height: '11px',
                  background: 'linear-gradient(to right, #34d399 50%, rgba(255,255,255,0.06) 50%)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '2px',
                  display: 'inline-block'
                }}></span>
                5분 (반칸)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '12px', height: '11px', background: '#fb923c', borderRadius: '2px', display: 'inline-block' }}></span>
                🍱 식사 (오렌지)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: '12px', height: '11px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', display: 'inline-block' }}></span>
                휴식 (빈칸)
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.65rem 0' }}>
            이번 주 일요일부터 토요일까지 10분 그리드 및 5분 반칸으로 과목별 색상에 맞춰 자동 색칠됩니다.
          </p>

          {/* Subject Color Legend */}
          {registeredSubjects && registeredSubjects.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '0.75rem', background: 'rgba(255,255,255,0.03)', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>과목별 색상:</span>
              {registeredSubjects.map(s => {
                const color = getSubjectColor(s, registeredSubjects);
                return (
                  <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: '#e2e8f0', background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, display: 'inline-block' }} />
                    {s}
                  </span>
                );
              })}
            </div>
          )}

          {/* Timetable Grid Container */}
          <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'inline-flex', flexDirection: 'column', minWidth: '650px', width: '100%', background: '#0a0f1d', borderRadius: '10px', padding: '0.75rem', border: '1px solid rgba(255,255,255,0.08)' }}>
              
              {/* Header Row: Days of Week */}
              <div style={{ display: 'flex', borderBottom: '2px solid rgba(255,255,255,0.12)', paddingBottom: '0.5rem', marginBottom: '0.35rem' }}>
                {/* Time Label Column Header */}
                <div style={{ width: '38px', textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'bold', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '0.2rem' }}>
                  시간
                </div>

                {/* 7 Days Columns */}
                {weekDays.map(day => {
                  const isSun = day.dayName === '일';
                  const isSat = day.dayName === '토';
                  const dayColor = day.isToday 
                    ? '#34d399' 
                    : isSun 
                      ? '#f87171' 
                      : isSat 
                        ? '#60a5fa' 
                        : 'var(--text-primary)';

                  return (
                    <div key={day.dateStr} style={{ flex: 1, textAlign: 'center', padding: '0.2rem 0.25rem' }}>
                      <div style={{
                        background: day.isToday ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                        border: day.isToday ? '1px solid #10b981' : '1px solid transparent',
                        borderRadius: '6px',
                        padding: '0.25rem'
                      }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: dayColor }}>
                          {day.dayName}요일 {day.isToday && <span style={{ fontSize: '0.65rem', color: '#10b981' }}>(오늘)</span>}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          {day.dateShort}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: day.data.totalMinutes > 0 ? '#34d399' : 'rgba(255,255,255,0.25)', marginTop: '0.15rem' }}>
                          {formatTimeRange(day.data.totalMinutes)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Rows: 24 Hours (6am to 5am next day) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {PLANNER_HOURS.map((h) => (
                  <div key={h} style={{ display: 'flex', alignItems: 'center', height: '17px' }}>
                    {/* Hour Number (e.g. 6, 7, ... 12, 1, 2) */}
                    <div style={{ width: '38px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {getHourDisplayLabel(h)}
                    </div>

                    {/* 7 Days 6-block tracks */}
                    {weekDays.map(day => (
                      <div key={day.dateStr} style={{ flex: 1, display: 'flex', gap: '2px', padding: '0 3px', height: '100%' }}>
                        {[0, 1, 2, 3, 4, 5].map(b => {
                          const cell = day.data.matrix[h]?.[b] || { left: false, right: false };
                          const fallbackColor = day.isToday ? '#34d399' : 'rgba(52, 211, 153, 0.75)';
                          const tooltip = getBlockTooltip(`${day.dayName}요일`, h, b, cell);
                          return (
                            <TimetableBlock
                              key={b}
                              cell={cell}
                              fallbackColor={fallbackColor}
                              tooltip={tooltip}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>



    </div>
  );
}
