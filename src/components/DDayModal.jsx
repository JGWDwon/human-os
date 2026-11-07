import { useState, useEffect } from 'react';
import { Target, X, Check, Calendar } from 'lucide-react';
import { storage } from '../utils/storage';

export default function DDayModal({ isOpen, onClose }) {
  const [dDay1, setDDay1] = useState({ label: '1차 시험', targetDate: '' });
  const [dDay2, setDDay2] = useState({ label: '2차 시험', targetDate: '' });

  useEffect(() => {
    if (isOpen) {
      const saved = storage.getDDays();
      if (Array.isArray(saved)) {
        if (saved[0]) setDDay1({ label: saved[0].label || '1차 시험', targetDate: saved[0].targetDate || '' });
        if (saved[1]) setDDay2({ label: saved[1].label || '2차 시험', targetDate: saved[1].targetDate || '' });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getDDayPreview = (dateStr) => {
    if (!dateStr) return '-';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'D-Day';
    if (diffDays > 0) return `D-${diffDays}`;
    return `D+${Math.abs(diffDays)}`;
  };

  const handleSave = (e) => {
    e?.preventDefault();
    const list = [
      { id: 'd1', label: dDay1.label.trim() || '1차 시험', targetDate: dDay1.targetDate },
      { id: 'd2', label: dDay2.label.trim() || '2차 시험', targetDate: dDay2.targetDate }
    ];
    storage.saveDDays(list);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: '1rem'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        maxWidth: '440px', width: '100%', background: '#0f172a', border: '1px solid #f59e0b',
        borderRadius: '16px', padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Target size={20} /> D-Day (1차 / 2차) 설정
          </h3>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0', lineHeight: 1.4 }}>
          목표하는 1차 및 2차 시험 날짜를 지정하면 메인 화면 상단에 D-Day 카운트다운이 표시됩니다.
        </p>

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* 1차 시험 설정 */}
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', padding: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fbbf24' }}>
                🎯 1차 목표 설정
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.2)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                {getDDayPreview(dDay1.targetDate)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>명칭</label>
                <input
                  type="text"
                  value={dDay1.label}
                  onChange={(e) => setDDay1(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="예: 1차 시험"
                  style={{ width: '100%', padding: '0.45rem', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>목표 날짜</label>
                <input
                  type="date"
                  value={dDay1.targetDate}
                  onChange={(e) => setDDay1(prev => ({ ...prev, targetDate: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }}
                />
              </div>
            </div>
          </div>

          {/* 2차 시험 설정 */}
          <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '10px', padding: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#38bdf8' }}>
                🎯 2차 목표 설정
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.2)', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                {getDDayPreview(dDay2.targetDate)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: '0.5rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>명칭</label>
                <input
                  type="text"
                  value={dDay2.label}
                  onChange={(e) => setDDay2(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="예: 2차 시험"
                  style={{ width: '100%', padding: '0.45rem', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>목표 날짜</label>
                <input
                  type="date"
                  value={dDay2.targetDate}
                  onChange={(e) => setDDay2(prev => ({ ...prev, targetDate: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }}
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem', background: 'linear-gradient(90deg, #f59e0b, #f97316)', color: '#000', fontWeight: 'bold' }}
            >
              저장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
