import { Target, Lock, X, ChevronRight, Star, Shield, Zap } from 'lucide-react';

export default function PhaseRoadmap({ onClose }) {
  const phases = [
    {
      level: 1,
      title: "무기력증 탈출",
      status: "진행 중 (현재)",
      desc: "완벽주의를 버리고 '최소 5번의 뽀모도로(약 2시간)'만 완성해도 승리하는 단계. 공부의 시동을 거는 것이 유일한 목표입니다.",
      icon: <Star size={24} color="#10b981" />,
      color: "#10b981"
    },
    {
      level: 2,
      title: "습관 정착과 1문제의 기적",
      status: "잠금",
      desc: "시동이 꺼지지 않게 유지하며, 하루 단 1문제라도 확실하게 '질적(오답노트/백지)'으로 소화하는 습관을 붙이는 단계입니다.",
      icon: <Lock size={24} color="var(--text-muted)" />,
      color: "#3b82f6"
    },
    {
      level: 3,
      title: "가속도: 순공 4시간 돌파",
      status: "잠금",
      desc: "뇌가 공부에 적응했습니다. 무리하지 않되, 뽀모도로 8회(순수 집중 4시간)를 안정적으로 돌파하며 체력을 기릅니다.",
      icon: <Lock size={24} color="var(--text-muted)" />,
      color: "#8b5cf6"
    },
    {
      level: 4,
      title: "실전 방어력 훈련",
      status: "잠금",
      desc: "약점(자주 틀리는 세법/회계 주제)을 파악하고 방어력을 올리는 집중 훈련 기간. 오답을 마주하는 두려움을 없앱니다.",
      icon: <Lock size={24} color="var(--text-muted)" />,
      color: "#f59e0b"
    },
    {
      level: 5,
      title: "본격 레이드: 예비 세무사",
      status: "잠금",
      desc: "순공 8시간 이상, 주말 실전 모의고사 등 진짜 고시생의 삶을 살아가는 최종 각성 상태. 여기까지 오면 합격은 시간 문제입니다.",
      icon: <Lock size={24} color="var(--text-muted)" />,
      color: "#ef4444"
    }
  ];

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

      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', margin: '0 0 0.5rem 0', color: 'var(--accent-primary)' }}>
          세무사 2차 정복 로드맵
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>
          조급해하지 마세요. 아주 잘게 쪼갠 계단을 하나씩 밟아 올라갑니다.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {phases.map((phase, idx) => (
          <div key={idx} style={{ 
            display: 'flex', gap: '1.5rem', alignItems: 'flex-start',
            background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: 'var(--radius-sm)',
            borderLeft: `4px solid ${phase.level === 1 ? phase.color : 'rgba(255,255,255,0.1)'}`,
            opacity: phase.level === 1 ? 1 : 0.6
          }}>
            <div style={{ 
              width: '48px', height: '48px', borderRadius: '50%', 
              background: phase.level === 1 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              {phase.icon}
            </div>
            
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: phase.level === 1 ? phase.color : 'var(--text-primary)' }}>
                  Phase {phase.level}: {phase.title}
                </h3>
                <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', background: phase.level === 1 ? phase.color : 'rgba(255,255,255,0.1)', color: phase.level === 1 ? '#fff' : 'var(--text-muted)', borderRadius: '12px', fontWeight: 'bold' }}>
                  {phase.status}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {phase.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--accent-primary)', fontSize: '0.95rem', fontWeight: 'bold' }}>
          "현재는 오직 Phase 1, 무기력증을 깨는 것에만 100% 집중하세요!"
        </p>
      </div>
    </div>
  );
}
