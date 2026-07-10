import { useState, useEffect } from 'react'

// 스트릭 불꽃 — 평소엔 정적, 클릭 또는 외부 신호(playSignal 변화, 예: 도장 연출)로 타오름.
//   키프레임은 index.css 에 값 그대로. 마크업(26×30, 불티 3개, 22×24 SVG, 외염/내염/코어,
//   transform-origin·animation-delay·--ex·drop-shadow, 헤일로 없음)도 값 그대로.
//   ※ 클릭 재생용 조정: infinite → 유한 반복(마지막 키프레임=rest 에서 끝나 freeze 없음),
//     불티 base opacity:0(정지 시 안 보이게). path 좌표·그라데이션 stop 은 절대 불변.
function FlameIcon({ className = '', playSignal = 0, interactive = true }) {
  const [runKey, setRunKey] = useState(0)
  // 외부 신호(도장 연출 등)로도 타오르게 — playSignal 이 바뀌면 재생
  useEffect(() => { if (playSignal) setRunKey((k) => k + 1) }, [playSignal])
  const on = runKey > 0
  const A = (v) => (on ? v : 'none')   // 클릭 후에만 애니메이션(정지 시 정적 rest)
  return (
    <span
      className={className}
      onClick={interactive ? (e) => { e.stopPropagation(); setRunKey((k) => k + 1) } : undefined}
      style={{ position: 'relative', display: 'inline-flex', width: 26, height: 30, alignItems: 'flex-end', justifyContent: 'center', cursor: interactive ? 'pointer' : 'default' }}
    >
      {/* 클릭마다 remount → 애니메이션 처음부터 재생 */}
      <span key={runKey} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        {/* 불티 3개 */}
        <span style={{ position: 'absolute', left: 9, bottom: 13, width: 2, height: 2, borderRadius: 999, background: '#FFD98A', opacity: 0, '--ex': '-3px', animation: A('emberRise 1.4s ease-out 2'), animationDelay: '0.1s' }} />
        <span style={{ position: 'absolute', left: 15, bottom: 15, width: 1.6, height: 1.6, borderRadius: 999, background: '#FFB65C', opacity: 0, '--ex': '3px', animation: A('emberRise 1.7s ease-out 2'), animationDelay: '0.7s' }} />
        <span style={{ position: 'absolute', left: 12, bottom: 12, width: 1.4, height: 1.4, borderRadius: 999, background: '#FFE3A8', opacity: 0, '--ex': '1px', animation: A('emberRise 1.2s ease-out 2'), animationDelay: '1.1s' }} />
        {/* 불꽃 본체 */}
        <svg width="22" height="24" viewBox="0 0 24 26" fill="none" style={{ position: 'relative', transformOrigin: '50% 100%', animation: A('flameBody 0.72s ease-in-out 4'), filter: 'drop-shadow(0 1px 3px rgba(244,81,30,0.55))' }}>
          <defs>
            <linearGradient id="streakFlame2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#F4471E" /><stop offset="0.45" stopColor="#FF8A1E" /><stop offset="1" stopColor="#FFD23F" /></linearGradient>
            <linearGradient id="streakFlameInner" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#FF9A2E" /><stop offset="0.55" stopColor="#FFDA5A" /><stop offset="1" stopColor="#FFF3C4" /></linearGradient>
          </defs>
          {/* 외염 */}
          <path d="M8.5 16.5A2.5 2.5 0 0 0 11 14c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" fill="url(#streakFlame2)" />
          {/* 내염 (약간 빠르게) */}
          <path d="M10 18.5a2 2 0 0 0 2-2c0-1-.4-1.6-.8-2.4-.7-1.5-.2-2.9 1.2-4.1.4 1.8 1.4 3.4 2.6 4.6 1.1 1 1.6 2.2 1.6 3.4a4.4 4.4 0 1 1-8.8 0c0-.8.3-1.5.7-2a2 2 0 0 0 1.5 2.5z" fill="url(#streakFlameInner)" style={{ transformOrigin: '50% 90%', animation: A('flameCoreLive 0.5s ease-in-out 5') }} />
          {/* 코어 */}
          <ellipse cx="12" cy="19" rx="2.1" ry="3" fill="#FFF6DA" opacity="0.92" style={{ transformOrigin: '50% 85%', animation: A('flameCoreLive 0.42s ease-in-out 6'), animationDelay: '0.12s' }} />
        </svg>
      </span>
    </span>
  )
}

export default FlameIcon
