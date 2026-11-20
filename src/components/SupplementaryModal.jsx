import { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  Bookmark,
  Filter
} from 'lucide-react';
import { storage, getSubjectColor } from '../utils/storage';

export default function SupplementaryModal({ isOpen, onClose }) {
  const [slots, setSlots] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed' | 'all'
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');

  // New slot form state
  const [titleInput, setTitleInput] = useState('');
  const [subjectInput, setSubjectInput] = useState('');
  const [memoInput, setMemoInput] = useState('');
  const [showMemoField, setShowMemoField] = useState(false);

  // Edit slot state
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editMemo, setEditMemo] = useState('');

  const loadData = () => {
    setSlots(storage.getSupplementarySlots());
    setSubjects(storage.getSubjects());
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener('supplementary-slots-updated', handleUpdate);
    return () => {
      window.removeEventListener('supplementary-slots-updated', handleUpdate);
    };
  }, []);

  // Title change auto-subject detection
  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitleInput(val);
    if (!subjectInput) {
      for (const s of subjects) {
        if (val.includes(s)) {
          setSubjectInput(s);
          break;
        }
      }
    }
  };

  const handleAddSlot = (e) => {
    e?.preventDefault();
    const trimmedTitle = titleInput.trim();
    if (!trimmedTitle) {
      alert('문항 또는 문제 번호를 입력해주세요 (예: 셈회12장05번)');
      return;
    }

    const currentSelected = localStorage.getItem('human_os_selected_subject_v1');
    const finalSubject = subjectInput.trim() || currentSelected || (subjects[0] || '기타');

    storage.addSupplementarySlot({
      title: trimmedTitle,
      subject: finalSubject,
      memo: memoInput.trim()
    });

    setTitleInput('');
    setMemoInput('');
    setShowMemoField(false);
  };

  const handleToggle = (slotId) => {
    storage.toggleSupplementarySlot(slotId);
  };

  const handleDelete = (slotId) => {
    if (window.confirm('이 보충 슬롯을 삭제하시겠습니까?')) {
      storage.removeSupplementarySlot(slotId);
    }
  };

  const handleStartEdit = (slot) => {
    setEditingSlotId(slot.id);
    setEditTitle(slot.title);
    setEditSubject(slot.subject);
    setEditMemo(slot.memo || '');
  };

  const handleSaveEdit = (slotId) => {
    if (!editTitle.trim()) {
      alert('문항 이름을 입력해주세요.');
      return;
    }
    storage.updateSupplementarySlot(slotId, {
      title: editTitle.trim(),
      subject: editSubject.trim() || '기타',
      memo: editMemo.trim()
    });
    setEditingSlotId(null);
  };

  if (!isOpen) return null;

  // Filter slots
  const filteredSlots = slots.filter(slot => {
    // Tab filter
    if (activeTab === 'pending' && slot.isCompleted) return false;
    if (activeTab === 'completed' && !slot.isCompleted) return false;

    // Subject filter
    if (selectedSubjectFilter !== 'all' && slot.subject !== selectedSubjectFilter) return false;

    return true;
  });

  const pendingCount = slots.filter(s => !s.isCompleted).length;
  const completedCount = slots.filter(s => s.isCompleted).length;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.82)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10005,
      padding: '1rem'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        maxWidth: '580px',
        width: '100%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0f172a',
        border: '1.5px solid #f59e0b',
        borderRadius: '18px',
        boxShadow: '0 15px 40px rgba(0,0,0,0.7)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.1rem 1.3rem 0.85rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#f59e0b',
                padding: '0.3rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Bookmark size={18} />
              </span>
              <h2 style={{ margin: 0, fontSize: '1.18rem', fontWeight: 900, color: '#fff', letterSpacing: '-0.3px' }}>
                막힌 문제 보충 슬롯 <span style={{ color: '#f59e0b', fontSize: '0.92rem', fontWeight: 'bold' }}>({pendingCount}건 대기)</span>
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              복습 중 막혀서 넘어간 문제를 킵해두고, 다음 공부 전이나 여유 시간에 완벽히 정복하세요.
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.6rem', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Quick Add Section */}
        <div style={{
          padding: '0.9rem 1.3rem',
          background: 'rgba(15, 23, 42, 0.6)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <form onSubmit={handleAddSlot} style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <div style={{ display: 'flex', gap: '0.45rem' }}>
              <input
                type="text"
                placeholder="막힌 문제 입력 (예: 셈회12장05번)"
                value={titleInput}
                onChange={handleTitleChange}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  color: '#fff',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />

              {/* Subject Select */}
              <select
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                style={{
                  width: '105px',
                  padding: '0.45rem 0.5rem',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: subjectInput ? getSubjectColor(subjectInput, subjects) : 'var(--text-muted)',
                  fontSize: '0.82rem',
                  outline: 'none'
                }}
              >
                <option value="">과목 선택</option>
                {subjects.map(s => (
                  <option key={s} value={s} style={{ color: '#fff', background: '#1e293b' }}>
                    {s}
                  </option>
                ))}
                <option value="기타" style={{ color: '#fff', background: '#1e293b' }}>기타</option>
              </select>

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  padding: '0.45rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  border: 'none',
                  color: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  whiteSpace: 'nowrap'
                }}
              >
                <Plus size={16} /> 슬롯 킵
              </button>
            </div>

            {/* Optional Memo Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {!showMemoField ? (
                <button
                  type="button"
                  onClick={() => setShowMemoField(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    padding: 0
                  }}
                >
                  <Plus size={12} /> 추가 메모 (어디서 막혔는지 기록)
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.4rem', width: '100%', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="막힌 이유나 체크 포인트 메모 (예: 물음 2번 감가상각 누계액 계산 오류)"
                    value={memoInput}
                    onChange={(e) => setMemoInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.3rem 0.6rem',
                      borderRadius: '6px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      fontSize: '0.78rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => { setShowMemoField(false); setMemoInput(''); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.72rem',
                      cursor: 'pointer'
                    }}
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Filter Bar (Tabs & Subject Filter) */}
        <div style={{
          padding: '0.65rem 1.3rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          background: 'rgba(0, 0, 0, 0.2)'
        }}>
          {/* Main Status Tabs */}
          <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(0,0,0,0.3)', padding: '0.2rem', borderRadius: '10px' }}>
            <button
              onClick={() => setActiveTab('pending')}
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'pending' ? '#f59e0b' : 'transparent',
                color: activeTab === 'pending' ? '#000' : 'var(--text-secondary)',
                fontWeight: activeTab === 'pending' ? 'bold' : 'normal',
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              대기 중 ({pendingCount})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'completed' ? '#10b981' : 'transparent',
                color: activeTab === 'completed' ? '#000' : 'var(--text-secondary)',
                fontWeight: activeTab === 'completed' ? 'bold' : 'normal',
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              해결 완료 ({completedCount})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              style={{
                padding: '0.25rem 0.65rem',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'all' ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: activeTab === 'all' ? '#fff' : 'var(--text-secondary)',
                fontWeight: activeTab === 'all' ? 'bold' : 'normal',
                fontSize: '0.78rem',
                cursor: 'pointer'
              }}
            >
              전체 ({slots.length})
            </button>
          </div>

          {/* Subject Filter */}
          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            style={{
              padding: '0.25rem 0.55rem',
              borderRadius: '6px',
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--text-muted)',
              fontSize: '0.74rem',
              outline: 'none'
            }}
          >
            <option value="all">전체 과목</option>
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
            <option value="기타">기타</option>
          </select>
        </div>

        {/* Slot Items List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.85rem 1.3rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem'
        }}>
          {filteredSlots.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2.5rem 1rem',
              color: 'var(--text-muted)'
            }}>
              {activeTab === 'pending' ? (
                <>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>🎉</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: '#e2e8f0' }}>대기 중인 막힌 문제가 없습니다!</div>
                  <div style={{ fontSize: '0.76rem', marginTop: '0.2rem' }}>공부 중 풀리지 않는 문제가 생기면 언제든 여기에 킵해두세요.</div>
                </>
              ) : activeTab === 'completed' ? (
                <>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>📝</div>
                  <div style={{ fontSize: '0.88rem', color: '#e2e8f0' }}>해결 완료된 문제가 아직 없습니다.</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>📌</div>
                  <div style={{ fontSize: '0.88rem', color: '#e2e8f0' }}>등록된 보충 문제가 없습니다.</div>
                </>
              )}
            </div>
          ) : (
            filteredSlots.map(slot => {
              const isEditing = editingSlotId === slot.id;
              const subColor = getSubjectColor(slot.subject, subjects);

              if (isEditing) {
                return (
                  <div
                    key={slot.id}
                    style={{
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: '1.5px solid #38bdf8',
                      borderRadius: '10px',
                      padding: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        style={{
                          flex: 2,
                          padding: '0.35rem 0.55rem',
                          borderRadius: '6px',
                          background: 'rgba(0,0,0,0.4)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: '#fff',
                          fontSize: '0.82rem'
                        }}
                      />
                      <select
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '0.35rem 0.45rem',
                          borderRadius: '6px',
                          background: 'rgba(0,0,0,0.4)',
                          border: '1px solid rgba(255,255,255,0.2)',
                          color: '#fff',
                          fontSize: '0.8rem'
                        }}
                      >
                        {subjects.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        <option value="기타">기타</option>
                      </select>
                    </div>

                    <input
                      type="text"
                      placeholder="메모 수정"
                      value={editMemo}
                      onChange={(e) => setEditMemo(e.target.value)}
                      style={{
                        padding: '0.35rem 0.55rem',
                        borderRadius: '6px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff',
                        fontSize: '0.78rem'
                      }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => setEditingSlotId(null)}
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(slot.id)}
                        className="btn btn-primary"
                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', background: '#38bdf8', color: '#000', border: 'none', fontWeight: 'bold' }}
                      >
                        저장
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={slot.id}
                  style={{
                    background: slot.isCompleted ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.04)',
                    border: slot.isCompleted ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '10px',
                    padding: '0.65rem 0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    opacity: slot.isCompleted ? 0.65 : 1,
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Left: Checkbox & Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                    {/* Checkbox */}
                    <button
                      type="button"
                      onClick={() => handleToggle(slot.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        color: slot.isCompleted ? '#10b981' : '#94a3b8'
                      }}
                      title={slot.isCompleted ? '미해결로 되돌리기' : '해결 완료로 체크'}
                    >
                      {slot.isCompleted ? (
                        <CheckSquare size={20} color="#10b981" />
                      ) : (
                        <Square size={20} color="#94a3b8" />
                      )}
                    </button>

                    {/* Content */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        {/* Subject Tag */}
                        <span style={{
                          fontSize: '0.68rem',
                          fontWeight: 'bold',
                          padding: '0.1rem 0.45rem',
                          borderRadius: '4px',
                          color: subColor,
                          background: `${subColor}1f`,
                          border: `1px solid ${subColor}40`
                        }}>
                          {slot.subject}
                        </span>

                        {/* Title */}
                        <span style={{
                          fontSize: '0.9rem',
                          fontWeight: 'bold',
                          color: slot.isCompleted ? '#94a3b8' : '#f8fafc',
                          textDecoration: slot.isCompleted ? 'line-through' : 'none',
                          wordBreak: 'break-all'
                        }}>
                          {slot.title}
                        </span>
                      </div>

                      {/* Memo & Date Meta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {slot.memo && (
                          <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>
                            💬 {slot.memo}
                          </span>
                        )}
                        <span>등록: {slot.date}</span>
                        {slot.isCompleted && slot.completedAt && (
                          <span style={{ color: '#34d399' }}>
                            ✓ 해결 완료 ({new Date(slot.completedAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Actions: Edit & Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => handleStartEdit(slot)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '0.2rem',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="수정"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(slot.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        padding: '0.2rem',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div style={{
          padding: '0.7rem 1.3rem',
          background: 'rgba(0,0,0,0.3)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <span>💡 5개 이상 쌓이면 다음 날 첫 공부 시작 전 워밍업 알림이 뜹니다.</span>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.8rem', fontSize: '0.78rem' }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
