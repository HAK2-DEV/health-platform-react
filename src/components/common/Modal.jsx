import { useEffect, useRef } from 'react'
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

  // 가로 스와이프로 이전/다음 이동 (화살표 버튼 대체).
  //   좌→우(dx>0)=이전, 우→좌(dx<0)=다음. 세로 스크롤과 구분 위해 수평 우세 + 임계값.
  const touchStart = useRef({ x: 0, y: 0 })
  const onTouchStart = (e) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  const onTouchEnd = (e) => {
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0 && onNext) onNext()
      else if (dx > 0 && onPrev) onPrev()
    }
  }

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
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
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

            {/* 닫기: 모바일은 손잡이 슬라이드 다운, 데스크톱은 배경 클릭 + ESC (X 버튼 제거) */}
            {children}
          </motion.div>

          {/* 좌우 화살표 제거 — 가로 스와이프(onTouchStart/End)로 이전/다음 이동 */}
        </div>
      )}
    </AnimatePresence>
  )
}

export default Modal