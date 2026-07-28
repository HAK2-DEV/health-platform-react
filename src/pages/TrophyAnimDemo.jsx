import { useState } from 'react'
import { RotateCcw } from 'lucide-react'

// 트로피(내 점수·랭킹) 아이콘 애니메이션 데모 — 여러 버전 비교.
//   컨페티 3색(파랑/민트/보라)·초록 포디움은 주신 에셋 콘셉트를 CSS 로 근사.
//   라우트: /trophy-anim-demo

const TROPHY = '/icons/reward/trophy1.png'
const PARTICLES = ['/icons/reward/particle-1.png', '/icons/reward/particle-2.png', '/icons/reward/particle-3.png']
const C_BLUE = '#3db6f5', C_TEAL = '#3fd6c0', C_PURPLE = '#a982f0'

// 최종 단계 정적 색종이 — 스테이지 기준 %, 회전. c=파티클 종류(1~3). 트로피 주변(상단) 배치.
const STATIC_CONF = [
  { l: 18, t: 20, r: -18, c: 1 }, { l: 78, t: 22, r: 26, c: 2 }, { l: 24, t: 44, r: 14, c: 3 },
  { l: 80, t: 42, r: -22, c: 1 }, { l: 50, t: 11, r: 8, c: 2 }, { l: 66, t: 16, r: -12, c: 3 },
  { l: 34, t: 14, r: 20, c: 1 },
]
const CONFETTI = [
  { tx: -72, ty: -30, rot: 420, c: C_BLUE, d: 0 },
  { tx: -45, ty: -55, rot: -300, c: C_TEAL, d: 0.15 },
  { tx: -20, ty: -64, rot: 360, c: C_PURPLE, d: 0.05 },
  { tx: 8, ty: -66, rot: -380, c: C_BLUE, d: 0.22 },
  { tx: 32, ty: -58, rot: 300, c: C_TEAL, d: 0.1 },
  { tx: 56, ty: -40, rot: -420, c: C_PURPLE, d: 0.18 },
  { tx: 72, ty: -22, rot: 340, c: C_BLUE, d: 0.28 },
  { tx: -60, ty: -10, rot: -260, c: C_PURPLE, d: 0.32 },
  { tx: 60, ty: -6, rot: 400, c: C_TEAL, d: 0.36 },
  { tx: -32, ty: -42, rot: 280, c: C_BLUE, d: 0.4 },
  { tx: 20, ty: -50, rot: -360, c: C_PURPLE, d: 0.24 },
  { tx: 0, ty: -62, rot: 200, c: C_TEAL, d: 0.44 },
]

