import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

// 🔧 운영자 개요 배너 「스택(덱)」 프로토타입 — 라우트: /dev/banner-stack
//   접힘=top카드+뒤 카드 엣지 peek / top 박스 탭 → 화면 중앙 팝업(전체 목록) / 성취는 덱 밖 독립.

// ── 컨페티(새 성취일 때만) ──
const CONFETTI = Array.from({ length: 14 }, (_, i) => {
  const ang = (-90 + (i / 14) * 360) * (Math.PI / 180)
  const dist = 40 + (i % 4) * 14
  const colors = ['#34d399', '#fbbf24', '#f87171', '#60a5fa', '#a78bfa']
  return {
    x: Math.round(Math.cos(ang) * dist),
    y: Math.round(Math.sin(ang) * dist * 0.8) - 4,
    c: colors[i % colors.length],
    rot: (i % 2 ? 1 : -1) * (140 + (i % 5) * 40),
    delay: (i % 6) * 0.02,
  }
})

const Trophy = ({ cls }) => (
  <img src="/icons/cheer/trophy.png" alt="" aria-hidden="true" className={cls}
    onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('span'), { textContent: '🏆', className: cls.includes('w-14') ? 'text-[34px]' : 'text-2xl' })) }} />
)

// ── 개별 배너 카드 ──
function TodoCard() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[14px] font-extrabold text-amber-900">🔔 처리할 일 1건</p>
        <p className="text-[11px] text-amber-700/70">지금 처리하면 원활해요</p>
      </div>
      <button type="button" onClick={(e) => e.stopPropagation()}
        className="w-full h-10 rounded-xl bg-white border border-amber-200 text-[13px] font-bold text-amber-900 flex items-center justify-center gap-2 active:scale-[0.98] transition">
        퀴즈 채점 <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px]">1</span>
      </button>
    </div>
  )
}

function SurveyCard() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-[14px] font-extrabold text-amber-900 mb-0.5">🏁 종료 설문 준비</p>
      <p className="text-[12px] text-amber-800/80 leading-snug mb-3 break-keep">마무리가 다가와요. 시작하면 참여자에게 종료 설문이 나가요. 먼저 문항을 확인하세요.</p>
      <div className="flex gap-2">
        <button type="button" onClick={(e) => e.stopPropagation()}
          className="flex-1 h-10 rounded-xl bg-white border border-amber-200 text-[13px] font-bold text-amber-900 active:scale-[0.98] transition">종료 문항 검토</button>
        <button type="button" onClick={(e) => e.stopPropagation()}
          className="flex-1 h-10 rounded-xl bg-amber-500 text-white text-[13px] font-bold active:scale-[0.98] transition">종료 설문 시작</button>
      </div>
    </div>
  )
}

function ReportCard() {
  return (
    <button type="button" onClick={(e) => e.stopPropagation()}
      className="w-full flex items-center gap-2.5 p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50 text-left active:scale-[0.99] transition">
      <span className="text-lg">💡</span>
      <span className="flex-1 text-[13px] font-semibold text-emerald-800">이번 주 리포트가 도착했어요</span>
      <span className="text-emerald-500 text-lg">›</span>
    </button>
  )
}

// 지난 성취 — 덱 밖 독립, 조용한 얇은 줄(컨페티 없음)
function MilestoneQuietCard() {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/60">
      <Trophy cls="w-8 h-8 object-contain flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-emerald-900">큰 진전이에요 · 누적 인증 50건</p>
        <p className="text-[11px] text-emerald-700/70">참여자 10명 돌파</p>
      </div>
    </div>
  )
}

