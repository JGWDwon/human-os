import { Rocket, Target, Shield, BookOpen, Lock, X } from 'lucide-react';

export default function PhaseTwoPreview({ onClose }) {
  return (
    <div className="glass-panel animate-fade-in" style={{ 
      position: 'relative',
      padding: '2rem', 
      border: '2px dashed var(--accent-primary)', 
      background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.98), rgba(16, 185, 129, 0.1))',
      color: 'var(--text-primary)'
    }}>
      <button 
        onClick={onClose}
        className="btn"
        style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
      >
        <X size={24} />
      </button>

      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-primary)', marginBottom: '1rem' }}>
          <Lock size={32} />
        </div>
        <h2 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', color: 'var(--accent-primary)' }}>
          Phase 2: 본격 레이드 모드
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', margin: 0 }}>
          세무사 2차 시험 정복을 위한 각성 단계 (현재 잠금 상태)
        </p>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '2rem' }}>
        <p style={{ margin: 0, lineHeight: 1.6, color: '#cbd5e1' }}>
          <strong>"무기력증은 완전히 사라졌다. 이제 압도적인 공부량으로 찍어누를 차례다."</strong><br /><br />
          Phase 1이 무기력증을 이겨내고 책상에 앉는 습관(5 뽀모도로)을 만드는 과정이었다면, 
          Phase 2는 흔들림 없는 강철 멘탈로 극한의 수험량을 소화해내는 진정한 고시생 모드입니다. 
          이 단계에서는 단순한 '시간 채우기'를 넘어, <strong>'질적 공부'</strong>에 대한 확실한 보상이 주어집니다.
        </p>
      </div>

      <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
        🚀 Phase 2 예정 기능 (컨셉)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        
        {/* Feature 1 */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid #ef4444' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', color: '#ef4444', fontSize: '1.1rem' }}>
            <Target size={20} /> 보스전: 백지 복습 레이드
          </h4>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            세법학과 재무회계의 핵심 논제를 <strong>'백지'에 완벽하게 써내야만</strong> 처치할 수 있는 주간 보스 몬스터가 등장합니다. 보스 처치 시 막대한 양의 전리품(희귀 경험치)을 획득합니다.
          </p>
        </div>

        {/* Feature 2 */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid #3b82f6' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', color: '#3b82f6', fontSize: '1.1rem' }}>
            <BookOpen size={20} /> 실전 주간 모의고사
          </h4>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            매주 주말, 실제 세무사 2차 시험 시간표와 동일하게 타이머가 굴러가는 <strong>'실전 모의고사 모드'</strong>가 활성화됩니다. 레이드 성공 시 일주일간 버프 효과를 받습니다.
          </p>
        </div>

        {/* Feature 3 */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid #8b5cf6' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', color: '#8b5cf6', fontSize: '1.1rem' }}>
            <Shield size={20} /> 스탯 분배: 오답 방어력
          </h4>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            단순히 경험치로 레벨만 오르는 것이 아닙니다. 틀린 문제를 오답노트로 복습할 때마다 <strong>[방어력 스탯]</strong> 포인트를 얻어, 본인만의 캐릭터 스탯을 찍을 수 있습니다.
          </p>
        </div>

        {/* Feature 4 */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid #f59e0b' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1rem 0', color: '#f59e0b', fontSize: '1.1rem' }}>
            <Rocket size={20} /> 직업 전직: 예비 세무사
          </h4>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            초보자, 기사를 넘어 <strong>'수습 세무사', '예비 세무사'</strong> 전직 테크 트리가 열립니다. 목표에 한 걸음씩 다가가는 것을 시각적인 직업 칭호로 확인하세요.
          </p>
        </div>

      </div>

      <div style={{ marginTop: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--accent-primary)', fontSize: '0.9rem', fontStyle: 'italic' }}>
          "현재는 Phase 1에 집중할 때입니다. 5번의 뽀모도로가 가볍게 느껴지는 날, 봉인을 해제하세요."
        </p>
      </div>
    </div>
  );
}
