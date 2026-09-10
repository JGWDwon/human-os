import { useState, useEffect, useRef } from 'react';
import { Settings, BarChart2, Target, Zap, Trophy, Download, Upload, X, Sparkles, BookOpen } from 'lucide-react';
import confetti from 'canvas-confetti';
import PomodoroTracker from './components/PomodoroTracker';
import ForestPixelMap from './components/ForestPixelMap';
import InsightsDashboard from './components/InsightsDashboard';
import PhaseRoadmap from './components/PhaseRoadmap';
import EbbinghausPlanner from './components/EbbinghausPlanner';
import { storage } from './utils/storage';
import TierBadge from './components/TierBadge';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

function App() {
  const [activeView, setActiveView] = useState('main'); // 'main' | 'ebbinghaus' | 'insights' | 'settings' | 'roadmap'
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
  const [levelUpModal, setLevelUpModal] = useState(null);
  const [milestoneToast, setMilestoneToast] = useState(null);
  const [showTierModal, setShowTierModal] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const handleXpUpdate = () => {
      const profile = storage.getUserProfile();
      setXpInfo(storage.getLevelInfo(profile.totalXP));
    };

    const handleLevelUp = (e) => {
      setLevelUpModal(e.detail);
      confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.4 },
        colors: ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6']
      });
    };

    const handleMilestone = (e) => {
      setMilestoneToast(e.detail);
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#10b981', '#34d399']
      });
      setTimeout(() => {
        setMilestoneToast(null);
      }, 4000);
    };

    window.addEventListener('xp-updated', handleXpUpdate);
    window.addEventListener('level-up', handleLevelUp);
    window.addEventListener('milestone-achieved', handleMilestone);

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

    return () => {
      window.removeEventListener('xp-updated', handleXpUpdate);
      window.removeEventListener('level-up', handleLevelUp);
      window.removeEventListener('milestone-achieved', handleMilestone);
    };
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

  // Backup & Restore Handlers (Moved into Settings for clean UI)
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

  const todayFormatted = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <>
      <div className="app-container">
        
        {/* ========================================================================= */}
        {/* SLIM COMPACT HEADER (높이 48px 내외로 공간 대폭 확보) */}
        {/* ========================================================================= */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '0.6rem 1rem',
          marginBottom: '1.25rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)'
        }}>
          {/* Logo & Today Badge */}
          <div 
            onClick={() => setActiveView('main')} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
            title="메인 화면으로 이동"
          >
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#fff', letterSpacing: '-0.5px' }}>
              Human<span style={{ color: 'var(--accent-primary)' }}>OS</span>
            </h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '0.15rem 0.5rem', borderRadius: '12px' }}>
              {todayFormatted}
            </span>
            {updateAvailable && (
              <button
                onClick={handleApplyUpdate}
                style={{
                  background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  animation: 'pulse 1.5s infinite'
                }}
              >
                🚀 업데이트
              </button>
            )}
          </div>

          {/* Slim RPG Level & Tier Badge Widget */}
          <div 
            onClick={() => setShowTierModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              background: 'rgba(0, 0, 0, 0.35)',
              border: `1px solid ${xpInfo.tierColor || 'rgba(16, 185, 129, 0.3)'}`,
              borderRadius: '24px',
              padding: '0.25rem 0.85rem',
              flex: '1 1 260px',
              maxWidth: '380px',
              minWidth: '220px',
              cursor: 'pointer',
              transition: 'transform 0.15s, border-color 0.2s'
            }}
            title="클릭하여 랭크 배지 도감 확인"
          >
            <TierBadge level={xpInfo.level} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: xpInfo.tierColor || '#34d399',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  Lv.{xpInfo.level} {xpInfo.title.split('(')[0]}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {xpInfo.progressPercent}%
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '5px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '3px',
                overflow: 'hidden',
                marginTop: '0.2rem'
              }}>
                <div style={{
                  width: `${xpInfo.progressPercent}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${xpInfo.tierColor || '#10b981'}, #34d399)`,
                  transition: 'width 0.4s ease'
                }} />
              </div>
            </div>
          </div>

          {/* Unified Header Nav Buttons */}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              onClick={() => setActiveView(activeView === 'ebbinghaus' ? 'main' : 'ebbinghaus')}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.82rem',
                padding: '0.4rem 0.75rem',
                background: activeView === 'ebbinghaus' ? '#8b5cf6' : 'rgba(255, 255, 255, 0.05)',
                color: activeView === 'ebbinghaus' ? '#fff' : 'var(--text-secondary)',
                border: activeView === 'ebbinghaus' ? '1px solid #a78bfa' : '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <BookOpen size={15} />
              <span>에빙하우스 복습</span>
            </button>

            <button
              onClick={() => setActiveView(activeView === 'insights' ? 'main' : 'insights')}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.82rem',
                padding: '0.4rem 0.75rem',
                background: activeView === 'insights' ? 'var(--accent-secondary)' : 'rgba(255, 255, 255, 0.05)',
                color: activeView === 'insights' ? '#fff' : 'var(--text-secondary)',
                border: activeView === 'insights' ? '1px solid #60a5fa' : '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <BarChart2 size={15} />
              <span>성장 리포트</span>
            </button>

            <button
              onClick={() => setActiveView(activeView === 'settings' ? 'main' : 'settings')}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.82rem',
                padding: '0.4rem 0.65rem',
                background: activeView === 'settings' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
              title="설정"
            >
              <Settings size={15} />
            </button>
          </div>
        </header>

        {/* Milestone Toast */}
        {milestoneToast && (
          <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: 'linear-gradient(135deg, #065f46, #047857)',
            color: '#fff',
            padding: '0.75rem 1.25rem',
            borderRadius: '12px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.4), 0 0 15px rgba(52, 211, 153, 0.5)',
            border: '1px solid #34d399',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            zIndex: 9998,
            animation: 'slideUp 0.3s ease-out'
          }}>
            <span style={{ fontSize: '1.4rem' }}>{milestoneToast.icon}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{milestoneToast.label}</div>
              <div style={{ fontSize: '0.78rem', color: '#a7f3d0' }}>+{milestoneToast.bonus} XP 보너스 획득!</div>
            </div>
          </div>
        )}

        {/* Level Up Celebration Modal */}
        {levelUpModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}>
            <div style={{
              background: 'linear-gradient(145deg, #1e1b4b, #0f172a)',
              border: `2px solid ${levelUpModal.tierColor || '#f59e0b'}`,
              borderRadius: '20px',
              padding: '2rem 1.75rem',
              maxWidth: '420px',
              width: '100%',
              textAlign: 'center',
              boxShadow: `0 0 40px ${levelUpModal.tierColor || 'rgba(245, 158, 11, 0.4)'}`,
              animation: 'popIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }}>
              <div style={{
                margin: '0 auto 1.25rem auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TierBadge level={levelUpModal.newLevel} size={88} showGlow={true} />
              </div>

              <span style={{
                background: levelUpModal.tierColor || '#f59e0b',
                color: '#000',
                padding: '0.2rem 0.8rem',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 800,
                letterSpacing: '1px'
              }}>
                LEVEL UP!
              </span>

              <h2 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', margin: '0.75rem 0 0.25rem 0' }}>
                Lv.{levelUpModal.newLevel} 달성!
              </h2>

              <p style={{ fontSize: '1.05rem', color: levelUpModal.tierColor || '#fbbf24', fontWeight: 700, margin: '0 0 1rem 0' }}>
                {levelUpModal.title}
              </p>

              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 1.75rem 0' }}>
                포기하지 않고 쌓아올린 집중의 시간들이 실질적인 성장으로 결실을 맺었습니다! 다음 랭크를 향해 힘차게 달려보세요.
              </p>

              <button
                onClick={() => setLevelUpModal(null)}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  fontSize: '1rem',
                  fontWeight: 800,
                  background: `linear-gradient(90deg, ${levelUpModal.tierColor || '#f59e0b'}, #f97316)`,
                  border: 'none',
                  borderRadius: '10px',
                  color: '#000',
                  boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
                  cursor: 'pointer'
                }}
              >
                계속해서 집중하기 ✨
              </button>
            </div>
          </div>
        )}

        {/* Tier Badge Guide Modal */}
        {showTierModal && (
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem'
          }}>
            <div className="glass-panel animate-fade-in" style={{
              maxWidth: '480px', width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '20px', padding: '1.75rem', boxShadow: '0 15px 35px rgba(0,0,0,0.6)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={20} color="var(--accent-primary)" /> 랭크 배지 도감
                </h3>
                <button onClick={() => setShowTierModal(false)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
                  <X size={16} />
                </button>
              </div>

              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0', lineHeight: 1.4 }}>
                공부 시간을 쌓아 레벨업하면 상위 랭크 배지가 자동으로 승급됩니다.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {[
                  { level: 2, name: '브론즈 (Bronze)', range: 'Lv.1 ~ Lv.9', desc: '시작하는 도전자 · 습관 형성', color: '#cd7f32' },
                  { level: 15, name: '실버 (Silver)', range: 'Lv.10 ~ Lv.29', desc: '열정 수험생 · 흔들림 없는 러너', color: '#94a3b8' },
                  { level: 45, name: '골드 (Gold)', range: 'Lv.30 ~ Lv.69', desc: '정예 합격권 · 고수 회독러', color: '#f59e0b' },
                  { level: 85, name: '플래티넘 (Platinum)', range: 'Lv.70 ~ Lv.119', desc: '절대 집중자 · 회독 장인', color: '#06b6d4' },
                  { level: 120, name: '그랜드 마스터 (Master)', range: 'Lv.120+', desc: '최종 합격 · 예비 세무사', color: '#c084fc' }
                ].map(t => {
                  const isCurrent = (t.name.includes('브론즈') && xpInfo.level < 10) ||
                                    (t.name.includes('실버') && xpInfo.level >= 10 && xpInfo.level < 30) ||
                                    (t.name.includes('골드') && xpInfo.level >= 30 && xpInfo.level < 70) ||
                                    (t.name.includes('플래티넘') && xpInfo.level >= 70 && xpInfo.level < 120) ||
                                    (t.name.includes('마스터') && xpInfo.level >= 120);

                  return (
                    <div
                      key={t.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.85rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '10px',
                        background: isCurrent ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                        border: isCurrent ? `1.5px solid ${t.color}` : '1px solid rgba(255, 255, 255, 0.06)'
                      }}
                    >
                      <TierBadge level={t.level} size={42} showGlow={isCurrent} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: t.color }}>
                            {t.name} {isCurrent && <span style={{ fontSize: '0.72rem', background: t.color, color: '#000', padding: '0.05rem 0.4rem', borderRadius: '8px', marginLeft: '0.4rem' }}>내 랭크</span>}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.range}</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          {t.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MAIN VIEWS & CONTENT AREA */}
        {/* ========================================================================= */}
        {activeView === 'roadmap' ? (
          <PhaseRoadmap onClose={() => setActiveView('main')} />
        ) : activeView === 'insights' ? (
          <InsightsDashboard onClose={() => setActiveView('main')} />
        ) : activeView === 'ebbinghaus' ? (
          <EbbinghausPlanner onClose={() => setActiveView('main')} />
        ) : activeView === 'settings' ? (
          <div className="glass-panel animate-fade-in" style={{ marginBottom: '1rem', background: 'rgba(30, 41, 59, 0.95)', border: '1px solid var(--accent-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={20} color="var(--accent-secondary)" /> 환경 설정
              </h3>
              <button onClick={() => setActiveView('main')} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem' }}>닫기</button>
            </div>

            {/* 전체 로드맵 바로가기 버튼 */}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem' }}>공부 시스템 전체 로드맵</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Phase 1(집중)부터 Phase 4(실전 모의고사)까지 마일스톤 확인</div>
              </div>
              <button 
                onClick={() => setActiveView('roadmap')}
                className="btn btn-secondary" 
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Target size={15} /> 로드맵 열기
              </button>
            </div>

            {/* 백업 및 복구 영역 (리포트에서 설정으로 깔끔하게 이동) */}
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
              <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem', marginBottom: '0.3rem' }}>데이터 백업 및 복구</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>공부 기록과 통계를 안전하게 파일로 저장하거나 복원합니다.</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={handleExport}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <Download size={16} /> 데이터 파일 백업
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <Upload size={16} /> 백업 파일 복구
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImport} 
                  accept=".json" 
                  style={{ display: 'none' }} 
                />
              </div>
            </div>

            {/* 데이터 관리 및 초기화 */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>데이터 관리 및 초기화</h4>
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
                  style={{ padding: '0.5rem 0.8rem', fontSize: '0.85rem', flex: 1 }}
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
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', flex: 1 }}
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
        ) : (
          /* ========================================================================= */
          /* MAIN VIEW: 1:1 SIDE-BY-SIDE (타이머 & 캘린더 한눈에 보기) */
          /* ========================================================================= */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '1.5rem',
            alignItems: 'stretch',
            width: '100%'
          }}>
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
