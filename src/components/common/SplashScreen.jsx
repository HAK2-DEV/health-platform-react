import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// 앱 콜드 스타트 스플래시 — 배경 이미지(public/splash-bg.jpg) 위에
//   아이콘·브랜드명·문구를 하나씩 천천히(staggered) 등장시킨 뒤 페이드아웃.
//   배경 이미지가 없으면 흰/민트 그라데이션으로 폴백.
//   App() 최상위에 마운트(라우터 무관). 클라이언트 라우팅 이동에는 다시 안 뜸.
const DURATION_MS = 2600   // 전체 노출 시간(요소 등장 완료 후 잠시 머무름 → 페이드아웃)

// 부모 컨테이너가 자식 등장을 0.32s 간격으로 stagger
const group = {
  hidden: {},
  show: { transition: { staggerChildren: 0.32, delayChildren: 0.25 } },
}
const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } },
}
const pop = {
  hidden: { opacity: 0, scale: 0.82 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring', damping: 15, stiffness: 200 } },
}

function SplashScreen() {
  // 업데이트 reload 로 진입한 경우엔 이미 업데이트 스플래시(3D 새싹)를 봤으므로 초기 스플래시 생략
  //   (로딩화면 2번 노출 방지). 플래그는 한 번만 사용하고 제거.
  const [show, setShow] = useState(() => {
    let willShow = true
    try {
      if (sessionStorage.getItem('pwa-updating')) {
        sessionStorage.removeItem('pwa-updating')
        willShow = false
      }
    } catch { /* sessionStorage 미지원 */ }
    // 콜드 스타트 스플래시가 화면을 덮는 동안 뒤에서 마운트되는 요소들이 등장 애니메이션을
    //   놓치지 않도록 상태 공유 — 스플래시가 걷힌 뒤 'app-splash-done' 으로 등장 트리거.
    if (typeof window !== 'undefined') window.__appSplashActive = willShow
    return willShow
  })

  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => {
      setShow(false)
      try {
        window.__appSplashActive = false
        window.dispatchEvent(new Event('app-splash-done'))
      } catch { /* 무시 */ }
    }, DURATION_MS)
    return () => clearTimeout(t)
  }, [show])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] overflow-hidden bg-gradient-to-b from-emerald-50 via-emerald-50/60 to-teal-50"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* 배경 풍경 (없으면 위 그라데이션이 그대로 보임) */}
          <img
            src="/splash-bg.jpg"
            alt=""
            aria-hidden="true"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* 상단 가독성 스크림 — 글자 영역만 살짝 밝게 */}
          <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/55 to-transparent pointer-events-none" />

          {/* 얹힌 요소 — 하나씩 천천히 등장 */}
          <motion.div
            className="absolute inset-x-0 top-0 flex flex-col items-center text-center px-6"
            style={{ paddingTop: 'max(16vh, 96px)' }}
            variants={group}
            initial="hidden"
            animate="show"
          >
            {/* 앱 아이콘 */}
            <motion.img
              variants={pop}
              src="/app-icon.png"
              onError={(e) => { e.currentTarget.src = '/favicon.svg' }}
              alt="도담"
              className="w-16 h-16 rounded-[18px] shadow-elevated"
            />

            {/* 브랜드명 — 본인 업로드 디자인과 동일: "Health-Platform 도담" (동일 크기·순서·간격) */}
            <motion.div variants={rise} className="mt-3">
              <span className="text-xl font-bold text-emerald-600">Health-Platform 도담</span>
            </motion.div>

            {/* 메인 카피 */}
            <motion.h1
              variants={rise}
              className="mt-7 text-2xl font-bold text-gray-800 leading-snug tracking-tight"
            >
              건강한 습관이<br />더 나은 내일을 만듭니다
            </motion.h1>

            {/* 서브 카피 (태그라인) */}
            <motion.p variants={rise} className="mt-3 text-sm font-medium text-gray-600">
              운영은 쉽게, 건강은 단단하게.
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default SplashScreen
