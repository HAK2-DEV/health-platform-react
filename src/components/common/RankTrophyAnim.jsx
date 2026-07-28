import { useState, useEffect } from 'react'
import { useInViewOnce } from '../program/statsAnim'

// 「내 점수 및 랭킹」 트로피 — 포디움 위로 trophy1 팝업 안착 + 파티클 팡 → 트로피+색종이 최종.
//   화면에 처음 들어올 때 1회 재생. 트로피를 클릭하면 파티클이 다시 터짐(계속 재생 가능).
//   170x220 스테이지를 절대좌표로 구성하고, 104x104 슬롯 안에 오프셋+스케일로 배치.

const PARTICLES = ['/icons/reward/particle-1.png', '/icons/reward/particle-2.png', '/icons/reward/particle-3.png']
const CONFETTI = [
  { tx: -72, ty: -30, rot: 420, d: 0 }, { tx: -45, ty: -55, rot: -300, d: 0.15 },
  { tx: -20, ty: -64, rot: 360, d: 0.05 }, { tx: 8, ty: -66, rot: -380, d: 0.22 },
  { tx: 32, ty: -58, rot: 300, d: 0.1 }, { tx: 56, ty: -40, rot: -420, d: 0.18 },
  { tx: 72, ty: -22, rot: 340, d: 0.28 }, { tx: -60, ty: -10, rot: -260, d: 0.32 },
  { tx: 60, ty: -6, rot: 400, d: 0.36 }, { tx: -32, ty: -42, rot: 280, d: 0.4 },
  { tx: 20, ty: -50, rot: -360, d: 0.24 }, { tx: 0, ty: -62, rot: 200, d: 0.44 },
]
const STATIC_CONF = [
  { l: 18, t: 20, r: -18, c: 1 }, { l: 78, t: 22, r: 26, c: 2 }, { l: 24, t: 44, r: 14, c: 3 },
  { l: 80, t: 42, r: -22, c: 1 }, { l: 50, t: 11, r: 8, c: 2 }, { l: 66, t: 16, r: -12, c: 3 },
  { l: 34, t: 14, r: 20, c: 1 },
]

const CSS = `
@keyframes rt-drop {
  0%   { transform: translateX(-53%) translateY(-90px) scale(.72); opacity:0 }
  56%  { transform: translateX(-53%) translateY(0);                opacity:1 }
  68%  { transform: translateX(-53%) translateY(3px) scale(1.07, .89) }
  82%  { transform: translateX(-53%) translateY(-5px) }
  100% { transform: translateX(-53%) translateY(0) scale(1) }
}
.rt-drop { transform-origin:50% 100%; animation: rt-drop .88s .5s cubic-bezier(.32,.85,.35,1) both; }
@keyframes rt-pdip {
  0%   { transform: translateX(-50%) scale(1) }
  40%  { transform: translateX(-50%) scale(1.05, .92) }
  100% { transform: translateX(-50%) scale(1) }
}
.rt-pdip { transform-origin:50% 100%; animation: rt-pdip .5s .84s ease-out both; }
@keyframes rt-part {
  0%   { transform: translate(-50%,-50%) rotate(0) scale(.4); opacity:0 }
  14%  { opacity:1 }
  100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--r)) scale(.85); opacity:0 }
}
.rt-part { position:absolute; left:50%; top:38%; animation: rt-part 1.6s ease-out both; }
@keyframes rt-cfade { 0% { opacity:0 } 100% { opacity:1 } }
.rt-cfade { animation: rt-cfade .4s 2.6s ease both; }
@media (prefers-reduced-motion: reduce) {
  .rt-drop,.rt-pdip,.rt-cfade { animation: none !important; }
  .rt-drop { transform: translateX(-53%) }
  .rt-part { animation: none !important; opacity:0 }
}
`

export default function RankTrophyAnim({ className = '', scale = 0.8 }) {
  const [ref, inView] = useInViewOnce()
  const [playKey, setPlayKey] = useState(0)   // 전체 시퀀스(드롭/포디움/정적색종이) — 진입 1회
  const [burstKey, setBurstKey] = useState(0) // 파티클 버스트 — 리마운트로 재생(클릭마다 +1)
  useEffect(() => {
    if (!inView) return
    setPlayKey(1)
    const t = setTimeout(() => setBurstKey(k => k + 1), 1000)   // 착지 순간 첫 버스트
    return () => clearTimeout(t)
  }, [inView])

  return (
    <div ref={ref} className={className} onClick={() => setBurstKey(k => k + 1)}
      style={{ position: 'relative', width: 104, height: 104, overflow: 'visible', cursor: 'pointer' }}
      title="탭하면 축하 파티클이 터져요">
      <style>{CSS}</style>
      {playKey > 0 && (
        <div style={{ position: 'absolute', left: -33, top: -48, width: 170, height: 220, transformOrigin: '85px 111px', transform: `scale(${scale})` }}>
          {/* 포디움 */}
          <img src="/icons/reward/podium.png" alt="" aria-hidden="true" className="rt-pdip"
            style={{ position: 'absolute', left: '50%', bottom: 46, width: 105, transform: 'translateX(-50%)', zIndex: 1 }} />
          {/* 트로피 — translateY-only 낙하 */}
          <img src="/icons/reward/trophy1.png" alt="" aria-hidden="true" className="rt-drop"
            style={{ position: 'absolute', left: '50%', top: 46, width: 110, transform: 'translateX(-53%)', zIndex: 2 }} />
          {/* 최종 정적 색종이 */}
          {STATIC_CONF.map((s, i) => (
            <img key={`s${i}`} src={PARTICLES[(s.c - 1) % 3]} alt="" aria-hidden="true" className="rt-cfade"
              style={{ position: 'absolute', width: 38, left: `${s.l}%`, top: `${s.t}%`, transform: `translate(-18px, 8px) rotate(${s.r}deg)`, zIndex: 4 }} />
          ))}
          {/* 파티클 버스트 — burstKey 로 리마운트(클릭마다 다시 터짐) */}
          {burstKey > 0 && (
            <div key={burstKey}>
              {CONFETTI.map((p, i) => (
                <img key={i} src={PARTICLES[i % 3]} alt="" aria-hidden="true" className="rt-part"
                  style={{ width: 42, '--dx': `${p.tx}px`, '--dy': `${p.ty}px`, '--r': `${p.rot}deg`, animationDelay: `${(p.d * 0.14).toFixed(2)}s`, zIndex: 3 }} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
