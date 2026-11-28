import { useState, useEffect, useMemo } from 'react';
import { BookOpen, Plus, Check, ChevronLeft, ChevronRight, Trash2, Calendar, BrainCircuit, RotateCcw, Palmtree, ArrowRight, Wand2, Settings, CheckCircle2, ChevronDown, ChevronUp, ArrowLeft, X, Sparkles, Flame, Layers } from 'lucide-react';
import { storage, getSubjectColor, EBBINGHAUS_14_SCORES } from '../utils/storage';
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

// 같은 강의(lecture)에서 현재 회차의 직전 회차가 스킵(isSkipped === true)되었는지 판별
const isPrevReviewSkipped = (lec, currentDayOffset) => {
  if (!lec || !Array.isArray(lec.reviews)) return false;
  const sorted = [...lec.reviews].sort((a, b) => Number(a.dayOffset) - Number(b.dayOffset));
  const idx = sorted.findIndex(r => Number(r.dayOffset) === Number(currentDayOffset));
  if (idx <= 0) return false;
  return Boolean(sorted[idx - 1].isSkipped);
};

// 1471430 복습 우선순위 자동 정렬 비교 함수
// 1순위(상단 고정): dayOffset === 1 (1원칙: 당일 복습)
// 2순위: 직전 복습 회차가 스킵(X) 처리된 강의의 다음 회차 (2원칙 최우선 방어)
// 3순위: 나머지 2원칙 복습을 dayOffset 오름차순(4 → 7 → 14 → 30)으로 정렬
const compareReviewsByPriority = (a, b) => {
  const aIsFirst = Number(a.dayOffset) === 1;
  const bIsFirst = Number(b.dayOffset) === 1;
  if (aIsFirst !== bIsFirst) return aIsFirst ? -1 : 1;

  const aPrevSkipped = Boolean(a.isPrevSkipped);
  const bPrevSkipped = Boolean(b.isPrevSkipped);
  if (aPrevSkipped !== bPrevSkipped) return aPrevSkipped ? -1 : 1;

  return (Number(a.dayOffset) || 0) - (Number(b.dayOffset) || 0);
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
  const earliestVacDate = storage.getEarliestVacationDate();
  const [vacStartDate, setVacStartDate] = useState(earliestVacDate);
  const [vacEndDate, setVacEndDate] = useState(earliestVacDate);
  const [vacReason, setVacReason] = useState('');
  const [vacations, setVacations] = useState([]);

  // 14일차 100점 만점 자동 채점 결과 모달 상태
  const [score14ModalTarget, setScore14ModalTarget] = useState(null);

  // 복습 카드 클릭 시 상/중/하 성취도 선택 알림박스 모달 상태
  const [achievementModalTarget, setAchievementModalTarget] = useState(null);

  // 2원칙(4·7·14·30일차) X(스킵) 확인 모달 상태
  const [skipModalTarget, setSkipModalTarget] = useState(null);
  const [skipMarkedOnly, setSkipMarkedOnly] = useState(false);

  // 복습 플래너 보기 방식 (과목별 모아보기 vs 일차별 순) 및 과목 필터링
  const [reviewViewMode, setReviewViewMode] = useState('subject'); // 'subject' (과목별 모아보기) | 'cycle' (일차별 순)
  const [subjectFilter, setSubjectFilter] = useState('all'); // 'all' | 과목명

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

  const handleToggleReview = (lectureId, reviewId, isCompleted, achievement = 'mid') => {
    if (isCompleted) {
      storage.undoReview(lectureId, reviewId);
      window.dispatchEvent(new CustomEvent('xp-updated'));
      refreshData();
      return;
    }

    const { score14Result } = storage.completeReview(lectureId, reviewId, achievement);
    
    // 14일차 판정이 새로 발생한 경우 모달 팝업 표시
    if (score14Result) {
      setScore14ModalTarget(score14Result);
      if (score14Result.score14 >= 80) {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#10b981', '#3b82f6', '#facc15']
        });
      } else {
        confetti({
          particleCount: 45,
          spread: 55,
          origin: { y: 0.6 },
          colors: ['#f97316', '#ef4444', '#fbbf24']
        });
      }
    } else {
      confetti({
        particleCount: 30,
        spread: 40,
        origin: { y: 0.7 },
        colors: achievement === 'high' ? ['#10b981', '#34d399'] : (achievement === 'low' ? ['#f87171', '#ef4444'] : ['#60a5fa', '#3b82f6'])
      });
    }

    window.dispatchEvent(new CustomEvent('xp-updated'));
    refreshData();
  };

  // 2원칙(4·7·14·30일차) X(스킵) 요청 핸들러 (연속 2회 스킵 방지 안전장치 포함)
  const handleRequestSkipReview = (e, rev) => {
    if (e) e.stopPropagation();
    if (Number(rev.dayOffset) === 1) return; // 1원칙은 스킵 불가

    if (rev.isPrevSkipped) {
      const confirmed = window.confirm(
        '직전 회차를 건너뛰었습니다. 연속 스킵은 권장하지 않습니다. 정말 넘기시겠습니까?'
      );
      if (!confirmed) return;
    }

    setSkipMarkedOnly(false);
    setSkipModalTarget(rev);
  };

  const handleConfirmSkipReview = () => {
    if (!skipModalTarget) return;
    const { score14Result } = storage.skipReview(skipModalTarget.lectureId, skipModalTarget.id, skipMarkedOnly);
    setSkipModalTarget(null);
    setSkipMarkedOnly(false);
    if (score14Result) {
      setScore14ModalTarget(score14Result);
    }
    refreshData();
  };

  const handleUnskipReview = (e, lectureId, reviewId) => {
    if (e) e.stopPropagation();
    storage.unskipReview(lectureId, reviewId);
    refreshData();
  };

  const handleSelectAchievement = (lectureId, reviewId, achievement) => {
    const { score14Result } = storage.setReviewAchievement(lectureId, reviewId, achievement);
    if (score14Result) {
      setScore14ModalTarget(score14Result);
    }
    refreshData();
  };

  // 성취도 알림박스(모달)에서 상/중/하 클릭 시 완료 및 점수 반영
  const handleSelectReviewAchievement = (target, chosenAchievement) => {
    if (!target) return;
    const reviewId = target.reviewId || target.id;
    const lectureId = target.lectureId;
    setAchievementModalTarget(null);

    const targetLec = lectures.find(l => l.id === lectureId);
    const targetRev = targetLec?.reviews.find(r => r.id === reviewId);
    const isCompleted = targetRev ? targetRev.isCompleted : target.isCompleted;

    if (isCompleted) {
      // 이미 완료된 회차의 성취도 수정
      const { score14Result } = storage.setReviewAchievement(lectureId, reviewId, chosenAchievement);
      if (score14Result) {
        setScore14ModalTarget(score14Result);
        if (score14Result.score14 >= 80) {
          confetti({
            particleCount: 80,
            spread: 80,
            origin: { y: 0.5 },
            colors: ['#10b981', '#3b82f6', '#facc15']
          });
        }
      } else {
        confetti({
          particleCount: 30,
          spread: 40,
          origin: { y: 0.7 },
          colors: chosenAchievement === 'high' ? ['#10b981', '#34d399'] : (chosenAchievement === 'low' ? ['#f87171', '#ef4444'] : ['#60a5fa', '#3b82f6'])
        });
      }
      refreshData();
    } else {
      // 신규 완료 처리
      handleToggleReview(lectureId, reviewId, false, chosenAchievement);
    }
  };

  // 성취도 알림박스에서 완료 취소(미완료 복구)
  const handleUndoReviewFromModal = (target) => {
    if (!target) return;
    const reviewId = target.reviewId || target.id;
    const lectureId = target.lectureId;
    setAchievementModalTarget(null);
    handleToggleReview(lectureId, reviewId, true);
  };

  const handleRegisterReReview = (lectureId) => {
    const newLec = storage.registerReReviewLecture(lectureId);
    if (newLec) {
      confetti({
        particleCount: 65,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f97316', '#fbbf24', '#10b981']
      });
      alert(`🎉 "${newLec.title}" 항목이 오늘부터 새로운 1-4-7-14-30 복습 스케줄로 자동 등록되었습니다!`);
      setScore14ModalTarget(null);
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

    const check = storage.canRegisterVacation(vacStartDate, vacEndDate);
    if (!check.allowed) {
      alert(`⚠️ 휴가 등록 불가:\n${check.reason}`);
      return;
    }

    const result = storage.addVacation(vacStartDate, vacEndDate, vacReason);
    if (!result.success) {
      alert(`⚠️ 휴가 등록 실패:\n${result.reason}`);
      return;
    }

    const reasonMsg = vacReason.trim() ? `\n사유: ${vacReason.trim()}` : '';
    alert(`🌴 휴가 모드 적용 완료!\n${vacStartDate} ~ ${vacEndDate} (총 ${result.days}일간)${reasonMsg}\n\n휴가 기간 및 이후 미완료 복습 ${result.count}개가 정확히 ${result.days}일 뒤로 연기되었습니다! 🎉`);
    setVacReason('');
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

  // Today's due reviews (1원칙 상단 고정 → 직전 스킵 2순위 → 4·7·14·30 오름차순)
  const todayReviews = useMemo(() => {
    const list = [];
    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        if (rev.targetDate === todayStr) {
          list.push({
            lectureId: lec.id,
            subject: lec.subject,
            title: lec.title,
            score14: lec.score14,
            verdict14: lec.verdict14,
            hasReReviewRegistered: lec.hasReReviewRegistered,
            isPrevSkipped: isPrevReviewSkipped(lec, rev.dayOffset),
            ...rev
          });
        }
      });
    });
    return list.sort(compareReviewsByPriority);
  }, [lectures, todayStr]);

  const todayPrinciple1Reviews = useMemo(
    () => todayReviews.filter(r => Number(r.dayOffset) === 1),
    [todayReviews]
  );
  const todayPrinciple2Reviews = useMemo(
    () => todayReviews.filter(r => Number(r.dayOffset) !== 1),
    [todayReviews]
  );

  const todayCompletedCount = todayReviews.filter(r => r.isCompleted).length;
  const todaySkippedCount = todayReviews.filter(r => r.isSkipped).length;
  const overdueCount = lectures.flatMap(l => l.reviews).filter(r => !r.isCompleted && !r.isSkipped && r.targetDate < todayStr).length;

  // Generate 7 days of current week
  const weekDays = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(currentWeekStart.getDate() + i);
    const dateStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const isToday = dateStr === todayStr;
    
    let dayReviews = [];
    lectures.forEach(lec => {
      lec.reviews.forEach(rev => {
        if (rev.targetDate === dateStr) {
          dayReviews.push({
            lectureId: lec.id,
            subject: lec.subject,
            title: lec.title,
            score14: lec.score14,
            verdict14: lec.verdict14,
            hasReReviewRegistered: lec.hasReReviewRegistered,
            isPrevSkipped: isPrevReviewSkipped(lec, rev.dayOffset),
            ...rev
          });
        }
      });
    });

    // 1. 과목 필터 적용
    if (subjectFilter !== 'all') {
      dayReviews = dayReviews.filter(r => r.subject === subjectFilter);
    }

    // 2. 정렬 방식: 과목별 모아보기(과목 내 1원칙→직전스킵→오름차순) vs 우선순위 일차별 순
    if (reviewViewMode === 'subject') {
      dayReviews.sort((a, b) => {
        if (a.subject !== b.subject) {
          const idxA = registeredSubjects.indexOf(a.subject);
          const idxB = registeredSubjects.indexOf(b.subject);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.subject.localeCompare(b.subject, 'ko');
        }
        return compareReviewsByPriority(a, b);
      });
    } else {
      dayReviews.sort(compareReviewsByPriority);
    }

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
              background: (todayCompletedCount + todaySkippedCount) === todayReviews.length && todayReviews.length > 0 ? '#10b981' : '#8b5cf6',
              color: '#fff',
              padding: '0.12rem 0.5rem',
              borderRadius: '10px',
              fontWeight: 'bold'
            }}>
              {todayCompletedCount} / {todayReviews.length} 완료{todaySkippedCount > 0 ? ` · ${todaySkippedCount} 스킵` : ''}
            </span>
          </div>

          {todayReviews.length > 0 && (todayCompletedCount + todaySkippedCount) === todayReviews.length && (
            <span style={{ fontSize: '0.8rem', color: '#34d399', fontWeight: 'bold' }}>
              ✨ 오늘 복습 미션 처리 완료!
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {[
              {
                key: 'p1',
                title: '📌 1원칙 · 당일 필수 복습 (1일차)',
                badgeColor: '#22d3ee',
                badgeBg: 'rgba(34, 211, 238, 0.14)',
                items: todayPrinciple1Reviews
              },
              {
                key: 'p2',
                title: '📚 2원칙 · 누적 복습 (4 · 7 · 14 · 30일차)',
                badgeColor: '#a78bfa',
                badgeBg: 'rgba(167, 139, 250, 0.14)',
                items: todayPrinciple2Reviews
              }
            ].filter(sec => sec.items.length > 0).map(sec => (
              <div key={sec.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{
                    fontSize: '0.74rem',
                    fontWeight: 'bold',
                    color: sec.badgeColor,
                    background: sec.badgeBg,
                    border: `1px solid ${sec.badgeColor}44`,
                    padding: '0.12rem 0.55rem',
                    borderRadius: '6px'
                  }}>
                    {sec.title} ({sec.items.length})
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.5rem' }}>
                  {sec.items.map(rev => {
                    const badge = getDayOffsetBadgeStyle(rev.dayOffset);
                    const isPrinciple1 = Number(rev.dayOffset) === 1;
                    const isSkipped = Boolean(rev.isSkipped);
                    return (
                      <div
                        key={rev.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.75rem',
                          background: rev.isCompleted
                            ? 'rgba(16, 185, 129, 0.12)'
                            : (isSkipped ? 'rgba(100, 116, 139, 0.14)' : 'rgba(0, 0, 0, 0.3)'),
                          border: `1px solid ${
                            rev.isCompleted
                              ? 'rgba(16, 185, 129, 0.35)'
                              : (isSkipped ? 'rgba(148, 163, 184, 0.25)' : 'rgba(255, 255, 255, 0.08)')
                          }`,
                          borderLeft: `3px solid ${
                            rev.isCompleted ? '#10b981' : (isSkipped ? '#64748b' : badge.color)
                          }`,
                          borderRadius: '8px',
                          padding: '0.55rem 0.8rem',
                          opacity: isSkipped ? 0.78 : 1,
                          transition: 'all 0.2s'
                        }}
                      >
                        <div 
                          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1, cursor: 'pointer' }}
                          onClick={() => setAchievementModalTarget(rev)}
                          title="클릭하여 복습 성취도(상/중/하) 평가 및 완료"
                        >
                          <div 
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '5px',
                              border: `2px solid ${rev.isCompleted ? '#10b981' : (isSkipped ? '#64748b' : 'rgba(255,255,255,0.3)')}`,
                              background: rev.isCompleted ? '#10b981' : (isSkipped ? 'rgba(100, 116, 139, 0.35)' : 'transparent'),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              cursor: 'pointer'
                            }}
                          >
                            {rev.isCompleted && <Check size={13} color="#000" strokeWidth={3} />}
                            {isSkipped && !rev.isCompleted && <X size={12} color="#cbd5e1" strokeWidth={3} />}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            {(() => {
                              const subColor = getSubjectColor(rev.subject, registeredSubjects);
                              const curAch = rev.achievement || (rev.difficulty === 'easy' ? 'high' : (rev.difficulty === 'normal' ? 'mid' : (rev.difficulty === 'hard' ? 'low' : null)));
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem', flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: '0.62rem',
                                    color: isPrinciple1 ? '#22d3ee' : '#c084fc',
                                    background: isPrinciple1 ? 'rgba(34, 211, 238, 0.14)' : 'rgba(192, 132, 252, 0.14)',
                                    border: `1px solid ${isPrinciple1 ? 'rgba(34, 211, 238, 0.35)' : 'rgba(192, 132, 252, 0.35)'}`,
                                    padding: '0.03rem 0.3rem',
                                    borderRadius: '3px',
                                    fontWeight: 'bold'
                                  }}>
                                    {isPrinciple1 ? '1원칙' : '2원칙'}
                                  </span>
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
                                  {!rev.isCompleted && !isSkipped && rev.isPrevSkipped && (
                                    <span style={{
                                      fontSize: '0.65rem',
                                      color: '#fbbf24',
                                      background: 'rgba(245, 158, 11, 0.2)',
                                      border: '1px solid rgba(245, 158, 11, 0.5)',
                                      padding: '0.05rem 0.35rem',
                                      borderRadius: '3px',
                                      fontWeight: 'bold'
                                    }}>
                                      ⚠️ 직전 스킵 - 우선 복습
                                    </span>
                                  )}
                                  {isSkipped && (
                                    <span style={{
                                      fontSize: '0.65rem',
                                      color: '#cbd5e1',
                                      background: 'rgba(148, 163, 184, 0.2)',
                                      border: '1px solid rgba(148, 163, 184, 0.4)',
                                      padding: '0.05rem 0.35rem',
                                      borderRadius: '3px',
                                      fontWeight: 'bold'
                                    }}>
                                      ⏭️ 스킵됨{rev.markedOnly ? ' (📘 단권화만)' : ''}
                                    </span>
                                  )}
                                  {rev.isCompleted && curAch === 'high' && (
                                    <span style={{ fontSize: '0.65rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '0.05rem 0.3rem', borderRadius: '3px', fontWeight: 'bold' }}>
                                      🟢 상
                                    </span>
                                  )}
                                  {rev.isCompleted && curAch === 'mid' && (
                                    <span style={{ fontSize: '0.65rem', color: '#93c5fd', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', padding: '0.05rem 0.3rem', borderRadius: '3px', fontWeight: 'bold' }}>
                                      🟡 중
                                    </span>
                                  )}
                                  {rev.isCompleted && curAch === 'low' && (
                                    <span style={{ fontSize: '0.65rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '0.05rem 0.3rem', borderRadius: '3px', fontWeight: 'bold' }}>
                                      🔴 하
                                    </span>
                                  )}
                                  {rev.score14 !== undefined && (
                                    <span style={{
                                      fontSize: '0.65rem',
                                      color: rev.score14 >= 80 ? '#34d399' : (rev.score14 >= 70 ? '#fbbf24' : '#f87171'),
                                      background: rev.score14 >= 80 ? 'rgba(16, 185, 129, 0.15)' : (rev.score14 >= 70 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                                      border: `1px solid ${rev.score14 >= 80 ? 'rgba(16, 185, 129, 0.4)' : (rev.score14 >= 70 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(239, 68, 68, 0.4)')}`,
                                      padding: '0.05rem 0.35rem',
                                      borderRadius: '3px',
                                      fontWeight: 'bold'
                                    }}>
                                      {rev.score14 >= 80 ? `🟢 14일차 통과 (${rev.score14}점)` : (rev.score14 >= 70 ? `🟡 재복습 권장 (${rev.score14}점)` : `🔴 재복습 필수 (${rev.score14}점)`)}
                                    </span>
                                  )}
                                  {rev.hasReReviewRegistered && (
                                    <span style={{ fontSize: '0.65rem', color: '#c084fc', background: 'rgba(192, 132, 252, 0.15)', border: '1px solid rgba(192, 132, 252, 0.35)', padding: '0.05rem 0.3rem', borderRadius: '3px', fontWeight: 'bold' }}>
                                      🔁 재복습 등록됨
                                    </span>
                                  )}
                                  {rev.isCompleted && rev.isDelayed && (
                                    <span style={{ fontSize: '0.65rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.18)', border: '1px solid rgba(245, 158, 11, 0.35)', padding: '0.05rem 0.3rem', borderRadius: '3px', fontWeight: 'bold' }} title={rev.delayNote || `${rev.delayedDays}일 지연 완료`}>
                                      ⏰ {rev.delayedDays}일 지연 완료
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                            <div style={{
                              fontSize: '0.85rem',
                              fontWeight: 'bold',
                              color: (rev.isCompleted || isSkipped) ? 'var(--text-muted)' : '#fff',
                              textDecoration: (rev.isCompleted || isSkipped) ? 'line-through' : 'none',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {rev.title}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                          {rev.isCompleted ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }} onClick={(e) => e.stopPropagation()}>
                              {(() => {
                                const curAch = rev.achievement || (rev.difficulty === 'easy' ? 'high' : (rev.difficulty === 'normal' ? 'mid' : (rev.difficulty === 'hard' ? 'low' : null)));
                                return (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectAchievement(rev.lectureId, rev.id, 'high')}
                                      style={{
                                        fontSize: '0.66rem',
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: '3px',
                                        border: curAch === 'high' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                                        background: curAch === 'high' ? 'rgba(16, 185, 129, 0.28)' : 'rgba(255,255,255,0.03)',
                                        color: curAch === 'high' ? '#34d399' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontWeight: curAch === 'high' ? 'bold' : 'normal'
                                      }}
                                      title="성취도: 상 (완벽 이해)"
                                    >
                                      상
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectAchievement(rev.lectureId, rev.id, 'mid')}
                                      style={{
                                        fontSize: '0.66rem',
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: '3px',
                                        border: curAch === 'mid' ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)',
                                        background: curAch === 'mid' ? 'rgba(59, 130, 246, 0.28)' : 'rgba(255,255,255,0.03)',
                                        color: curAch === 'mid' ? '#93c5fd' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontWeight: curAch === 'mid' ? 'bold' : 'normal'
                                      }}
                                      title="성취도: 중 (적정 이해)"
                                    >
                                      중
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectAchievement(rev.lectureId, rev.id, 'low')}
                                      style={{
                                        fontSize: '0.66rem',
                                        padding: '0.15rem 0.4rem',
                                        borderRadius: '3px',
                                        border: curAch === 'low' ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)',
                                        background: curAch === 'low' ? 'rgba(239, 68, 68, 0.28)' : 'rgba(255,255,255,0.03)',
                                        color: curAch === 'low' ? '#fca5a5' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontWeight: curAch === 'low' ? 'bold' : 'normal'
                                      }}
                                      title="성취도: 하 (부족·취약)"
                                    >
                                      하
                                    </button>
                                  </>
                                );
                              })()}

                              {rev.score14 !== undefined && rev.score14 < 80 && !rev.hasReReviewRegistered && (
                                <button
                                  type="button"
                                  onClick={() => handleRegisterReReview(rev.lectureId)}
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: '4px',
                                    border: '1px solid #f97316',
                                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    marginLeft: '0.2rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px'
                                  }}
                                  title="새로운 1-4-7-14-30 복습 스케줄로 즉시 재복습 등록"
                                >
                                  <Flame size={11} /> + 재복습
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleToggleReview(rev.lectureId, rev.id, true)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  fontSize: '0.72rem',
                                  cursor: 'pointer',
                                  padding: '0.1rem 0.25rem',
                                  marginLeft: '2px'
                                }}
                                title="완료 취소 (미완료로 복구)"
                              >
                                ↩️
                              </button>
                            </div>
                          ) : isSkipped ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => handleUnskipReview(e, rev.lectureId, rev.id)}
                                style={{
                                  fontSize: '0.7rem',
                                  padding: '0.22rem 0.55rem',
                                  borderRadius: '5px',
                                  border: '1px solid rgba(148, 163, 184, 0.4)',
                                  background: 'rgba(148, 163, 184, 0.16)',
                                  color: '#e2e8f0',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                                title="스킵 취소 (미완료로 복구)"
                              >
                                ↩️ 스킵 취소
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }} onClick={(e) => e.stopPropagation()}>
                              {/* 원클릭 성취도 완료 버튼 그룹 [상] [중] [하] */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                background: 'rgba(255, 255, 255, 0.04)',
                                padding: '2px',
                                borderRadius: '5px',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                              }}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleReview(rev.lectureId, rev.id, false, 'high')}
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '0.18rem 0.42rem',
                                    borderRadius: '3px',
                                    border: '1px solid rgba(16, 185, 129, 0.5)',
                                    background: 'rgba(16, 185, 129, 0.18)',
                                    color: '#34d399',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="상 (완벽 이해) - 원클릭 완료"
                                >
                                  상
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleReview(rev.lectureId, rev.id, false, 'mid')}
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '0.18rem 0.42rem',
                                    borderRadius: '3px',
                                    border: '1px solid rgba(59, 130, 246, 0.5)',
                                    background: 'rgba(59, 130, 246, 0.18)',
                                    color: '#93c5fd',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="중 (적정 이해) - 원클릭 완료"
                                >
                                  중
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleReview(rev.lectureId, rev.id, false, 'low')}
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '0.18rem 0.42rem',
                                    borderRadius: '3px',
                                    border: '1px solid rgba(239, 68, 68, 0.5)',
                                    background: 'rgba(239, 68, 68, 0.18)',
                                    color: '#fca5a5',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    transition: 'all 0.15s ease'
                                  }}
                                  title="하 (부족·취약) - 원클릭 완료"
                                >
                                  하
                                </button>
                              </div>

                              {/* 2원칙(4·7·14·30일차) 전용 X(스킵) 버튼 - 1일차(dayOffset === 1)에는 미표시 */}
                              {!isPrinciple1 && (
                                <button
                                  type="button"
                                  onClick={(e) => handleRequestSkipReview(e, rev)}
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '0.2rem 0.45rem',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(148, 163, 184, 0.45)',
                                    background: 'rgba(100, 116, 139, 0.22)',
                                    color: '#cbd5e1',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  title="2원칙 회차 스킵 (X) - 연체 해제 및 스킵 기록"
                                >
                                  X
                                </button>
                              )}

                              {/* 일정 조정 버튼 */}
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
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
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

      {/* Ebbinghaus Cycle Badges, View Mode Selector & Subject Filter */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.6rem', 
        marginBottom: '0.75rem',
        padding: '0.45rem 0.8rem',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.08)'
      }}>
        {/* Left: Cycle Badges */}
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

        {/* Center: View Mode Toggle (과목별 모아보기 vs 일차별 순) */}
        <div style={{
          display: 'inline-flex',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '20px',
          padding: '0.15rem',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <button
            type="button"
            onClick={() => setReviewViewMode('subject')}
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '16px',
              border: 'none',
              background: reviewViewMode === 'subject' ? '#8b5cf6' : 'transparent',
              color: reviewViewMode === 'subject' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
            title="과목별로 묶어서 표시 (셈회는 셈회끼리, 행소는 행소끼리)"
          >
            <span>📚</span> 과목별 모아보기
          </button>
          <button
            type="button"
            onClick={() => setReviewViewMode('cycle')}
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '16px',
              border: 'none',
              background: reviewViewMode === 'cycle' ? '#8b5cf6' : 'transparent',
              color: reviewViewMode === 'cycle' ? '#fff' : 'var(--text-muted)',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
            title="14일차 -> 7일차 -> 4일차 순서로 표시"
          >
            <span>🗓️</span> 일차별 순
          </button>
        </div>

        {/* Right: Subject Interactive Filter Buttons */}
        {registeredSubjects.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 'bold' }}>
              과목 필터:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSubjectFilter('all')}
                style={{
                  fontSize: '0.67rem',
                  padding: '0.08rem 0.45rem',
                  borderRadius: '4px',
                  border: subjectFilter === 'all' ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.12)',
                  background: subjectFilter === 'all' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255,255,255,0.04)',
                  color: subjectFilter === 'all' ? '#38bdf8' : 'var(--text-muted)',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                전체
              </button>
              {registeredSubjects.map(s => {
                const col = getSubjectColor(s, registeredSubjects);
                const isSelected = subjectFilter === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSubjectFilter(isSelected ? 'all' : s)}
                    style={{
                      fontSize: '0.67rem',
                      padding: '0.08rem 0.45rem',
                      borderRadius: '4px',
                      background: isSelected ? `${col}35` : `${col}15`,
                      border: isSelected ? `1.5px solid ${col}` : `1px solid ${col}4d`,
                      color: isSelected ? '#fff' : col,
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: isSelected ? `0 0 8px ${col}66` : 'none',
                      transition: 'all 0.15s'
                    }}
                    title={`${s} 복습만 보기`}
                  >
                    {s}
                  </button>
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
                  {day.isVacation ? '🌴 휴가' : (subjectFilter !== 'all' ? `${subjectFilter} 복습 없음` : '-')}
                </div>
              ) : (
                day.reviews.map((rev, revIdx) => {
                  const badge = getDayOffsetBadgeStyle(rev.dayOffset);
                  const subColor = getSubjectColor(rev.subject, registeredSubjects);
                  const isFirstOfSubject = reviewViewMode === 'subject' && (revIdx === 0 || day.reviews[revIdx - 1].subject !== rev.subject);
                  
                  return (
                    <div key={rev.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {/* 과목별 모아보기 모드일 때 과목 헤더 표시 */}
                      {isFirstOfSubject && (
                        <div style={{
                          fontSize: '0.67rem',
                          fontWeight: 'bold',
                          color: subColor,
                          background: `${subColor}18`,
                          borderLeft: `3px solid ${subColor}`,
                          padding: '0.15rem 0.4rem',
                          borderRadius: '0 4px 4px 0',
                          marginTop: revIdx > 0 ? '0.45rem' : '0.1rem',
                          marginBottom: '0.1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <span>📚</span>
                          <span>{rev.subject}</span>
                        </div>
                      )}

                      <div 
                        style={{ 
                          background: rev.isCompleted
                            ? 'rgba(16, 185, 129, 0.1)'
                            : (rev.isSkipped ? 'rgba(100, 116, 139, 0.14)' : 'rgba(30, 41, 59, 0.8)'),
                          border: `1px solid ${
                            rev.isCompleted
                              ? 'rgba(16, 185, 129, 0.3)'
                              : (rev.isSkipped ? 'rgba(148, 163, 184, 0.25)' : 'var(--panel-border)')
                          }`,
                          borderLeft: `3px solid ${
                            rev.isCompleted ? '#10b981' : (rev.isSkipped ? '#64748b' : badge.color)
                          }`,
                          padding: '0.4rem 0.5rem',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          opacity: (day.dateStr < todayStr && !rev.isCompleted && !rev.isSkipped) || rev.isSkipped ? 0.72 : 1
                        }}
                        onClick={() => setAchievementModalTarget(rev)}
                        title="클릭하여 복습 성취도(상/중/하) 평가 및 완료"
                      >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
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
                          {!rev.isCompleted && !rev.isSkipped && rev.isPrevSkipped && (
                            <span style={{
                              fontSize: '0.56rem',
                              padding: '1px 3px',
                              borderRadius: '2px',
                              background: 'rgba(245, 158, 11, 0.22)',
                              border: '1px solid rgba(245, 158, 11, 0.5)',
                              color: '#fbbf24',
                              fontWeight: 'bold'
                            }} title="직전 회차 스킵 - 우선 복습">
                              ⚠️우선
                            </span>
                          )}
                          {rev.isSkipped && (
                            <span style={{
                              fontSize: '0.56rem',
                              padding: '1px 3px',
                              borderRadius: '2px',
                              background: 'rgba(148, 163, 184, 0.2)',
                              color: '#cbd5e1',
                              fontWeight: 'bold'
                            }}>
                              ⏭️스킵{rev.markedOnly ? '·단권화' : ''}
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        {!rev.isCompleted && !rev.isSkipped && (
                          <>
                            {Number(rev.dayOffset) !== 1 && (
                              <button
                                onClick={(e) => handleRequestSkipReview(e, rev)}
                                style={{
                                  background: 'rgba(100, 116, 139, 0.25)',
                                  border: '1px solid rgba(148, 163, 184, 0.35)',
                                  color: '#cbd5e1',
                                  fontSize: '0.58rem',
                                  padding: '0.05rem 0.25rem',
                                  borderRadius: '2px',
                                  cursor: 'pointer',
                                  fontWeight: 'bold'
                                }}
                                title="2원칙 스킵 (X)"
                              >
                                X
                              </button>
                            )}
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
                        {rev.isSkipped && (
                          <button
                            onClick={(e) => handleUnskipReview(e, rev.lectureId, rev.id)}
                            style={{
                              background: 'rgba(148, 163, 184, 0.18)',
                              border: 'none',
                              color: '#cbd5e1',
                              fontSize: '0.58rem',
                              padding: '0.05rem 0.25rem',
                              borderRadius: '2px',
                              cursor: 'pointer'
                            }}
                            title="스킵 취소"
                          >
                            ↩️
                          </button>
                        )}
                        {(() => {
                          const curAch = rev.achievement || (rev.difficulty === 'easy' ? 'high' : (rev.difficulty === 'normal' ? 'mid' : (rev.difficulty === 'hard' ? 'low' : null)));
                          return (
                            <>
                              {rev.isCompleted && curAch === 'high' && (
                                <span style={{ fontSize: '0.62rem', fontWeight: 'bold', color: '#34d399' }} title="성취도: 상">
                                  🟢상
                                </span>
                              )}
                              {rev.isCompleted && curAch === 'mid' && (
                                <span style={{ fontSize: '0.62rem', fontWeight: 'bold', color: '#93c5fd' }} title="성취도: 중">
                                  🟡중
                                </span>
                              )}
                              {rev.isCompleted && curAch === 'low' && (
                                <span style={{ fontSize: '0.62rem', fontWeight: 'bold', color: '#f87171' }} title="성취도: 하">
                                  🔴하
                                </span>
                              )}
                              {rev.score14 !== undefined && (
                                <span style={{
                                  fontSize: '0.58rem',
                                  fontWeight: 'bold',
                                  padding: '1px 3px',
                                  borderRadius: '2px',
                                  background: rev.score14 >= 80 ? 'rgba(16, 185, 129, 0.25)' : (rev.score14 >= 70 ? 'rgba(245, 158, 11, 0.25)' : 'rgba(239, 68, 68, 0.25)'),
                                  color: rev.score14 >= 80 ? '#34d399' : (rev.score14 >= 70 ? '#fbbf24' : '#f87171')
                                }} title={`14일차 채점: ${rev.score14}점`}>
                                  {rev.score14}점
                                </span>
                              )}
                            </>
                          );
                        })()}
                        {rev.isCompleted && rev.isDelayed && (
                          <span style={{ fontSize: '0.6rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.2)', padding: '1px 3px', borderRadius: '3px', fontWeight: 'bold' }} title={rev.delayNote || `${rev.delayedDays}일 지연 완료`}>
                            +{rev.delayedDays}d
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
                                title={`${badge.label}: 예정 ${rev.targetDate}${rev.isCompleted ? (rev.isDelayed ? ` (${rev.completedDate}에 ${rev.delayedDays}일 지연 완료)` : ` (${rev.completedDate || rev.targetDate} 완료)`) : ' (미완료)'}`}
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
              {(() => {
                const vacQuota = storage.getMonthlyVacationQuota();
                return (
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <div style={{ fontWeight: 'bold', color: '#34d399', fontSize: '0.92rem' }}>
                        🌴 여행/휴가 모드 관리
                      </div>
                      <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.25)', color: '#6ee7b7', padding: '0.1rem 0.45rem', borderRadius: '10px', fontWeight: 'bold' }}>
                        잔여: {vacQuota.remaining} / 2일
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0', lineHeight: 1.4 }}>
                      사전 예약(전날 22:00 전)을 통해 휴가를 등록하고 복습을 자동 연기합니다. (사유 불문 월 2회 한도)
                    </p>
                    <button
                      onClick={() => { setShowManageModal(false); setShowVacationModal(true); }}
                      className="btn btn-secondary"
                      style={{ width: '100%', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399', padding: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold' }}
                    >
                      <Palmtree size={15} /> 여행/휴가 기간 설정 열기 (이번 달 잔여: {vacQuota.remaining} / 2일)
                    </button>
                  </div>
                );
              })()}

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

            {/* Vacation Quota & Anti-Escape Rule Banner */}
            {(() => {
              const vacQuota = storage.getMonthlyVacationQuota();
              return (
                <>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    marginBottom: '1rem',
                    fontSize: '0.78rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', color: '#34d399', marginBottom: '0.25rem' }}>
                      <span>🎯 이번 달 잔여 휴가: {vacQuota.remaining} / 2일</span>
                      <span style={{ fontSize: '0.7rem', color: '#a7f3d0' }}>월 2회 단일 쿼터</span>
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '0.72rem', lineHeight: 1.45 }}>
                      • <strong>당일 즉흥 휴가 원천 차단</strong>: 오늘 및 과거 날짜 등록 불가<br />
                      • <strong>사전 예약제</strong>: 전날 밤 22:00 이전까지만 예약 가능 (최단 예약 가능일: {earliestVacDate})<br />
                      • 사유 불문 월 2회 단일 한도 내에서만 차감
                    </div>
                  </div>

                  <form onSubmit={handleApplyVacation} style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '120px' }}>
                        <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>시작일 (당일 불가)</label>
                        <input 
                          type="date" 
                          min={earliestVacDate}
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
                          min={vacStartDate || earliestVacDate}
                          value={vacEndDate} 
                          onChange={(e) => setVacEndDate(e.target.value)} 
                          required 
                          style={{ width: '100%', padding: '0.45rem', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }} 
                        />
                      </div>
                    </div>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
                        휴가 사유 (사유 불문 쿼터 차감)
                      </label>
                      <input 
                        type="text" 
                        placeholder="예: 허리 통증 병원, 가족 행사, 정기 휴식 등" 
                        value={vacReason} 
                        onChange={(e) => setVacReason(e.target.value)} 
                        style={{ width: '100%', padding: '0.45rem', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }} 
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={vacQuota.remaining <= 0}
                      className="btn btn-primary" 
                      style={{
                        width: '100%',
                        padding: '0.55rem',
                        background: vacQuota.remaining > 0 ? '#10b981' : '#475569',
                        border: 'none',
                        color: vacQuota.remaining > 0 ? '#000' : '#94a3b8',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        cursor: vacQuota.remaining > 0 ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {vacQuota.remaining > 0 ? '🌴 휴가 사전 예약 등록 및 자동 연기' : '⛔ 이번 달 휴가 쿼터 소진 (0 / 2일)'}
                    </button>
                  </form>
                </>
              );
            })()}

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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontSize: '0.82rem', color: '#34d399', fontWeight: 'bold' }}>
                            {v.startDate} ~ {v.endDate} ({v.days}일간)
                            {v.startDate <= todayStr && v.endDate >= todayStr && (
                              <span style={{ fontSize: '0.68rem', background: 'rgba(16, 185, 129, 0.2)', padding: '0.1rem 0.35rem', borderRadius: '4px', marginLeft: '0.4rem' }}>
                                진행 중 🌴
                              </span>
                            )}
                          </span>
                          {v.reason && (
                            <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                              📝 {v.reason}
                            </span>
                          )}
                        </div>
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

      {/* 복습 카드 클릭 시 상/중/하 성취도(점수메김) 선택 알림박스 모달 */}
      {achievementModalTarget && (() => {
        const target = achievementModalTarget;
        const reviewId = target.reviewId || target.id;
        const currentLec = lectures.find(l => l.id === target.lectureId);
        const currentRev = currentLec?.reviews.find(r => r.id === reviewId);
        const isCompleted = currentRev ? Boolean(currentRev.isCompleted) : Boolean(target.isCompleted);
        const dayNum = Number(target.dayOffset);
        const scoreInfo = EBBINGHAUS_14_SCORES ? EBBINGHAUS_14_SCORES[dayNum] : null;
        const badge = getDayOffsetBadgeStyle(target.dayOffset);
        const subColor = getSubjectColor(target.subject, registeredSubjects);
        const rawAch = currentRev ? (currentRev.achievement || currentRev.difficulty) : (target.achievement || target.difficulty);
        const curAch = rawAch === 'high' || rawAch === 'easy' ? 'high' : (rawAch === 'low' || rawAch === 'hard' ? 'low' : (rawAch ? 'mid' : null));

        return (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.78)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1050,
              padding: '1rem'
            }}
            onClick={() => setAchievementModalTarget(null)}
          >
            <div 
              className="glass-panel animate-fade-in"
              style={{
                width: '100%',
                maxWidth: '430px',
                padding: '1.4rem',
                borderRadius: '14px',
                border: '1px solid rgba(139, 92, 246, 0.45)',
                background: '#0f172a',
                boxShadow: '0 20px 45px rgba(0, 0, 0, 0.75)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <span style={{ fontSize: '1.15rem' }}>⭐</span>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#c084fc', fontWeight: 800 }}>
                    복습 성취도 평가
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAchievementModalTarget(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="닫기"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Target Lecture Info Card */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderLeft: `4px solid ${subColor}`,
                borderRadius: '8px',
                padding: '0.8rem 0.95rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 'bold',
                    color: subColor,
                    background: `${subColor}22`,
                    border: `1px solid ${subColor}55`,
                    padding: '0.08rem 0.4rem',
                    borderRadius: '4px'
                  }}>
                    {target.subject}
                  </span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 'bold',
                    color: badge.color,
                    background: badge.bg,
                    border: `1px solid ${badge.border}`,
                    padding: '0.08rem 0.4rem',
                    borderRadius: '4px'
                  }}>
                    {badge.label}
                  </span>
                  {target.targetDate && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      📅 {target.targetDate}
                    </span>
                  )}
                </div>

                <div style={{
                  fontSize: '0.96rem',
                  fontWeight: 'bold',
                  color: '#fff',
                  lineHeight: 1.35,
                  marginBottom: '0.3rem',
                  wordBreak: 'break-word'
                }}>
                  {target.title}
                </div>

                {scoreInfo ? (
                  <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                    💡 1·4·7·14일차 복습 완료 시 <strong style={{ color: '#38bdf8' }}>100점 만점 자동 채점 & 재복습 판정</strong>에 반영됩니다.
                  </div>
                ) : (
                  <div style={{ fontSize: '0.74rem', color: '#facc15', lineHeight: 1.4 }}>
                    🏆 <strong>30일차 최종 인출 단계</strong>입니다. (100점 채점 외 5회독 완주 기록)
                  </div>
                )}

                {isCompleted && (
                  <div style={{
                    marginTop: '0.45rem',
                    padding: '0.25rem 0.5rem',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: '#34d399',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}>
                    <Check size={14} /> 현재 완료 상태 ({curAch === 'high' ? '🟢 상' : (curAch === 'low' ? '🔴 하' : '🟡 중')}) · 클릭 시 변경
                  </div>
                )}
              </div>

              {/* Achievement Option Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {/* 상 */}
                <button
                  type="button"
                  onClick={() => handleSelectReviewAchievement(target, 'high')}
                  style={{
                    padding: '0.75rem 0.9rem',
                    borderRadius: '8px',
                    background: curAch === 'high' && isCompleted ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.08)',
                    border: curAch === 'high' && isCompleted ? '2px solid #10b981' : '1px solid rgba(16, 185, 129, 0.3)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#34d399' }}>
                      🟢 상 (완벽 이해)
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      color: '#fff',
                      background: 'rgba(16, 185, 129, 0.4)',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '4px'
                    }}>
                      {scoreInfo ? `+${scoreInfo.high}점` : '완벽 인출'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    막힘없이 개념을 완벽히 설명할 수 있고 문제를 즉시 해결함
                  </span>
                </button>

                {/* 중 */}
                <button
                  type="button"
                  onClick={() => handleSelectReviewAchievement(target, 'mid')}
                  style={{
                    padding: '0.75rem 0.9rem',
                    borderRadius: '8px',
                    background: curAch === 'mid' && isCompleted ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.08)',
                    border: curAch === 'mid' && isCompleted ? '2px solid #3b82f6' : '1px solid rgba(59, 130, 246, 0.3)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#60a5fa' }}>
                      🟡 중 (적정 이해)
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      color: '#fff',
                      background: 'rgba(59, 130, 246, 0.4)',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '4px'
                    }}>
                      {scoreInfo ? `+${scoreInfo.mid}점` : '적정 인출'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    대부분 기억나고 풀 수 있으나 일부 애매하거나 헷갈리는 부분 있음
                  </span>
                </button>

                {/* 하 */}
                <button
                  type="button"
                  onClick={() => handleSelectReviewAchievement(target, 'low')}
                  style={{
                    padding: '0.75rem 0.9rem',
                    borderRadius: '8px',
                    background: curAch === 'low' && isCompleted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.08)',
                    border: curAch === 'low' && isCompleted ? '2px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.3)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.92rem', fontWeight: 'bold', color: '#f87171' }}>
                      🔴 하 (부족·취약)
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      color: '#fff',
                      background: 'rgba(239, 68, 68, 0.4)',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '4px'
                    }}>
                      {scoreInfo ? `+${scoreInfo.low}점` : '보충 필요'}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    개념이 가물가물하거나 문제 풀이에 어려움이 있어 추가 복습 필요
                  </span>
                </button>
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.3rem' }}>
                {isCompleted ? (
                  <button
                    type="button"
                    onClick={() => handleUndoReviewFromModal(target)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      color: '#f87171',
                      borderRadius: '6px',
                      padding: '0.5rem 0.8rem',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}
                  >
                    <RotateCcw size={14} /> 완료 취소 (미완료로 복구)
                  </button>
                ) : (
                  <div />
                )}

                <button
                  type="button"
                  onClick={() => setAchievementModalTarget(null)}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.5rem 1rem',
                    fontSize: '0.82rem',
                    borderRadius: '6px'
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 14일차 100점 만점 자동 채점 & 재복습 판정 결과 모달 */}
      {score14ModalTarget && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '460px', width: '100%', background: '#0f172a',
            border: score14ModalTarget.score14 >= 80
              ? '1px solid #10b981'
              : (score14ModalTarget.score14 >= 70 ? '1px solid #f59e0b' : '1px solid #ef4444'),
            borderRadius: '16px', padding: '1.75rem', boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column', gap: '1.15rem'
          }}>
            {/* Header */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{
                  fontSize: '0.74rem',
                  fontWeight: 'bold',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '20px',
                  background: score14ModalTarget.score14 >= 80
                    ? 'rgba(16, 185, 129, 0.2)'
                    : (score14ModalTarget.score14 >= 70 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)'),
                  border: score14ModalTarget.score14 >= 80
                    ? '1px solid #10b981'
                    : (score14ModalTarget.score14 >= 70 ? '1px solid #f59e0b' : '1px solid #ef4444'),
                  color: score14ModalTarget.score14 >= 80
                    ? '#34d399'
                    : (score14ModalTarget.score14 >= 70 ? '#fbbf24' : '#f87171'),
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  {score14ModalTarget.score14 >= 80 && <>🟢 14일차 통과 (30일차 최종 인출 진행)</>}
                  {score14ModalTarget.score14 >= 70 && score14ModalTarget.score14 < 80 && <>🟡 14일차 재복습 권장</>}
                  {score14ModalTarget.score14 < 70 && <>🔴 14일차 재복습 필수</>}
                </span>
                <button
                  onClick={() => setScore14ModalTarget(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                  title="닫기"
                >
                  <X size={18} />
                </button>
              </div>
              <h3 style={{ margin: '0.2rem 0', fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>
                14일차 복습 100점 만점 채점 결과
              </h3>
            </div>

            {/* Target lecture card */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.74rem', color: '#93c5fd', fontWeight: 'bold', marginBottom: '0.15rem' }}>
                  [{score14ModalTarget.subject}]
                </div>
                <div style={{ fontSize: '0.98rem', fontWeight: 'bold', color: '#f8fafc' }}>
                  {score14ModalTarget.title}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: '2rem',
                  fontWeight: '900',
                  color: score14ModalTarget.score14 >= 80 ? '#34d399' : (score14ModalTarget.score14 >= 70 ? '#fbbf24' : '#f87171')
                }}>
                  {score14ModalTarget.score14}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}> / 100점</span>
              </div>
            </div>

            {/* Score Breakdown Table */}
            {score14ModalTarget.breakdown && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '0.75rem 0.9rem'
              }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>회차별 성취도 평가</span>
                  <span>배점 및 획득 점수</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {[
                    { day: 1, name: '1일차 복습', max: 15, info: score14ModalTarget.breakdown[1] },
                    { day: 4, name: '4일차 복습', max: 20, info: score14ModalTarget.breakdown[4] },
                    { day: 7, name: '7일차 복습', max: 30, info: score14ModalTarget.breakdown[7] },
                    { day: 14, name: '14일차 복습', max: 35, info: score14ModalTarget.breakdown[14] }
                  ].map(row => {
                    const achLabel = row.info?.achievement === 'high' ? '상' : (row.info?.achievement === 'low' ? '하' : '중');
                    const achColor = row.info?.achievement === 'high' ? '#34d399' : (row.info?.achievement === 'low' ? '#f87171' : '#60a5fa');
                    return (
                      <div key={row.day} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                        <span style={{ color: '#cbd5e1' }}>{row.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 'bold',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '3px',
                            background: `${achColor}22`,
                            color: achColor,
                            border: `1px solid ${achColor}55`
                          }}>
                            {achLabel}
                          </span>
                          <span style={{ fontWeight: 'bold', color: '#fff', minWidth: '45px', textAlign: 'right' }}>
                            {row.info?.score ?? 0} <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>/ {row.max}점</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Verdict Explanation Message */}
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '10px',
              background: score14ModalTarget.score14 >= 80
                ? 'rgba(16, 185, 129, 0.1)'
                : (score14ModalTarget.score14 >= 70 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)'),
              border: score14ModalTarget.score14 >= 80
                ? '1px solid rgba(16, 185, 129, 0.3)'
                : (score14ModalTarget.score14 >= 70 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'),
              fontSize: '0.82rem',
              lineHeight: '1.45',
              color: score14ModalTarget.score14 >= 80
                ? '#d1fae5'
                : (score14ModalTarget.score14 >= 70 ? '#fef3c7' : '#fee2e2')
            }}>
              {score14ModalTarget.score14 >= 80 ? (
                <>
                  🎉 <strong>기억 정착 우수 (통과):</strong> 1·4·7·14일차 복습을 성공적으로 완주했습니다! 기억이 안정 궤도에 올랐으므로 30일차 최종 인출(5회독 졸업) 단계로 바로 진행합니다.
                </>
              ) : score14ModalTarget.score14 >= 70 ? (
                <>
                  ⚠️ <strong>망각 주의 (재복습 권장):</strong> 개념의 일부가 아직 완전히 체화되지 않았습니다. 30일차로 넘어가기 전, 오늘 날짜로 새로운 1-4-7-14-30 복습 스케줄을 추가 등록해 약점을 보완하는 것을 권장합니다.
                </>
              ) : (
                <>
                  🚨 <strong>재복습 필수:</strong> 망각 곡선 임계점을 넘어 복습 효과가 낮아졌습니다. 확실한 시험 합격을 위해 오늘부터 새로운 1-4-7-14-30 복습 스케줄로 즉시 다시 시작해 주세요.
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.3rem' }}>
              {score14ModalTarget.score14 < 80 && (
                <button
                  type="button"
                  onClick={() => handleRegisterReReview(score14ModalTarget.lectureId)}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    fontSize: '0.92rem',
                    fontWeight: 'bold',
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(249, 115, 22, 0.4)'
                  }}
                >
                  <Flame size={17} /> [+ 재복습 등록] 새 1-4-7-14-30 스케줄 생성
                </button>
              )}

              <button
                type="button"
                onClick={() => setScore14ModalTarget(null)}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  fontSize: '0.85rem',
                  fontWeight: score14ModalTarget.score14 >= 80 ? 'bold' : 'normal',
                  background: score14ModalTarget.score14 >= 80 ? '#10b981' : 'rgba(255,255,255,0.06)',
                  color: score14ModalTarget.score14 >= 80 ? '#000' : 'var(--text-muted)',
                  border: score14ModalTarget.score14 >= 80 ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                {score14ModalTarget.score14 >= 80 ? '🎉 확인 (30일차 최종 인출 진행)' : '30일차 그대로 진행 (닫기)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2원칙(4·7·14·30일차) X(스킵) 확인 모달 (노트북LM 단권화 가공만 완료 옵션 포함) */}
      {skipModalTarget && (
        <div
          onClick={() => setSkipModalTarget(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 10010,
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
              maxWidth: '420px',
              background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.98) 100%)',
              border: '1.5px solid rgba(148, 163, 184, 0.45)',
              borderRadius: '14px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.9rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.02rem', color: '#f1f5f9' }}>
                ⏭️ {skipModalTarget.dayOffset}일차 복습 스킵 (X)
              </h3>
              <button
                type="button"
                onClick={() => setSkipModalTarget(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.45 }}>
              <strong>[{skipModalTarget.subject}] {skipModalTarget.title}</strong> ({skipModalTarget.dayOffset}일차) 복습을 스킵하시겠습니까?
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                스킵 처리 시 밀린 복습(연체) 목록에서 즉시 해제되며, 다음 복습 회차에서 우선 방어 알림이 표시됩니다.
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                padding: '0.6rem 0.75rem',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: '#bfdbfe'
              }}
            >
              <input
                type="checkbox"
                checked={skipMarkedOnly}
                onChange={(e) => setSkipMarkedOnly(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>📘 노트북LM 단권화 가공만 완료 (markedOnly)</span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.2rem' }}>
              <button
                type="button"
                onClick={() => setSkipModalTarget(null)}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmSkipReview}
                style={{
                  background: 'linear-gradient(135deg, #64748b, #475569)',
                  border: '1px solid rgba(148, 163, 184, 0.4)',
                  borderRadius: '7px',
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 'bold',
                  padding: '0.45rem 0.95rem',
                  cursor: 'pointer'
                }}
              >
                스킵 확정 (X)
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
