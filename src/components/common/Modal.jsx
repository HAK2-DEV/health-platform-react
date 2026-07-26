import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'

// 스와이프 다운 임계값 — 모달 닫기용. 좌우 스와이프는 브라우저 swipe-to-navigate
// 와 충돌이 잦아 본인 결정으로 제거. 대신 좌·우 fade 버튼으로 대체 (Day 65).
const SWIPE_CLOSE_DISTANCE = 100     // 아래로 끌어 닫기 — 100px 이상
const SWIPE_CLOSE_VELOCITY = 500     // 또는 빠른 플릭 (px/s)

// 모달 히스토리(하드웨어 뒤로=닫기) — 자기유발 back 이 다른 모달/네비게이션을 오작동시키지 않도록
let _modalSeq = 0
let _ignoreNextPop = false

// props:
//   isOpen / onClose — 기본
//   onPrev / onNext — 좌우 화살표 버튼 클릭 시 호출. undefined 면 해당 버튼 숨김 (첫/마지막).
//   fill — true 면 고정 높이 flex 컬럼(본문 채움·푸터 하단 고정용). 내부에서 스크롤 처리.
function Modal({ isOpen, onClose, children, onPrev, onNext, fill = false }) {
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

  // 하드웨어/브라우저 뒤로가기 = 모달 닫기 (네이티브 안드로이드 뒤로 UX).
  //   열릴 때 history 더미(고유 key) push → 뒤로가기(popstate) 시 onClose.
  //   닫힐 때: 뒤로가기로 닫힌 게 아니고 우리 더미가 아직 최상단일 때만 history.back() 으로 정리.
  //     · 모달→모달 전환/모달→페이지 네비게이션 시엔 더미가 이미 위에 덮이거나(navigate) 자기유발
  //       popstate 라서, key 확인 + _ignoreNextPop 로 오작동(상세 모달 즉시 닫힘·홈으로 튕김) 방지.
  //   ※ dev(StrictMode 이중 실행)에선 history 꼬임으로 오작동 → 프로드/네이티브에서만 동작.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!isOpen || import.meta.env.DEV) return
    let viaPop = false
    const myKey = `__m${++_modalSeq}`
    window.history.pushState({ __modal: true, __mkey: myKey }, '')
    const onPop = () => {
      // 다른 모달/네비의 프로그램적 back 이 유발한 popstate 는 자기 뒤로가기로 오인하지 않도록 무시
      if (_ignoreNextPop) { _ignoreNextPop = false; return }
      viaPop = true
      onCloseRef.current?.()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      // 뒤로가기로 닫힌 게 아니고, 우리 더미가 아직 최상단(네비게이션 등으로 벗어나지 않음)일 때만 정리
      if (!viaPop && window.history.state?.__mkey === myKey) {
        _ignoreNextPop = true
        window.history.back()
        setTimeout(() => { _ignoreNextPop = false }, 0) // 아무도 안 잡아도 플래그 누수 방지
      }
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
            className={`relative bg-white shadow-xl overscroll-contain w-full rounded-t-2xl sm:max-w-md sm:rounded-lg ${
              fill
                ? 'h-[88vh] sm:h-[85vh] flex flex-col overflow-hidden'
                : 'max-h-[85vh] sm:max-h-[85vh] overflow-y-auto'
            }`}
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
              className="sm:hidden flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing flex-shrink-0"
              style={{ touchAction: 'none' }}
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* 닫기: 모바일은 손잡이 슬라이드 다운, 데스크톱은 배경 클릭 + ESC (X 버튼 제거) */}
            {fill ? <div className="flex-1 min-h-0 flex flex-col">{children}</div> : children}
          </motion.div>

          {/* 좌우 화살표 제거 — 가로 스와이프(onTouchStart/End)로 이전/다음 이동 */}
        </div>
      )}
    </AnimatePresence>
  )
}

export default Modal