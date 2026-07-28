import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Icon3D } from '../components/program/ProgramHome'

// 공지 아이콘 애니메이션 데모 — 새 공지가 등록되면 "조회 전까지" 주목 애니메이션을 준다.
//   여러 후보를 나란히 비교 + 「안 읽음/읽음」 토글로 상태 시뮬레이션.
//   라우트: /notice-anim-demo

const CSS = `
@keyframes na-wiggle {
  0%, 55%, 100% { transform: rotate(0deg); }
  60% { transform: rotate(-13deg); }
  66% { transform: rotate(11deg); }
  72% { transform: rotate(-8deg); }
  78% { transform: rotate(5deg); }
  84% { transform: rotate(-2deg); }
  90% { transform: rotate(0deg); }
}
.na-wiggle { animation: na-wiggle 2.4s ease-in-out infinite; transform-origin: 55% 60%; }

@keyframes na-ring {
  0% { transform: scale(0.75); opacity: 0.55; }
  100% { transform: scale(1.9); opacity: 0; }
}
.na-ring::before {
  content: ''; position: absolute; inset: -3px; border-radius: 9999px;
  background: rgba(239,68,68,0.30); z-index: 0;
  animation: na-ring 1.7s ease-out infinite;
}

@keyframes na-dot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.4); opacity: 0.65; }
}
.na-dot { animation: na-dot 1.1s ease-in-out infinite; }

@keyframes na-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
.na-bob { animation: na-bob 1.3s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .na-wiggle, .na-ring::before, .na-dot, .na-bob { animation: none !important; }
}
`

function NewBadge() {
  return <span className="ml-1 px-1.5 py-[1px] rounded-full bg-red-500 text-white text-[9px] font-extrabold tracking-wide align-middle">NEW</span>
}

// 실제 공지 카드 모양 재현 + variant 별 애니메이션
function NoticeCard({ unread, variant }) {
  const wiggle = unread && (variant === 'wiggle' || variant === 'combo')
  const bob = unread && variant === 'bob'
  const ring = unread && (variant === 'ring' || variant === 'combo')
  const dot = unread && (variant === 'dot' || variant === 'combo')
  return (
    <button type="button"
      className="w-full flex items-center gap-3 rounded-2xl p-3.5 bg-white border border-gray-100 shadow-soft text-left">
      <span className={`relative flex items-center justify-center flex-shrink-0 ${ring ? 'na-ring' : ''}`}>
        <span className="relative z-10 inline-flex">
          <Icon3D src="/icons/feature/notice.png" emoji="📢" className={`w-8 h-8 ${wiggle ? 'na-wiggle' : ''} ${bob ? 'na-bob' : ''}`} />
          {dot && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white na-dot" />}
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-gray-800">공지사항{unread && <NewBadge />}</p>
        <p className="text-[12px] text-gray-500 truncate">{unread ? '새로운 공지가 등록되었어요' : '등록된 공지가 없어요'}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
    </button>
  )
}

const VARIANTS = [
  { key: 'wiggle', label: '① 흔들림 (종 울리듯)', desc: '메가폰이 주기적으로 좌우로 흔들려요. 눈에 확 띔.' },
  { key: 'ring', label: '② 펄스 링', desc: '아이콘 뒤로 빨간 파동이 퍼져요. 은은한 주목.' },
  { key: 'dot', label: '③ 빨간 점 배지', desc: '우상단 빨간 점이 콩닥콩닥. 가장 절제된 방식.' },
  { key: 'bob', label: '④ 통통 튐 (bob)', desc: '위아래로 살짝 튀어요. 가볍고 귀여움.' },
  { key: 'combo', label: '⑤ 흔들림 + 빨간 점 (조합)', desc: '움직임 + 배지. 가장 강한 주목.' },
]

export default function NoticeAnimDemo() {
  const [unread, setUnread] = useState(true)
  return (
    <div className="min-h-screen bg-gray-50">
      <style>{CSS}</style>
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">공지 아이콘 애니메이션 데모</h1>
          <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
            새 공지가 등록되면 <b className="text-gray-700">조회하기 전까지</b> 공지 아이콘에 주목 애니메이션을 줍니다.
            아래 후보를 비교해 보고 마음에 드는 걸 알려주세요.
          </p>
        </div>

        {/* 상태 토글 */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-2">
          <span className="text-[12px] font-bold text-gray-500 px-1">상태</span>
          <div className="inline-flex items-center gap-0.5 bg-gray-100 rounded-full p-0.5 ml-auto">
            <button type="button" onClick={() => setUnread(true)}
              className={`px-3 py-1 rounded-full text-[12px] font-bold transition ${unread ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500'}`}>새 공지 (안 읽음)</button>
            <button type="button" onClick={() => setUnread(false)}
              className={`px-3 py-1 rounded-full text-[12px] font-bold transition ${!unread ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>조회함 (읽음)</button>
          </div>
        </div>

        {/* 후보들 */}
        <div className="space-y-3">
          {VARIANTS.map(v => (
            <div key={v.key} className="bg-white/60 rounded-2xl p-3 border border-gray-100">
              <div className="flex items-baseline justify-between gap-2 mb-2 px-1">
                <span className="text-[13px] font-bold text-gray-800">{v.label}</span>
              </div>
              <NoticeCard unread={unread} variant={v.key} />
              <p className="text-[11.5px] text-gray-400 mt-2 px-1 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-gray-400 text-center pt-2 leading-relaxed">
          「조회함(읽음)」으로 바꾸면 애니메이션·배지가 사라집니다.<br />
          실제 적용 시엔 <b className="text-gray-500">공지 열람(markSeen)</b> 시점에 멈추게 연결합니다.
        </p>
      </div>
    </div>
  )
}
