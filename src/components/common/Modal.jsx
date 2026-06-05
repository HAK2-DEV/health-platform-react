import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'

// 스와이프 다운 임계값 — 모달 닫기용. 좌우 스와이프는 브라우저 swipe-to-navigate
// 와 충돌이 잦아 본인 결정으로 제거. 대신 좌·우 fade 버튼으로 대체 (Day 65).
const SWIPE_CLOSE_DISTANCE = 100     // 아래로 끌어 닫기 — 100px 이상
const SWIPE_CLOSE_VELOCITY = 500     // 또는 빠른 플릭 (px/s)

// props:
//   isOpen / onClose — 기본
//   onPrev / onNext — 좌우 화살표 버튼 클릭 시 호출. undefined 면 해당 버튼 숨김 (첫/마지막).
function Modal({ isOpen, onClose, children, onPrev, onNext }) {
  // 상단 핸들에서만 drag 시작 — 본문 스크롤과 충돌 방지
  const dragControls = useDragControls()

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
    }
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  // body 스크롤 잠금 — 모달 열렸을 때 뒤 페이지 스크롤 차단 (Day 65 본인 결정)
  //   모바일에서 모달 안 스크롤이 부모(body)로 전파되는 scroll chaining 문제 해결
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
          onClick={onClose}
        >
          {/* 배경 흐림 — fade */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          />

          {/* 모달 내용 — 살짝 아래에서 올라오며 페이드+scale 인. spring 으로 부드럽게.
              overscroll-contain: 모달 내부 스크롤 끝 도달 시에도 부모로 전파 안 함 (추가 안전망)
              drag y: 상단 핸들에서 시작 (dragListener=false + dragControls).
              onPanEnd: 좌우 스와이프 감지 — onPrev/onNext 있을 때만 navigation. */}
          {/* 모달 본체. drag y 는 핸들에서만 시작 (dragListener=false) — 본문 스크롤과 충돌 X.
              좌우 스와이프는 브라우저 swipe-to-navigate 와 충돌이 잦아 제거 → fade 버튼으로 대체. */}
          <motion.div
            className="
              relative bg-white shadow-xl overflow-y-auto overscroll-contain
              w-full max-h-[90vh] rounded-t-2xl
              sm:max-w-md sm:max-h-[85vh] sm:rounded-lg
            "
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 32, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.97 }}
            transition={{
              type: 'spring',
              damping: 26,
              stiffness: 320,
              mass: 0.8,
            }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > SWIPE_CLOSE_DISTANCE || info.velocity.y > SWIPE_CLOSE_VELOCITY) {
                onClose()
              }
            }}
          >
            {/* 모바일 손잡이 — 여기서만 drag y 시작 → 본문 스크롤과 분리 */}
            <div
              className="sm:hidden flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition z-20"
            >
              <X className="w-5 h-5" />
            </button>

            {children}
          </motion.div>

          {/* prev/next fade 버튼 — 모달 좌·우 가장자리 세로 중앙.
              화면 좌표 기준 fixed 라 모달 스크롤과 독립적 위치.
              undefined 면 안 렌더 (첫/마지막 자연 인지). */}
          {onPrev && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPrev() }}
              className="fixed left-2 sm:left-4 top-[58%] -translate-y-1/2 z-[70] w-10 h-10 flex items-center justify-center bg-white/40 hover:bg-white/80 text-gray-600 rounded-full shadow-md backdrop-blur-sm transition"
              title="이전"
              aria-label="이전 프로그램"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onNext() }}
              className="fixed right-2 sm:right-4 top-[58%] -translate-y-1/2 z-[70] w-10 h-10 flex items-center justify-center bg-white/40 hover:bg-white/80 text-gray-600 rounded-full shadow-md backdrop-blur-sm transition"
              title="다음"
              aria-label="다음 프로그램"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      )}
    </AnimatePresence>
  )
}

export default Modal