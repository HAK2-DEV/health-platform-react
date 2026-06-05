import { X } from 'lucide-react'
import { useEffect } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'

// 스와이프 임계값 (Day 65 본인 모바일 UX 요청)
const SWIPE_CLOSE_DISTANCE = 100     // 아래로 끌어 닫기 — 100px 이상
const SWIPE_CLOSE_VELOCITY = 500     // 또는 빠른 플릭 (px/s)
const SWIPE_NAV_DISTANCE = 80        // 좌우 prev/next — 80px 이상
const SWIPE_NAV_VELOCITY = 400

// props:
//   isOpen / onClose — 기본
//   onPrev / onNext — 좌우 스와이프 시 호출. 없으면 좌우 제스처 비활성.
//                      예: setSelectedProgram(programs[currentIndex - 1])
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
            onPanEnd={(_, info) => {
              if (!onPrev && !onNext) return
              const { offset, velocity } = info
              // 수평 우세 (수직보다 1.5배 이상) + 임계값 통과 시에만
              if (Math.abs(offset.x) < Math.abs(offset.y) * 1.5) return
              // 본인 의도(page-flip 메타포): 우로 스와이프 → 다음, 좌로 스와이프 → 이전.
              const goNext = offset.x > SWIPE_NAV_DISTANCE || velocity.x > SWIPE_NAV_VELOCITY
              const goPrev = offset.x < -SWIPE_NAV_DISTANCE || velocity.x < -SWIPE_NAV_VELOCITY
              if (goNext && onNext) onNext()
              else if (goPrev && onPrev) onPrev()
            }}
          >
            {/* 모바일 손잡이 — 여기서만 drag y 시작 → 본문 스크롤과 분리 */}
            <div
              className="sm:hidden flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition z-10"
            >
              <X className="w-5 h-5" />
            </button>

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export default Modal