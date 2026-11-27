import { useState, useEffect, useRef } from 'react';
import { X, Edit3, Plus, Check, Clock, Save } from 'lucide-react';
import { storage } from '../utils/storage';

const getTodayStr = () => {
  const d = new Date();
  return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
};

const getNowTimeStr = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

export default function QuickDiaryModal({ isOpen, onClose, targetDate }) {
  const effectiveDate = targetDate || getTodayStr();
  const isToday = effectiveDate === getTodayStr();

  const [quickLine, setQuickLine] = useState('');
  const [fullDiary, setFullDiary] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const quickInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const log = storage.getDailyLogByDate(effectiveDate);
      setFullDiary(log?.diary || log?.note || '');
      setQuickLine('');
      setFeedbackMsg('');
      setTimeout(() => {
        if (quickInputRef.current) {
          quickInputRef.current.focus();
        }
      }, 60);
    }
  }, [isOpen, effectiveDate]);

  if (!isOpen) return null;

  const showFeedback = (msg) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 2200);
  };

  // 생각나는 그때그때 현재 시각([HH:mm])과 함께 한 줄씩 누적 추가
  const handleAddQuickLine = (e) => {
    if (e) e.preventDefault();
    const trimmed = quickLine.trim();
    if (!trimmed) return;

    const timeTag = getNowTimeStr();
    const newEntry = `[${timeTag}] ${trimmed}`;
    const updatedText = fullDiary.trim()
      ? `${fullDiary.trimEnd()}\n${newEntry}`
      : newEntry;

    storage.saveDailyLog(effectiveDate, { diary: updatedText, note: updatedText });
    setFullDiary(updatedText);
    setQuickLine('');
    window.dispatchEvent(new CustomEvent('daily-logs-updated', { detail: { date: effectiveDate } }));
    showFeedback(`[${timeTag}] 한 줄 기록이 추가되었습니다!`);
  };

  // 누적된 전체 일기 직접 수정 저장
  const handleSaveFullDiary = () => {
    storage.saveDailyLog(effectiveDate, { diary: fullDiary, note: fullDiary });
    window.dispatchEvent(new CustomEvent('daily-logs-updated', { detail: { date: effectiveDate } }));
    showFeedback('전체 일기 내용이 저장되었습니다!');
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 10005,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '500px',
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.98) 0%, rgba(24, 24, 37, 0.98) 100%)',
          border: '1.5px solid rgba(192, 132, 252, 0.45)',
          borderRadius: '16px',
          padding: '1.25rem',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.65), 0 0 24px rgba(168, 85, 247, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.9rem'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.08rem', color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Edit3 size={18} color="#c084fc" />
              {isToday ? '오늘의 수시 한줄일기' : `${effectiveDate} 한줄일기`}
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              공부가 끝난 뒤가 아니라, 생각나는 그때그때 바로 기록하세요.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="닫기"
          >
            <X size={16} />
          </button>
        </div>

        {/* 1. Quick Single-Line Timestamped Add */}
        <form onSubmit={handleAddQuickLine} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={13} /> 지금 떠오른 생각 바로 추가 ({getNowTimeStr()})
          </label>
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            <input
              ref={quickInputRef}
              type="text"
              value={quickLine}
              onChange={(e) => setQuickLine(e.target.value)}
              placeholder="한 줄 메모를 적고 Enter를 누르세요..."
              style={{
                flex: 1,
                background: 'rgba(0, 0, 0, 0.5)',
                border: '1.5px solid rgba(192, 132, 252, 0.4)',
                borderRadius: '8px',
                padding: '0.55rem 0.75rem',
                color: '#fff',
                fontSize: '0.84rem',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={!quickLine.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: quickLine.trim()
                  ? 'linear-gradient(135deg, #a855f7, #7c3aed)'
                  : 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '8px',
                padding: '0 0.85rem',
                color: quickLine.trim() ? '#fff' : 'var(--text-muted)',
                fontSize: '0.82rem',
                fontWeight: 'bold',
                cursor: quickLine.trim() ? 'pointer' : 'not-allowed',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={15} /> 추가
            </button>
          </div>
        </form>

        {/* Feedback Toast */}
        {feedbackMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.76rem',
            fontWeight: 'bold',
            color: '#34d399',
            background: 'rgba(16, 185, 129, 0.14)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            padding: '0.35rem 0.65rem',
            borderRadius: '6px'
          }}>
            <Check size={14} /> {feedbackMsg}
          </div>
        )}

        {/* 2. Accumulated Diary View & Direct Edit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 'bold' }}>
              📖 {isToday ? '오늘 쌓인 한줄일기' : `${effectiveDate} 한줄일기`}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {(fullDiary || '').length}자
            </span>
          </div>
          <textarea
            value={fullDiary}
            onChange={(e) => setFullDiary(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleSaveFullDiary();
              }
            }}
            placeholder="위 입력칸에서 한 줄씩 추가하거나, 여기에 자유롭게 직접 작성할 수 있습니다."
            rows={5}
            style={{
              width: '100%',
              resize: 'vertical',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '8px',
              padding: '0.6rem 0.75rem',
              color: '#f8fafc',
              fontSize: '0.82rem',
              lineHeight: '1.5',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              직접 수정 후에는 아래 저장 버튼을 눌러주세요 (Ctrl+Enter)
            </span>
            <button
              type="button"
              onClick={handleSaveFullDiary}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(192, 132, 252, 0.4)',
                borderRadius: '7px',
                padding: '0.35rem 0.75rem',
                color: '#e9d5ff',
                fontSize: '0.76rem',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              <Save size={13} /> 전체 내용 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
