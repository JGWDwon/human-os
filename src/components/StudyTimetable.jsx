import React, { useState, useMemo } from 'react';
import { Calendar, ArrowRight, TrendingUp, TrendingDown, Clock, CheckCircle2 } from 'lucide-react';
import { storage } from '../utils/storage';

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

// Build 24x6 active matrix for a given date
const buildActiveMatrixForDate = (dateStr) => {
  const dayData = storage.getPomodoroByDate(dateStr);
  const timestamps = dayData?.timestamps || [];

  // matrix[hour_0_to_23][block_0_to_5]
  const matrix = Array.from({ length: 24 }, () => Array(6).fill(false));

  timestamps.forEach(ts => {
    const { startTime, endTime } = getSessionRange(ts);
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
        const blockEnd = blockStart + 10;

        const hasOverlap = Math.max(startTotal, blockStart) < Math.min(endTotal, blockEnd);
        const hasWrappedOverlap = endTotal > 1440 && Math.max(startTotal - 1440, blockStart) < Math.min(endTotal - 1440, blockEnd);

        if (hasOverlap || hasWrappedOverlap) {
          matrix[h][b] = true;
        }
      }
    }
  });

  return {
    totalMinutes: dayData?.totalMinutes || 0,
    sessionCount: timestamps.length,
    matrix
  };
};

