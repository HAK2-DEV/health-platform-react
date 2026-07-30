import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

// 운영자 「인증 심사 대기」 배너 — 개요·미션 탭 상단.
//   playIntro=true 면 진입 강조 연출: 화면 정중앙에 통통 튀며 팝업(1.1x) → 원위치(상단)로 스프링 이동.
//   연출 완료 후 onIntroDone 호출(호출측에서 재생 플래그 내림 → 탭 전환 재마운트 시 재생 안 함).
function BannerInner({ count }) {
  return (
    <div className="w-full flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-left shadow-sm">
      <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 text-[15px]">📝</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-gray-800">인증 심사 대기 {count}건</p>
        <p className="text-[11px] text-emerald-700/80">탭해서 한 번에 검토 (승인/거절)</p>
      </div>
      <ChevronRight className="w-4 h-4 text-emerald-500 flex-shrink-0" />
    </div>
  )
}

// centerOffset: 정중앙 팝업 y 오프셋(px). 종료 리포트 배너와 둘 다 뜰 때 아래(+)로 벌려 겹침 방지.
function OperatorReviewBanner({ count, onClick, playIntro = false, onIntroDone, centerOffset = 0 }) {
  const [phase, setPhase] = useState('done')  // center → settle → done
  const [rect, setRect] = useState(null)
  const slotRef = useRef(null)
  const startedRef = useRef(false)

  // playIntro 가 켜지면(마운트 시점이든, 심사 데이터 로드 후 나중이든) 1회 연출 시작.
  //   useLayoutEffect 로 paint 전에 슬롯 좌표를 재고 center 로 전환 → 깜빡임 없음.
  useLayoutEffect(() => {
    if (playIntro && !startedRef.current && slotRef.current) {
      startedRef.current = true
      const r = slotRef.current.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width })
      setPhase('center')
    }
  }, [playIntro])

  // 정중앙 강조 유지 후 원위치로
  useEffect(() => {
    if (phase !== 'center') return
    const t = setTimeout(() => setPhase('settle'), 950)
    return () => clearTimeout(t)
  }, [phase])

  const centerTop = (typeof window !== 'undefined' ? window.innerHeight * 0.42 : 360) + centerOffset
  const animating = phase !== 'done' && rect

  return (
    <div className="mb-3">
      {/* 인라인 버튼 — 연출 중엔 자리만(숨김), 완료 후 실제 클릭 대상 */}
      <button type="button" onClick={onClick} ref={slotRef}
        className="w-full block hover:opacity-90 transition"
        style={{ visibility: phase === 'done' ? 'visible' : 'hidden' }}>
        <BannerInner count={count} />
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
              className="rounded-xl"
              animate={{ boxShadow: phase === 'center' ? '0 0 0 6px rgba(16,185,129,0.15), 0 12px 30px rgba(16,185,129,0.25)' : '0 0 0 0px rgba(16,185,129,0)' }}
              transition={{ duration: 0.35 }}
            >
              <BannerInner count={count} />
            </motion.div>
          </motion.div>
        </>
      )}
    </div>
  )
}

export default OperatorReviewBanner
