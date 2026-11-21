import React from 'react';

export default function ExamPrinciplesBanner() {
  return (
    <div style={{
      margin: '0.25rem 0 0.45rem 0',
      padding: '0.45rem 0.85rem',
      borderRadius: '10px',
      background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
      border: '1px solid rgba(56, 189, 248, 0.22)',
      display: 'flex',
      alignItems: 'center',
      gap: '0.55rem',
      fontSize: '0.78rem',
      color: '#e2e8f0',
      lineHeight: 1.4,
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
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

      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.35rem 0.75rem'
      }}>
        <span>
          <strong style={{ color: '#67e8f9' }}>① 3강 집착 금지</strong>{' '}
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>(1강만 들어도 전진)</span>
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.25)', display: 'inline' }}>•</span>
        <span>
          <strong style={{ color: '#c084fc' }}>② 복습 강박 금지</strong>{' '}
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>(성취도 '하' 통과 + 14일차 100점 채점기 + 주말 보충이 해결)</span>
        </span>
      </div>
    </div>
  );
}
