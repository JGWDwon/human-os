import { useState, useEffect } from 'react';
import { Settings, BarChart2, Target, Zap } from 'lucide-react';
import PomodoroTracker from './components/PomodoroTracker';
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

  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const handleXpUpdate = () => {
      const profile = storage.getUserProfile();
      setXpInfo(storage.getLevelInfo(profile.totalXP));
    };
    window.addEventListener('xp-updated', handleXpUpdate);

    // In-App Update Detector for native app experience
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateAvailable(true);
      });
    }

    return () => window.removeEventListener('xp-updated', handleXpUpdate);
  }, []);

  const handleApplyUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
    window.location.reload();
  };

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Human-OS <span style={{ color: 'var(--accent-primary)' }}>v1.0</span>
              </h1>
              {updateAvailable && (
                <button
                  onClick={handleApplyUpdate}
                  style={{
                    background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                    color: '#fff',
                    border: 'none',
                    padding: '0.3rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 0 12px rgba(236, 72, 153, 0.5)',
                    animation: 'pulse 1.5s infinite'
                  }}
                  title="새로운 기능 업데이트 적용하기"
                >
                  🚀 최신 버전 업데이트 적용
                </button>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              나의 성장 일지
            </p>
            <p style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', marginTop: '0.5rem', fontWeight: 600 }}>
              {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </p>
          </div>
          
          {/* XP Bar (Prominent RPG Character Card) */}
          <div style={{
            display: 'flex', alignItems: 'center', flex: '1 1 360px', minWidth: '320px', maxWidth: '640px', margin: '0 auto',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.9))',
            padding: '1rem 1.25rem', borderRadius: '12px',
            border: '2px solid rgba(16, 185, 129, 0.35)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)', gap: '1.25rem'
          }}>
             <div style={{ position: 'relative', flexShrink: 0 }}>
               <img 
                 src={getAvatarImage(xpInfo.level)} 
                 alt="Character Avatar" 
                 style={{
                   width: '76px', height: '76px', borderRadius: '50%',
                   border: '3px solid var(--accent-primary)',
                   boxShadow: '0 0 16px rgba(16, 185, 129, 0.5)',
                   objectFit: 'cover', background: '#0f172a'
                 }} 
               />
               <span style={{
                 position: 'absolute', bottom: '-4px', right: '-4px',
                 background: 'var(--accent-primary)', color: '#000',
                 fontWeight: 800, fontSize: '0.75rem', padding: '0.1rem 0.4rem',
                 borderRadius: '10px', border: '2px solid #0f172a'
               }}>
                 Lv.{xpInfo.level}
               </span>
             </div>

             <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                 <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#34d399', letterSpacing: '-0.02em' }}>
                   {xpInfo.title}
                 </span>
                 <span style={{ fontSize: '0.78rem', color: 'var(--accent-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                   <Zap size={13} /> 누적 {xpInfo.totalXP.toLocaleString()} XP
                 </span>
               </div>

               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                 <span>성장 진척도</span>
                 <span style={{ color: '#fff' }}>{xpInfo.xpIntoLevel} / {xpInfo.xpNeededForLevel} XP ({xpInfo.progressPercent}%)</span>
               </div>

               <div style={{ width: '100%', height: '16px', background: 'rgba(0,0,0,0.6)', borderRadius: '8px', overflow: 'hidden', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
                 <div style={{
                   width: `${Math.min(xpInfo.progressPercent, 100)}%`, height: '100%',
                   background: 'linear-gradient(90deg, #10b981, #34d399, #6EE7B7)',
                   borderRadius: '6px', transition: 'width 0.5s ease-out',
                   boxShadow: '0 0 10px rgba(52, 211, 153, 0.6)'
                 }} />
               </div>
             </div>
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
              Phase 1. 집중 사냥터 (타이머 & 성장의 숲)
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

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>데이터 관리 및 복구</h4>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button 
                  onClick={() => {
                    if(window.confirm('과거의 모든 뽀모도로 기록을 긁어모아 내 경험치(XP)와 레벨을 정확하게 재계산합니다. 진행하시겠습니까?')) {
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
                    if(window.confirm('선택된 날짜의 뽀모도로 공부 기록을 초기화하시겠습니까? (획득한 경험치도 차감됩니다)')) {
                      const rawData = localStorage.getItem('human_os_pomodoro_v1');
                      if (rawData) {
                        const data = JSON.parse(rawData);
                        if (data[selectedDate]) {
                          const minsToSubtract = data[selectedDate].totalMinutes || 0;
                          if (minsToSubtract > 0) {
                            storage.addXP(-minsToSubtract);
                            window.dispatchEvent(new CustomEvent('xp-updated'));
                          }
                          delete data[selectedDate];
                          localStorage.setItem('human_os_pomodoro_v1', JSON.stringify(data));
                          window.dispatchEvent(new CustomEvent('cloud-sync-needed'));
                        }
                      }
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
                    if(window.confirm('모든 공부 기록과 다이어리 기록을 완전히 초기화하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) {
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', alignItems: 'stretch', width: '100%' }}>
          {/* Left Column: Pomodoro Timer */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            <PomodoroTracker selectedDate={selectedDate} onUpdate={triggerRefresh} />
          </div>
          
          {/* Right Column: Calendar Forest (4h/6h/8h Study Goal Pixel Map) */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
            <ForestPixelMap refreshTrigger={refreshTrigger} selectedDate={selectedDate} onDateSelect={handleDateSelect} />
          </div>
        </div>
        )}
      </div>
    </>
  );
}

export default App;
