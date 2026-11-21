import React, { useState, useEffect } from 'react';
import { Shield, Flame, CheckCircle2, ChevronRight, Sparkles, Palmtree, ArrowRight } from 'lucide-react';
import { storage } from '../utils/storage';

export default function DefenseBanner({ onNavigateToReviews, selectedDate }) {
  const [defense, setDefense] = useState(null);

  const refreshDefense = () => {
    const todayStr = selectedDate || storage._dateToStr(new Date());
    const result = storage.getDailyDefenseStatus(todayStr);
    setDefense(result);
  };

  useEffect(() => {
    refreshDefense();

    const handleSync = () => refreshDefense();
    window.addEventListener('storage-sync', handleSync);
    window.addEventListener('daily-logs-updated', handleSync);
    window.addEventListener('xp-updated', handleSync);

    return () => {
      window.removeEventListener('storage-sync', handleSync);
      window.removeEventListener('daily-logs-updated', handleSync);
      window.removeEventListener('xp-updated', handleSync);
    };
  }, [selectedDate]);

  if (!defense) return null;

  const { status, totalReviews, completedReviews, isStep1Cleared, isStep2Cleared, isVacation } = defense;

  // 1. Vacation Mode
  if (isVacation) {
    return (
      <div style={{
        margin: '0.5rem 0 1rem 0',
        padding: '0.75rem 1rem',
        borderRadius: '12px',
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🌴</span>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '0.88rem', color: '#34d399' }}>
              휴가 모드 진행 중 (정상 휴식일)
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              사전 예약된 휴식일입니다. 편안한 재충전의 시간을 보내세요!
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Full Cleared: 1단계 + 2단계 모두 달성
  if (status === 'full_cleared' || isStep2Cleared) {
    return (
      <div 
        onClick={onNavigateToReviews}
        style={{
          margin: '0.5rem 0 1rem 0',
          padding: '0.85rem 1.15rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(239, 68, 68, 0.18))',
          border: '1.5px solid rgba(245, 158, 11, 0.65)',
          boxShadow: '0 4px 15px rgba(245, 158, 11, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: onNavigateToReviews ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
            color: '#fff',
            borderRadius: '50%',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
          }}>
            <Flame size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.92rem',
                fontWeight: 'bold',
                color: '#fbbf24',
                letterSpacing: '-0.2px'
              }}>
                🔥 오늘 목표 완전 정복!
              </span>
              <span style={{
                fontSize: '0.7rem',
                background: 'rgba(245, 158, 11, 0.25)',
                color: '#fef08a',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                fontWeight: 'bold'
              }}>
                1·2단계 All Clear
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#e2e8f0', marginTop: '0.15rem', lineHeight: 1.35 }}>
              1단계 최저 방어선(복습 100%) + 2단계 새 강의 수강 &amp; 1일차 복습까지 완벽 주행 완료!
            </div>
          </div>
        </div>
        {onNavigateToReviews && (
          <ChevronRight size={18} color="#fbbf24" style={{ flexShrink: 0, opacity: 0.8 }} />
        )}
      </div>
    );
  }

  // 3. Step 1 Cleared: 최저 방어선 돌파 (복습 100% 완료)
  if (status === 'review_cleared' || isStep1Cleared) {
    return (
      <div 
        onClick={onNavigateToReviews}
        style={{
          margin: '0.5rem 0 1rem 0',
          padding: '0.85rem 1.15rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.2))',
          border: '1.5px solid rgba(16, 185, 129, 0.65)',
          boxShadow: '0 4px 15px rgba(16, 185, 129, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: onNavigateToReviews ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: '#fff',
            borderRadius: '50%',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
          }}>
            <Shield size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.92rem',
                fontWeight: 'bold',
                color: '#34d399',
                letterSpacing: '-0.2px'
              }}>
                🛡️ 최저 방어선 돌파 완료!
              </span>
              <span style={{
                fontSize: '0.7rem',
                background: 'rgba(16, 185, 129, 0.25)',
                color: '#a7f3d0',
                padding: '0.1rem 0.45rem',
                borderRadius: '10px',
                fontWeight: 'bold'
              }}>
                복습 부채 0건
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#cbd5e1', marginTop: '0.15rem', lineHeight: 1.35 }}>
              (복습 부채 0건 — 지금 종료해도 도피 아님 / 힘 남으면 강의 추가 가능)
            </div>
          </div>
        </div>
        {onNavigateToReviews && (
          <ChevronRight size={18} color="#34d399" style={{ flexShrink: 0, opacity: 0.8 }} />
        )}
      </div>
    );
  }

  // 4. Default / In Progress: 복습 미완료 상태 (Step 1 진행 중)
  const pct = totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 100) : 100;

  return (
    <div 
      onClick={onNavigateToReviews}
      style={{
        margin: '0.5rem 0 1rem 0',
        padding: '0.8rem 1.1rem',
        borderRadius: '12px',
        background: 'rgba(30, 41, 59, 0.75)',
        border: '1px solid rgba(139, 92, 246, 0.35)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        cursor: onNavigateToReviews ? 'pointer' : 'default',
        transition: 'all 0.2s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={18} color="#a78bfa" />
          <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#c4b5fd' }}>
            1단계 [최저 방어선] 진행 중
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            (오늘 복습 {completedReviews}/{totalReviews} 완료)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: pct === 100 ? '#34d399' : '#a78bfa' }}>
            {pct}%
          </span>
          {onNavigateToReviews && <ChevronRight size={15} color="#94a3b8" />}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        width: '100%',
        height: '6px',
        background: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '3px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #8b5cf6, #10b981)',
          transition: 'width 0.3s ease'
        }} />
      </div>

      <div style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: 1.35 }}>
        💡 기분이 바닥인 날은 새 인강을 듣지 말고, 막히면 바로 보면서 성취도 '하'로라도 오늘 복습만 전부 완료하기
      </div>
    </div>
  );
}
