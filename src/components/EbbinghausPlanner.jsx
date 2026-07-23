import { useState, useEffect } from 'react';
import { BookOpen, Plus, Check, ChevronLeft, ChevronRight, Trash2, Calendar, BrainCircuit } from 'lucide-react';
import { storage } from '../utils/storage';
import confetti from 'canvas-confetti';

export default function EbbinghausPlanner() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // 1=Mon, 7=Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    monday.setHours(0,0,0,0);
    return monday;
  });

  const [lectures, setLectures] = useState([]);
  const [newSubject, setNewSubject] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDateFilter, setSelectedDateFilter] = useState(
    new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]
  );

  const refreshData = () => {
    setLectures(storage.getLectures());
  };

  useEffect(() => {
    refreshData();
    window.addEventListener('cloud-sync-needed', refreshData);
    return () => window.removeEventListener('cloud-sync-needed', refreshData);
  }, []);

  const handlePrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const handleAddLecture = (e) => {
    e.preventDefault();
    if (!newSubject.trim() || !newTitle.trim()) return;
    
    // Add based on today
    storage.addLecture(newSubject, newTitle);
    
    setNewSubject('');
    setNewTitle('');
    setShowAddForm(false);
    refreshData();
    
    // Confetti for starting a new learning journey
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#3b82f6', '#8b5cf6']
    });
  };

  const handleToggleReview = (lectureId, reviewId, isCompleted) => {
    if (isCompleted) {
      storage.undoReview(lectureId, reviewId);
    } else {
      storage.completeReview(lectureId, reviewId);
      // Play satisfying ding (optional, skipping audio for now to keep it simple, just confetti)
      confetti({
        particleCount: 30,
        spread: 40,
        origin: { y: 0.7 },
        colors: ['#10b981']
      });
      window.dispatchEvent(new CustomEvent('xp-updated'));
    }
    refreshData();
  };

  const handleDeleteLecture = (lectureId) => {
    if (window.confirm("이 강의와 모든 복습 일정을 삭제하시겠습니까? (완료된 복습으로 얻은 XP도 회수됩니다)")) {
      storage.deleteLecture(lectureId);
      refreshData();
      window.dispatchEvent(new CustomEvent('xp-updated'));
    }
  };

  // Generate the 7 days of the current week
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(currentWeekStart.getDate() + i);
    const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const isToday = dateStr === new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    
    // Find all reviews for this day
    const dayReviews = [];
    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        if (rev.targetDate === dateStr) {
          dayReviews.push({
            lectureId: lec.id,
            subject: lec.subject,
            title: lec.title,
            ...rev
          });
        }
      });
    });

    return {
      date: d,
      dateStr,
      isToday,
      dayName: ['일','월','화','수','목','금','토'][d.getDay()],
      reviews: dayReviews
    };
  });

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '80vh', borderTop: '3px solid #8b5cf6' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>
            <BrainCircuit size={24} color="#8b5cf6" />
            에빙하우스 망각곡선 플래너
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            오늘 배운 지식을 1일, 4일, 7일, 14일, 30일차에 복습하여 장기기억으로 만드세요.
          </p>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn btn-primary"
          style={{ background: '#8b5cf6', borderColor: '#7c3aed' }}
        >
          {showAddForm ? '취소' : <><Plus size={18} /> 오늘 수강한 강의 추가</>}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#a78bfa' }}>오늘 배운 내용 기록하기</h3>
          <form onSubmit={handleAddLecture} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 200px' }}>
              <input 
                type="text" 
                placeholder="과목명 (예: 재무회계)" 
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)' }}
              />
            </div>
            <div style={{ flex: '2 1 300px' }}>
              <input 
                type="text" 
                placeholder="강의/단원 제목 (예: 1강~3강 문제풀이)" 
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ background: '#8b5cf6', borderColor: '#7c3aed' }}>
              복습 스케줄 생성
            </button>
          </form>
        </div>
      )}

      {/* Weekly Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
        <button onClick={handlePrevWeek} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={18} color="#a78bfa" />
          {currentWeekStart.getMonth() + 1}월 {currentWeekStart.getDate()}일 ~ 
          {(() => {
            const end = new Date(currentWeekStart);
            end.setDate(end.getDate() + 6);
            return ` ${end.getMonth() + 1}월 ${end.getDate()}일`;
          })()}
        </div>
        <button onClick={handleNextWeek} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Weekly Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', flex: 1 }}>
        {weekDays.map(day => (
          <div 
            key={day.dateStr} 
            style={{ 
              background: day.isToday ? 'rgba(139, 92, 246, 0.15)' : 'rgba(0,0,0,0.2)', 
              border: `1px solid ${day.isToday ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '250px'
            }}
          >
            {/* Day Header */}
            <div style={{ 
              padding: '0.75rem', 
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              background: day.isToday ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontWeight: 'bold', color: day.isToday ? '#a78bfa' : 'var(--text-secondary)' }}>
                {day.dayName}요일
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {day.date.getDate()}일
              </span>
            </div>
            
            {/* Reviews List */}
            <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
              {day.reviews.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem', opacity: 0.5 }}>
                  일정 없음
                </div>
              ) : (
                day.reviews.map(rev => (
                  <div 
                    key={rev.id}
                    style={{ 
                      background: rev.isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(30, 41, 59, 0.8)',
                      border: `1px solid ${rev.isCompleted ? 'rgba(16, 185, 129, 0.3)' : 'var(--panel-border)'}`,
                      padding: '0.5rem',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: (new Date(day.dateStr) < new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0] && !rev.isCompleted) ? 0.7 : 1
                    }}
                    onClick={() => handleToggleReview(rev.lectureId, rev.id, rev.isCompleted)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ 
                        fontSize: '0.7rem', 
                        padding: '0.1rem 0.3rem', 
                        borderRadius: '4px',
                        background: '#3b82f640',
                        color: '#60a5fa',
                        fontWeight: 'bold'
                      }}>
                        {rev.dayOffset}일차
                      </span>
                      {rev.isCompleted && <Check size={14} color="#10b981" />}
                      {!rev.isCompleted && (new Date(day.dateStr) < new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0]) && (
                        <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold' }}>지연됨</span>
                      )}
                    </div>
                    
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.1rem' }}>
                      {rev.subject}
                    </div>
                    <div style={{ 
                      fontSize: '0.85rem', 
                      color: rev.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: rev.isCompleted ? 'line-through' : 'none',
                      lineHeight: 1.3
                    }}>
                      {rev.title}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Full Lecture List (Bottom section to manage all) */}
      <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={18} /> 진행 중인 복습 트랙 관리
        </h3>
        
        {lectures.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>아직 등록된 강의가 없습니다.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {lectures.map(lec => {
              const completedCount = lec.reviews.filter(r => r.isCompleted).length;
              const isAllDone = completedCount === 5;
              
              return (
                <div key={lec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)' }}>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: isAllDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isAllDone ? 'line-through' : 'none' }}>
                      [{lec.subject}] {lec.title}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      시작일: {lec.dateAdded} | 복습 진행률: {completedCount}/5
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteLecture(lec.id)}
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}
                    title="기록 삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
