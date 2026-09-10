import React from 'react';

export default function TierBadge({ level = 1, size = 36, showGlow = true, className = '' }) {
  // Determine tier & division based on level
  let tier = 'bronze';
  let division = 3;
  let tierName = '브론즈';

  if (level < 4) {
    tier = 'bronze'; division = 3; tierName = '브론즈 III';
  } else if (level < 7) {
    tier = 'bronze'; division = 2; tierName = '브론즈 II';
  } else if (level < 10) {
    tier = 'bronze'; division = 1; tierName = '브론즈 I';
  } else if (level < 16) {
    tier = 'silver'; division = 3; tierName = '실버 III';
  } else if (level < 23) {
    tier = 'silver'; division = 2; tierName = '실버 II';
  } else if (level < 30) {
    tier = 'silver'; division = 1; tierName = '실버 I';
  } else if (level < 43) {
    tier = 'gold'; division = 3; tierName = '골드 III';
  } else if (level < 56) {
    tier = 'gold'; division = 2; tierName = '골드 II';
  } else if (level < 70) {
    tier = 'gold'; division = 1; tierName = '골드 I';
  } else if (level < 86) {
    tier = 'platinum'; division = 3; tierName = '플래티넘 III';
  } else if (level < 103) {
    tier = 'platinum'; division = 2; tierName = '플래티넘 II';
  } else if (level < 120) {
    tier = 'platinum'; division = 1; tierName = '플래티넘 I';
  } else {
    tier = 'master'; division = 0; tierName = '그랜드 마스터';
  }

  // Tier configuration: colors, gradients, glow
  const config = {
    bronze: {
      primary: '#ea580c',
      secondary: '#9a3412',
      highlight: '#fdba74',
      bgDark: '#2a1208',
      glow: 'rgba(234, 88, 12, 0.45)',
      symbol: 'shield'
    },
    silver: {
      primary: '#94a3b8',
      secondary: '#475569',
      highlight: '#f8fafc',
      bgDark: '#0f172a',
      glow: 'rgba(148, 163, 184, 0.45)',
      symbol: 'star'
    },
    gold: {
      primary: '#eab308',
      secondary: '#854d0e',
      highlight: '#fef08a',
      bgDark: '#2d1f03',
      glow: 'rgba(234, 179, 8, 0.5)',
      symbol: 'laurel'
    },
    platinum: {
      primary: '#06b6d4',
      secondary: '#0e7490',
      highlight: '#cffafe',
      bgDark: '#04222c',
      glow: 'rgba(6, 182, 212, 0.55)',
      symbol: 'diamond'
    },
    master: {
      primary: '#c084fc',
      secondary: '#7e22ce',
      highlight: '#fef08a',
      bgDark: '#230b38',
      glow: 'rgba(192, 132, 252, 0.65)',
      symbol: 'crown'
    }
  }[tier];

  const uid = `badge-${tier}-${level}`;

  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        filter: showGlow ? `drop-shadow(0 0 ${Math.max(4, size * 0.12)}px ${config.glow})` : 'none',
        flexShrink: 0
      }}
      title={`[${tierName}] Lv.${level}`}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={`${uid}-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={config.highlight} />
            <stop offset="40%" stopColor={config.primary} />
            <stop offset="100%" stopColor={config.secondary} />
          </linearGradient>
          <radialGradient id={`${uid}-inner`} cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor={config.primary} stopOpacity="0.35" />
            <stop offset="100%" stopColor={config.bgDark} stopOpacity="0.95" />
          </radialGradient>
        </defs>

        {/* Outer Shield / Crest Base */}
        <polygon
          points="50,4 88,20 82,72 50,96 18,72 12,20"
          fill={`url(#${uid}-inner)`}
          stroke={`url(#${uid}-grad)`}
          strokeWidth="4"
          strokeLinejoin="round"
        />

        {/* Inner Border Rim */}
        <polygon
          points="50,12 80,25 75,67 50,87 25,67 20,25"
          fill="none"
          stroke={`url(#${uid}-grad)`}
          strokeWidth="1.5"
          strokeOpacity="0.65"
          strokeLinejoin="round"
        />

        {/* Central Symbols */}
        {config.symbol === 'shield' && (
          <path
            d="M50,26 L66,35 L62,58 L50,68 L38,58 L34,35 Z"
            fill={`url(#${uid}-grad)`}
          />
        )}

        {config.symbol === 'star' && (
          <path
            d="M50,22 L55,36 L70,36 L58,46 L63,60 L50,51 L37,60 L42,46 L30,36 L45,36 Z"
            fill={`url(#${uid}-grad)`}
          />
        )}

        {config.symbol === 'laurel' && (
          <g fill={`url(#${uid}-grad)`}>
            <path d="M50,26 L54,36 L65,36 L56,43 L60,53 L50,47 L40,53 L44,43 L35,36 L46,36 Z" />
            <path d="M28,32 Q32,48 40,62 Q34,50 30,36 Z" opacity="0.85" />
            <path d="M72,32 Q68,48 60,62 Q66,50 70,36 Z" opacity="0.85" />
          </g>
        )}

        {config.symbol === 'diamond' && (
          <g fill={`url(#${uid}-grad)`}>
            <polygon points="50,22 68,34 50,65 32,34" />
            <line x1="32" y1="34" x2="68" y2="34" stroke="#fff" strokeWidth="1" opacity="0.7" />
            <line x1="50" y1="22" x2="50" y2="65" stroke="#fff" strokeWidth="0.8" opacity="0.6" />
          </g>
        )}

        {config.symbol === 'crown' && (
          <g fill={`url(#${uid}-grad)`}>
            <path d="M30,58 L30,42 L40,50 L50,30 L60,50 L70,42 L70,58 Z" />
            <circle cx="50" cy="27" r="3.5" fill={config.highlight} />
            <circle cx="30" cy="38" r="2.5" fill={config.highlight} />
            <circle cx="70" cy="38" r="2.5" fill={config.highlight} />
            <rect x="28" y="60" width="44" height="4" rx="2" fill={config.highlight} />
          </g>
        )}

        {/* Division Pips / Stars at bottom */}
        {division === 1 && (
          <g fill={config.highlight} transform="translate(50, 78)">
            <circle cx="0" cy="0" r="3.2" />
          </g>
        )}
        {division === 2 && (
          <g fill={config.highlight} transform="translate(50, 78)">
            <circle cx="-5.5" cy="0" r="3" />
            <circle cx="5.5" cy="0" r="3" />
          </g>
        )}
        {division === 3 && (
          <g fill={config.highlight} transform="translate(50, 78)">
            <circle cx="-9" cy="0" r="2.8" />
            <circle cx="0" cy="0" r="2.8" />
            <circle cx="9" cy="0" r="2.8" />
          </g>
        )}
        {division === 0 && (
          <g fill={config.highlight} transform="translate(50, 78)">
            <polygon points="0,-4 3.5,0 0,4 -3.5,0" />
          </g>
        )}
      </svg>
    </div>
  );
}
