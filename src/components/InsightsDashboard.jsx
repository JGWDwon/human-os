import { useState, useEffect, useRef } from 'react';
import { BarChart2, Download, Upload, Trophy, CheckCircle, Timer, BookOpen, AlertCircle, Clock, AlertTriangle, Calendar, Moon, Sun, Sunrise, Zap } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { storage } from '../utils/storage';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export default function InsightsDashboard({ onClose }) {
  const [stats, setStats] = useState(null);
  const [historyTimeline, setHistoryTimeline] = useState([]);
  
  const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const [selectedTimelineDate, setSelectedTimelineDate] = useState(todayStr);
  const [dailyTimeline, setDailyTimeline] = useState([]);
  const [wasteAnalysis, setWasteAnalysis] = useState(null);
  const [hoveredSlot, setHoveredSlot] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    setStats(storage.getAllTimeStats());
    setDailyTimeline(storage.getDailySessionTimeline(selectedTimelineDate));
    setWasteAnalysis(storage.getTimeWasteAnalysis(7));

    const recentQuests = storage.getQuestHistory(30).reverse();
    const activeTimeline = recentQuests.filter(day => day.status !== 'none');
    setHistoryTimeline(activeTimeline);
  }, [selectedTimelineDate]);

  const handleExport = async () => {
    const data = storage.getAllData();
    const jsonStr = JSON.stringify(data, null, 2);
    const filename = `human-os-backup-${new Date().toISOString().split('T')[0]}.json`;

    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: filename,
          data: jsonStr,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        const { uri } = await Filesystem.getUri({
          path: filename,
          directory: Directory.Cache
        });
        await Share.share({
          title: 'Human OS 백업 파일',
          text: '내 Human OS 데이터 백업 파일입니다.',
          url: uri,
          dialogTitle: '백업 파일 저장 위치 선택'
        });
      } catch (e) {
        alert('저장 실패: ' + e.message);
      }
    } else {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (json.version) {
          storage.importData(json);
          alert('데이터 복구가 완료되었습니다! 앱을 재시작합니다.');
          window.location.reload();
        } else {
          alert('유효하지 않은 백업 파일입니다.');
        }
      } catch (err) {
        alert('파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  };

  const formatTime = (minutes) => {
    if (!minutes || minutes <= 0) return '0분';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}시간 ${m > 0 ? m + '분' : ''}`;
    return `${m}분`;
  };

  if (!stats || !wasteAnalysis) return null;

  // Active waking hours: 05:00~23:00 (18 hours = 1080 mins)
  const selectedFocusMins = dailyTimeline.reduce((sum, slot) => sum + slot.focusMins, 0);
  const selectedPauseMins = dailyTimeline.reduce((sum, slot) => sum + slot.pauseMins, 0);
  const selectedWasteMins = Math.max(0, 1080 - selectedFocusMins - selectedPauseMins);

  // Group 144 slots into 3 time categories for optimal wide visibility:
  // Row 1: Dawn/Morning (00:00 ~ 08:00, slots 0~47)
  // Row 2: Daytime/Afternoon (08:00 ~ 16:00, slots 48~95)
  // Row 3: Evening/Night (16:00 ~ 24:00, slots 96~143)
  const morningSlots = dailyTimeline.slice(0, 48);
  const afternoonSlots = dailyTimeline.slice(48, 96);
  const eveningSlots = dailyTimeline.slice(96, 144);

  const renderTimelineRow = (title, icon, timeRange, slots, labels) => (
    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {icon} {title} <span style={{ color: 'var(--text-muted)', fontWeight: 'normal', fontSize: '0.75rem' }}>({timeRange})</span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>48개 슬롯 (10분 단위)</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(48, 1fr)', gap: '2px', height: '36px', background: 'rgba(0,0,0,0.5)', padding: '3px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
        {slots.map((slot) => {
          const hasFocus = slot.focusMins > 0;
          const hasPause = slot.pauseMins > 0;
          
          let bgColor = 'rgba(255,255,255,0.04)';
          if (hasFocus && hasPause) bgColor = 'linear-gradient(135deg, #10b981 60%, #f59e0b 40%)';
          else if (hasFocus) bgColor = '#10b981';
          else if (hasPause) bgColor = '#f59e0b';
          else if (slot.isSleepTime) bgColor = 'rgba(139, 92, 246, 0.25)';

          const isHovered = hoveredSlot && hoveredSlot.idx === slot.idx;

          return (
            <div 
              key={slot.idx}
              onMouseEnter={() => setHoveredSlot(slot)}
              onMouseLeave={() => setHoveredSlot(null)}
              style={{
                background: bgColor,
                borderRadius: '2px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                transform: isHovered ? 'scaleY(1.25)' : 'scaleY(1)',
                boxShadow: isHovered ? '0 0 8px rgba(255,255,255,0.8)' : 'none',
                zIndex: isHovered ? 10 : 1
              }}
            />
          );
        })}
      </div>

      {/* Axis Labels */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${labels.length}, 1fr)`, marginTop: '0.3rem', fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        {labels.map((lbl, idx) => <span key={idx}>{lbl}</span>)}
      </div>
    </div>
  );

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '80vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>
            <BarChart2 size={24} color="var(--accent-secondary)" />
            공부 시간 & 시간 낭비 정밀 분석 (10분 단위 3구간 시각화)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            23시~05시는 취침 시간(💤)으로 지정되며, 3개 시간대(새벽/낮/저녁)별로 10분 단위 타임블록을 널찍하게 관찰합니다.
          </p>
        </div>
        <button onClick={onClose} className="btn btn-secondary">돌아가기</button>
      </div>

      {/* Top 4 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Trophy size={16} color="#10b981" /> 총 출석 일수
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{stats.activeDays}일</div>
        </div>

        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle size={16} color="#3b82f6" /> 누적 퀘스트 완료
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-secondary)' }}>{stats.totalCompletedQuests}회</div>
        </div>

        <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Timer size={16} color="#10b981" /> 최근 7일 공부 시간
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>{formatTime(wasteAnalysis.totalFocusMins)}</div>
        </div>

        <div style={{ background: 'rgba(239, 68, 68, 0.12)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={16} color="#ef4444" /> 하루 평균 활동 낭비 시간
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ef4444' }}>{formatTime(wasteAnalysis.avgDailyWasteMins)}</div>
        </div>
      </div>

      {/* SECTION 1: 3-Category Timeline Rows (Dawn/Morning, Daytime, Evening/Night) */}
      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} color="#10b981" /> 3구간 분할 10분 타임라인 바 (공부 vs 일시정지 vs 취침 vs 공백)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              오전/낮/저녁 3개 구간으로 나누어 10분 단위 블록을 널찍하게 배치했습니다. (23시~05시 취침시간 💤)
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={16} color="var(--text-muted)" />
            <input 
              type="date" 
              value={selectedTimelineDate}
              onChange={(e) => setSelectedTimelineDate(e.target.value)}
              style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', padding: '0.35rem 0.6rem', borderRadius: '4px', fontSize: '0.85rem' }}
            />
          </div>
        </div>

        {/* Selected Date Summary Header */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: '0.85rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px', display: 'inline-block' }}></span>
            <span style={{ color: 'var(--text-muted)' }}>공부:</span>
            <strong style={{ color: '#10b981' }}>{formatTime(selectedFocusMins)}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '2px', display: 'inline-block' }}></span>
            <span style={{ color: 'var(--text-muted)' }}>일시정지:</span>
            <strong style={{ color: '#f59e0b' }}>{formatTime(selectedPauseMins)}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '10px', height: '10px', background: 'rgba(139, 92, 246, 0.4)', borderRadius: '2px', display: 'inline-block' }}></span>
            <span style={{ color: 'var(--text-muted)' }}>취침 시간 (23~05시):</span>
            <strong style={{ color: '#c4b5fd' }}>6시간 00분 💤</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '10px', height: '10px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', display: 'inline-block' }}></span>
            <span style={{ color: 'var(--text-muted)' }}>활동 공백(낭비 시간):</span>
            <strong style={{ color: '#ef4444' }}>{formatTime(selectedWasteMins)}</strong>
          </div>
        </div>

        {/* 3 Split Category Rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {renderTimelineRow('새벽 & 오전 구간', <Sunrise size={16} color="#a78bfa" />, '00:00 ~ 08:00', morningSlots, ['00:00 💤', '02:00 💤', '04:00 💤', '06:00 🌅', '08:00 ☀️'])}
          {renderTimelineRow('낮 & 오후 구간', <Sun size={16} color="#f59e0b" />, '08:00 ~ 16:00', afternoonSlots, ['08:00 ☀️', '10:00 📚', '12:00 🍽️', '14:00 ☕', '16:00 🌆'])}
          {renderTimelineRow('저녁 & 밤 구간', <Moon size={16} color="#3b82f6" />, '16:00 ~ 24:00', eveningSlots, ['16:00 🌆', '18:00 🍲', '20:00 🌃', '22:00 🌙', '24:00 💤'])}
        </div>

        {/* Hover / Slot Detail Card */}
        {hoveredSlot ? (
          <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(139, 92, 246, 0.4)', padding: '0.6rem 1rem', borderRadius: '6px', fontSize: '0.85rem', color: '#fff', display: 'flex', gap: '1.5rem', alignItems: 'center', marginTop: '0.85rem', flexWrap: 'wrap' }}>
            <div>
              <strong style={{ color: '#a78bfa' }}>⏱️ {hoveredSlot.fullRangeLabel} 시간대 (10분 슬롯)</strong>
              {hoveredSlot.isSleepTime && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#c4b5fd', background: 'rgba(139, 92, 246, 0.2)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>💤 취침 시간대</span>}
            </div>
            <div style={{ color: '#10b981' }}>공부: <strong>{hoveredSlot.focusMins}분</strong></div>
            <div style={{ color: '#f59e0b' }}>일시정지: <strong>{hoveredSlot.pauseMins}분</strong></div>
            <div style={{ color: 'var(--text-muted)' }}>공백/휴식: <strong>{hoveredSlot.idleMins}분</strong></div>
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.75rem' }}>
            💡 블록에 마우스를 올리거나 터치하면 10분 단위 상세 내역을 볼 수 있습니다. (보라색 블록 = 취침시간 23:00~05:00)
          </div>
        )}
      </div>

      {/* SECTION 2: Top Active Time Waste Analysis (1-Hour Intervals) & Coaching */}
      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.4rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={18} color="#ef4444" /> 활동 시간(05시~23시) 중 주요 낭비 구간 분석 (1시간 단위, 최근 7일)
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
          취침 시간(23시~05시)을 제외한 낮 활동 시간대 중 공부나 타이머 동작 없이 지속적으로 비어있었던 Top 3 (1시간) 구간입니다.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          {wasteAnalysis.topIdleSlots.map((slot, rankIdx) => {
            const medal = ['🥇 1위 낭비 구간', '🥈 2위 낭비 구간', '🥉 3위 낭비 구간'][rankIdx];
            return (
              <div key={slot.hour} style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px', padding: '1rem',
                display: 'flex', flexDirection: 'column', gap: '0.4rem'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 'bold' }}>{medal}</div>
                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{slot.label}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  평균 공백: <strong style={{ color: '#ef4444' }}>{slot.avgIdleMins}분/시간</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.2rem' }}>
                  해당 1시간 평균 공부량: {formatTime(Math.round(slot.totalFocusMins / 7))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Coaching Guide Box */}
        <div style={{ background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '0.85rem 1.25rem', borderRadius: '8px', fontSize: '0.85rem', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Zap size={20} color="#a78bfa" style={{ flexShrink: 0 }} />
          <div>
            <strong>시간 낭비 개선 팁:</strong> 가장 공백이 큰 <strong>{wasteAnalysis.topIdleSlots[0]?.label}</strong> 구간에 뽀모도로 타이머 25분 1세트만 먼저 켜는 습관을 들여보세요!
          </div>
        </div>
      </div>

      {/* SECTION 3: Daily Time Waste Trend (Recharts) */}
      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', border: '1px solid rgba(255,255,255,0.08)' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart2 size={18} color="#3b82f6" /> 일자별 공부 vs 일시정지 vs 활동 낭비 시간 추이 (최근 7일)
        </h3>
        
        <div style={{ height: '260px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={wasteAnalysis.dailyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `${Math.floor(val / 60)}h`} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', borderColor: 'rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff' }}
                formatter={(val, name) => {
                  const labels = { focusMins: '공부 시간', pauseMins: '일시정지 시간', wasteMins: '활동 낭비 시간' };
                  return [formatTime(val), labels[name] || name];
                }}
              />
              <Legend formatter={(val) => {
                const labels = { focusMins: '공부 시간 (🟩)', pauseMins: '일시정지 (🟧)', wasteMins: '활동 낭비 (🟥)' };
                return labels[val] || val;
              }} />
              <Bar dataKey="focusMins" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar dataKey="pauseMins" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Line type="monotone" dataKey="wasteMins" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECTION 4: Timeline & Backup Management */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 300px', background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: 'var(--radius-sm)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={16} /> 활동 수행 타임라인 (최근 30일)
          </h3>
          <div style={{ overflowY: 'auto', maxHeight: '220px', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {historyTimeline.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>아직 활동 기록이 없습니다. 꾸준히 기록을 쌓아보세요!</p>
            ) : (
              historyTimeline.map((day, idx) => (
                <div key={idx} style={{ position: 'relative', paddingLeft: '1.25rem', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ 
                    position: 'absolute', left: '-5px', top: '2px', width: '8px', height: '8px', borderRadius: '50%',
                    background: day.status === 'completed' ? 'var(--accent-primary)' : day.status === 'partial' ? 'rgba(16, 185, 129, 0.5)' : day.status === 'hibernation' ? 'var(--accent-hibernation)' : 'var(--text-muted)'
                  }} />
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>
                    {day.date}
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.4rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', display: 'inline-block' }}>
                    {day.status === 'completed' && <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>🎯 메인 퀘스트 완수</span>}
                    {day.status === 'partial' && <span style={{ color: '#34d399' }}>✨ 일일 퀘스트 수행</span>}
                    {day.status === 'hibernation' && <span style={{ color: 'var(--accent-hibernation)' }}>🌴 휴가/연기 모드</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ flex: '1 1 240px', background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} /> 안전한 데이터 백업
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
              기록을 파일로 저장해두면 기기를 바꿔도 손쉽게 복구할 수 있습니다.
            </p>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              onClick={handleExport}
              className="btn btn-primary"
              style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem', fontSize: '0.85rem' }}
            >
              <Download size={16} />
              기록 파일 저장 (.json)
            </button>
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary"
              style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem', fontSize: '0.85rem' }}
            >
              <Upload size={16} />
              파일 불러오기
            </button>
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImport}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
