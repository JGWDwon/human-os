import { useState, useEffect } from 'react';
import { Check, X, Sparkles, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { storage } from '../utils/storage';
import pigImg from '../assets/pig.png';
import slimeImg from '../assets/slime.png';

export default function MicroQuestList({ selectedDate, onQuestUpdate }) {
  const [quests, setQuests] = useState([]);
  const [skipModal, setSkipModal] = useState({ isOpen: false, questId: null });
  const [skipReason, setSkipReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiFeedback, setAiFeedback] = useState(null);

  useEffect(() => {
    setQuests(storage.getQuestsByDate(selectedDate));
    
    // Listen for custom quests update
    const handleUpdate = () => setQuests(storage.getQuestsByDate(selectedDate));
    window.addEventListener('quests-updated', handleUpdate);
    return () => window.removeEventListener('quests-updated', handleUpdate);
  }, [selectedDate]);

  const handleComplete = (id) => {
    const updated = quests.map(q => 
      q.id === id ? { ...q, isCompleted: true, skippedReason: null } : q
    );
    setQuests(updated);
    storage.saveQuestsByDate(selectedDate, updated);
    
    // Play a satisfying subtle 'ding' sound
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1); // Slide up to A6
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.log('Audio not supported or blocked');
    }

    // Add XP based on type
    const quest = updated.find(q => q.id === id);
    const xpReward = quest && quest.type === 'sub' ? 5 : 10;
    storage.addXP(xpReward);
    window.dispatchEvent(new CustomEvent('xp-updated'));

    // Check if ALL MAIN quests are complete
    const mainQuests = updated.filter(q => q.type === 'main' || !q.type);
    const isAllComplete = mainQuests.filter(q => q.isCompleted).length === mainQuests.length;

    if (isAllComplete) {
      // Grand Confetti
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 },
        colors: ['#10b981', '#3b82f6', '#f8fafc', '#f59e0b', '#ef4444']
      });
    } else {
      // Small Dopamine Particle Effect
      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#10b981']
      });
    }

    if (onQuestUpdate) onQuestUpdate(updated);
  };

  const handleUndo = (id) => {
    const quest = quests.find(q => q.id === id);
    if (!quest) return;

    const updated = quests.map(q => 
      q.id === id ? { ...q, isCompleted: false, skippedReason: null } : q
    );
    setQuests(updated);
    storage.saveQuestsByDate(selectedDate, updated);
    
    // Subtract XP only if it was completed
    if (quest.isCompleted) {
      const xpReward = quest.type === 'sub' ? 5 : 10;
      storage.addXP(-xpReward);
      window.dispatchEvent(new CustomEvent('xp-updated'));
    }
    
    if (onQuestUpdate) onQuestUpdate(updated);
  };

  const handleSkipClick = (id) => {
    setSkipModal({ isOpen: true, questId: id });
    setSkipReason('');
    setAiFeedback(null);
  };

  const submitSkip = async () => {
    if (!skipReason.trim()) return;
    setIsSubmitting(true);
    
    try {
      const feedbackMsg = "이유를 기록했습니다. 전략적 휴식도 훌륭한 선택입니다. 자책하지 마세요!";
      
      const updated = quests.map(q => 
        q.id === skipModal.questId ? { ...q, skippedReason: skipReason, isCompleted: false } : q
      );
      setQuests(updated);
      storage.saveQuestsByDate(selectedDate, updated);
      setAiFeedback(feedbackMsg);
      
      if (onQuestUpdate) onQuestUpdate(updated);
    } catch (err) {
      console.error(err);
      setAiFeedback("오류가 발생했습니다. 하지만 기록은 저장되었어요. 푹 쉬세요!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeSkipModal = () => {
    setSkipModal({ isOpen: false, questId: null });
    setAiFeedback(null);
  };

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <Sparkles size={20} color="var(--accent-primary)" />
          일상 퀘스트
        </h2>
        {selectedDate !== new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0] && (
          <div style={{ background: 'rgba(249, 115, 22, 0.2)', color: '#f97316', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
            📅 {selectedDate} 과거 기록 수정
          </div>
        )}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
        
        {/* Main Quests */}
        <div>
          <h4 style={{ color: 'var(--accent-primary)', marginBottom: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src={pigImg} alt="Pig" style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--accent-primary)', objectFit: 'cover' }} /> 
            메인 퀘스트 (필수)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {quests.filter(q => q.type === 'main' || !q.type).map(q => (
              <QuestCard key={q.id} q={q} onComplete={handleComplete} onSkip={handleSkipClick} onUndo={handleUndo} />
            ))}
          </div>
        </div>

        {/* Sub Quests */}
        <div>
          <h4 style={{ color: 'var(--accent-secondary)', marginBottom: '0.75rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src={slimeImg} alt="Slime" style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid var(--accent-secondary)', objectFit: 'cover' }} /> 
            서브 퀘스트 (선택)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {quests.filter(q => q.type === 'sub').map(q => (
              <QuestCard key={q.id} q={q} onComplete={handleComplete} onSkip={handleSkipClick} onUndo={handleUndo} isSub />
            ))}
          </div>
        </div>
      </div>

      {/* CBT Skip Modal */}
      {skipModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '90%', maxWidth: '400px', padding: '2rem' }}>
            {!aiFeedback ? (
              <>
                <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>전략적 휴식 선택 💤</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
                  에너지가 부족할 때 쉬는 것은 아주 훌륭한 선택입니다. 현재 어떤 상태인지 짧게 적어주세요.
                </p>
                <textarea 
                  value={skipReason}
                  onChange={e => setSkipReason(e.target.value)}
                  placeholder="예: 너무 피곤하다, 오늘은 그냥 눕고 싶다..."
                  rows={3}
                  style={{ marginBottom: '1.5rem' }}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button onClick={closeSkipModal} className="btn btn-secondary">취소</button>
                  <button onClick={submitSkip} className="btn btn-primary" disabled={isSubmitting || !skipReason.trim()}>
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : '휴식 기록하기'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ marginBottom: '1rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={20} /> AI 코치의 답변
                </h3>
                <div style={{ 
                  background: 'rgba(59, 130, 246, 0.1)', 
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  padding: '1rem', borderRadius: 'var(--radius-sm)',
                  marginBottom: '1.5rem', lineHeight: 1.6
                }}>
                  {aiFeedback}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={closeSkipModal} className="btn btn-primary">닫기</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QuestCard({ q, onComplete, onSkip, onUndo, isSub }) {
  const accentColor = isSub ? 'var(--accent-secondary)' : 'var(--accent-primary)';
  const bgCompleted = isSub ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)';
  
  return (
    <div style={{
      padding: '1rem',
      background: q.isCompleted ? bgCompleted : 'rgba(0,0,0,0.1)',
      border: `2px solid ${q.isCompleted ? accentColor : 'var(--panel-border)'}`,
      borderRadius: 'var(--radius-sm)',
      opacity: q.skippedReason ? 0.6 : 1,
      transition: 'all 0.3s ease',
      boxShadow: q.isCompleted ? `0 0 10px ${accentColor}40` : 'none'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, paddingRight: '1rem' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', textDecoration: q.isCompleted ? 'line-through' : 'none', color: 'var(--text-primary)' }}>
            {q.title} <span style={{ fontSize: '0.75rem', color: accentColor, fontWeight: 'normal', marginLeft: '0.25rem' }}>({isSub ? '+5' : '+10'} XP)</span>
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{q.description}</p>
          {q.skippedReason && (
            <p style={{ color: 'var(--accent-hibernation)', fontSize: '0.85rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
              💤 전략적 휴식 중: {q.skippedReason}
            </p>
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
          {!q.isCompleted && !q.skippedReason && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => onSkip(q.id)} className="btn btn-skip" style={{ padding: '0.5rem' }} title="전략적 휴식">
                <X size={16} />
              </button>
              <button onClick={() => onComplete(q.id)} className="btn" style={{ padding: '0.5rem 1rem', background: accentColor, color: '#fff', border: 'none', fontWeight: 'bold' }}>
                <Check size={16} /> 완료!
              </button>
            </div>
          )}
          {q.isCompleted && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
              <div style={{ color: accentColor, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Check size={18} /> 완료
              </div>
              <button onClick={() => onUndo(q.id)} className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', border: 'none', color: 'var(--text-muted)' }}>취소</button>
            </div>
          )}
          {q.skippedReason && (
            <button onClick={() => onUndo(q.id)} className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)', border: 'none', color: 'var(--text-muted)' }}>다시 도전</button>
          )}
        </div>
      </div>
    </div>
  );
}
