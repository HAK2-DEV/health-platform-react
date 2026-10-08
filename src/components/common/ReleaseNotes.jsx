import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import { KIND_META } from '../../lib/releaseNotes'

// 배포 변경사항 알림 — 「갑자기 화면이 바뀐」 순간의 궁금증·두려움을 푸는 창.
//   variant: 'popup'(화면 중앙) | 'banner'(하단에 조용히) — 어느 쪽이 나은지 /dev/release 에서 비교.
//
// 공통 규칙
//   · 분류는 사용자 말로 — 달라진 화면 / 새로 생긴 것 / 고친 문제.
//   · 화면이 크게 바뀐 항목엔 안심 문장(safe) — 두려움의 핵심은 «내 기록»이다.
//   · 「동작 줄이기」면 등장 연출 없이 바로 최종 상태(§15-4).

// ⭐ 한 항목의 순서는 **제목 → 사진 → 설명**(본인 2026-10-06).
//   제목으로 «무엇이» 바뀌었는지 먼저 알려 주고, 사진으로 보여 주고, 설명으로 «그래서 뭘 하면 되는지».
//   사진 먼저 두면 무엇에 대한 사진인지 모른 채 보게 된다.
//   사진이 없으면 조용히 글만 남는다 — 사진으로 보여 줄 수 없는 변화도 있다(본인 2026-10-06).
function NoteList({ items }) {
  return (
    <ul className="space-y-6">
      {items.map((it, i) => {
        const meta = KIND_META[it.kind] || KIND_META.changed
        return (
          <li key={i}>
            <p className="text-[15px] font-bold text-gray-900 leading-snug break-keep flex items-start gap-1.5">
              <span className="flex-shrink-0" aria-hidden="true">{meta.emoji}</span>
              <span>{it.text}</span>
            </p>
            {it.image && (
              <img
                src={it.image} alt="" aria-hidden="true" loading="lazy" decoding="async"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
                className="w-full rounded-xl bg-gray-50 mt-2"
              />
            )}
            {it.detail && (
              <p className="text-[13px] text-gray-600 leading-relaxed break-keep mt-2">{it.detail}</p>
            )}
            {it.safe && (
              <p className="text-[12.5px] text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5 mt-1.5 break-keep">
                {it.safe}
              </p>
            )}
            {it.kind === 'operator' && (
              <p className="text-[11.5px] text-gray-400 mt-1">운영자에게만 보이는 안내예요</p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ReleaseNotes({ note, variant = 'popup', isOpen = true, onClose }) {
  const reduce = useReducedMotion()
  useBodyScrollLock(isOpen && variant === 'popup')
  useBackButtonClose(isOpen && variant === 'popup', onClose)
  if (!note) return null

  if (variant === 'banner') {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md"
            style={{ bottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
          >
            <div className="bg-white rounded-2xl shadow-elevated border border-gray-100 p-4">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-gray-900 break-keep">{note.title}</p>
                  <p className="text-[12px] text-gray-500 mt-0.5">이번 업데이트로 {note.items.length}가지가 달라졌어요</p>
                </div>
                <button type="button" onClick={onClose} aria-label="닫기"
                  className="w-7 h-7 -mr-1 -mt-1 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-3 max-h-[40vh] overflow-y-auto"><NoteList items={note.items} /></div>
              <button type="button" onClick={onClose}
                className="mt-3 w-full h-10 rounded-xl bg-gray-50 text-gray-700 text-[13px] font-bold hover:bg-gray-100 transition">확인했어요</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // 중앙 팝업
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[70] bg-black/40 flex items-center justify-center p-5"
          onClick={onClose}
        >
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.34, 1.4, 0.64, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-card shadow-elevated overflow-hidden"
          >
            <div className="px-6 pt-6 pb-2 text-center">
              <p className="text-[12px] font-semibold text-emerald-600">업데이트</p>
              <h2 className="text-lg font-bold text-gray-900 mt-1 break-keep">{note.title}</h2>
            </div>
            <div className="px-6 py-4 max-h-[52vh] overflow-y-auto"><NoteList items={note.items} /></div>
            <div className="px-6 pb-6">
              <button type="button" onClick={onClose}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-sm font-bold transition">
                확인했어요
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ReleaseNotes
