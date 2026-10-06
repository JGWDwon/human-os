import { useState, useEffect, useMemo } from 'react';
import { BookOpen, Plus, Check, ChevronLeft, ChevronRight, Trash2, Calendar, BrainCircuit, RotateCcw, Palmtree, ArrowRight, Wand2, Settings, CheckCircle2, ChevronDown, ChevronUp, ArrowLeft, X, Sparkles, Flame, Layers } from 'lucide-react';
import { storage } from '../utils/storage';
import confetti from 'canvas-confetti';

export default function EbbinghausPlanner({ onClose }) {
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
  const [showManageModal, setShowManageModal] = useState(false);
  const [showLectureList, setShowLectureList] = useState(false);

  // Curriculum Preset state (e.g. Finance 54 lectures)
  const [showCurriculumModal, setShowCurriculumModal] = useState(false);
  const [currSubject, setCurrSubject] = useState('재무');
  const [currTotal, setCurrTotal] = useState(54);
  const [currChunk, setCurrChunk] = useState(3);
  const [currPerDay, setCurrPerDay] = useState(2);
  const [currMaxReviewsPerDay, setCurrMaxReviewsPerDay] = useState(2); // Strict limit: at most 2 reviews per day
  const [currIntervalPreset, setCurrIntervalPreset] = useState('standard'); // 'standard' | 'compact'
  const [currStartToday, setCurrStartToday] = useState(true);
  const [currMode, setCurrMode] = useState('replace_all'); // 'replace_all' | 'replace_subject' | 'append'

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
    e.stopPropagation();
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
          const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          const targetWeekStart = new Date(revDate);
          targetWeekStart.setDate(revDate.getDate() + diffToMon);
          setCurrentWeekStart(targetWeekStart);
        }
      }
    }
    refreshData();
  };

  const selectedIntervals = useMemo(() => {
    return currIntervalPreset === 'compact' ? [1, 7, 30] : [1, 4, 7, 14, 30];
  }, [currIntervalPreset]);

  const previewSchedule = useMemo(() => {
    const total = Math.max(1, Number(currTotal) || 54);
    const chunk = Math.max(1, Number(currChunk) || 3);
    const perDay = Math.max(1, Number(currPerDay) || 2);
    const maxReviews = Math.max(1, Number(currMaxReviewsPerDay) || 2);
    const sub = currSubject.trim() || '재무';

    const res = storage.generateCurriculumSchedule({
      subject: sub,
      totalLectures: total,
      chunkSize: chunk,
      perDay: perDay,
      intervals: selectedIntervals,
      startToday: currStartToday,
      maxReviewsPerDay: maxReviews
    });

    return {
      sub,
      units: res.units,
      dates: res.dates,
      scheduleByDate: res.scheduleByDate,
      totalUnits: res.totalUnits,
      totalReviews: res.totalReviews,
      totalDays: res.totalDays
    };
  }, [currSubject, currTotal, currChunk, currPerDay, currStartToday, currMaxReviewsPerDay, selectedIntervals]);

  const handleCreateCurriculum = (e) => {
    if (e) e.preventDefault();
    const sub = currSubject.trim() || '재무';
    const total = Math.max(1, Number(currTotal) || 54);
    const chunk = Math.max(1, Number(currChunk) || 3);
    const perDay = Math.max(1, Number(currPerDay) || 2);
    const maxReviews = Math.max(1, Number(currMaxReviewsPerDay) || 2);

    const modeMsg = currMode === 'replace_all'
      ? "기존의 모든 강의를 초기화하고"
      : currMode === 'replace_subject'
        ? `기존 [${sub}] 관련 강의만 삭제하고`
        : "기존 강의를 유지한 채";

    const startMsg = currStartToday
      ? "오늘부터 즉시 1차 복습을 시작합니다."
      : "오늘을 진도 학습일로 등록하고 내일부터 1차 복습이 시작됩니다.";

    const intervalsLabel = currIntervalPreset === 'compact' ? '3회 쾌속 (1·7·30일)' : '5회 표준 (1·4·7·14·30일)';

    if (!window.confirm(`[${sub}] 총 ${total}강 (${chunk}강씩) 복습 플랜을 생성하시겠습니까?\n\n• ${modeMsg} 새 스케줄을 세팅합니다.\n• ${startMsg}\n• ✨ 지능형 자동 스무딩: 하루 최대 ${maxReviews}개로 엄격 제한 (절대 2개 초과 안 함)\n• 복습 주기: ${intervalsLabel}`)) {
      return;
    }

    const count = storage.initializeCurriculumReview({
      subject: sub,
      totalLectures: total,
      chunkSize: chunk,
      perDay: perDay,
      intervals: selectedIntervals,
      startToday: currStartToday,
      mode: currMode,
      maxReviewsPerDay: maxReviews
    });

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    alert(`🎉 [${sub}] 자동 스무딩 복습 플랜 생성 완료!\n총 ${count}개 묶음(${total}강)의 복습이 하루 최대 ${maxReviews}개를 넘지 않도록 균등 분배되었습니다.\n\n오늘의 복습 체크리스트에서 바로 확인해보세요! 🔥`);
    setShowCurriculumModal(false);
    setShowManageModal(false);
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
    alert(`🌴 휴가 모드 적용 완료!\n${vacStartDate} ~ ${vacEndDate} (총 ${result.days}일간)\n\n휴가 기간 동안 미완료 복습 ${result.count}개가 휴가일 이후로 자동 연기되었습니다! 🎉`);
    setShowVacationModal(false);
    refreshData();
  };

  const handleRevertVacation = (vacationId) => {
    if (window.confirm("이 휴가 일정을 취소하시겠습니까?\n휴가 기간이 삭제되고, 미완료 복습이 원래 14714 간격으로 재계산됩니다.")) {
      const result = storage.revertVacation(vacationId);
      alert(`↩️ 휴가 취소 완료!\n${result.count}개의 미완료 복습이 원래 간격으로 재배치되었습니다.`);
      refreshData();
    }
  };

  const handleDistributeOverdue = (maxPerDay = 3) => {
    const count = storage.redistributeOverdueReviews(maxPerDay);
    alert(`✨ 밀린 복습 재배치 완료!\n총 ${count}개의 밀린 복습이 하루 최대 ${maxPerDay}개씩 균등하게 재배치되었습니다.`);
    setShowOverdueModal(false);
    refreshData();
  };

  const handleSmartRedistribute = (maxPerDay = 3) => {
    const count = storage.redistributeOverdueReviewsSmart(maxPerDay);
    alert(`✨ 회차 간격 보존 재배치 완료!\n총 ${count}개의 밀린 복습이 오늘부터 하루 최대 ${maxPerDay}개씩 배정되었으며, 이후 회차 간격(+3일, +7일 등)도 100% 보존되었습니다.`);
    setShowOverdueModal(false);
    refreshData();
  };

  const handleMoveOverdueToTodayModal = () => {
    const count = storage.moveOverdueReviewsToDate(todayStr);
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
            onClick={() => setShowCurriculumModal(true)}
            className="btn btn-secondary"
            style={{ 
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.25) 0%, rgba(249, 115, 22, 0.25) 100%)', 
              border: '1px solid #a855f7', 
              color: '#f3e8ff', 
              fontSize: '0.82rem', 
              padding: '0.4rem 0.75rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.35rem',
              fontWeight: 'bold'
            }}
            title="재무 54강 1471430 원클릭 복습 초기화 및 생성"
          >
            <Sparkles size={15} color="#c084fc" /> 🔥 재무 54강 새출발
          </button>

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
            {todayReviews.map(rev => (
              <div
                key={rev.id}
                onClick={() => handleToggleReview(rev.lectureId, rev.id, rev.isCompleted)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  background: rev.isCompleted ? 'rgba(16, 185, 129, 0.12)' : 'rgba(0, 0, 0, 0.3)',
                  border: `1px solid ${rev.isCompleted ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.1rem' }}>
                      <span style={{ fontSize: '0.68rem', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.15)', padding: '0.05rem 0.3rem', borderRadius: '3px', fontWeight: 'bold' }}>
                        {rev.subject}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#c084fc', fontWeight: 'bold' }}>
                        {rev.dayOffset}일차
                      </span>
                    </div>
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
                  )}
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
            <div style={{ flex: '1 1 160px' }}>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#a78bfa', marginBottom: '0.2rem' }}>과목명</label>
              <input 
                type="text" 
                placeholder="예: 세법학, 회계학" 
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', background: 'rgba(0,0,0,0.2)', padding: '0.4rem 0.75rem', borderRadius: '8px' }}>
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
                day.reviews.map(rev => (
                  <div 
                    key={rev.id}
                    style={{ 
                      background: rev.isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(30, 41, 59, 0.8)',
                      border: `1px solid ${rev.isCompleted ? 'rgba(16, 185, 129, 0.3)' : 'var(--panel-border)'}`,
                      padding: '0.4rem 0.5rem',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: (day.dateStr < todayStr && !rev.isCompleted) ? 0.7 : 1
                    }}
                    onClick={() => handleToggleReview(rev.lectureId, rev.id, rev.isCompleted)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        padding: '0.05rem 0.25rem', 
                        borderRadius: '3px',
                        background: '#3b82f640',
                        color: '#60a5fa',
                        fontWeight: 'bold'
                      }}>
                        {rev.dayOffset}일차
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        {!rev.isCompleted && (
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
                        )}
                        {rev.isCompleted && <Check size={12} color="#10b981" />}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.05rem' }}>
                      {rev.subject}
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
                ))
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

      {/* ========================================================================= */}
      {/* 재무 54강 1471430 맞춤 복습 초기화 & 플랜 생성 모달 (ShowCurriculumModal) */}
      {/* ========================================================================= */}
      {showCurriculumModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0, 0, 0, 0.82)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1002, padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '520px', width: '100%', background: '#0f172a', border: '1px solid #a855f7',
            borderRadius: '16px', padding: '1.5rem', boxShadow: '0 15px 35px rgba(0,0,0,0.7)',
            maxHeight: '92vh', overflowY: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 'bold' }}>
                  <Flame size={20} color="#f97316" /> 재무 54강 1471430 복습 새출발
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  3강씩 18개 묶음 · 하루 최대 2개씩 순차 진도 · 5회 망각곡선 자동 생성
                </p>
              </div>
              <button onClick={() => setShowCurriculumModal(false)} className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCurriculum} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Preset Quick Banner with Smoothing Note */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(249, 115, 22, 0.15) 100%)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                borderRadius: '10px',
                padding: '0.85rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Sparkles size={14} color="#f59e0b" /> 지능형 자동 스무딩 활성화
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 'bold', background: 'rgba(56, 189, 248, 0.15)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                    하루 최대 {currMaxReviewsPerDay}개 절대 엄수
                  </span>
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  총 <b style={{ color: '#fff' }}>{currTotal}강</b>({previewSchedule.totalUnits}개 묶음) 복습이 겹치지 않도록, 특정 날짜에 몰리는 복습을 뒤로 자동 분산합니다.<br />
                  어떤 날도 <b style={{ color: '#f97316' }}>하루 최대 {currMaxReviewsPerDay}개</b>를 넘지 않아, 다른 과목을 추가하셔도 부담 없이 쾌적하게 복습할 수 있습니다!
                </div>
              </div>

              {/* Basic Settings Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.6rem' }}>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>과목명</label>
                  <input
                    type="text"
                    value={currSubject}
                    onChange={(e) => setCurrSubject(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.45rem', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>총 강의 수</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={currTotal}
                    onChange={(e) => setCurrTotal(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.45rem', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>1회 분량 (강씩)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={currChunk}
                    onChange={(e) => setCurrChunk(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.45rem', background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '0.82rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem' }}>하루 복습 상한 (개)</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={currMaxReviewsPerDay}
                    onChange={(e) => setCurrMaxReviewsPerDay(e.target.value)}
                    required
                    style={{ width: '100%', padding: '0.45rem', background: '#1e293b', color: '#38bdf8', border: '1px solid #38bdf8', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 'bold' }}
                    title="하루에 이 과목의 복습이 절대 이 개수를 넘지 않도록 자동 스무딩됩니다"
                  />
                </div>
              </div>

              {/* Interval Preset Selector */}
              <div style={{ background: '#1e293b', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#cbd5e1', display: 'block', marginBottom: '0.45rem' }}>
                  🔁 복습 주기 선택
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setCurrIntervalPreset('standard')}
                    className="btn"
                    style={{
                      flex: 1,
                      minWidth: '140px',
                      padding: '0.45rem 0.6rem',
                      background: currIntervalPreset === 'standard' ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255,255,255,0.05)',
                      border: currIntervalPreset === 'standard' ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.1)',
                      color: currIntervalPreset === 'standard' ? '#c084fc' : 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: currIntervalPreset === 'standard' ? 'bold' : 'normal',
                      textAlign: 'left'
                    }}
                  >
                    <div>🔥 5회 표준 주기 (기본)</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>1·4·7·14·30일차 (총 5회)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrIntervalPreset('compact')}
                    className="btn"
                    style={{
                      flex: 1,
                      minWidth: '140px',
                      padding: '0.45rem 0.6rem',
                      background: currIntervalPreset === 'compact' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.05)',
                      border: currIntervalPreset === 'compact' ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                      color: currIntervalPreset === 'compact' ? '#34d399' : 'var(--text-muted)',
                      fontSize: '0.75rem',
                      fontWeight: currIntervalPreset === 'compact' ? 'bold' : 'normal',
                      textAlign: 'left'
                    }}
                  >
                    <div>⚡ 3회 쾌속 주기</div>
                    <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>1·7·30일차 (총 3회)</div>
                  </button>
                </div>
              </div>

              {/* Start Mode Options */}
              <div style={{ background: '#1e293b', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#cbd5e1', display: 'block', marginBottom: '0.45rem' }}>
                  🎯 복습 시작 기준일 설정
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', color: currStartToday ? '#c084fc' : 'var(--text-muted)' }}>
                    <input
                      type="radio"
                      name="currStartToday"
                      checked={currStartToday === true}
                      onChange={() => setCurrStartToday(true)}
                      style={{ marginTop: '0.15rem' }}
                    />
                    <div>
                      <span style={{ fontWeight: currStartToday ? 'bold' : 'normal' }}>
                        🔥 오늘부터 1차 복습 바로 시작 (권장)
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        오늘의 복습 체크리스트에 1~3강, 4~6강(1회차)이 즉시 등장합니다.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.78rem', color: !currStartToday ? '#c084fc' : 'var(--text-muted)' }}>
                    <input
                      type="radio"
                      name="currStartToday"
                      checked={currStartToday === false}
                      onChange={() => setCurrStartToday(false)}
                      style={{ marginTop: '0.15rem' }}
                    />
                    <div>
                      <span style={{ fontWeight: !currStartToday ? 'bold' : 'normal' }}>
                        📖 오늘 진도 시작 (내일부터 1차 복습 등장)
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        오늘을 진도 학습일로 등록하고, 첫 복습(1회차)은 내일 체크리스트에 나타납니다.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Overwrite Mode */}
              <div style={{ background: '#1e293b', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#cbd5e1', display: 'block', marginBottom: '0.45rem' }}>
                  ⚙️ 기존 강의 데이터 처리
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.78rem', color: currMode === 'replace_all' ? '#f87171' : 'var(--text-muted)' }}>
                    <input
                      type="radio"
                      name="currMode"
                      checked={currMode === 'replace_all'}
                      onChange={() => setCurrMode('replace_all')}
                    />
                    <span><b>전면 초기화 후 새출발</b> (기존 모든 강의/복습 삭제 후 깔끔히 시작)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.78rem', color: currMode === 'replace_subject' ? '#38bdf8' : 'var(--text-muted)' }}>
                    <input
                      type="radio"
                      name="currMode"
                      checked={currMode === 'replace_subject'}
                      onChange={() => setCurrMode('replace_subject')}
                    />
                    <span><b>[{currSubject}] 과목만 교체</b> (다른 과목은 안전하게 보존)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.78rem', color: currMode === 'append' ? '#34d399' : 'var(--text-muted)' }}>
                    <input
                      type="radio"
                      name="currMode"
                      checked={currMode === 'append'}
                      onChange={() => setCurrMode('append')}
                    />
                    <span><b>기존 강의 유지하고 추가</b></span>
                  </label>
                </div>
              </div>

              {/* Intelligent Smoothed Preview */}
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    📅 스무딩 적용 스케줄 미리보기 ({previewSchedule.totalDays}일간)
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 'bold' }}>
                    하루 최대 {currMaxReviewsPerDay}개 절대 엄수
                  </span>
                </div>
                <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingRight: '0.2rem' }}>
                  {previewSchedule.dates.map((dateStr) => {
                    const items = previewSchedule.scheduleByDate[dateStr] || [];
                    const isToday = dateStr === todayStr;
                    return (
                      <div key={dateStr} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.35rem 0.55rem', borderRadius: '6px', fontSize: '0.72rem' }}>
                        <span style={{ color: isToday ? '#34d399' : '#94a3b8', fontWeight: isToday ? 'bold' : 'normal' }}>
                          {dateStr} {isToday ? '(오늘)' : ''} <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>({items.length}개)</span>
                        </span>
                        <span style={{ color: '#fff', fontWeight: '500' }}>
                          {items.map(it => `[${currSubject}] ${it.unitTitle} (${it.milestone}회차)`).join(' · ')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCurriculumModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '0.6rem', fontSize: '0.85rem' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    flex: 2,
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #f97316 100%)',
                    border: 'none',
                    padding: '0.6rem',
                    fontSize: '0.88rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
                  }}
                >
                  <Flame size={16} /> 재무 54강 복습 플랜 생성 & 새출발
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
              {/* Option 0: 재무 54강 1471430 맞춤 초기화 */}
              <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(249, 115, 22, 0.15) 100%)', border: '1px solid #a855f7', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <div style={{ fontWeight: 'bold', color: '#c084fc', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Flame size={16} color="#f97316" /> 🔥 재무 54강 1471430 새출발
                  </div>
                  <span style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', borderRadius: '4px', background: '#8b5cf6', color: '#fff', fontWeight: 'bold' }}>
                    NEW 맞춤 프리셋
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0', lineHeight: 1.4 }}>
                  재무 54강을 3강씩(총 18개 묶음), 오늘부터 하루 최대 2개씩 1471430 망각곡선 5회 복습으로 자동 세팅합니다.
                </p>
                <button
                  onClick={() => { setShowManageModal(false); setShowCurriculumModal(true); }}
                  className="btn btn-primary"
                  style={{ width: '100%', background: 'linear-gradient(135deg, #8b5cf6 0%, #f97316 100%)', border: 'none', padding: '0.55rem', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Sparkles size={15} /> 재무 54강 복습 플랜 생성기 열기
                </button>
              </div>

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
              <h4 style={{ fontSize: '0.88rem', color: '#fff', margin: '0 0 0.5rem 0' }}>등록된 휴가 내역</h4>
              {vacations.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>현재 등록된 휴가가 없습니다.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {vacations.map(v => (
                    <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.82rem', color: '#34d399' }}>
                        {v.startDate} ~ {v.endDate} ({v.days}일간)
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
              )}
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

    </div>
  );
}
