import { useState, useEffect } from 'react';
import { Settings, BarChart2, Target, Zap } from 'lucide-react';
import PomodoroTracker from './components/PomodoroTracker';
import MicroQuestList from './components/MicroQuestList';
import ForestPixelMap from './components/ForestPixelMap';
import InsightsDashboard from './components/InsightsDashboard';
import PhaseRoadmap from './components/PhaseRoadmap';
import EbbinghausPlanner from './components/EbbinghausPlanner';
import { storage } from './utils/storage';
import adventurerImg from './assets/adventurer.png';
import rank1Img from './assets/rank1.jpg';
import rank2Img from './assets/rank2.jpg';
import rank3Img from './assets/rank3.jpg';
import rank4Img from './assets/rank4.jpg';

const getAvatarImage = (level) => {
  if (level >= 120) return rank4Img;     // 4차 전직 (왕관 & 붉은 망토 그랜드마스터)
  if (level >= 70) return rank3Img;      // 3차 전직 (골드 장식 커맨더 기사)
  if (level >= 30) return rank2Img;      // 2차 전직 (실버 갑옷 정예 기사)
  if (level >= 10) return rank1Img;      // 1차 전직 (가죽 갑옷 초급 전사)
  return adventurerImg;                  // 0차 초보자 (목검 모험가)
};

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(1);
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
        {/* Header - compact */}
        <header style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Human-OS <span style={{ color: 'var(--accent-primary)' }}>v1.0</span>
            </h1>
            <p style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginTop: '0.35rem', fontWeight: 600 }}>
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
           <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              onClick={() => { setShowRoadmap(true); setShowInsights(false); setShowSettings(false); }}
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: showRoadmap ? 'var(--accent-primary)' : 'transparent', color: showRoadmap ? '#fff' : 'var(--text-secondary)', border: showRoadmap ? '1px solid var(--accent-primary)' : '1px dashed var(--accent-primary)' }}
            >
              <Target size={18} />
              <span className="hide-on-mobile">전체 로드맵</span>
            </button>
            <button 
              onClick={() => { setShowInsights(true); setShowSettings(false); setShowRoadmap(false); }}
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: showInsights ? 'var(--accent-secondary)' : 'transparent', color: showInsights ? '#fff' : 'var(--text-secondary)' }}
            >
              <BarChart2 size={18} />
              <span className="hide-on-mobile">성장 기록</span>
            </button>
            <button 
              onClick={() => { setShowSettings(!showSettings); setShowInsights(false); setShowRoadmap(false); }}
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Settings size={18} />
              <span className="hide-on-mobile">설정</span>
            </button>
          </div>
        </header>

        {/* Phase Tabs */}
        {!showRoadmap && !showInsights && !showSettings && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
            <button 
              onClick={() => setCurrentPhase(1)}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '0.75rem', background: currentPhase === 1 ? 'var(--accent-primary)' : 'rgba(0,0,0,0.3)', color: currentPhase === 1 ? '#fff' : 'var(--text-muted)', border: currentPhase === 1 ? 'none' : '1px solid var(--panel-border)' }}
            >
              Phase 1. 생존 모드 (타이머/일상)
            </button>
            <button 
              onClick={() => setCurrentPhase(2)}
              className="btn btn-secondary"
              style={{ flex: 1, padding: '0.75rem', background: currentPhase === 2 ? '#8b5cf6' : 'rgba(0,0,0,0.3)', color: currentPhase === 2 ? '#fff' : 'var(--text-muted)', border: currentPhase === 2 ? 'none' : '1px solid var(--panel-border)' }}
            >
              Phase 2. 지식 축적 (에빙하우스)
            </button>
          </div>
        )}

        {/* Content Area */}
        {showRoadmap ? (
          <PhaseRoadmap onClose={() => setShowRoadmap(false)} />
        ) : showInsights ? (
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
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>데이터 관리 및 복구</h4>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button 
                  onClick={() => {
                    if(window.confirm('과거의 모든 퀘스트 및 뽀모도로 기록을 긁어모아 내 경험치(XP)와 레벨을 정확하게 재계산합니다. 진행하시겠습니까?')) {
                      storage.recalculateTotalXP();
                      window.dispatchEvent(new CustomEvent('xp-updated'));
                      window.dispatchEvent(new CustomEvent('cloud-sync-needed'));
                      alert('과거 기록을 바탕으로 경험치가 완벽하게 복구되었습니다!');
                    }
                  }}
                  className="btn btn-primary"
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.85rem',
                    flex: 1
                  }}
                >
                  ✨ 잃어버린 경험치(XP) 복구하기
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => {
                    if(window.confirm('선택된 날짜의 퀘스트와 뽀모도로 기록을 초기화하시겠습니까? (획득한 경험치도 차감됩니다)')) {
                      // 1. Get quests for selectedDate
                      const quests = storage.getQuestsByDate(selectedDate);
                      let xpToSubtract = 0;
                      const resetQuests = quests.map(q => {
                        if (q.isCompleted) {
                           xpToSubtract += (q.type === 'sub' ? 5 : 10);
                        }
                        return { ...q, isCompleted: false, skippedReason: null };
                      });
                      storage.saveQuestsByDate(selectedDate, resetQuests);
                      
                      // 2. Subtract XP
                      if (xpToSubtract > 0) {
                        storage.addXP(-xpToSubtract);
                        window.dispatchEvent(new CustomEvent('xp-updated'));
                      }
                      
                      // 3. Reset Pomodoro
                      const rawData = localStorage.getItem('human_os_pomodoro_v1');
                      if (rawData) {
                        const data = JSON.parse(rawData);
                        if (data[selectedDate]) {
                          const minsToSubtract = data[selectedDate].totalMinutes || 0;
                          if (minsToSubtract > 0) {
                            storage.addXP(-minsToSubtract);
                          }
                          delete data[selectedDate];
                          localStorage.setItem('human_os_pomodoro_v1', JSON.stringify(data));
                          window.dispatchEvent(new CustomEvent('cloud-sync-needed'));
                        }
                      }
                      
                      // 4. Refresh
                      window.dispatchEvent(new CustomEvent('quests-updated'));
                      setRefreshTrigger(prev => prev + 1);
                      alert('해당 날짜의 기록이 초기화되었습니다.');
                    }
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.85rem',
                    flex: 1
                  }}
                >
                  오늘 하루 초기화
                </button>
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
                  모든 데이터 초기화
                </button>
              </div>
            </div>
          </div>
        ) : currentPhase === 2 ? (
          <EbbinghausPlanner />
        ) : (
        <div className="hud-bottom-split">
          
          {/* Left Column: Pomodoro (top) + Quests (bottom) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
            <PomodoroTracker selectedDate={selectedDate} onUpdate={triggerRefresh} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <MicroQuestList selectedDate={selectedDate} onQuestUpdate={triggerRefresh} />
            </div>
          </div>
          
          {/* Right Column: RPG Character Card (top) + Calendar Forest (bottom) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>

            {/* ====== RPG Character Profile Card ====== */}
            <div className="glass-panel" style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.95))',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
              padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem'
            }}>
              {/* Avatar */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: '120px', height: '120px', borderRadius: '50%',
                  border: '4px solid var(--accent-primary)',
                  boxShadow: '0 0 30px rgba(16, 185, 129, 0.4), 0 0 60px rgba(16, 185, 129, 0.15)',
                  overflow: 'hidden', background: '#0f172a'
                }}>
                  <img 
                    src={getAvatarImage(xpInfo.level)} 
                    alt="Character Avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <span style={{
                  position: 'absolute', bottom: '0px', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--accent-primary)', color: '#000',
                  fontWeight: 800, fontSize: '0.85rem', padding: '0.15rem 0.7rem',
                  borderRadius: '12px', border: '3px solid #0f172a', whiteSpace: 'nowrap'
                }}>
                  Lv.{xpInfo.level}
                </span>
              </div>

              {/* Title */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.25rem', color: '#34d399', letterSpacing: '-0.02em' }}>
                  {xpInfo.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--accent-secondary)', fontWeight: 600, marginTop: '0.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                  <Zap size={14} /> 누적 경험치 {xpInfo.totalXP.toLocaleString()} XP
                </div>
              </div>

              {/* XP Progress Bar */}
              <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.4rem' }}>
                  <span>다음 레벨까지</span>
                  <span style={{ color: '#fff' }}>{xpInfo.xpIntoLevel} / {xpInfo.xpNeededForLevel} XP</span>
                </div>
                <div style={{
                  width: '100%', height: '20px', background: 'rgba(0,0,0,0.6)', borderRadius: '10px',
                  overflow: 'hidden', padding: '3px', border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
                }}>
                  <div style={{
                    width: `${Math.min(xpInfo.progressPercent, 100)}%`, height: '100%',
                    background: 'linear-gradient(90deg, #10b981, #34d399, #6EE7B7)',
                    borderRadius: '8px', transition: 'width 0.5s ease-out',
                    boxShadow: '0 0 12px rgba(52, 211, 153, 0.6), inset 0 1px 0 rgba(255,255,255,0.3)'
                  }} />
                </div>
                <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#34d399', fontWeight: 700, marginTop: '0.3rem' }}>
                  {xpInfo.progressPercent}%
                </div>
              </div>
            </div>

            {/* ====== Calendar Forest ====== */}
            <ForestPixelMap refreshTrigger={refreshTrigger} selectedDate={selectedDate} onDateSelect={handleDateSelect} />
          </div>
          
        </div>
        )}
      </div>
    </>
  );
}

export default App;