export default function StudyTimetable() {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'tier1' | 'tier2' | 'tier3'

  // Dates computation
  const todayObj = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const d = todayObj;
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  }, [todayObj]);

  const yesterdayStr = useMemo(() => {
    const d = new Date(todayObj);
    d.setDate(d.getDate() - 1);
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  }, [todayObj]);

  const lastWeekSameDayStr = useMemo(() => {
    const d = new Date(todayObj);
    d.setDate(d.getDate() - 7);
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  }, [todayObj]);

  // Current week Mon ~ Sun
  const weekDays = useMemo(() => {
    const now = new Date(todayObj);
    const dayOfWeek = now.getDay() || 7; // 1=Mon, 7=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);

    const days = [];
    const dayNames = ['월', '화', '수', '목', '금', '토', '일'];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const isToday = dateStr === todayStr;

      days.push({
        dateStr,
        dayName: dayNames[i],
        dateShort: `${d.getMonth() + 1}/${d.getDate()}`,
        isToday,
        data: buildActiveMatrixForDate(dateStr)
      });
    }
    return days;
  }, [todayObj, todayStr]);

  // Data for Tier 2 (Yesterday vs Today)
  const yesterdayData = useMemo(() => buildActiveMatrixForDate(yesterdayStr), [yesterdayStr]);
  const todayData = useMemo(() => buildActiveMatrixForDate(todayStr), [todayStr]);

  // Data for Tier 3 (Last Week Same Day vs Today)
  const lastWeekData = useMemo(() => buildActiveMatrixForDate(lastWeekSameDayStr), [lastWeekSameDayStr]);

  // Comparison stats
  const diffYesterday = todayData.totalMinutes - yesterdayData.totalMinutes;
  const diffLastWeek = todayData.totalMinutes - lastWeekData.totalMinutes;

  const todayDayName = ['일', '월', '화', '수', '목', '금', '토'][todayObj.getDay()];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1.5rem' }}>
      
      {/* Tier Switcher Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', background: 'rgba(0,0,0,0.3)', padding: '0.4rem', borderRadius: '10px' }}>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.82rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: activeTab === 'all' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'all' ? '#000' : 'var(--text-secondary)',
            transition: 'all 0.2s'
          }}
        >
          ✨ 전체 타임테이블 보기
        </button>
        <button
          onClick={() => setActiveTab('tier1')}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.82rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: activeTab === 'tier1' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'tier1' ? '#000' : 'var(--text-secondary)',
            transition: 'all 0.2s'
          }}
        >
          1단. 월~일 주간 타임테이블
        </button>
        <button
          onClick={() => setActiveTab('tier2')}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.82rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: activeTab === 'tier2' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'tier2' ? '#000' : 'var(--text-secondary)',
            transition: 'all 0.2s'
          }}
        >
          2단. 어제 vs 오늘 비교
        </button>
        <button
          onClick={() => setActiveTab('tier3')}
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: '8px',
            border: 'none',
            fontSize: '0.82rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            background: activeTab === 'tier3' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'tier3' ? '#000' : 'var(--text-secondary)',
            transition: 'all 0.2s'
          }}
        >
          3단. 저번주 {todayDayName}요일 vs 오늘 비교
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1단: 월~일 타임테이블 (Weekly Study Planner Timetable) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'tier1') && (
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ background: 'var(--accent-primary)', color: '#000', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                1단
              </span>
              <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)', fontWeight: 'bold' }}>
                월~일 주간 타임테이블 (10분 단위 색칠)
              </h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '10px', height: '10px', background: '#34d399', borderRadius: '2px', display: 'inline-block' }}></span> 집중 시간
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '10px', height: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', display: 'inline-block' }}></span> 휴식
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
            이번 주 월요일부터 일요일까지 10분 단위 집중 기록이 스터디 플래너 양식으로 자동 색칠됩니다.
          </p>

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
                {weekDays.map(day => (
                  <div key={day.dateStr} style={{ flex: 1, textAlign: 'center', padding: '0.2rem 0.25rem' }}>
                    <div style={{
                      background: day.isToday ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.03)',
                      border: day.isToday ? '1px solid #10b981' : '1px solid transparent',
                      borderRadius: '6px',
                      padding: '0.25rem'
                    }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: day.isToday ? '#34d399' : 'var(--text-primary)' }}>
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
                ))}
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
                      <div key={day.dateStr} style={{ flex: 1, display: 'flex', gap: '1px', padding: '0 3px', height: '100%' }}>
                        {[0, 1, 2, 3, 4, 5].map(b => {
                          const isActive = day.data.matrix[h]?.[b];
                          return (
                            <div
                              key={b}
                              title={`${day.dayName}요일 ${h}:${b * 10} ~ ${h}:${(b + 1) * 10}`}
                              style={{
                                flex: 1,
                                height: '100%',
                                background: isActive
                                  ? (day.isToday ? '#34d399' : 'rgba(52, 211, 153, 0.75)')
                                  : 'rgba(255,255,255,0.04)',
                                border: isActive
                                  ? '1px solid #10b981'
                                  : '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '1.5px',
                                transition: 'background 0.2s'
                              }}
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
      )}

      {/* ========================================================================= */}
      {/* 2단: 어제와 오늘 비교 타임테이블 (Yesterday vs Today Comparison) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'tier2') && (
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ background: '#3b82f6', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                2단
              </span>
              <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)', fontWeight: 'bold' }}>
                어제 vs 오늘 집중 비교 타임테이블
              </h3>
            </div>

            {/* Comparison Badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: diffYesterday >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${diffYesterday >= 0 ? '#10b981' : '#ef4444'}`,
              color: diffYesterday >= 0 ? '#34d399' : '#f87171',
              padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold'
            }}>
              {diffYesterday >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>
                {diffYesterday >= 0
                  ? `어제 대비 +${formatTimeRange(diffYesterday)} 더 집중!`
                  : `어제 대비 ${formatTimeRange(Math.abs(diffYesterday))} 차이`}
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
            어제와 오늘 어느 시간대에 집중했는지 두 타임테이블을 나란히 비교하여 생활 패턴의 변화를 관찰합니다.
          </p>

          {/* 2-Column Comparison Layout */}
          <div style={{ background: '#0a0f1d', borderRadius: '10px', padding: '1rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            
            {/* Column Headers */}
            <div style={{ display: 'flex', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid rgba(255,255,255,0.12)' }}>
              <div style={{ width: '42px' }}></div>
              
              {/* Yesterday Header */}
              <div style={{ flex: 1, padding: '0.4rem', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.25)', textAlign: 'center', marginRight: '0.5rem' }}>
                <div style={{ fontSize: '0.82rem', color: '#60a5fa', fontWeight: 'bold' }}>어제 ({yesterdayStr})</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff', marginTop: '0.15rem' }}>
                  {formatTimeRange(yesterdayData.totalMinutes)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>총 {yesterdayData.sessionCount}회 집중</div>
              </div>

              {/* Today Header */}
              <div style={{ flex: 1, padding: '0.4rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)', textAlign: 'center', marginLeft: '0.5rem' }}>
                <div style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 'bold' }}>오늘 ({todayStr})</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff', marginTop: '0.15rem' }}>
                  {formatTimeRange(todayData.totalMinutes)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>총 {todayData.sessionCount}회 집중</div>
              </div>
            </div>

            {/* 24 Hours Comparison Track */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {PLANNER_HOURS.map(h => (
                <div key={h} style={{ display: 'flex', alignItems: 'center', height: '18px' }}>
                  {/* Hour Label */}
                  <div style={{ width: '42px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {getHourDisplayLabel(h)}시
                  </div>

                  {/* Yesterday 6 Blocks */}
                  <div style={{ flex: 1, display: 'flex', gap: '2px', height: '100%', marginRight: '0.5rem' }}>
                    {[0, 1, 2, 3, 4, 5].map(b => {
                      const isActive = yesterdayData.matrix[h]?.[b];
                      return (
                        <div
                          key={b}
                          title={`어제 ${h}:${b * 10} ~ ${h}:${(b + 1) * 10}`}
                          style={{
                            flex: 1,
                            height: '100%',
                            background: isActive ? '#3b82f6' : 'rgba(255,255,255,0.04)',
                            border: isActive ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '2px'
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Divider */}
                  <div style={{ width: '2px', height: '100%', background: 'rgba(255,255,255,0.1)' }}></div>

                  {/* Today 6 Blocks */}
                  <div style={{ flex: 1, display: 'flex', gap: '2px', height: '100%', marginLeft: '0.5rem' }}>
                    {[0, 1, 2, 3, 4, 5].map(b => {
                      const isActive = todayData.matrix[h]?.[b];
                      return (
                        <div
                          key={b}
                          title={`오늘 ${h}:${b * 10} ~ ${h}:${(b + 1) * 10}`}
                          style={{
                            flex: 1,
                            height: '100%',
                            background: isActive ? '#10b981' : 'rgba(255,255,255,0.04)',
                            border: isActive ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '2px'
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3단: 저번주 요일과 오늘 요일 비교 타임테이블 (Last Week vs Today Same Day) */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'tier3') && (
        <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ background: '#8b5cf6', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                3단
              </span>
              <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)', fontWeight: 'bold' }}>
                저번주 {todayDayName}요일 vs 오늘 {todayDayName}요일 비교 타임테이블
              </h3>
            </div>

            {/* Comparison Badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              background: diffLastWeek >= 0 ? 'rgba(139, 92, 246, 0.18)' : 'rgba(239, 68, 68, 0.15)',
              border: `1px solid ${diffLastWeek >= 0 ? '#8b5cf6' : '#ef4444'}`,
              color: diffLastWeek >= 0 ? '#c084fc' : '#f87171',
              padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold'
            }}>
              {diffLastWeek >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>
                {diffLastWeek >= 0
                  ? `저번주 대비 +${formatTimeRange(diffLastWeek)} 성장!`
                  : `저번주 대비 ${formatTimeRange(Math.abs(diffLastWeek))} 차이`}
              </span>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem 0' }}>
            저번 주 같은 요일({todayDayName}요일)과 오늘의 집중 타임테이블을 비교하여 요일별 공부 습관의 개선도를 확인합니다.
          </p>

          {/* 2-Column Comparison Layout */}
          <div style={{ background: '#0a0f1d', borderRadius: '10px', padding: '1rem', border: '1px solid rgba(255,255,255,0.08)' }}>
            
            {/* Column Headers */}
            <div style={{ display: 'flex', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid rgba(255,255,255,0.12)' }}>
              <div style={{ width: '42px' }}></div>
              
              {/* Last Week Header */}
              <div style={{ flex: 1, padding: '0.4rem', background: 'rgba(139, 92, 246, 0.08)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.25)', textAlign: 'center', marginRight: '0.5rem' }}>
                <div style={{ fontSize: '0.82rem', color: '#c084fc', fontWeight: 'bold' }}>저번주 {todayDayName}요일 ({lastWeekSameDayStr})</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff', marginTop: '0.15rem' }}>
                  {formatTimeRange(lastWeekData.totalMinutes)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>총 {lastWeekData.sessionCount}회 집중</div>
              </div>

              {/* Today Header */}
              <div style={{ flex: 1, padding: '0.4rem', background: 'rgba(16, 185, 129, 0.08)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)', textAlign: 'center', marginLeft: '0.5rem' }}>
                <div style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 'bold' }}>이번주 {todayDayName}요일 ({todayStr})</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#fff', marginTop: '0.15rem' }}>
                  {formatTimeRange(todayData.totalMinutes)}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>총 {todayData.sessionCount}회 집중</div>
              </div>
            </div>

            {/* 24 Hours Comparison Track */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {PLANNER_HOURS.map(h => (
                <div key={h} style={{ display: 'flex', alignItems: 'center', height: '18px' }}>
                  {/* Hour Label */}
                  <div style={{ width: '42px', textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 'bold' }}>
                    {getHourDisplayLabel(h)}시
                  </div>

                  {/* Last Week 6 Blocks */}
                  <div style={{ flex: 1, display: 'flex', gap: '2px', height: '100%', marginRight: '0.5rem' }}>
                    {[0, 1, 2, 3, 4, 5].map(b => {
                      const isActive = lastWeekData.matrix[h]?.[b];
                      return (
                        <div
                          key={b}
                          title={`저번주 ${h}:${b * 10} ~ ${h}:${(b + 1) * 10}`}
                          style={{
                            flex: 1,
                            height: '100%',
                            background: isActive ? '#8b5cf6' : 'rgba(255,255,255,0.04)',
                            border: isActive ? '1px solid #c084fc' : '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '2px'
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Divider */}
                  <div style={{ width: '2px', height: '100%', background: 'rgba(255,255,255,0.1)' }}></div>

                  {/* Today 6 Blocks */}
                  <div style={{ flex: 1, display: 'flex', gap: '2px', height: '100%', marginLeft: '0.5rem' }}>
                    {[0, 1, 2, 3, 4, 5].map(b => {
                      const isActive = todayData.matrix[h]?.[b];
                      return (
                        <div
                          key={b}
                          title={`오늘 ${h}:${b * 10} ~ ${h}:${(b + 1) * 10}`}
                          style={{
                            flex: 1,
                            height: '100%',
                            background: isActive ? '#10b981' : 'rgba(255,255,255,0.04)',
                            border: isActive ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '2px'
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
