import { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, X, Check } from 'lucide-react';
import { storage, getSubjectColor } from '../utils/storage';

export default function SubjectModal({ isOpen, onClose }) {
  const [subjects, setSubjects] = useState([]);
  const [newSubjectInput, setNewSubjectInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSubjects(storage.getSubjects());
      setNewSubjectInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAdd = (e) => {
    e?.preventDefault();
    const trimmed = newSubjectInput.trim();
    if (!trimmed) return;
    if (subjects.includes(trimmed)) {
      alert('이미 등록된 과목입니다.');
      return;
    }
    const updated = [...subjects, trimmed];
    storage.saveSubjects(updated);
    setSubjects(updated);
    setNewSubjectInput('');
  };

  const handleDelete = (name) => {
    if (subjects.length <= 1) {
      alert('최소 1개 이상의 과목이 필요합니다.');
      return;
    }
    const updated = subjects.filter(s => s !== name);
    storage.saveSubjects(updated);
    setSubjects(updated);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: '1rem'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        maxWidth: '440px', width: '100%', background: '#0f172a', border: '1px solid #38bdf8',
        borderRadius: '16px', padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <BookOpen size={20} /> 공부 과목 등록 및 관리
          </h3>
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
            <X size={16} />
          </button>
        </div>

        {/* Current Subjects List */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 'bold' }}>
            등록된 과목 목록 ({subjects.length}개)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', minHeight: '44px', padding: '0.5rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            {subjects.map(s => {
              const col = getSubjectColor(s, subjects);
              return (
                <span
                  key={s}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: `${col}1e`,
                    border: `1px solid ${col}4d`,
                    color: col,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '14px',
                    fontSize: '0.82rem',
                    fontWeight: 'bold'
                  }}
                >
                  {s}
                  <button
                    type="button"
                    onClick={() => handleDelete(s)}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                    title={`${s} 삭제`}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                  >
                    <X size={13} />
                  </button>
                </span>
              );
            })}
          </div>
        </div>

        {/* Add New Subject Form */}
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <input
            type="text"
            placeholder="새 과목명 입력 (예: 세법, 회계학)"
            value={newSubjectInput}
            onChange={(e) => setNewSubjectInput(e.target.value)}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              background: 'rgba(0,0,0,0.4)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              fontSize: '0.85rem'
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <Plus size={16} /> 과목 추가
          </button>
        </form>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}
          >
            완료
          </button>
        </div>
      </div>
    </div>
  );
}
