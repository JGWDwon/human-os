import { useState, useEffect } from 'react';
import { BookOpen, Plus, Check, ChevronLeft, ChevronRight, Trash2, Calendar, BrainCircuit, RotateCcw, Palmtree, ArrowRight, Wand2 } from 'lucide-react';
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
  const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const [selectedDateFilter, setSelectedDateFilter] = useState(todayStr);

  const [selectedDateForAdd, setSelectedDateForAdd] = useState(todayStr);

  // Vacation & Overdue Modal states
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [vacStartDate, setVacStartDate] = useState(todayStr);
  const [vacEndDate, setVacEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  });
  const [vacations, setVacations] = useState([]);

  const refreshData = () => {
    setLectures(storage.getLectures());
    setVacations(storage.getVacations());
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
    
    // Add based on selected date
    storage.addLecture(newSubject, newTitle, selectedDateForAdd);
    
    setNewSubject('');
    setNewTitle('');
    setSelectedDateForAdd(todayStr);
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

  const handleShiftReview = (e, lectureId, reviewId, days) => {
    e.stopPropagation(); // Prevent toggling completion status
    storage.postponeReview(lectureId, reviewId, days);
    
    // Check if the review's new targetDate is outside current visible week, and auto-navigate if needed
    const updatedLectures = storage.getLectures();
    const lec = updatedLectures.find(l => l.id === lectureId);
    if (lec) {
      const rev = lec.reviews.find(r => r.id === reviewId);
      if (rev && rev.targetDate) {
        const revDate = new Date(rev.targetDate + 'T00:00:00');
        const weekEnd = new Date(currentWeekStart);
        weekEnd.setDate(currentWeekStart.getDate() + 6);

        if (revDate < currentWeekStart || revDate > weekEnd) {
          const dayOfWeek = revDate.getDay();
          const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const targetWeekStart = new Date(revDate);
          targetWeekStart.setDate(revDate.getDate() + diffToMon);
          setCurrentWeekStart(targetWeekStart);
        }
      }
    }
    refreshData();
  };

  const handleMoveOverdueClick = () => {
    const overdueCount = lectures.flatMap(l => l.reviews).filter(r => !r.isCompleted && r.targetDate < todayStr).length;
    if (overdueCount === 0) {
      alert("밀린 복습이 없습니다! 아주 훌륭합니다 🎉");
      return;
    }
    setShowOverdueModal(true);
  };

  const handleDistributeOverdue = (maxPerDay) => {
    const count = storage.distributeOverdueReviews(maxPerDay);
    if (count > 0) {
      alert(`🌱 밀린 복습 ${count}개를 오늘부터 하루 ${maxPerDay}개씩 나누어 균등하게 재배치했습니다!`);
      refreshData();
    }
    setShowOverdueModal(false);
  };

  const handleMoveOverdueToTodayModal = () => {
    const count = storage.moveAllOverdueToToday();
    if (count > 0) {
      alert(`⚡ 밀린 복습 ${count}개를 오늘 날짜로 모두 이동했습니다! 💪`);
      refreshData();
    }
    setShowOverdueModal(false);
  };

  const handleApplyVacation = (e) => {
    e.preventDefault();
    if (!vacStartDate || !vacEndDate) {
      alert("시작일과 종료일을 모두 입력해주세요.");
      return;
    }
    if (vacEndDate < vacStartDate) {
      alert("종료일은 시작일보다 빠를 수 없습니다.");
      return;
    }
    const result = storage.addVacation(vacStartDate, vacEndDate);
    alert(`🌴 휴가 모드 적용 완료!\n${vacStartDate} ~ ${vacEndDate} (총 ${result.days}일간)\n\n휴가 기간은 "없는 날"로 처리됩니다.\n미완료 복습 ${result.count}개가 휴가일을 건너뛰어 재배치되었습니다.\n(완료된 복습은 그대로 유지됩니다)\n\n즐거운 여행 되세요! 🎉`);
    refreshData();
  };

  const handleRevertVacation = (vacationId) => {
    if (window.confirm("이 휴가 일정을 취소하시겠습니까?\n휴가 기간이 삭제되고, 미완료 복습이 원래 14714 간격으로 재계산됩니다.\n(완료된 복습은 그대로 유지됩니다)")) {
      const result = storage.revertVacation(vacationId);
      alert(`↩️ 휴가 취소 완료!\n${result.count}개의 미완료 복습이 원래 간격으로 재배치되었습니다.`);
      refreshData();
    }
  };

  const handleDeleteLecture = (lectureId) => {
    if (window.confirm("이 강의와 모든 복습 일정을 삭제하시겠습니까? (완료된 복습으로 얻은 XP도 회수됩니다)")) {
      storage.deleteLecture(lectureId);
      refreshData();
      window.dispatchEvent(new CustomEvent('xp-updated'));
    }
  };

  const handleSmartRedistribute = (maxPerDay = 2) => {
    const count = storage.smartEbbinghausRedistribute(maxPerDay);
    if (count > 0) {
      alert(`✨ 복습 재배치 완료!\n\n• 미완료 복습 ${count}개가 14714 간격 기준으로 재계산되었습니다.\n• 휴가 기간은 "없는 날"로 건너뜁니다.\n• 하루 최대 ${maxPerDay}개씩 균등 분배됩니다.\n• 이미 완료한 복습은 그대로 유지됩니다! ✅`);
      refreshData();
    } else {
      alert("이미 모든 복습 일정이 정확하게 배치되어 있습니다! 👍");
    }
    setShowOverdueModal(false);
  };

  const handleRecalculateReviews = () => {
    if (window.confirm("모든 미완료 복습 일정을 강의 시작일 기준 원래의 1·4·7·14·30 망각곡선 간격(휴가 기간 제외)으로 초기화하시겠습니까?\n\n• 이미 완료한 복습은 그대로 보존됩니다.\n• 휴가 기간은 없는 날로 계산됩니다.")) {
      const count = storage.recalculateAllReviews();
      alert(`✨ 복습 일정 초기화 완료!\n미완료 복습 ${count}개가 순수 1·4·7·14·30 간격(휴가 제외)으로 원위치 재정렬되었습니다.`);
      refreshData();
    }
  };

  // Calculate overdue review count
  const overdueCount = lectures.flatMap(l => l.reviews).filter(r => !r.isCompleted && r.targetDate < todayStr).length;

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

    const isVacation = storage.isVacationDate(dateStr);

    return {
      date: d,
      dateStr,
      isToday,
      isVacation,
      dayName: ['일','월','화','수','목','금','토'][d.getDay()],
      reviews: dayReviews
    };
  });

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '80vh', borderTop: '3px solid #8b5cf6' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>
            <BrainCircuit size={24} color="#8b5cf6" />
            에빙하우스 망각곡선 플래너
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
            오늘 배운 지식을 1일, 4일, 7일, 14일, 30일차에 복습하여 장기기억으로 만드세요.
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button 
            onClick={handleMoveOverdueClick}
            className="btn btn-secondary"
            style={{ 
              background: overdueCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', 
              border: `1px solid ${overdueCount > 0 ? '#ef4444' : 'rgba(255,255,255,0.1)'}`, 
              color: overdueCount > 0 ? '#f87171' : 'var(--text-secondary)', 
              fontSize: '0.8rem', 
              padding: '0.4rem 0.75rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.3rem' 
            }}
            title="밀린 복습 처리 및 균등 분배"
          >
            <RotateCcw size={14} /> 밀린 복습 정리 {overdueCount > 0 ? `(${overdueCount}개)` : ''}
          </button>

          <button 
            onClick={handleRecalculateReviews}
            className="btn btn-secondary"
            style={{ background: 'rgba(251, 191, 36, 0.15)', border: '1px solid #fbbf24', color: '#fbbf24', fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            title="모든 미완료 복습 일정을 원래 1/4/7/14/30일 간격으로 재배치"
          >
            <Wand2 size={14} /> 복습 일정 초기화 (1·4·7·14·30)
          </button>

          <button 
            onClick={() => setShowVacationModal(true)}
            className="btn btn-secondary"
            style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', fontSize: '0.8rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            title="휴가/여행 기간 동안 모든 복습 일정 연기 및 취소 관리"
          >
            <Palmtree size={14} /> 여행/휴가 모드 (날짜 지정 & 취소)
          </button>

          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary"
            style={{ background: '#8b5cf6', borderColor: '#7c3aed', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
          >
            {showAddForm ? '취소' : <><Plus size={16} /> 강의 추가 (날짜 지정)</>}
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#a78bfa' }}>배운 내용 및 학습 날짜 기록하기</h3>
          <form onSubmit={handleAddLecture} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#a78bfa', marginBottom: '0.3rem' }}>학습 날짜</label>
              <input 
                type="date" 
                value={selectedDateForAdd}
                onChange={(e) => setSelectedDateForAdd(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
              />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#a78bfa', marginBottom: '0.3rem' }}>과목명</label>
              <input 
                type="text" 
                placeholder="예: 재무회계" 
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
              />
            </div>
            <div style={{ flex: '2 1 240px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#a78bfa', marginBottom: '0.3rem' }}>강의/단원 제목</label>
              <input 
                type="text" 
                placeholder="예: 1강~3강 문제풀이" 
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ background: '#8b5cf6', borderColor: '#7c3aed', height: '42px' }}>
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
              background: day.isVacation 
                ? 'rgba(16, 185, 129, 0.12)' 
                : (day.isToday ? 'rgba(139, 92, 246, 0.15)' : 'rgba(0,0,0,0.2)'), 
              border: day.isVacation
                ? '1px solid rgba(16, 185, 129, 0.4)'
                : `1px solid ${day.isToday ? 'rgba(139, 92, 246, 0.4)' : 'rgba(255,255,255,0.05)'}`,
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
              background: day.isVacation
                ? 'rgba(16, 185, 129, 0.22)' 
                : (day.isToday ? 'rgba(139, 92, 246, 0.2)' : 'transparent'),
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ fontWeight: 'bold', color: day.isVacation ? '#34d399' : (day.isToday ? '#a78bfa' : 'var(--text-secondary)') }}>
                  {day.dayName}요일
                </span>
                {day.isVacation && (
                  <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.4)', color: '#fff', padding: '0.05rem 0.35rem', borderRadius: '4px', fontWeight: 'bold' }}>
                    🌴 휴가
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.85rem', color: day.isVacation ? '#34d399' : 'var(--text-muted)' }}>
                {day.date.getDate()}일
              </span>
            </div>
            
            {/* Reviews List */}
            <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
              {day.reviews.length === 0 ? (
                <div style={{ color: day.isVacation ? '#34d399' : 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', marginTop: '1rem', opacity: day.isVacation ? 0.9 : 0.5, fontWeight: day.isVacation ? 'bold' : 'normal' }}>
                  {day.isVacation ? '🌴 휴가 기간' : '일정 없음'}
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
                      opacity: (day.dateStr < todayStr && !rev.isCompleted) ? 0.7 : 1
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {!rev.isCompleted && (
                          <div style={{ display: 'flex', gap: '0.2rem' }}>
                            <button
                              onClick={(e) => handleShiftReview(e, rev.lectureId, rev.id, -1)}
                              style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#cbd5e1',
                                fontSize: '0.65rem',
                                padding: '0.05rem 0.3rem',
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                              title="이 복습 1일 앞으로 당기기 (-1일)"
                            >
                              -1일
                            </button>
                            <button
                              onClick={(e) => handleShiftReview(e, rev.lectureId, rev.id, 1)}
                              style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                color: '#cbd5e1',
                                fontSize: '0.65rem',
                                padding: '0.05rem 0.3rem',
                                borderRadius: '3px',
                                cursor: 'pointer'
                              }}
                              title="이 복습 1일 뒤로 미루기 (+1일)"
                            >
                              +1일
                            </button>
                          </div>
                        )}
                        {rev.isCompleted && <Check size={14} color="#10b981" />}
                        {!rev.isCompleted && (day.dateStr < todayStr) && (
                          <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold' }}>지연됨</span>
                        )}
                      </div>
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

      {/* Vacation Mode Modal */}
      {showVacationModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '520px', width: '100%', background: '#0f172a', border: '1px solid #10b981',
            borderRadius: '16px', padding: '1.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Palmtree size={22} /> 여행/휴가 모드 (기간 지정 & 취소)
              </h3>
              <button onClick={() => setShowVacationModal(false)} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>닫기</button>
            </div>

            <form onSubmit={handleApplyVacation} style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: '#fff' }}>🗓️ 여행/휴가 기간 지정 연기</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
                여행 시작일부터 종료일까지의 총 일수를 계산하여, 해당 시점 이후의 모든 복습 일정을 자동으로 연기합니다.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>여행 시작일</label>
                  <input 
                    type="date" 
                    value={vacStartDate} 
                    onChange={(e) => setVacStartDate(e.target.value)} 
                    required 
                    style={{ width: '100%', padding: '0.5rem', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.85rem' }} 
                  />
                </div>
                <div style={{ flex: 1, minWidth: '130px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>여행 종료일</label>
                  <input 
                    type="date" 
                    value={vacEndDate} 
                    onChange={(e) => setVacEndDate(e.target.value)} 
                    required 
                    style={{ width: '100%', padding: '0.5rem', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.85rem' }} 
                  />
                </div>
              </div>

              {vacStartDate && vacEndDate && vacEndDate >= vacStartDate && (
                <div style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 'bold', marginBottom: '1rem', background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.8rem', borderRadius: '6px', border: '1px border rgba(16, 185, 129, 0.3)' }}>
                  🏝️ {vacStartDate} ~ {vacEndDate} (총 {Math.round((new Date(vacEndDate + 'T00:00:00') - new Date(vacStartDate + 'T00:00:00')) / (1000 * 60 * 60 * 24)) + 1}일간 복습 일정 연기)
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%', background: '#10b981', borderColor: '#059669', padding: '0.65rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
                🌴 휴가 일정 연기 적용하기
              </button>
            </form>

            {/* Applied Vacations & Revert Option */}
            <div>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <RotateCcw size={16} color="#f87171" /> 적용된 여행 목록 (여행 취소 & 복원)
              </h4>

              {vacations.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>현재 적용된 여행/휴가 일정이 없습니다.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {vacations.map(vac => (
                    <div key={vac.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#fff' }}>
                          🏖️ {vac.startDate} ~ {vac.endDate} ({vac.days}일간 연기됨)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          영향받은 복습 일정: {vac.count}개
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRevertVacation(vac.id)} 
                        className="btn btn-secondary" 
                        style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#f87171', fontSize: '0.78rem', padding: '0.35rem 0.7rem', flexShrink: 0 }}
                      >
                        ↩️ 여행 취소 (원복)
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overdue Distribution Modal */}
      {showOverdueModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '480px', width: '100%', background: '#0f172a', border: '1px solid #ef4444',
            borderRadius: '16px', padding: '1.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RotateCcw size={22} /> 밀린 복습 스마트 재배치 ({overdueCount}개)
              </h3>
              <button onClick={() => setShowOverdueModal(false)} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>닫기</button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              밀린 복습 <strong style={{ color: '#ef4444' }}>{overdueCount}개</strong>가 존재합니다.<br />
              오늘 날짜를 기준점으로 <strong>1일, 4일, 7일, 14일, 30일 에빙하우스 주기</strong>로 스마트하게 재배치하거나 순차 분배할 수 있습니다.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button
                onClick={() => handleSmartRedistribute(2)}
                className="btn"
                style={{
                  background: 'rgba(139, 92, 246, 0.2)', border: '1px solid #8b5cf6', color: '#c084fc',
                  padding: '0.85rem 1rem', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>✨ 하루 2개씩 평일 균등 분배 (강력 추천)</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '0.2rem' }}>
                    특정 날짜 몰림 없이 화·수·목·금에 하루 2개씩 1·4·7·14·30 주기로 나누어 배치합니다.
                  </div>
                </div>
                <ArrowRight size={18} />
              </button>

              <button
                onClick={() => handleSmartRedistribute(3)}
                className="btn"
                style={{
                  background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399',
                  padding: '0.85rem 1rem', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>🌱 하루 3개씩 평일 균등 분배</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '0.2rem' }}>
                    하루 최대 3개씩 요일별로 나누어 1·4·7·14·30 주기로 배치합니다.
                  </div>
                </div>
                <ArrowRight size={18} />
              </button>

              <button
                onClick={() => handleDistributeOverdue(2)}
                className="btn"
                style={{
                  background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #3b82f6', color: '#60a5fa',
                  padding: '0.85rem 1rem', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>🌿 하루 2개씩 순차 균등 분배</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '0.2rem' }}>
                    휴가를 제외하고 매일 2개씩 차근차근 배치합니다.
                  </div>
                </div>
                <ArrowRight size={18} />
              </button>

              <button
                onClick={handleMoveOverdueToTodayModal}
                className="btn"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171',
                  padding: '0.85rem 1rem', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>⚡ 오늘 날짜로 모두 당겨오기</div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '0.2rem' }}>
                    {overdueCount}개의 복습을 전부 오늘 하루 일정으로 한꺼번에 이동합니다.
                  </div>
                </div>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
