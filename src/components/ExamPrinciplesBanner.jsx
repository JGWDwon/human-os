import React from 'react';

export default function ExamPrinciplesBanner() {
  return (
    <div style={{
      margin: '0.25rem 0 0.55rem 0',
      padding: '0.55rem 0.9rem',
      borderRadius: '10px',
      background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
      border: '1px solid rgba(56, 189, 248, 0.22)',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.45rem',
      fontSize: '0.78rem',
      color: '#e2e8f0',
      lineHeight: 1.45,
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
    }}>
      {/* 1~2번 핵심 마인드셋 원칙 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.35rem 0.65rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          color: '#38bdf8',
          fontWeight: 'bold',
          flexShrink: 0,
          fontSize: '0.78rem'
        }}>
          <span style={{ fontSize: '0.95rem' }}>🧭</span>
          <span style={{ whiteSpace: 'nowrap' }}>핵심 원칙</span>
          <span style={{ opacity: 0.35, marginLeft: '0.15rem' }}>|</span>
        </div>

        <span>
          <strong style={{ color: '#67e8f9' }}>1. 3강 집착 금지</strong>{' '}
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>(1강만 들어도 전진)</span>
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.25)', display: 'inline' }}>•</span>
        <span>
          <strong style={{ color: '#c084fc' }}>2. 복습 강박 금지</strong>{' '}
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>(성취도 '하' 통과 + 14일차 100점 채점기 + 주말 보충이 해결)</span>
        </span>
      </div>

      {/* 3번 일일 학습 루틴 */}
      <div style={{
        borderTop: '1px dashed rgba(255, 255, 255, 0.12)',
        paddingTop: '0.4rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        fontSize: '0.74rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', flexWrap: 'wrap' }}>
          <strong style={{ color: '#34d399', whiteSpace: 'nowrap' }}>3. ① 강의가 있는 날</strong>
          <span style={{ color: '#cbd5e1' }}>
            세법관련 강의 (오전 2~3h) ➔ (고단백 식사) ➔ 세법관련 복습 (최대 3.5h 컷) ➔ (식사·휴식) ➔ 쉬운과목 복습 ➔ 나머지과목 강의
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', flexWrap: 'wrap' }}>
          <strong style={{ color: '#fbbf24', whiteSpace: 'nowrap' }}>② 강의가 없는 날 / 컨디션이 낮은 날 / 복습이 많은 날</strong>
          <span style={{ color: '#cbd5e1' }}>
            쉬운과목 복습 (30~50m) ➔ 나머지과목 복습 (1~1.5h) ➔ 세무관련 복습 (3h+)
          </span>
        </div>
      </div>
    </div>
  );
}