const CSS = `
/* 1) 떠오름 */
@keyframes t-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
@keyframes t-shadow { 0%,100% { transform: scaleX(1); opacity:.28 } 50% { transform: scaleX(.72); opacity:.15 } }
.t-bob { animation: t-bob 2s ease-in-out infinite; }
.t-shadow { animation: t-shadow 2s ease-in-out infinite; }

/* 2) 글로우 반짝임 */
@keyframes t-glow { 0%,100% { opacity:.35; transform: translate(-50%,-50%) scale(.9) } 50% { opacity:.75; transform: translate(-50%,-50%) scale(1.15) } }
@keyframes t-spark { 0%,100% { opacity:0; transform: scale(.4) } 50% { opacity:1; transform: scale(1) } }
.t-glow { animation: t-glow 1.8s ease-in-out infinite; }
.t-spark { animation: t-spark 1.6s ease-in-out infinite; }

/* 3) 컨페티 */
@keyframes t-confetti {
  0% { transform: translate(-50%,-50%) rotate(0) scale(.3); opacity:0 }
  12% { opacity:1 }
  45% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) rotate(calc(var(--rot)*.45)) scale(1); opacity:1 }
  100% { transform: translate(calc(-50% + var(--tx)*1.15), calc(-50% + 74px)) rotate(var(--rot)) scale(.85); opacity:0 }
}
.t-confetti { position:absolute; left:50%; top:46%; width:7px; height:15px; border-radius:4px; animation: t-confetti 2.2s ease-out infinite; }
.t-confetti-once { position:absolute; left:50%; top:46%; width:7px; height:15px; border-radius:4px; animation: t-confetti 1.7s ease-out both; }
@keyframes t-pop-soft { 0%,100% { transform: scale(1) } 12% { transform: scale(1.12) } 24% { transform: scale(1) } }
.t-pop-soft { animation: t-pop-soft 2.2s ease-in-out infinite; }

/* 4) 팝 등장 (1회) */
@keyframes t-pop-in {
  0% { transform: scale(.2) rotate(-18deg); opacity:0 }
  55% { transform: scale(1.18) rotate(6deg); opacity:1 }
  72% { transform: scale(.94) rotate(-3deg) }
  86% { transform: scale(1.05) rotate(1deg) }
  100% { transform: scale(1) rotate(0) }
}
.t-pop-in { animation: t-pop-in .8s cubic-bezier(.2,.8,.25,1) both; }

/* 5) 포디움 상승 */
@keyframes t-podium-up { 0% { transform: translateY(40px); opacity:0 } 60% { transform: translateY(-4px); opacity:1 } 100% { transform: translateY(0) } }
@keyframes t-land { 0% { transform: translateY(-14px) } 55% { transform: translateY(2px) } 100% { transform: translateY(0) } }
.t-podium-up { animation: t-podium-up .7s cubic-bezier(.2,.8,.25,1) both; }
.t-land { animation: t-land .7s cubic-bezier(.2,.8,.25,1) .1s both; }

/* ⑦ 완성 시퀀스 — 포디움 정지 → 트로피 낙하·안착 → 컨페티 → 글로우·스파클 지속 */
/* 트로피 낙하 — translateY만 애니(최종 translateY(0)=겹쳐진 위치). transform-origin bottom 으로 squash 가 포디움 쪽으로. */
@keyframes seq-drop {
  0%   { transform: translateX(-53%) translateY(-90px) scale(.72); opacity:0 }
  56%  { transform: translateX(-53%) translateY(0);                opacity:1 }
  68%  { transform: translateX(-53%) translateY(3px) scale(1.07, .89) }
  82%  { transform: translateX(-53%) translateY(-5px) }
  100% { transform: translateX(-53%) translateY(0) scale(1) }
}
.seq-drop { transform-origin:50% 100%; animation: seq-drop .88s .5s cubic-bezier(.32,.85,.35,1) both; }
/* 포디움 착지 딥 — 착지 타이밍(~1.0s)에 살짝 눌림 */
@keyframes seq-pdip {
  0%   { transform: translateX(-50%) scale(1) }
  40%  { transform: translateX(-50%) scale(1.05, .92) }
  100% { transform: translateX(-50%) scale(1) }
}
.seq-pdip { transform-origin:50% 100%; animation: seq-pdip .5s .84s ease-out both; }
/* 파티클 — 조각마다 --dx/--dy/--r 인라인, keyframes 하나가 소비 */
@keyframes seq-part {
  0%   { transform: translate(-50%,-50%) rotate(0) scale(.4); opacity:0 }
  14%  { opacity:1 }
  100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--r)) scale(.85); opacity:0 }
}
.seq-part { position:absolute; left:50%; top:38%; animation: seq-part 1.05s 1.0s ease-out both; }
@keyframes seq-cfade2 { 0% { opacity:0 } 100% { opacity:1 } }
.seq-cfade2 { animation: seq-cfade2 .4s 1.5s ease both; }

@media (prefers-reduced-motion: reduce) {
  .t-bob,.t-shadow,.t-glow,.t-spark,.t-confetti,.t-confetti-once,.t-pop-soft,.t-pop-in,.t-podium-up,.t-land,
  .seq-drop,.seq-pdip,.seq-part,.seq-cfade2 { animation: none !important; }
}
`

function Stage({ children }) {
  return <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">{children}</div>
}
function Trophy({ className = '', size = 88 }) {
  return <img src={TROPHY} alt="" aria-hidden="true" className={`object-contain relative z-10 ${className}`} style={{ width: size, height: size }} />
}