// 새 성취 — 덱 밖 독립, 컨페티 + 글로우
function MilestoneHeroCard({ onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0, boxShadow: ['0 0 0 0 rgba(16,185,129,0)', '0 0 26px 5px rgba(16,185,129,0.45)', '0 0 0 0 rgba(16,185,129,0)'] }}
      transition={{ default: { type: 'spring', stiffness: 320, damping: 20 }, boxShadow: { duration: 1.5, repeat: 1, ease: 'easeInOut' } }}
      className="relative rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 p-4 overflow-visible">
      <button type="button" onClick={onDismiss} aria-label="닫기"
        className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full text-emerald-500/70 hover:bg-white/60 flex items-center justify-center">
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-3.5">
        <div className="relative flex-shrink-0 w-14 h-14">
          {CONFETTI.map((c, i) => (
            <motion.span key={i} className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full -ml-1 -mt-1" style={{ background: c.c }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.3, rotate: 0 }}
              animate={{ x: c.x, y: c.y, opacity: [0, 1, 1, 0], scale: [0.3, 1, 1, 0.8], rotate: c.rot }}
              transition={{ duration: 1.1, delay: 0.12 + c.delay, ease: 'easeOut' }} />
          ))}
          <motion.div className="relative w-14 h-14 flex items-center justify-center"
            initial={{ scale: 0, rotate: -28 }} animate={{ scale: [0, 1.28, 0.96, 1], rotate: [-28, 10, -4, 0] }}
            transition={{ duration: 0.66, delay: 0.06, ease: 'easeOut' }}>
            <Trophy cls="w-14 h-14 object-contain drop-shadow" />
          </motion.div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15.5px] font-extrabold text-emerald-900">큰 진전이에요!</p>
          <div className="mt-1.5 space-y-1">
            <p className="text-[13px] font-bold text-emerald-800">🔥 누적 인증 50건!</p>
            <p className="text-[13px] font-bold text-emerald-800">🎉 참여자 10명 돌파!</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── 접힘 덱(top 카드 + 뒤 카드 엣지 peek). 탭 → 중앙 팝업 ──
