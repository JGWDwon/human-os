import { useState, useEffect, useMemo } from 'react';
import { BookOpen, Plus, Check, ChevronLeft, ChevronRight, Trash2, Calendar, BrainCircuit, RotateCcw, Palmtree, ArrowRight, Wand2, Settings, CheckCircle2, ChevronDown, ChevronUp, ArrowLeft, X, Sparkles, Flame, Layers } from 'lucide-react';
import { storage, getSubjectColor } from '../utils/storage';
import confetti from 'canvas-confetti';
import SubjectModal from './SubjectModal';

// 1일차, 4일차, 7일차, 14일차, 30일차 복습 주기별 구분 스타일 및 색상 정의
export const getDayOffsetBadgeStyle = (dayOffset) => {
  switch (Number(dayOffset)) {
    case 1:
      return {
        bg: 'rgba(56, 189, 248, 0.16)', // 하늘색
        border: 'rgba(56, 189, 248, 0.45)',
        color: '#38bdf8',
        label: '1일차'
      };
    case 4:
      return {
        bg: 'rgba(168, 85, 247, 0.16)', // 보라색
        border: 'rgba(168, 85, 247, 0.45)',
        color: '#c084fc',
        label: '4일차'
      };
    case 7:
      return {
        bg: 'rgba(52, 211, 153, 0.16)', // 에메랄드/민트
        border: 'rgba(52, 211, 153, 0.45)',
        color: '#34d399',
        label: '7일차'
      };
    case 14:
      return {
        bg: 'rgba(251, 146, 60, 0.16)', // 오렌지
        border: 'rgba(251, 146, 60, 0.45)',
        color: '#fb923c',
        label: '14일차'
      };
    case 30:
      return {
        bg: 'rgba(250, 204, 21, 0.2)', // 골드/황금색
        border: 'rgba(250, 204, 21, 0.5)',
        color: '#facc15',
        label: '30일차'
      };
    default:
      return {
        bg: 'rgba(148, 163, 184, 0.15)',
        border: 'rgba(148, 163, 184, 0.3)',
        color: '#94a3b8',
        label: `${dayOffset}일차`
      };
  }
};