function VBob() {
  return (
    <Stage>
      <Trophy className="t-bob" />
      <span className="t-shadow absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-2.5 rounded-full bg-black/30 blur-[2px]" />
    </Stage>
  )
}
function VGlow() {
  return (
    <Stage>
      <span className="t-glow absolute left-1/2 top-1/2 w-20 h-20 rounded-full" style={{ background: 'radial-gradient(circle, rgba(251,191,36,.55), transparent 70%)' }} />
      <Trophy />
      {[[14, 20], [78, 26], [70, 74], [20, 70]].map(([l, t], i) => (
        <span key={i} className="t-spark absolute text-amber-300 text-sm" style={{ left: `${l}%`, top: `${t}%`, animationDelay: `${i * 0.35}s` }}>✦</span>
      ))}
    </Stage>
  )
}
function VConfetti() {
  return (
    <Stage>
      {CONFETTI.map((p, i) => (
        <span key={i} className="t-confetti" style={{ background: p.c, '--tx': `${p.tx}px`, '--ty': `${p.ty}px`, '--rot': `${p.rot}deg`, animationDelay: `${p.d}s` }} />
      ))}
      <Trophy className="t-pop-soft" />
    </Stage>
  )
}
function VPop({ playKey }) {
  return (
    <Stage>
      <Trophy key={playKey} className="t-pop-in" />
    </Stage>
  )
}
function VPopConfetti({ playKey }) {
  return (
    <Stage>
      <div key={playKey} className="absolute inset-0 flex items-center justify-center">
        {CONFETTI.map((p, i) => (
          <span key={i} className="t-confetti-once" style={{ background: p.c, '--tx': `${p.tx}px`, '--ty': `${p.ty}px`, '--rot': `${p.rot}deg`, animationDelay: `${p.d * 0.5}s` }} />
        ))}
        <Trophy className="t-pop-in" />
      </div>
    </Stage>
  )
}
function VPodium({ playKey }) {
  return (
    <Stage>
      <div key={playKey} className="absolute inset-0 flex flex-col items-center justify-center">
        <Trophy className="t-land relative z-10" size={68} />
        {/* 초록 포디움 (실제 에셋) */}
        <img src="/icons/reward/podium.png" alt="" aria-hidden="true" className="t-podium-up -mt-6 relative z-0 object-contain" style={{ width: 86 }} />
      </div>
    </Stage>
  )
}

// ⑦ 한 스테이지에서 절대좌표 겹치기(흐름 배치 금지). 재생 = key 로 서브트리 리마운트 → CSS 애니 처음부터.
function VSequence({ playKey }) {
  return (
    <div className="relative flex-shrink-0" style={{ width: 170, height: 220 }}>
      <div key={playKey} className="absolute inset-0">
        {/* 포디움 — 절대 고정 (착지 딥) */}
        <img src="/icons/reward/podium.png" alt="" aria-hidden="true" className="seq-pdip absolute object-contain"
          style={{ left: '50%', bottom: 46, width: 105, transform: 'translateX(-50%)', zIndex: 1 }} />
        {/* 트로피 — 절대, translateY-only 낙하 (최종 translateY(0) = 겹쳐진 위치). 크기 키우고 top 보정해 밑동 정렬 유지 */}
        <img src="/icons/reward/trophy1.png" alt="" aria-hidden="true" className="seq-drop absolute object-contain"
          style={{ left: '50%', top: 46, width: 110, transform: 'translateX(-53%)', zIndex: 2 }} />
        {/* 파티클 — 착지 순간 팡. 조각마다 --dx/--dy/--r 인라인 */}
        {CONFETTI.map((p, i) => (
          <img key={i} src={PARTICLES[i % 3]} alt="" aria-hidden="true" className="seq-part object-contain"
            style={{ width: 42, '--dx': `${p.tx}px`, '--dy': `${p.ty}px`, '--r': `${p.rot}deg`, animationDelay: `${(1.0 + p.d * 0.14).toFixed(2)}s`, zIndex: 3 }} />
        ))}
        {/* 최종 정적 색종이 (trophy-final 느낌) — 트로피 주변 */}
        {STATIC_CONF.map((s, i) => (
          <img key={`s${i}`} src={PARTICLES[(s.c - 1) % 3]} alt="" aria-hidden="true" className="seq-cfade2 object-contain absolute"
            style={{ width: 38, left: `${s.l}%`, top: `${s.t}%`, transform: `translateX(-18px) rotate(${s.r}deg)`, zIndex: 4 }} />
        ))}
      </div>
    </div>
  )
}

