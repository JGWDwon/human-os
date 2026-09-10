import { useState, useEffect, useRef } from 'react';
import { BarChart2, Download, Upload, Trophy, Timer, Zap, Calendar, Flame } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { storage } from '../utils/storage';
import StudyTimetable from './StudyTimetable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export default function InsightsDashboard({ onClose }) {
  const [stats, setStats] = useState(null);
  const [weeklyTrend, setWeeklyTrend] = useState([]);
  const fileInputRef = useRef(null);

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

  if (!stats) return null;

  const recent7DaysMins = weeklyTrend.reduce((sum, item) => sum + item.minutes, 0);
  const maxMins = Math.max(...weeklyTrend.map(t => t.minutes), 60);

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '80vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.4rem', color: 'var(--text-primary)' }}>
            <BarChart2 size={24} color="var(--accent-secondary)" />
            나의 공부 성장 리포트
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            나의 핵심 공부 기록과 주간 성장 트렌드를 한눈에 관찰합니다.
          </p>
        </div>

        {/* Export & Import Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button 
            onClick={handleExport}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            title="내 데이터 백업하기"
          >
            <Download size={15} /> 백업
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            title="백업 파일 가져오기"
          >
            <Upload size={15} /> 복구
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            accept=".json" 
            style={{ display: 'none' }} 
          />

          <button onClick={onClose} className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}>
            돌아가기
          </button>
        </div>
      </div>

      {/* Top 3 Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.12)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Trophy size={16} color="#10b981" /> 총 공부 출석일
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{stats.activeDays}일</div>
        </div>

        <div style={{ background: 'rgba(59, 130, 246, 0.12)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Zap size={16} color="#3b82f6" /> 누적 총 공부 시간
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-secondary)' }}>{formatTime(stats.totalFocusMins || 0)}</div>
        </div>

        <div style={{ background: 'rgba(168, 85, 247, 0.12)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Timer size={16} color="#c084fc" /> 최근 7일 집중 시간
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#c084fc' }}>{formatTime(recent7DaysMins)}</div>
        </div>
      </div>

      {/* Weekly Study Trend Bar Chart */}
      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} color="#10b981" /> 최근 7일 공부 시간 트렌드
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>최근 7일간 집중 시간 (요일별)</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: '0.75rem', height: '240px', padding: '1.25rem 0.5rem 0.5rem 0.5rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
          {weeklyTrend.map((item) => {
            const heightPercent = item.minutes > 0 ? Math.max(12, Math.round((item.minutes / maxMins) * 100)) : 4;
            
            return (
              <div key={item.dateStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                {/* Time label above bar */}
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: item.minutes > 0 ? '#34d399' : 'rgba(255,255,255,0.25)', marginBottom: '0.35rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {formatTime(item.minutes)}
                </div>

                {/* Bar */}
                <div 
                  style={{ 
                    width: '100%', 
                    maxWidth: '44px', 
                    height: `${heightPercent}%`, 
                    background: item.minutes > 0 
                      ? (item.isToday ? 'linear-gradient(180deg, #c084fc 0%, #7c3aed 100%)' : 'linear-gradient(180deg, #34d399 0%, #059669 100%)') 
                      : 'rgba(255,255,255,0.06)', 
                    borderRadius: '6px 6px 2px 2px',
                    transition: 'all 0.3s ease',
                    boxShadow: item.minutes > 0 ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
                    border: item.isToday ? '1px solid #c084fc' : 'none'
                  }} 
                  title={`${item.dayLabel}: ${formatTime(item.minutes)}`}
                />

                {/* Day of Week Label */}
                <div style={{ marginTop: '0.65rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: item.isToday ? '#c084fc' : (item.minutes > 0 ? '#fff' : 'var(--text-muted)') }}>
                    {item.dayName}요일
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {item.dateShort}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3-Tier Study Planner Timetables (1단: 월~일, 2단: 어제 vs 오늘, 3단: 저번주 vs 오늘) */}
      <StudyTimetable />
    </div>
  );
}