export default function EbbinghausPlanner({ onClose }) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dayOfWeek);
    sunday.setHours(0,0,0,0);
    return sunday;
  });

  const [lectures, setLectures] = useState([]);
  const [newSubject, setNewSubject] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showLectureList, setShowLectureList] = useState(false);
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [registeredSubjects, setRegisteredSubjects] = useState(() => storage.getSubjects());

  const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
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

  // 30일차 복습 평가 모달 및 약점 극복 재복습함 상태
  const [difficultyModalTarget, setDifficultyModalTarget] = useState(null); // { lectureId, reviewId, subject, title }
  const [showReReviewVault, setShowReReviewVault] = useState(true);
  const [reReviewFilter, setReReviewFilter] = useState('pending'); // 'pending' | 'completed' | 'all'

  const refreshData = () => {
    setLectures(storage.getLectures());
    setVacations(storage.getVacations());
  };

  useEffect(() => {
    storage.migrateReviewsToSameDay();
    refreshData();
    window.addEventListener('cloud-sync-needed', refreshData);
    const handleSubs = () => setRegisteredSubjects(storage.getSubjects());
    window.addEventListener('subjects-updated', handleSubs);
    return () => {
      window.removeEventListener('cloud-sync-needed', refreshData);
      window.removeEventListener('subjects-updated', handleSubs);
    };
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
    
    storage.addLecture(newSubject, newTitle, selectedDateForAdd);
    
    setNewSubject('');
    setNewTitle('');
    setSelectedDateForAdd(todayStr);
    setShowAddForm(false);
    refreshData();
    
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#3b82f6', '#8b5cf6']
    });
  };

  const handleToggleReview = (lectureId, reviewId, isCompleted, revDetails = null) => {
    if (isCompleted) {
      storage.undoReview(lectureId, reviewId);
      refreshData();
      return;
    }

    // 30일차 복습(5회독 최종 복습)인지 판별
    let dayOffset = revDetails?.dayOffset;
    let subject = revDetails?.subject;
    let title = revDetails?.title;

    if (dayOffset === undefined) {
      const currentLectures = storage.getLectures();
      const lec = currentLectures.find(l => l.id === lectureId);
      const rev = lec?.reviews.find(r => r.id === reviewId);
      dayOffset = rev?.dayOffset;
      subject = lec?.subject;
      title = lec?.title;
    }

    if (Number(dayOffset) === 30) {
      setDifficultyModalTarget({
        lectureId,
        reviewId,
        subject: subject || '과목',
        title: title || '30일차 복습'
      });
      return;
    }

    storage.completeReview(lectureId, reviewId);
    confetti({
      particleCount: 30,
      spread: 40,
      origin: { y: 0.7 },
      colors: ['#10b981']
    });
    window.dispatchEvent(new CustomEvent('xp-updated'));
    refreshData();
  };

  const handleSelectDifficulty = (difficulty) => {
    if (!difficultyModalTarget) return;
    const { lectureId, reviewId } = difficultyModalTarget;
    
    storage.completeReview(lectureId, reviewId, difficulty);
    window.dispatchEvent(new CustomEvent('xp-updated'));
    
    if (difficulty === 'easy') {
      confetti({
        particleCount: 65,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#10b981', '#3b82f6', '#f59e0b']
      });
    } else {
      setShowReReviewVault(true);
      setReReviewFilter('pending');
      confetti({
        particleCount: 35,
        spread: 50,
        origin: { y: 0.7 },
        colors: ['#f97316', '#ef4444', '#fbbf24']
      });
    }

    setDifficultyModalTarget(null);
    refreshData();
  };

  const handleToggleReReviewStatus = (lectureId, reviewId) => {
    storage.toggleReReviewComplete(lectureId, reviewId);
    refreshData();
  };

  const handleDismissReReview = (lectureId, reviewId) => {
    if (window.confirm("이 항목을 약점 재복습함에서 제거(완전 정복 완료)하시겠습니까?")) {
      storage.removeReReview(lectureId, reviewId);
      refreshData();
    }
  };

  const handleShiftReview = (e, lectureId, reviewId, days) => {
    e.stopPropagation();

    if (days < 0) {
      const currentLectures = storage.getLectures();
      const lec = currentLectures.find(l => l.id === lectureId);
      const rev = lec?.reviews.find(r => r.id === reviewId);
      if (lec && rev && lec.dateAdded && rev.targetDate <= lec.dateAdded) {
        alert("강의 등록일(첫 학습일) 이전으로는 당길 수 없습니다.");
        return;
      }
    }

    storage.postponeReview(lectureId, reviewId, days);
    
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
          const targetWeekStart = new Date(revDate);
          targetWeekStart.setDate(revDate.getDate() - dayOfWeek);
          targetWeekStart.setHours(0, 0, 0, 0);
          setCurrentWeekStart(targetWeekStart);
        }
      }
    }
    refreshData();
  };

  const handleFullResetAll14714 = () => {
    if (window.confirm("모든 강의의 복습 기록(완료 항목 포함)을 초기화하고, 오늘부터 하루 최대 3개씩 14714(5회) 복습 스케줄로 다시 새출발하시겠습니까?\n\n• 완료/미완료된 모든 복습이 초기화됩니다.\n• 1, 4, 7, 14, 30일 간격으로 5회 복습이 재설정됩니다.\n• 하루에 복습이 최대 3개를 넘지 않도록 예쁘게 분배됩니다.")) {
      const count = storage.resetAllLectures14714FromToday(3);
      alert(`🎉 복습 전면 초기화 완료!\n총 ${count}개 강의의 복습 일정이 오늘부터 하루 최대 3개씩 14714 주기로 다시 설정되었습니다! 🔥`);
      setShowManageModal(false);
      refreshData();
    }
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
    alert(`🌴 휴가 모드 적용 완료!\n${vacStartDate} ~ ${vacEndDate} (총 ${result.days}일간)\n\n휴가 기간 및 이후 미완료 복습 ${result.count}개가 정확히 ${result.days}일 뒤로 연기되었습니다! 🎉`);
    setShowVacationModal(false);
    refreshData();
  };

  const handleRevertVacation = (vacationId) => {
    if (window.confirm("이 휴가 일정을 취소하시겠습니까?\n휴가 일정이 삭제되고, 연기되었던 미완료 복습 일정이 원래대로 앞당겨집니다.")) {
      const result = storage.revertVacation(vacationId);
      alert(`↩️ 휴가 취소 완료!\n${result.count}개의 미완료 복습 일정이 ${result.days}일 앞으로 원상복구되었습니다.`);
      refreshData();
    }
  };

  const handleDistributeOverdue = (maxPerDay = 3) => {
    const count = storage.distributeOverdueReviews(maxPerDay);
    alert(`✨ 밀린 복습 재배치 완료!\n총 ${count}개의 밀린 복습이 하루 최대 ${maxPerDay}개씩 균등하게 재배치되었습니다.`);
    setShowOverdueModal(false);
    refreshData();
  };

  const handleSmartRedistribute = (maxPerDay = 3) => {
    const count = storage.smartEbbinghausRedistribute(maxPerDay);
    alert(`✨ 회차 간격 보존 재배치 완료!\n총 ${count}개의 밀린 복습이 오늘부터 하루 최대 ${maxPerDay}개씩 배정되었으며, 이후 회차 간격(+3일, +7일 등)도 100% 보존되었습니다.`);
    setShowOverdueModal(false);
    refreshData();
  };

  const handleMoveOverdueToTodayModal = () => {
    const count = storage.moveAllOverdueToToday();
    alert(`⚡ 완료: 총 ${count}개의 밀린 복습이 오늘(${todayStr})로 이동되었습니다.`);
    setShowOverdueModal(false);
    refreshData();
  };

  const handleDeleteLecture = (lectureId) => {
    if (window.confirm("이 강의와 모든 복습 일정을 삭제하시겠습니까?")) {
      storage.deleteLecture(lectureId);
      refreshData();
      window.dispatchEvent(new CustomEvent('xp-updated'));
    }
  };

  // Today's due reviews
  const todayReviews = useMemo(() => {
    const list = [];
    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        if (rev.targetDate === todayStr) {
          list.push({
            lectureId: lec.id,
            subject: lec.subject,
            title: lec.title,
            ...rev
          });
        }
      });
    });
    return list;
  }, [lectures, todayStr]);

  const todayCompletedCount = todayReviews.filter(r => r.isCompleted).length;
  const overdueCount = lectures.flatMap(l => l.reviews).filter(r => !r.isCompleted && r.targetDate < todayStr).length;

  // 약점 극복 재복습 목록 (30일차 복습에서 '어려움'을 선택한 항목들)
  const reReviewList = useMemo(() => {
    const list = [];
    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        if (rev.needsReReview || (rev.difficulty === 'hard' && rev.reReviewStatus)) {
          list.push({
            lectureId: lec.id,
            subject: lec.subject,
            title: lec.title,
            dateAdded: lec.dateAdded,
            reviewId: rev.id,
            targetDate: rev.targetDate,
            completedAt: rev.completedAt,
            dayOffset: rev.dayOffset,
            difficulty: rev.difficulty,
            needsReReview: rev.needsReReview,
            reReviewStatus: rev.reReviewStatus || 'pending',
            reReviewCompletedAt: rev.reReviewCompletedAt || null,
            hardRecordedAt: rev.hardRecordedAt || rev.completedAt
          });
        }
      });
    });
    return list.sort((a, b) => new Date(b.hardRecordedAt || 0) - new Date(a.hardRecordedAt || 0));
  }, [lectures]);

  const pendingReReviewCount = useMemo(() => {
    return reReviewList.filter(item => item.reReviewStatus !== 'completed').length;
  }, [reReviewList]);

  const filteredReReviews = useMemo(() => {
    if (reReviewFilter === 'pending') {
      return reReviewList.filter(item => item.reReviewStatus !== 'completed');
    }
    if (reReviewFilter === 'completed') {
      return reReviewList.filter(item => item.reReviewStatus === 'completed');
    }
    return reReviewList;
  }, [reReviewList, reReviewFilter]);

  // Generate 7 days of current week
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(currentWeekStart.getDate() + i);
    const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const isToday = dateStr === todayStr;
    
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
            <BrainCircuit size={22} color="#8b5cf6" />
            에빙하우스 복습 플래너
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem', margin: 0 }}>
            1·4·7·14·30일 주기 장기기억 복습 관리
          </p>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn btn-primary"
            style={{ background: '#8b5cf6', borderColor: '#7c3aed', fontSize: '0.82rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            {showAddForm ? '취소' : <><Plus size={15} /> 강의 추가</>}
          </button>

          <button 
            onClick={() => setShowManageModal(true)}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            title="복습 초기화, 휴가 모드, 재배치 관리"
          >
            <Settings size={15} /> 복습 설정
          </button>

          {reReviewList.length > 0 && (
            <button 
              onClick={() => {
                setShowReReviewVault(true);
                document.getElementById('re-review-vault-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="btn btn-secondary"
              style={{
                fontSize: '0.82rem',
                padding: '0.4rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                border: pendingReReviewCount > 0 ? '1px solid rgba(249, 115, 22, 0.6)' : '1px solid rgba(255,255,255,0.12)',
                background: pendingReReviewCount > 0 ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255,255,255,0.04)',
                color: pendingReReviewCount > 0 ? '#fb923c' : 'var(--text-secondary)'
              }}
              title="약점 극복 재복습함 바로가기"
            >
              <Flame size={15} color={pendingReReviewCount > 0 ? '#f97316' : '#94a3b8'} />
              약점 재복습 {pendingReReviewCount > 0 && (
                <span style={{ background: '#f97316', color: '#fff', fontSize: '0.65rem', padding: '0.05rem 0.35rem', borderRadius: '10px', fontWeight: 'bold' }}>
                  {pendingReReviewCount}
                </span>
              )}
            </button>
          )}

          {onClose && (
            <button 
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <ArrowLeft size={15} /> 메인으로
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1순위 핵심: 오늘의 복습 체크리스트 (Today's Review Checklist) */}
      {/* ========================================================================= */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(30, 41, 59, 0.6))',
        border: '1px solid rgba(139, 92, 246, 0.35)',
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={18} color="#a78bfa" />
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>
              오늘의 복습 체크리스트
            </h3>
            <span style={{
              fontSize: '0.72rem',
              background: todayCompletedCount === todayReviews.length && todayReviews.length > 0 ? '#10b981' : '#8b5cf6',
              color: '#fff',
              padding: '0.12rem 0.5rem',
              borderRadius: '10px',
              fontWeight: 'bold'
            }}>
              {todayCompletedCount} / {todayReviews.length} 완료
            </span>
          </div>

          {todayReviews.length > 0 && todayCompletedCount === todayReviews.length && (
            <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 'bold' }}>
              ✨ 오늘 복습 미션 올클리어!
            </span>
          )}

          {overdueCount > 0 && (
            <span 
              onClick={() => setShowOverdueModal(true)}
              style={{ fontSize: '0.75rem', color: '#f87171', background: 'rgba(239,68,68,0.15)', padding: '0.15rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer' }}
            >
              ⚠️ 미뤄진 복습 {overdueCount}개 (재배치하기)
            </span>
          )}
        </div>

        {todayReviews.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.6rem 0', textAlign: 'center' }}>
            🎉 오늘 예정된 복습이 없습니다. 새로운 지식을 집중 사냥해보세요!
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.5rem' }}>
            {todayReviews.map(rev => {
              const badge = getDayOffsetBadgeStyle(rev.dayOffset);
              return (
                <div
                  key={rev.id}
                  onClick={() => handleToggleReview(rev.lectureId, rev.id, rev.isCompleted, rev)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    background: rev.isCompleted ? 'rgba(16, 185, 129, 0.12)' : 'rgba(0, 0, 0, 0.3)',
                    border: `1px solid ${rev.isCompleted ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderLeft: `3px solid ${rev.isCompleted ? '#10b981' : badge.color}`,
                    borderRadius: '8px',
                    padding: '0.55rem 0.8rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '5px',
                      border: `2px solid ${rev.isCompleted ? '#10b981' : 'rgba(255,255,255,0.3)'}`,
                      background: rev.isCompleted ? '#10b981' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {rev.isCompleted && <Check size={13} color="#000" strokeWidth={3} />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      {(() => {
                        const subColor = getSubjectColor(rev.subject, registeredSubjects);
                        return (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.12rem' }}>
                            <span style={{ 
                              fontSize: '0.68rem', 
                              color: subColor, 
                              background: `${subColor}1e`, 
                              border: `1px solid ${subColor}4d`,
                              padding: '0.05rem 0.35rem', 
                              borderRadius: '3px', 
                              fontWeight: 'bold' 
                            }}>
                              {rev.subject}
                            </span>
                            <span style={{ 
                              fontSize: '0.68rem', 
                              color: badge.color, 
                              background: badge.bg, 
                              border: `1px solid ${badge.border}`, 
                              padding: '0.05rem 0.35rem', 
                              borderRadius: '3px', 
                              fontWeight: 'bold',
                              letterSpacing: '-0.2px'
                            }}>
                              {badge.label}
                            </span>
                            {rev.isCompleted && rev.difficulty === 'easy' && (
                              <span style={{ fontSize: '0.65rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.2)', padding: '0.05rem 0.3rem', borderRadius: '3px', fontWeight: 'bold' }}>
                                😊 마스터
                              </span>
                            )}
                            {rev.isCompleted && rev.difficulty === 'hard' && (
                              <span style={{ fontSize: '0.65rem', color: '#fb923c', background: 'rgba(249, 115, 22, 0.2)', padding: '0.05rem 0.3rem', borderRadius: '3px', fontWeight: 'bold' }}>
                                🔥 약점
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        color: rev.isCompleted ? 'var(--text-muted)' : '#fff',
                        textDecoration: rev.isCompleted ? 'line-through' : 'none',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {rev.title}
                      </div>
                    </div>
                  </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                  {!rev.isCompleted && (
                    <>
                      <button
                        onClick={(e) => handleShiftReview(e, rev.lectureId, rev.id, -1)}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: 'var(--text-muted)',
                          fontSize: '0.68rem',
                          padding: '0.15rem 0.35rem',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                        title="어제로 당기기 (-1일)"
                      >
                        -1일
                      </button>
                      <button
                        onClick={(e) => handleShiftReview(e, rev.lectureId, rev.id, 1)}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: 'var(--text-muted)',
                          fontSize: '0.68rem',
                          padding: '0.15rem 0.35rem',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                        title="내일로 미루기 (+1일)"
                      >
                        +1일
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 🔥 약점 극복 재복습함 (Re-Review Weakness Vault) */}
      {/* ========================================================================= */}
      <div 
        id="re-review-vault-section"
        style={{
          background: 'var(--panel-bg)',
          border: pendingReReviewCount > 0 ? '1px solid rgba(249, 115, 22, 0.4)' : '1px solid var(--panel-border)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1.25rem',
          transition: 'border 0.2s'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div 
            onClick={() => setShowReReviewVault(prev => !prev)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{
              width: '26px', height: '26px', borderRadius: '6px',
              background: 'rgba(249, 115, 22, 0.2)',
              border: '1px solid rgba(249, 115, 22, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Flame size={15} color="#f97316" />
            </div>
            <div>
              <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#f8fafc' }}>
                약점 극복 재복습함
              </span>
              <span style={{
                marginLeft: '0.5rem',
                fontSize: '0.72rem',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                background: pendingReReviewCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                border: `1px solid ${pendingReReviewCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                color: pendingReReviewCount > 0 ? '#f87171' : '#34d399',
                fontWeight: 'bold'
              }}>
                {pendingReReviewCount > 0 ? `${pendingReReviewCount}개 재복습 대기` : (reReviewList.length > 0 ? '모두 완료됨' : '대기 없음')}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {reReviewList.length > 0 && showReReviewVault && (
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '0.15rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  type="button"
                  onClick={() => setReReviewFilter('pending')}
                  style={{
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.7rem',
                    borderRadius: '4px',
                    border: 'none',
                    background: reReviewFilter === 'pending' ? 'rgba(249, 115, 22, 0.3)' : 'transparent',
                    color: reReviewFilter === 'pending' ? '#fb923c' : 'var(--text-muted)',
                    fontWeight: reReviewFilter === 'pending' ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  대기 ({reReviewList.filter(i => i.reReviewStatus !== 'completed').length})
                </button>
                <button
                  type="button"
                  onClick={() => setReReviewFilter('completed')}
                  style={{
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.7rem',
                    borderRadius: '4px',
                    border: 'none',
                    background: reReviewFilter === 'completed' ? 'rgba(16, 185, 129, 0.3)' : 'transparent',
                    color: reReviewFilter === 'completed' ? '#34d399' : 'var(--text-muted)',
                    fontWeight: reReviewFilter === 'completed' ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  완료 ({reReviewList.filter(i => i.reReviewStatus === 'completed').length})
                </button>
                <button
                  type="button"
                  onClick={() => setReReviewFilter('all')}
                  style={{
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.7rem',
                    borderRadius: '4px',
                    border: 'none',
                    background: reReviewFilter === 'all' ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                    color: reReviewFilter === 'all' ? '#fff' : 'var(--text-muted)',
                    fontWeight: reReviewFilter === 'all' ? 'bold' : 'normal',
                    cursor: 'pointer'
                  }}
                >
                  전체 ({reReviewList.length})
                </button>
              </div>
            )}
            <button
              onClick={() => setShowReReviewVault(prev => !prev)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
              title={showReReviewVault ? '접기' : '펼치기'}
            >
              {showReReviewVault ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {showReReviewVault && (
          <div style={{ marginTop: '0.85rem' }}>
            {reReviewList.length === 0 ? (
              <div style={{
                padding: '0.9rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.82rem',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px'
              }}>
                🌱 아직 약점 보관함에 등록된 항목이 없습니다.<br />
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  (30일차 5회독 복습 완료 시 <b>'어려움'</b>을 선택하면 이곳에 자동으로 모여 언제든 집중 재학습할 수 있습니다)
                </span>
              </div>
            ) : filteredReReviews.length === 0 ? (
              <div style={{
                padding: '0.75rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                background: 'rgba(0,0,0,0.15)',
                borderRadius: '8px'
              }}>
                선택한 필터 조건에 해당하는 항목이 없습니다.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem' }}>
                {filteredReReviews.map(item => {
                  const isDone = item.reReviewStatus === 'completed';
                  return (
                    <div
                      key={item.reviewId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        background: isDone ? 'rgba(16, 185, 129, 0.08)' : 'rgba(249, 115, 22, 0.08)',
                        border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.3)' : 'rgba(249, 115, 22, 0.35)'}`,
                        borderRadius: '8px',
                        padding: '0.65rem 0.85rem'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                          {(() => {
                            const subColor = getSubjectColor(item.subject, registeredSubjects);
                            return (
                              <span style={{
                                fontSize: '0.68rem',
                                color: subColor,
                                background: `${subColor}1e`,
                                border: `1px solid ${subColor}4d`,
                                padding: '0.05rem 0.35rem',
                                borderRadius: '3px',
                                fontWeight: 'bold'
                              }}>
                                {item.subject}
                              </span>
                            );
                          })()}
                          <span style={{
                            fontSize: '0.66rem',
                            color: isDone ? '#34d399' : '#fb923c',
                            background: isDone ? 'rgba(16, 185, 129, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                            padding: '0.05rem 0.35rem',
                            borderRadius: '3px',
                            fontWeight: 'bold'
                          }}>
                            {isDone ? '✓ 재복습 완료' : '🚨 재복습 필요'}
                          </span>
                        </div>
                        <div style={{
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          color: isDone ? 'var(--text-muted)' : '#f8fafc',
                          textDecoration: isDone ? 'line-through' : 'none',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {item.title}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => handleToggleReReviewStatus(item.lectureId, item.reviewId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.72rem',
                            fontWeight: 'bold',
                            padding: '0.25rem 0.55rem',
                            borderRadius: '5px',
                            border: `1px solid ${isDone ? 'rgba(16, 185, 129, 0.4)' : 'rgba(249, 115, 22, 0.5)'}`,
                            background: isDone ? 'rgba(16, 185, 129, 0.2)' : 'rgba(249, 115, 22, 0.2)',
                            color: isDone ? '#34d399' : '#fb923c',
                            cursor: 'pointer'
                          }}
                          title={isDone ? '다시 미완료로 변경' : '재복습 완료 체크'}
                        >
                          <Check size={12} strokeWidth={2.5} />
                          {isDone ? '완료됨' : '재복습 완료'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismissReReview(item.lectureId, item.reviewId)}
                          style={{
                            padding: '0.25rem 0.35rem',
                            borderRadius: '5px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.04)',
                            color: 'var(--text-muted)',
                            cursor: 'pointer'
                          }}
                          title="약점 보관함에서 삭제"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Form (Collapsible) */}
      {showAddForm && (
        <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '1.25rem', borderRadius: '10px', marginBottom: '1.5rem', animation: 'fadeIn 0.2s ease' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: '#a78bfa', margin: '0 0 0.75rem 0' }}>배운 내용 기록 및 14714 스케줄 생성</h3>
          <form onSubmit={handleAddLecture} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 140px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#a78bfa', marginBottom: '0.2rem' }}>학습 날짜</label>
              <input 
                type="date" 
                value={selectedDateForAdd}
                onChange={(e) => setSelectedDateForAdd(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }}
              />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                <label style={{ fontSize: '0.72rem', color: '#a78bfa' }}>과목 (선택 또는 입력)</label>
                <button
                  type="button"
                  onClick={() => setShowSubjectModal(true)}
                  style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.7rem', cursor: 'pointer', padding: 0 }}
                >
                  + 과목 관리
                </button>
              </div>
              {registeredSubjects.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.35rem' }}>
                  {registeredSubjects.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNewSubject(s)}
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '8px',
                        border: newSubject === s ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
                        background: newSubject === s ? 'rgba(167, 139, 250, 0.25)' : 'rgba(255,255,255,0.04)',
                        color: newSubject === s ? '#c4b5fd' : '#94a3b8',
                        fontSize: '0.73rem',
                        fontWeight: newSubject === s ? 'bold' : 'normal',
                        cursor: 'pointer'
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <input 
                type="text" 
                placeholder="직접 입력 또는 위 과목 클릭" 
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }}
              />
            </div>
            <div style={{ flex: '2 1 200px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#a78bfa', marginBottom: '0.2rem' }}>강의 / 단원 제목</label>
              <input 
                type="text" 
                placeholder="예: 1강~3강 기본이론 및 문제풀이" 
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ background: '#8b5cf6', borderColor: '#7c3aed', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              스케줄 생성
            </button>
          </form>
        </div>
      )}

      {/* Weekly Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.75rem', borderRadius: '8px' }}>
        <button onClick={handlePrevWeek} className="btn btn-secondary" style={{ padding: '0.35rem' }}>
          <ChevronLeft size={18} />
        </button>
        <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Calendar size={16} color="#a78bfa" />
          {currentWeekStart.getMonth() + 1}월 {currentWeekStart.getDate()}일 ~ 
          {(() => {
            const end = new Date(currentWeekStart);
            end.setDate(end.getDate() + 6);
            return ` ${end.getMonth() + 1}월 ${end.getDate()}일`;
          })()}
        </div>
        <button onClick={handleNextWeek} className="btn btn-secondary" style={{ padding: '0.35rem' }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Ebbinghaus Cycle Badges & Subject Legend */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.6rem', 
        marginBottom: '0.75rem',
        padding: '0.4rem 0.75rem',
        background: 'rgba(0,0,0,0.25)',
        borderRadius: '7px',
        border: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 'bold' }}>
            복습 주기:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            {[1, 4, 7, 14, 30].map(offset => {
              const b = getDayOffsetBadgeStyle(offset);
              return (
                <span key={offset} style={{
                  fontSize: '0.66rem',
                  padding: '0.06rem 0.35rem',
                  borderRadius: '3px',
                  background: b.bg,
                  border: `1px solid ${b.border}`,
                  color: b.color,
                  fontWeight: 'bold'
                }}>
                  {b.label}
                </span>
              );
            })}
          </div>
        </div>

        {registeredSubjects.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 'bold' }}>
              과목 색상:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
              {registeredSubjects.map(s => {
                const col = getSubjectColor(s, registeredSubjects);
                return (
                  <span key={s} style={{
                    fontSize: '0.66rem',
                    padding: '0.06rem 0.35rem',
                    borderRadius: '3px',
                    background: `${col}1e`,
                    border: `1px solid ${col}4d`,
                    color: col,
                    fontWeight: 'bold'
                  }}>
                    {s}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Weekly Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.6rem', flex: 1, marginBottom: '1.5rem' }}>
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
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '220px'
            }}
          >
            {/* Day Header */}
            <div style={{ 
              padding: '0.5rem 0.65rem', 
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              background: day.isVacation
                ? 'rgba(16, 185, 129, 0.22)' 
                : (day.isToday ? 'rgba(139, 92, 246, 0.2)' : 'transparent'),
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: day.isVacation ? '#34d399' : (day.isToday ? '#a78bfa' : 'var(--text-secondary)') }}>
                  {day.dayName}
                </span>
                {day.isVacation && (
                  <span style={{ fontSize: '0.6rem', background: 'rgba(16, 185, 129, 0.4)', color: '#fff', padding: '0.05rem 0.3rem', borderRadius: '3px' }}>
                    🌴
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', color: day.isVacation ? '#34d399' : 'var(--text-muted)' }}>
                {day.date.getDate()}일
              </span>
            </div>
            
            {/* Reviews List */}
            <div style={{ padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, overflowY: 'auto' }}>
              {day.reviews.length === 0 ? (
                <div style={{ color: day.isVacation ? '#34d399' : 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', marginTop: '1rem', opacity: 0.6 }}>
                  {day.isVacation ? '🌴 휴가' : '-'}
                </div>
              ) : (
                day.reviews.map(rev => {
                  const badge = getDayOffsetBadgeStyle(rev.dayOffset);
                  const subColor = getSubjectColor(rev.subject, registeredSubjects);
                  return (
                    <div 
                      key={rev.id}
                      style={{ 
                        background: rev.isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(30, 41, 59, 0.8)',
                        border: `1px solid ${rev.isCompleted ? 'rgba(16, 185, 129, 0.3)' : 'var(--panel-border)'}`,
                        borderLeft: `3px solid ${rev.isCompleted ? '#10b981' : badge.color}`,
                        padding: '0.4rem 0.5rem',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        opacity: (day.dateStr < todayStr && !rev.isCompleted) ? 0.7 : 1
                      }}
                      onClick={() => handleToggleReview(rev.lectureId, rev.id, rev.isCompleted, rev)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
                        <span style={{ 
                          fontSize: '0.65rem', 
                          padding: '0.05rem 0.3rem', 
                          borderRadius: '3px',
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.color,
                          fontWeight: 'bold'
                        }}>
                          {badge.label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        {!rev.isCompleted && (
                          <>
                            <button
                              onClick={(e) => handleShiftReview(e, rev.lectureId, rev.id, -1)}
                              style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: 'none',
                                color: '#cbd5e1',
                                fontSize: '0.6rem',
                                padding: '0.05rem 0.25rem',
                                borderRadius: '2px',
                                cursor: 'pointer'
                              }}
                              title="-1일 당기기"
                            >
                              -1
                            </button>
                            <button
                              onClick={(e) => handleShiftReview(e, rev.lectureId, rev.id, 1)}
                              style={{
                                background: 'rgba(255,255,255,0.08)',
                                border: 'none',
                                color: '#cbd5e1',
                                fontSize: '0.6rem',
                                padding: '0.05rem 0.25rem',
                                borderRadius: '2px',
                                cursor: 'pointer'
                              }}
                              title="+1일 미루기"
                            >
                              +1
                            </button>
                          </>
                        )}
                        {rev.isCompleted && rev.difficulty === 'easy' && (
                          <span style={{ fontSize: '0.62rem' }} title="완벽 마스터">
                            😊
                          </span>
                        )}
                        {rev.isCompleted && rev.difficulty === 'hard' && (
                          <span style={{ fontSize: '0.62rem' }} title="약점 재복습 대상">
                            🔥
                          </span>
                        )}
                        {rev.isCompleted && <Check size={12} color="#10b981" />}
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '0.14rem' }}>
                      <span style={{ 
                        fontSize: '0.67rem', 
                        fontWeight: 'bold', 
                        color: subColor,
                        background: `${subColor}1e`,
                        border: `1px solid ${subColor}4d`,
                        padding: '0.04rem 0.35rem',
                        borderRadius: '3px',
                        display: 'inline-block',
                        lineHeight: 1.25,
                        letterSpacing: '-0.2px'
                      }}>
                        {rev.subject}
                      </span>
                    </div>
                    <div style={{ 
                      fontSize: '0.78rem', 
                      color: rev.isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: rev.isCompleted ? 'line-through' : 'none',
                      lineHeight: 1.25,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {rev.title}
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </div>
        ))}
      </div>

      {/* Collapsible Registered Lecture Tracks Management */}
      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <button
          onClick={() => setShowLectureList(!showLectureList)}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            padding: '0.75rem 1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            color: 'var(--text-primary)'
          }}
        >
          <span style={{ fontSize: '0.88rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BookOpen size={16} color="#8b5cf6" /> 등록된 전체 강의 트랙 관리 ({lectures.length}개)
          </span>
          {showLectureList ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showLectureList && (
          <div style={{ padding: '0 1rem 1rem 1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {lectures.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.75rem 0 0 0' }}>아직 등록된 강의가 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
                {lectures.map(lec => {
                  const completedCount = lec.reviews.filter(r => r.isCompleted).length;
                  const isAllDone = completedCount === 5;
                  
                  return (
                    <div key={lec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.85rem', borderRadius: '6px' }}>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 'bold', color: isAllDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isAllDone ? 'line-through' : 'none' }}>
                          [{lec.subject}] {lec.title}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          시작일: {lec.dateAdded} | 복습 진행률: {completedCount}/5
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                          {lec.reviews.map(rev => {
                            const badge = getDayOffsetBadgeStyle(rev.dayOffset);
                            return (
                              <span 
                                key={rev.id}
                                style={{
                                  fontSize: '0.64rem',
                                  padding: '0.06rem 0.35rem',
                                  borderRadius: '3px',
                                  background: rev.isCompleted ? 'rgba(16, 185, 129, 0.15)' : badge.bg,
                                  border: `1px solid ${rev.isCompleted ? 'rgba(16, 185, 129, 0.4)' : badge.border}`,
                                  color: rev.isCompleted ? '#34d399' : badge.color,
                                  fontWeight: rev.isCompleted ? 'normal' : 'bold',
                                  opacity: rev.isCompleted ? 0.75 : 1
                                }}
                                title={`${badge.label}: ${rev.targetDate} (${rev.isCompleted ? '완료' : '미완료'})`}
                              >
                                {badge.label} {rev.isCompleted ? '✓' : ''}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteLecture(lec.id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}
                        title="강의 및 복습 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Curriculum Modal Removed */}






      {/* ========================================================================= */}
      {/* 복습 관리 통합 설정 모달 (ShowManageModal) */}
      {/* ========================================================================= */}
      {showManageModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '460px', width: '100%', background: '#0f172a', border: '1px solid #8b5cf6',
            borderRadius: '16px', padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Settings size={20} /> 에빙하우스 복습 일정 설정
              </h3>
              <button onClick={() => setShowManageModal(false)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>


              {/* Option 1: 14714 새출발 */}
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontWeight: 'bold', color: '#f87171', fontSize: '0.92rem', marginBottom: '0.25rem' }}>
                  🔥 복습 전면 초기화 & 14714 새출발
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0', lineHeight: 1.4 }}>
                  완료된 복습까지 모두 초기화하고, 오늘부터 하루 최대 3개씩 14714(5회) 주기로 쾌적하게 다시 시작합니다.
                </p>
                <button
                  onClick={handleFullResetAll14714}
                  className="btn btn-primary"
                  style={{ width: '100%', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', border: 'none', padding: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                >
                  <RotateCcw size={15} /> 지금 초기화하고 14714 새출발
                </button>
              </div>

              {/* Option 2: 휴가 모드 */}
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontWeight: 'bold', color: '#34d399', fontSize: '0.92rem', marginBottom: '0.25rem' }}>
                  🌴 여행/휴가 모드 관리
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0', lineHeight: 1.4 }}>
                  여행 또는 휴가 기간을 설정하여, 그 기간의 복습 일정을 자동으로 뒤로 연기합니다.
                </p>
                <button
                  onClick={() => { setShowManageModal(false); setShowVacationModal(true); }}
                  className="btn btn-secondary"
                  style={{ width: '100%', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399', padding: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                >
                  <Palmtree size={15} /> 여행/휴가 기간 설정 열기
                </button>
              </div>

              {/* Option 3: 밀린 복습 스마트 재배치 */}
              <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontWeight: 'bold', color: '#c084fc', fontSize: '0.92rem', marginBottom: '0.25rem' }}>
                  ⚡ 밀린 복습 스마트 분배
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0', lineHeight: 1.4 }}>
                  현재 {overdueCount}개의 밀린 복습이 있습니다. 하루에 감당 가능한 만큼 균등하게 재배치합니다.
                </p>
                <button
                  onClick={() => { setShowManageModal(false); setShowOverdueModal(true); }}
                  className="btn btn-secondary"
                  style={{ width: '100%', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid #8b5cf6', color: '#c084fc', padding: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                >
                  <Wand2 size={15} /> 밀린 복습 분배 마법사 열기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vacation Mode Modal */}
      {showVacationModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '480px', width: '100%', background: '#0f172a', border: '1px solid #10b981',
            borderRadius: '16px', padding: '1.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Palmtree size={20} /> 여행/휴가 모드 설정
              </h3>
              <button onClick={() => setShowVacationModal(false)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleApplyVacation} style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>시작일</label>
                  <input 
                    type="date" 
                    value={vacStartDate} 
                    onChange={(e) => setVacStartDate(e.target.value)} 
                    required 
                    style={{ width: '100%', padding: '0.45rem', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }} 
                  />
                </div>
                <div style={{ flex: 1, minWidth: '120px' }}>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>종료일</label>
                  <input 
                    type="date" 
                    value={vacEndDate} 
                    onChange={(e) => setVacEndDate(e.target.value)} 
                    required 
                    style={{ width: '100%', padding: '0.45rem', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }} 
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.55rem', background: '#10b981', border: 'none', color: '#000', fontWeight: 'bold', fontSize: '0.85rem' }}>
                🌴 휴가 일정 등록 및 자동 연기
              </button>
            </form>

            {/* Existing Vacations */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.88rem', color: '#fff', margin: 0 }}>등록된 휴가 내역</h4>
                {vacations.some(v => v.endDate < todayStr) && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    (지난 휴가 {vacations.filter(v => v.endDate < todayStr).length}건 숨김)
                  </span>
                )}
              </div>
              {(() => {
                const activeVacations = vacations.filter(v => v.endDate >= todayStr);
                if (activeVacations.length === 0) {
                  return (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0, padding: '0.5rem 0' }}>
                      현재 진행 중이거나 예정된 휴가가 없습니다.
                    </p>
                  );
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {activeVacations.map(v => (
                      <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 'bold' }}>
                          {v.startDate} ~ {v.endDate} ({v.days}일간)
                          {v.startDate <= todayStr && v.endDate >= todayStr && (
                            <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.2)', padding: '0.1rem 0.35rem', borderRadius: '4px', marginLeft: '0.4rem' }}>
                              진행 중 🌴
                            </span>
                          )}
                        </span>
                        <button 
                          onClick={() => handleRevertVacation(v.id)}
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', color: '#ef4444' }}
                        >
                          취소(원복)
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Overdue Redistribute Modal */}
      {showOverdueModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '460px', width: '100%', background: '#0f172a', border: '1px solid #8b5cf6',
            borderRadius: '16px', padding: '1.5rem', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Wand2 size={20} /> 밀린 복습({overdueCount}개) 분배
              </h3>
              <button onClick={() => setShowOverdueModal(false)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <button
                onClick={() => handleSmartRedistribute(3)}
                className="btn"
                style={{
                  background: 'rgba(139, 92, 246, 0.2)', border: '1px solid #8b5cf6', color: '#c084fc',
                  padding: '0.75rem 0.9rem', borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>✨ 하루 최대 3개씩 (회차 간격 보존 추천)</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.15rem' }}>
                    오늘부터 최대 3개씩 배정하고 이후 14714 간격을 100% 보존합니다.
                  </div>
                </div>
                <ArrowRight size={16} />
              </button>

              <button
                onClick={() => handleDistributeOverdue(2)}
                className="btn"
                style={{
                  background: 'rgba(59, 130, 246, 0.15)', border: '1px solid #3b82f6', color: '#60a5fa',
                  padding: '0.75rem 0.9rem', borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>🌿 하루 2개씩 순차 균등 분배</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.15rem' }}>
                    부담 없이 매일 2개씩 나누어 배치합니다.
                  </div>
                </div>
                <ArrowRight size={16} />
              </button>

              <button
                onClick={handleMoveOverdueToTodayModal}
                className="btn"
                style={{
                  background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171',
                  padding: '0.75rem 0.9rem', borderRadius: '8px', textAlign: 'left', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>⚡ 오늘 날짜로 모두 당겨오기</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.15rem' }}>
                    {overdueCount}개의 밀린 복습을 전부 오늘 일정으로 이동합니다.
                  </div>
                </div>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 30일차(5회독) 복습 완료 난이도 진단 모달 */}
      {difficultyModalTarget && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '480px', width: '100%', background: '#0f172a', border: '1px solid #f59e0b',
            borderRadius: '16px', padding: '1.75rem', boxShadow: '0 15px 40px rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column', gap: '1.15rem'
          }}>
            {/* Header */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 'bold',
                  padding: '0.15rem 0.55rem',
                  borderRadius: '20px',
                  background: 'rgba(250, 204, 21, 0.2)',
                  border: '1px solid rgba(250, 204, 21, 0.5)',
                  color: '#facc15',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <Sparkles size={13} /> 30일차 (5회독) 최종 완주!
                </span>
                <button
                  onClick={() => setDifficultyModalTarget(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                  title="닫기"
                >
                  <X size={18} />
                </button>
              </div>
              <h3 style={{ margin: '0.2rem 0', fontSize: '1.15rem', color: '#fff', fontWeight: 'bold' }}>
                복습 이해도 진단
              </h3>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                5회독 복습을 마친 이번 분량의 이해도는 어떠셨나요?<br />
                선택 결과에 따라 완벽 마스터 처리되거나 약점 보관함에 보관됩니다.
              </p>
            </div>

            {/* Target lecture card */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '0.85rem 1rem'
            }}>
              <div style={{ fontSize: '0.75rem', color: '#93c5fd', fontWeight: 'bold', marginBottom: '0.2rem' }}>
                [{difficultyModalTarget.subject}]
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#f8fafc' }}>
                {difficultyModalTarget.title}
              </div>
            </div>

            {/* Assessment Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Option 1: Easy / Mastered */}
              <button
                type="button"
                onClick={() => handleSelectDifficulty('easy')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '2px solid rgba(16, 185, 129, 0.5)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  color: '#fff'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.22)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)'}
              >
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.25)',
                  border: '1px solid #10b981',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem', flexShrink: 0
                }}>
                  😊
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    쉬움 · 완벽 이해 (최종 마스터)
                    <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.3)', padding: '0.1rem 0.4rem', borderRadius: '4px', color: '#6ee7b7' }}>+15 XP</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem', lineHeight: '1.35' }}>
                    내용이 머릿속에 확실히 정착되었습니다. 5회독을 완벽히 졸업합니다.
                  </div>
                </div>
              </button>

              {/* Option 2: Hard / Needs Re-review */}
              <button
                type="button"
                onClick={() => handleSelectDifficulty('hard')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  background: 'rgba(249, 115, 22, 0.12)',
                  border: '2px solid rgba(249, 115, 22, 0.55)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  color: '#fff'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(249, 115, 22, 0.22)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(249, 115, 22, 0.12)'}
              >
                <div style={{
                  width: '42px', height: '42px', borderRadius: '50%',
                  background: 'rgba(249, 115, 22, 0.25)',
                  border: '1px solid #f97316',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem', flexShrink: 0
                }}>
                  🤔
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fb923c', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    어려움 · 재복습 필요 (약점 보관함 등록)
                    <span style={{ fontSize: '0.68rem', background: 'rgba(249, 115, 22, 0.3)', padding: '0.1rem 0.4rem', borderRadius: '4px', color: '#fdba74' }}>+15 XP</span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.15rem', lineHeight: '1.35' }}>
                    아직 헷갈리거나 암기가 덜 되었습니다. '약점 극복 재복습함'에 보관하여 반복 점검합니다.
                  </div>
                </div>
              </button>
            </div>

            {/* Cancel Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.2rem' }}>
              <button
                type="button"
                onClick={() => setDifficultyModalTarget(null)}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
              >
                취소 (완료하지 않음)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subject Management Modal */}
      <SubjectModal isOpen={showSubjectModal} onClose={() => setShowSubjectModal(false)} />
    </div>
  );
}