const VERSIONS = [
  { key: 'bob', label: '① 떠오름', desc: '위아래로 부드럽게 둥실. 그림자도 함께 호흡.', oneShot: false, render: () => <VBob /> },
  { key: 'glow', label: '② 반짝임 (글로우+스파클)', desc: '금빛 후광이 맥동하고 ✦가 반짝여요.', oneShot: false, render: () => <VGlow /> },
  { key: 'confetti', label: '③ 컨페티 축하', desc: '파랑·민트·보라 조각이 팡 터져 흩날려요(주신 색).', oneShot: false, render: () => <VConfetti /> },
  { key: 'pop', label: '④ 팝 등장', desc: '통통 튀며 등장(스프링). 화면 진입/랭킹 상승 순간용.', oneShot: true, render: (k) => <VPop playKey={k} /> },
  { key: 'podium', label: '⑤ 포디움 상승', desc: '초록 포디움이 솟아오르고 트로피가 안착(주신 포디움).', oneShot: true, render: (k) => <VPodium playKey={k} /> },
  { key: 'popconfetti', label: '⑥ 팝 떠오름 + 컨페티 🎉', desc: '트로피가 팡 떠오르며 파랑·민트·보라 조각이 축하로 흩날려요. 랭킹 상승·달성 순간 추천.', oneShot: true, render: (k) => <VPopConfetti playKey={k} /> },
  { key: 'sequence', label: '⑦ 완성 시퀀스 🏆🎉 (요청)', desc: '포디움 고정 → trophy1이 그 위로 팝업 안착 → 파티클(1·2·3) 팡 → 최종엔 색종이가 트로피 주변에 자리잡아요. (포디움 위치 처음부터 끝까지 고정)', oneShot: true, render: (k) => <VSequence playKey={k} /> },
]

export default function TrophyAnimDemo() {
  const [keys, setKeys] = useState({})
  const replay = (k) => setKeys(s => ({ ...s, [k]: (s[k] || 0) + 1 }))
  return (
    <div className="min-h-screen bg-gray-50">
      <style>{CSS}</style>
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">트로피 아이콘 애니메이션 데모</h1>
          <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
            대시보드 「내 점수 및 랭킹」 트로피에 넣을 애니메이션 후보예요. 마음에 드는 번호(또는 조합)를 알려주세요.
            컨페티·포디움은 주신 3D 에셋 콘셉트를 CSS로 근사했고, 확정되면 실제 에셋으로 교체합니다.
          </p>
        </div>

        <div className="space-y-3">
          {VERSIONS.map(v => (
            <div key={v.key} className="bg-white rounded-2xl p-3 border border-gray-100 flex items-center gap-3">
              {/* 실제 카드 배경(연회색)과 비슷하게 */}
              <div className="rounded-xl bg-gray-50 border border-gray-100">
                {v.render(keys[v.key] || 0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-bold text-gray-800">{v.label}</p>
                <p className="text-[11.5px] text-gray-400 mt-0.5 leading-relaxed">{v.desc}</p>
                {v.oneShot && (
                  <button type="button" onClick={() => replay(v.key)}
                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold transition">
                    <RotateCcw className="w-3 h-3" /> 다시 재생
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 text-center pt-2 leading-relaxed">
          ①②③은 계속 반복, ④⑤는 「다시 재생」으로 확인.<br />실제 적용 시엔 화면 진입 1회 재생 또는 상시 은은하게 등 원하시는 방식으로 연결합니다.
        </p>
      </div>
    </div>
  )
}
