import { useState, useEffect } from 'react';
import { BookOpen, Send, Loader2, Download, X } from 'lucide-react';
import { storage } from '../utils/storage';

export default function DiaryAndEmotion({ selectedDate }) {
  const [diary, setDiary] = useState([]);
  const [emotion, setEmotion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBackupPrompt, setShowBackupPrompt] = useState(false);

  useEffect(() => {
    setDiary(storage.getDiaryByDate(selectedDate));
  }, [selectedDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emotion.trim()) return;

    setIsSubmitting(true);
    let feedback = '';

    try {
      const fallbacks = [
        "오늘 하루도 무사히 넘긴 자신을 칭찬해주세요. 나만의 비밀 일기장에 안전하게 보관되었습니다.",
        "감정을 솔직하게 적어내는 것만으로도 훌륭한 스트레스 해소법입니다. 잘하셨어요!",
        "힘든 감정을 털어놓아 주셔서 감사합니다. 이 일기장은 언제나 당신 편입니다."
      ];
      feedback = fallbacks[Math.floor(Math.random() * fallbacks.length)];

      const newEntry = storage.addDiaryEntry(selectedDate, {
        content: emotion,
        feedback: feedback
      });

      setDiary([newEntry, ...diary]);
      setEmotion('');
      
      // Add XP
      storage.addXP(5);
      window.dispatchEvent(new CustomEvent('xp-updated'));
      
      // 일기가 하루의 마지막 루틴인 경우가 많으므로 백업 팝업 띄우기
      setTimeout(() => {
        setShowBackupPrompt(true);
      }, 500);
    } catch (err) {
      console.error(err);
      alert("AI 피드백을 가져오는 중 오류가 발생했습니다. API 키를 확인해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '300px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <BookOpen size={20} color="var(--accent-secondary)" />
          하루 일기장
        </h2>
        {selectedDate !== new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0] && (
          <div style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
            📅 {selectedDate} 과거 기록 수정
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <textarea 
          value={emotion}
          onChange={(e) => setEmotion(e.target.value)}
          placeholder="오늘 하루는 어떠셨나요? 자유롭게 적어주세요."
          disabled={isSubmitting}
          rows={3}
          style={{ resize: 'vertical' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting || !emotion.trim()}>
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} /> 기록하기</>}
          </button>
        </div>
      </form>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }}>
        {diary.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '2rem' }}>
            아직 작성된 로그가 없습니다. 가벼운 마음으로 한 줄 적어보세요.
          </p>
        ) : (
          diary.map((entry) => (
            <div key={entry.id} style={{ 
              background: 'rgba(0,0,0,0.2)', 
              padding: '1rem', 
              borderRadius: 'var(--radius-sm)',
              borderLeft: '3px solid var(--accent-secondary)'
            }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {new Date(entry.timestamp || entry.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </p>
              <p style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: 500, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                {entry.content}
              </p>
              {entry.feedback && (
                <div style={{ 
                  background: 'rgba(59, 130, 246, 0.1)', 
                  padding: '0.75rem', 
                  borderRadius: '4px',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  color: 'rgba(255, 255, 255, 0.9)'
                }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent-secondary)' }}>AI 코치: </span>
                  {entry.feedback}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Backup Prompt Modal */}
      {showBackupPrompt && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '90%', maxWidth: '400px', padding: '2rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: 'var(--accent-primary)' }}>
              <Download size={40} />
            </div>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>오늘 하루도 수고하셨습니다!</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
              일기 작성까지 오늘의 모든 루틴을 마치셨군요.<br/>
              소중한 기록을 잃어버리지 않도록<br/>지금 바로 백업 파일을 다운로드할까요?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                onClick={() => {
                  storage.triggerBackupDownload();
                  setShowBackupPrompt(false);
                }} 
                className="btn btn-primary"
                style={{ padding: '0.8rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', fontWeight: 'bold' }}
              >
                <Download size={18} />
                데이터 백업하기 (권장)
              </button>
              <button 
                onClick={() => setShowBackupPrompt(false)} 
                className="btn btn-secondary"
                style={{ padding: '0.8rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
              >
                <X size={18} />
                오늘은 그냥 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