function CollapsedDeck({ cards, onOpen }) {
  const behind = cards.slice(1, 3)   // 뒤로 최대 2장 peek
  const pad = behind.length ? behind.length * 7 + 6 : 0   // peek를 컨테이너 안쪽 여백에 예약(아래 카드와 겹침 방지)
  return (
    <div className="relative" style={{ paddingBottom: pad }}>
      {/* 뒤 카드 — 실제 카드가 뒤에 쌓인 느낌(색·인셋·둥근 모서리·그림자). 컨테이너 padding 안에서만 peek */}
      {behind.map((c, i) => (
        <div key={c.id}
          className={`absolute rounded-2xl border shadow-sm ${c.tone === 'emerald' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
          style={{ left: (i + 1) * 13, right: (i + 1) * 13, top: (i + 1) * 7, bottom: pad - (i + 1) * 7, zIndex: 2 - i }} />
      ))}
      {/* top 카드 — 탭하면 팝업(내부 버튼은 미리보기라 클릭 무력화) */}
      <button type="button" onClick={onOpen} aria-label="전체 보기"
        className="relative block w-full text-left rounded-2xl active:scale-[0.99] transition" style={{ zIndex: 5 }}>
        <div className="pointer-events-none shadow-md rounded-2xl">{cards[0].node}</div>
        {cards.length > 1 && (
          <span className="absolute -top-2 -right-1 z-10 inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-gray-900 text-white text-[11px] font-bold shadow">
            {cards.length}
          </span>
        )}
      </button>
    </div>
  )
}

// ── 중앙 팝업 — 래퍼 없이 각 카드 박스가 개별 스프링 팝업, 배경만 페이드 ──
function StackModal({ open, cards, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {/* 배경 페이드(탭하면 닫힘) */}
          <motion.div className="absolute inset-0 bg-black/45" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          {/* 떠 있는 닫기 버튼 */}
          <motion.button type="button" onClick={onClose} aria-label="닫기"
            className="absolute top-5 right-5 z-10 w-9 h-9 rounded-full bg-white/90 text-gray-600 flex items-center justify-center shadow-lg"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <X className="w-4.5 h-4.5" />
          </motion.button>
          {/* 카드들 — 래퍼 없이 각각 스프링 등장 */}
          <div className="relative w-full max-w-sm max-h-[84vh] overflow-y-auto space-y-3 py-2">
            {cards.map((c, i) => (
              <motion.div key={c.id} onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 12 }}
                transition={{ type: 'spring', stiffness: 360, damping: 24, delay: i * 0.06 }}
                className="drop-shadow-xl">
                {c.node}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── 컨트롤 토글 ──
function Toggle({ on, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={`h-8 px-3 rounded-full text-[12px] font-semibold border transition ${on ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-gray-500 border-gray-200'}`}>
      {children}
    </button>
  )
}

const MILE_STATES = [
  { key: 'new', label: '새 성취(축하)' },
  { key: 'old', label: '지난 성취' },
  { key: 'none', label: '성취 없음' },
]

export default function BannerStackDemo() {
  const [mile, setMile] = useState('new')     // new | old | none — 항상 덱 밖 독립
  const [heroDismissed, setHeroDismissed] = useState(false)
  const [todo, setTodo] = useState(true)
  const [survey, setSurvey] = useState(true)
  const [report, setReport] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  // 덱 = 처리할일 → 종료설문 → 리포트 (성취 제외)
  const deck = []
  if (todo) deck.push({ id: 'todo', tone: 'amber', node: <TodoCard /> })
  if (survey) deck.push({ id: 'survey', tone: 'amber', node: <SurveyCard /> })
  if (report) deck.push({ id: 'report', tone: 'emerald', node: <ReportCard /> })

  const heroShown = mile === 'new' && !heroDismissed

  return (
    <div className="min-h-screen bg-gray-100 pb-16">
      <div className="max-w-md mx-auto px-4 pt-6">
        <h1 className="text-[17px] font-extrabold text-gray-900">배너 스택(덱) 프로토타입</h1>
        <p className="text-[12px] text-gray-500 mt-1 leading-snug break-keep">
          <b>성취=독립</b> + <b>나머지=접힌 덱</b>. 덱을 탭하면 <b>화면 중앙 팝업</b>으로 전체가 열려요. 아래 토글로 상태를 바꿔보세요.
        </p>

        {/* 컨트롤 */}
        <div className="mt-4 p-3 rounded-2xl bg-white border border-gray-200 space-y-3">
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-1.5">🏆 성취 (덱 밖 독립)</p>
            <div className="flex gap-1.5">
              {MILE_STATES.map((s) => (
                <Toggle key={s.key} on={mile === s.key} onClick={() => { setMile(s.key); setHeroDismissed(false) }}>{s.label}</Toggle>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-400 mb-1.5">덱에 담을 배너</p>
            <div className="flex flex-wrap gap-1.5">
              <Toggle on={todo} onClick={() => setTodo((v) => !v)}>🔔 처리할 일</Toggle>
              <Toggle on={survey} onClick={() => setSurvey((v) => !v)}>🏁 종료 설문</Toggle>
              <Toggle on={report} onClick={() => setReport((v) => !v)}>💡 리포트</Toggle>
            </div>
          </div>
        </div>

        {/* 개요 목업 */}
        <div className="mt-5 space-y-2.5">
          <div className="relative h-24 rounded-2xl overflow-hidden flex items-end p-3.5" style={{ background: 'linear-gradient(115deg,#3ec48b,#0c9082)' }}>
            <div className="text-white">
              <p className="text-[10px] opacity-80">D+8 · 9일 여정</p>
              <p className="text-[16px] font-extrabold leading-tight">테스트</p>
            </div>
          </div>

          {/* 성취 = 덱 밖 독립 */}
          <AnimatePresence>
            {heroShown && (
              <motion.div key="hero" exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }} transition={{ duration: 0.25 }}>
                <MilestoneHeroCard onDismiss={() => setHeroDismissed(true)} />
              </motion.div>
            )}
          </AnimatePresence>
          {mile === 'old' && <MilestoneQuietCard />}

          {/* 나머지 = 접힌 덱 → 탭하면 팝업 */}
          {deck.length > 0 && <CollapsedDeck cards={deck} onOpen={() => setModalOpen(true)} />}

          {/* 아래 기존 카드들(맥락) */}
          <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm">
            <p className="text-[13px] font-bold text-gray-800 mb-2">공지사항</p>
            <div className="h-8 rounded-lg bg-gray-50" />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm h-24" />
            <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-sm h-24" />
          </div>
        </div>

        {/* 설명 */}
        <div className="mt-6 p-3.5 rounded-2xl bg-white border border-gray-200 text-[12px] text-gray-500 leading-relaxed space-y-1.5">
          <p><b className="text-gray-700">· 접힘</b> — top 카드(가장 급함)만 보이고 뒤 카드는 색·인셋·둥근 모서리로 겹쳐 peek. 우측 상단 배지 = 총 개수.</p>
          <p><b className="text-gray-700">· 팝업</b> — top 박스 탭 → 화면 중앙에 전체 목록이 스프링 애니로 팝업. 배경 탭/✕ 로 닫힘. 여기 버튼이 실제 동작.</p>
          <p><b className="text-gray-700">· 성취</b> — 덱에서 제외. 새 성취=화려한 독립 카드, 지난 성취=조용한 독립 줄.</p>
        </div>
      </div>

      <StackModal open={modalOpen} cards={deck} onClose={() => setModalOpen(false)} />
    </div>
  )
}
