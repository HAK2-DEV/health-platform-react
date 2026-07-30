import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { Icon3D } from './ProgramHome'

// 운영자 「프로그램 종료 → 종료 리포트」 진입 배너 — 개요 상단.
//   인증 심사 배너와 동일 연출: playIntro=true 면 화면 정중앙에 통통 튀며 팝업(1.1x) → 원위치로 스프링 이동.
//   연출 1회 후 onIntroDone. (탭 전환 재마운트 시 재생 안 하도록 호출측에서 플래그 내림)
function BannerInner() {
  return (
    <div className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-left shadow-elevated">
      <Icon3D src="/icons/reward/report.png" emoji="📊" className="w-11 h-11 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-tight">프로그램이 종료되었어요</p>
        <p className="text-[12px] text-white/85 leading-snug mt-0.5">최종 성적표 — 종료 리포트 보기</p>
      </div>
      <ChevronRight className="w-5 h-5 flex-shrink-0 text-white/90" />
    </div>
  )
}

// centerOffset: 정중앙 팝업 y 오프셋(px). 인증 심사 배너와 둘 다 뜰 때 위(-)로 벌려 겹침 방지.
function EndReportBanner({ onClick, playIntro = false, onIntroDone, centerOffset = 0 }) {
  const [phase, setPhase] = useState('done')  // center → settle → done
  const [rect, setRect] = useState(null)
  const slotRef = useRef(null)
  const startedRef = useRef(false)

  useLayoutEffect(() => {
    if (playIntro && !startedRef.current && slotRef.current) {
      startedRef.current = true
      const r = slotRef.current.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width })
      setPhase('center')
    }
  }, [playIntro])

  useEffect(() => {
    if (phase !== 'center') return
    const t = setTimeout(() => setPhase('settle'), 950)
    return () => clearTimeout(t)
  }, [phase])

  const centerTop = (typeof window !== 'undefined' ? window.innerHeight * 0.42 : 360) + centerOffset
  const animating = phase !== 'done' && rect

  return (
    <div className="mb-[9px]">
      {/* 인라인 버튼 — 연출 중엔 자리만(숨김), 완료 후 실제 클릭 대상 */}
      <button type="button" onClick={onClick} ref={slotRef}
        className="w-full block active:scale-[0.99] transition"
        style={{ visibility: phase === 'done' ? 'visible' : 'hidden' }}>
        <BannerInner />
      </button>

      {animating && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/15 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 'center' ? 1 : 0 }}
            transition={{ duration: phase === 'center' ? 0.3 : 0.35 }}
          />
          <motion.div
            className="fixed z-50 pointer-events-none"
            style={{ transformOrigin: 'center' }}
            initial={{ top: centerTop, left: rect.left, width: rect.width, scale: 0.85, opacity: 0 }}
            animate={
              phase === 'center'
                ? { top: centerTop, left: rect.left, width: rect.width, scale: 1.1, opacity: 1 }
                : { top: rect.top, left: rect.left, width: rect.width, scale: 1, opacity: 1 }
            }
            transition={
              phase === 'center'
                ? { type: 'spring', stiffness: 420, damping: 11, mass: 0.9 }
                : { type: 'spring', stiffness: 260, damping: 26 }
            }
            onAnimationComplete={() => { if (phase === 'settle') { setPhase('done'); onIntroDone?.() } }}
          >
            <motion.div
              className="rounded-2xl"
              animate={{ boxShadow: phase === 'center' ? '0 0 0 6px rgba(16,185,129,0.18), 0 14px 34px rgba(13,148,136,0.35)' : '0 0 0 0px rgba(16,185,129,0)' }}
              transition={{ duration: 0.35 }}
            >
              <BannerInner />
            </motion.div>
          </motion.div>
        </>
      )}
    </div>
  )
}

export default EndReportBanner
