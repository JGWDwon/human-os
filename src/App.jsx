import { useState, useEffect } from 'react';
import { Settings, BarChart2 } from 'lucide-react';
import PomodoroTracker from './components/PomodoroTracker';
import MicroQuestList from './components/MicroQuestList';
import ForestPixelMap from './components/ForestPixelMap';
import DiaryAndEmotion from './components/DiaryAndEmotion';
import InsightsDashboard from './components/InsightsDashboard';
import { storage } from './utils/storage';
import adventurerImg from './assets/adventurer.png';

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  });
  const [xpInfo, setXpInfo] = useState(() => {
    const profile = storage.getUserProfile();
    return storage.getLevelInfo(profile.totalXP);
  });

  useEffect(() => {
    const handleXpUpdate = () => {
      const profile = storage.getUserProfile();
      setXpInfo(storage.getLevelInfo(profile.totalXP));
    };
    window.addEventListener('xp-updated', handleXpUpdate);
    return () => window.removeEventListener('xp-updated', handleXpUpdate);
  }, []);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <>
      <div className="app-container">
        {/* Header */}
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Human-OS <span style={{ color: 'var(--accent-primary)' }}>v1.0</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Phase 1: 무기력증 탈출 모드
            </p>
            <p style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 600 }}>
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
          
          {/* XP Bar */}
          <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 300px', minWidth: '300px', maxWidth: '600px', margin: '0 auto', background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '2px solid rgba(16, 185, 129, 0.2)', gap: '1rem' }}>
             <img src={adventurerImg} alt="Adventurer Avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--accent-primary)', objectFit: 'cover' }} />
             <div style={{ flex: 1 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                 <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>Lv.{xpInfo.level} {xpInfo.title}</span>
                 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{xpInfo.xpIntoLevel} / {xpInfo.xpNeededForLevel} XP</span>
               </div>
               <div style={{ width: '100%', height: '12px', background: 'rgba(0,0,0,0.5)', borderRadius: '6px', overflow: 'hidden' }}>
                 <div style={{ width: `${Math.min(xpInfo.progressPercent, 100)}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', transition: 'width 0.5s ease-out' }} />
               </div>
             </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              onClick={() => { setShowInsights(true); setShowSettings(false); }}
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: showInsights ? 'var(--accent-secondary)' : 'transparent', color: showInsights ? '#fff' : 'var(--text-secondary)' }}
            >
              <BarChart2 size={18} />
              <span className="hide-on-mobile">성장 기록</span>
            </button>
            <button 
              onClick={() => { setShowSettings(!showSettings); setShowInsights(false); }}
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Settings size={18} />
              <span className="hide-on-mobile">설정</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        {showInsights ? (
          <InsightsDashboard onClose={() => setShowInsights(false)} />
        ) : showSettings ? (
          <div className="glass-panel animate-fade-in" style={{ marginBottom: '1rem', background: 'rgba(30, 41, 59, 0.95)', border: '1px solid var(--accent-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>환경 설정</h3>
              <button onClick={() => setShowSettings(false)} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>닫기</button>
            </div>
            

            {/* Custom Quest Settings */}
            <div style={{ marginBottom: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <h4 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', fontSize: '0.95rem' }}>내 맞춤 일상 퀘스트 수정</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                매일 초기화될 때 제공될 기본 퀘스트 5가지(메인 3개, 서브 2개)를 내게 맞게 변경합니다. (저장 후 즉시 반영됩니다)
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {storage.getCustomQuests().map((q, idx) => (
                  <div key={q.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${q.type === 'main' ? 'var(--accent-primary)' : 'var(--accent-secondary)'}` }}>
                    <div style={{ fontSize: '0.85rem', color: q.type === 'main' ? 'var(--accent-primary)' : 'var(--accent-secondary)', fontWeight: 'bold' }}>
                      {q.type === 'main' ? `🎯 메인 퀘스트 ${idx + 1}` : `✨ 서브 퀘스트 ${idx - 2}`}
                    </div>
                    <input 
                      type="text" 
                      defaultValue={q.title}
                      placeholder="퀘스트 제목 (예: 기지개 켜기)"
                      id={`custom-quest-title-${q.id}`}
                    />
                    <input 
                      type="text" 
                      defaultValue={q.description}
                      placeholder="상세 설명 (예: 10초 동안 몸 풀기)"
                      id={`custom-quest-desc-${q.id}`}
                      style={{ fontSize: '0.85rem' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => {
                    const customQuests = storage.getCustomQuests().map(q => ({
                      ...q,
                      title: document.getElementById(`custom-quest-title-${q.id}`).value,
                      description: document.getElementById(`custom-quest-desc-${q.id}`).value
                    }));
                    storage.saveCustomQuests(customQuests);
                    
                    const updatedQuests = storage.getQuestsByDate(selectedDate).map(tq => {
                      if(tq.isCompleted || tq.skippedReason) return tq;
                      const custom = customQuests.find(cq => cq.id === tq.id);
                      return { ...tq, title: custom.title, description: custom.description };
                    });
                    storage.saveQuestsByDate(selectedDate, updatedQuests);
                    
                    window.dispatchEvent(new CustomEvent('quests-updated'));
                    alert('퀘스트가 성공적으로 수정되었습니다!');
                  }} 
                  className="btn btn-primary"
                >
                  퀘스트 저장
                </button>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>데이터 관리</h4>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => {
                    if(window.confirm('모든 퀘스트 기록과 다이어리 기록을 완전히 초기화하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) {
                      localStorage.clear();
                      window.location.reload();
                    }
                  }}
                  className="btn"
                  style={{
                    padding: '0.4rem 0.8rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: '0.85rem',
                    flex: 1
                  }}
                >
                  모든 기록 초기화
                </button>
              </div>
            </div>
          </div>
        ) : (
        <div className="hud-bottom-split">
          
          {/* Left Column: Action Board (Timer & Quests) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
            <PomodoroTracker selectedDate={selectedDate} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <MicroQuestList selectedDate={selectedDate} onQuestUpdate={triggerRefresh} />
            </div>
          </div>
          
          {/* Right Column: Calendar Forest & Diary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
            <ForestPixelMap refreshTrigger={refreshTrigger} selectedDate={selectedDate} onDateSelect={handleDateSelect} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <DiaryAndEmotion selectedDate={selectedDate} />
            </div>
          </div>
          
        </div>
        )}
      </div>
    </>
  );
}

export default App;
