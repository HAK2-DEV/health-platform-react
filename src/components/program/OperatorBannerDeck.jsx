import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'

// 운영자 개요 배너 「덱」 — 처리할일·종료설문·리포트가 여러 개 쌓이면 접힌 덱으로 묶어 top 카드만 노출.
//   탭 → 화면 중앙 팝업(각 카드 개별 스프링). 성취(축하)는 이 덱에 안 넣음(별도 독립).
//   카드 1개면 덱 없이 그대로 렌더(전체 인터랙티브). props: cards = [{ id, tone: 'amber'|'emerald', node }]

// 접힌 덱 — top 카드(가장 급함)만 실제 렌더, 뒤 카드는 색·인셋·둥근모서리로 peek(컨테이너 padding 안에 예약)
function CollapsedDeck({ cards, onOpen }) {
  const behind = cards.slice(1, 3)
  const pad = behind.length ? behind.length * 7 + 6 : 0
  return (
    <div className="relative" style={{ paddingBottom: pad }}>
      {behind.map((c, i) => (
        <div key={c.id}
          className={`absolute rounded-2xl border shadow-sm ${c.tone === 'emerald' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
          style={{ left: (i + 1) * 13, right: (i + 1) * 13, top: (i + 1) * 7, bottom: pad - (i + 1) * 7, zIndex: 2 - i }} />
      ))}
      <button type="button" onClick={onOpen} aria-label="처리할 일 전체 보기"
        className="relative block w-full text-left rounded-2xl active:scale-[0.99] transition" style={{ zIndex: 5 }}>
        <div className="pointer-events-none shadow-md rounded-2xl">{cards[0].node}</div>
        <span className="absolute -top-2 -right-1 z-10 inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-gray-900 text-white text-[11px] font-bold shadow">{cards.length}</span>
      </button>
    </div>
  )
}

// 중앙 팝업 — 래퍼 없이 각 카드 박스가 개별 스프링 팝업, 배경만 페이드. 카드 내 버튼 누르면 팝업 닫고 동작.
function StackModal({ open, cards, onClose }) {
  useBodyScrollLock(open)
  useBackButtonClose(open, onClose)
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/45" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.button type="button" onClick={onClose} aria-label="닫기"
            className="absolute top-5 right-5 z-10 w-9 h-9 rounded-full bg-white/90 text-gray-600 flex items-center justify-center shadow-lg"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <X className="w-[18px] h-[18px]" />
          </motion.button>
          <div className="relative w-full max-w-sm max-h-[84vh] overflow-y-auto space-y-3 py-2">
            {cards.map((c, i) => (
              <motion.div key={c.id}
                onClick={(e) => e.stopPropagation()}
                onClickCapture={(e) => { if (e.target.closest('button')) onClose() }}
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

export default function OperatorBannerDeck({ cards }) {
  const [open, setOpen] = useState(false)
  if (!cards || cards.length === 0) return null
  if (cards.length === 1) return <div>{cards[0].node}</div>
  return (
    <>
      <CollapsedDeck cards={cards} onOpen={() => setOpen(true)} />
      <StackModal open={open} cards={cards} onClose={() => setOpen(false)} />
    </>
  )
}
