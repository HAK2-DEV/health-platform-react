import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useDragControls } from 'framer-motion'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import { useLegacyKeyboardOpen } from '../../hooks/useLegacyKeyboardOpen'

// 스와이프 다운 임계값 — 모달 닫기용. 좌우 스와이프는 브라우저 swipe-to-navigate
// 와 충돌이 잦아 본인 결정으로 제거. 대신 좌·우 fade 버튼으로 대체 (Day 65).
const SWIPE_CLOSE_DISTANCE = 100     // 아래로 끌어 닫기 — 100px 이상
const SWIPE_CLOSE_VELOCITY = 500     // 또는 빠른 플릭 (px/s)


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

  // body 스크롤 잠금 (iOS 대응, 중첩 안전) — 공용 훅. [[useBodyScrollLock]]
  useBodyScrollLock(isOpen)

  // iOS 키보드 대응 — 입력창 포커스로 키보드가 뜨면 visualViewport 가 줄어든다.
  //   그 높이만큼 오버레이 하단에 패딩 → 바텀시트가 키보드 위로 올라와 입력·버튼이 안 가림.
  //   (예: 회원 탈퇴 닉네임 입력, 비번 변경, 각종 폼 모달 — 이전엔 스크롤해야 보였음)
  const [kbInset, setKbInset] = useState(0)
  const [kbViewportH, setKbViewportH] = useState(0)  // 키보드 위 실제 보이는 높이(vv.height) — fill 모달 높이 산정용
  useEffect(() => {
    const vv = window.visualViewport
    if (!isOpen || !vv) { setKbInset(0); setKbViewportH(0); return }
    const onResize = () => {
      setKbInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
      setKbViewportH(vv.height)
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    onResize()
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize) }
  }, [isOpen])

  // 구형 안드로이드(노트9=안드10 등) 키보드 대응 — 2026-09-16 「글쓰기 내용 칸이 키보드에 가림」 제보.
  //   이 기기들은 창을 리사이즈하지 않고(adjustNothing) visualViewport 도 키보드에 무반응이라 위의 kbInset 이
  //   0 이다. 키보드 «높이» 를 알 방법이 아예 없으므로(플러그인도 제거됨), 높이 대신 «떴다» 는 사실만 받아
  //   시트를 화면 위쪽에 붙이고 높이를 제한한다 → 어떤 키보드보다 위라 항상 보인다. [[lib/nativeKeyboard]]
  const legacyKbOpen = useLegacyKeyboardOpen()
  const legacyLift = isOpen && legacyKbOpen && !kbInset

  // 시트가 위로 접힌 뒤 포커스된 입력칸이 시트 스크롤 밖일 수 있다 → 시트 내부 스크롤로 끌어온다.
  //   ⚠️ 접히는 «순간» 한 번만으로는 부족하다. 입력칸이 여럿이면 두 번째 칸으로 옮겨갈 때
  //      legacyLift 가 이미 true 라 이 효과가 다시 돌지 않아 그 칸이 푸터에 덮인 채로 남는다
  //      (2026-09-17 노트9, 미션 만들기에서 드러남 — 이 시트는 카드가 짧아 우연히 안 보였을 뿐
  //      같은 결함이다). lift 인 «동안» 은 포커스가 바뀔 때마다 끌어온다. [[hooks/useKeyboardOverlay]]
  useEffect(() => {
    if (!legacyLift) return
    const pull = () => {
      const el = document.activeElement
      if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    const t = setTimeout(pull, 320)
    let t2 = null
    const onFocusIn = () => { clearTimeout(t2); t2 = setTimeout(pull, 120) }
    window.addEventListener('focusin', onFocusIn)
    return () => { clearTimeout(t); clearTimeout(t2); window.removeEventListener('focusin', onFocusIn) }
  }, [legacyLift])

  // 하드웨어/브라우저 뒤로가기 = 모달 닫기 (공용 훅 — 모든 오버레이가 상태 공유). [[useBackButtonClose]]
  useBackButtonClose(isOpen, onClose)

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
          style={{
            paddingBottom: kbInset || undefined,
            transition: 'padding-bottom .2s ease',
            // 구형 안드 키보드 — 바텀시트를 화면 위쪽으로 붙인다(아래는 키보드가 덮는 영역).
            ...(legacyLift ? { alignItems: 'flex-start', paddingTop: 8 } : null),
          }}
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
            // 키보드 뜨면 모달 최대높이를 키보드 위 실제 보이는 높이(visualViewport)로 제한 → 키보드 위에
            //   온전히 들어오고, overflow-y-auto 라 브라우저가 포커스된 입력창을 자동으로 보이게 스크롤.
            //   (100vh 는 안드 크롬에서 실제보다 커 부정확 → visualViewport 사용) fill·일반 모달 모두 적용.
            //   하단 안전 영역(3버튼 내비게이션 바 등) — 화면이 바 밑까지 그려지는 기기에서 하단 버튼이 바에 가려졌다
            //   (2026-09-15 S20+ 사진 편집 「취소·저장」). 시트 안쪽 여백으로 흰 배경은 바 밑까지 이어지고 버튼만 위로 올라온다.
            //   키보드가 떠 있으면 바깥 kbInset 이 이미 들어 올리므로 0.
            style={{
              ...(kbInset ? { maxHeight: `${Math.max(240, kbViewportH - 12)}px` } : null),
              //   구형 안드: 키보드 높이를 모르므로 «화면 위쪽 절반» 안에 시트를 가둔다. fill 모달의 고정 높이(h-[88vh])도
              //   여기서 풀어야 해서 height:auto 를 함께 준다. 값은 노트9 실측으로 정함(키보드+툴바 약 45%).
              ...(legacyLift ? { height: 'auto', maxHeight: '52vh' } : null),
              paddingBottom: kbInset || legacyLift ? undefined : 'max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px))',
            }}
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