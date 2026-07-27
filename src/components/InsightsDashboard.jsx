import { useState, useEffect, useRef } from 'react';
import { BarChart2, Download, Upload, Trophy, CheckCircle, Timer, BookOpen, AlertCircle, TrendingUp } from 'lucide-react';
import { ComposedChart, BarChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { storage } from '../utils/storage';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export default function InsightsDashboard({ onClose }) {
  const [stats, setStats] = useState(null);
  const [historyTimeline, setHistoryTimeline] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [timeDistribution, setTimeDistribution] = useState([]);
  const [slotSummary, setSlotSummary] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Load Stats
    setStats(storage.getAllTimeStats());
    setWeeklyData(storage.getWeeklyGraphData(8));
    setTimeDistribution(storage.getPomodoroTimeDistribution(30));
    setSlotSummary(storage.getTimeSlotSummary(30));

    // Build timeline from last 30 days
    const recentQuests = storage.getQuestHistory(30).reverse(); // oldest first natively, we want newest first, so reverse
    const diaryEntries = storage.getDiary();
    
    // Merge them by date
    const merged = recentQuests.map(day => {
      const dayDiary = diaryEntries.filter(e => e.dateStr === day.date);
      return {
        date: day.date,
        questStatus: day.status,
        diary: dayDiary
      };
    }).filter(day => day.questStatus !== 'none' || day.diary.length > 0); // only show active days

    setHistoryTimeline(merged);
  }, []);

  const handleExport = async () => {
    const data = storage.getAllData();
    const jsonStr = JSON.stringify(data, null, 2);
    const filename = `human-os-backup-${new Date().toISOString().split('T')[0]}.json`;

    if (Capacitor.isNativePlatform()) {
      try {
        // 앱 캐시 디렉토리에 파일 저장 후 공유 시트로 내보내기
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
      // 웹 브라우저 fallback
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
    // 웹: FileReader 방식 (input[type=file])
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
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}시간 ${m > 0 ? m + '분' : ''}`;
    return `${m}분`;
  };

  if (!stats) return null;

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '80vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>
          <BarChart2 size={24} color="var(--accent-secondary)" />
          나의 성장 기록 (Insights)
        </h2>
        <button onClick={onClose} className="btn btn-secondary">돌아가기</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Trophy size={16} /> 총 출석 일수
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{stats.activeDays}일</div>
        </div>
        
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <CheckCircle size={16} /> 누적 퀘스트 완료
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-secondary)' }}>{stats.totalCompletedQuests}회</div>
        </div>

        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Timer size={16} /> 총 집중 시간
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>{formatTime(stats.totalPomodoroMins)}</div>
        </div>
      </div>

      {/* Weekly Trends Chart */}
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={18} color="var(--accent-primary)" /> 주차별 성장 트렌드 (최근 8주)
        </h3>
        <div style={{ height: '300px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
              <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={12} />
              <YAxis yAxisId="right" orientation="right" stroke="var(--text-muted)" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                itemStyle={{ fontWeight: 'bold' }}
                formatter={(value, name) => {
                  if (name === '집중 시간') {
                    const h = Math.floor(value / 60);
                    const m = value % 60;
                    const display = h > 0 ? `${h}시간 ${m > 0 ? m + '분' : ''}` : `${m}분`;
                    return [display, name];
                  }
                  return [value + '회', name];
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Bar yAxisId="left" dataKey="mainQuests" name="메인퀘스트 완료" fill="var(--accent-primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Line yAxisId="right" type="monotone" dataKey="pomodoroMins" name="집중 시간" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#1e293b' }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hourly Time Distribution Chart */}
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Timer size={18} color="#ef4444" /> 나의 집중 시간대 분석 (최근 30일)
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          하루 중 어느 시간대에 가장 많이 몰입하고 공부했는지 실제 시간(분) 기준으로 파악하세요.
        </p>

        {/* Golden Time Banner */}
        {slotSummary && slotSummary.totalMinutes > 0 && slotSummary.topSlot && (
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.85rem 1.25rem', borderRadius: '8px', fontSize: '0.9rem', color: '#34d399', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.2rem' }}>💡</span>
            <span>
              사용자님은 주로 <strong>{slotSummary.topSlot.icon} {slotSummary.topSlot.label}</strong>에 집중력이 가장 뛰어납니다! ({formatTime(slotSummary.topSlot.minutes)}, 전체의 {slotSummary.topSlot.percent}%)
            </span>
          </div>
        )}

        {/* 8 Time Slots Summary Cards */}
        {slotSummary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {slotSummary.slots.map(slot => {
              const isTop = slotSummary.topSlot && slot.id === slotSummary.topSlot.id && slot.minutes > 0;
              return (
                <div key={slot.id} style={{
                  background: isTop ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.03)',
                  border: isTop ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px', padding: '0.6rem 0.5rem', textAlign: 'center',
                  position: 'relative', overflow: 'hidden'
                }}>
                  {isTop && <div style={{ position: 'absolute', top: '2px', right: '4px', fontSize: '0.6rem', color: '#34d399', fontWeight: 'bold' }}>🏆 BEST</div>}
                  <div style={{ fontSize: '1.1rem', marginBottom: '0.15rem' }}>{slot.icon}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>{slot.label}</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: isTop ? '#34d399' : 'var(--text-primary)', margin: '0.2rem 0 0.15rem' }}>
                    {formatTime(slot.minutes)}
                  </div>
                  {/* Mini progress bar */}
                  <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${slot.percent}%`, height: '100%', background: isTop ? '#34d399' : '#ef4444', borderRadius: '2px', transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ fontSize: '0.65rem', color: isTop ? '#34d399' : '#ef4444', fontWeight: 'bold', marginTop: '0.15rem' }}>
                    {slot.percent}%
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ height: '200px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={timeDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
              <XAxis dataKey="hour" stroke="var(--text-muted)" fontSize={11} interval={1} />
              <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                itemStyle={{ fontWeight: 'bold', color: '#ef4444' }}
                formatter={(value) => [`${formatTime(value)}`, '누적 집중 시간']}
              />
              <Bar dataKey="minutes" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flex: 1 }}>
        {/* Timeline */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={18} /> 과거 타임라인 (최근 30일)
          </h3>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '400px', paddingRight: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {historyTimeline.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>아직 활동 기록이 없습니다. 꾸준히 기록을 쌓아보세요!</p>
            ) : (
              historyTimeline.map((day, idx) => (
                <div key={idx} style={{ position: 'relative', paddingLeft: '1.5rem', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ 
                    position: 'absolute', left: '-6px', top: '0', width: '10px', height: '10px', borderRadius: '50%',
                    background: day.questStatus === 'completed' ? 'var(--accent-primary)' : day.questStatus === 'partial' ? 'rgba(16, 185, 129, 0.5)' : day.questStatus === 'hibernation' ? 'var(--accent-hibernation)' : 'var(--text-muted)'
                  }} />
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    {day.date}
                  </div>
                  
                  {day.diary.map(entry => (
                    <div key={entry.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem' }}>
                      <p style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.5 }}>"{entry.content}"</p>
                    </div>
                  ))}
                  {day.diary.length === 0 && day.questStatus !== 'none' && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>일기 기록 없음 (퀘스트 활동만 존재)</div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Data Management */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: 'var(--radius-sm)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={18} /> 안전한 데이터 백업
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              모든 기록은 앱 내부에 자동 저장됩니다.<br/>
              앱을 삭제하거나 기기를 바꿀 때를 대비해 가끔씩 파일로 백업해두세요.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                onClick={handleExport}
                className="btn btn-primary"
                style={{ display: 'flex', justifyContent: 'center' }}
              >
                <Download size={18} />
                내 기록 파일로 저장 (.json)
              </button>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary"
                style={{ display: 'flex', justifyContent: 'center' }}
              >
                <Upload size={18} />
                저장된 파일 불러오기
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
    </div>
  );
}
