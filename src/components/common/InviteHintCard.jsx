import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Ticket, X } from 'lucide-react'
import { getInviteHint, clearInviteHint } from '../../lib/pendingInvite'

// 대시보드 상단 「초대받은 프로그램」 카드 — 초대링크를 방문했으나 아직 참여하지 않은 경우의 리마인더.
//   자동복귀가 끊기거나 이미 로그인 상태로 초대만 보고 넘어간 경우의 안전망(본인 아이디어 2026-08-13).
//   참여 완료·닫기·7일 만료 시 사라짐. (저장: lib/pendingInvite 의 invite_hint)
//
//   등장 연출 — 운영자 「인증 심사 대기」 배너(OperatorReviewBanner)와 동일 패턴:
//   콜드스타트 스플래시가 걷힌 뒤, 화면 정중앙에 통통 튀며 팝업(딤+글로우) → 원래 자리로
//   스프링 이동하며 딤/블러가 부드럽게 해제. 슬롯이 레이아웃을 예약하고 fixed 클론이 연출.
//   조상에 transform 없음(.app=relative) → fixed 가 뷰포트 기준으로 정상.

// 카드 본체(시각) — 슬롯/클론 양쪽에서 재사용. onDismiss 있으면 X 버튼 활성.
function CardBody({ hint, rm, onDismiss }) {
  return (
    <div className="relative w-full flex items-center gap-3 p-3.5 rounded-[12px] bg-gradient-to-r from-emerald-500 to-teal-500 text-white overflow-hidden shadow-md">
      {!rm && (
        <motion.span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/25 blur-[2px]"
          initial={{ x: '-160%' }}
          animate={{ x: '460%' }}
          transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.8 }}
        />
      )}
      <span className="relative w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
        <Ticket className="w-5 h-5" />
      </span>
      <span className="relative flex-1 min-w-0">
        <span className="block text-[11px] font-bold text-white/85">🎟️ 초대받은 프로그램</span>
        <span className="block text-[15px] font-extrabold truncate leading-tight">
          {hint.name || '참여하러 가기'}
        </span>
      </span>
      <span className="relative flex-shrink-0 text-[12px] font-extrabold bg-white/25 rounded-full px-3 py-1.5 whitespace-nowrap">
        참여하기
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="초대 카드 닫기"
        tabIndex={onDismiss ? 0 : -1}
        className="relative flex-shrink-0 p-1 -mr-1 text-white/70 hover:text-white transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

function InviteHintCard() {
  const navigate = useNavigate()
  const rm = useReducedMotion()
  const [hint, setHint] = useState(() => getInviteHint())
  const [phase, setPhase] = useState('wait')   // wait → center → settle → done
  const [rect, setRect] = useState(null)
  const [intro, setIntro] = useState(false)
  const slotRef = useRef(null)
  const startedRef = useRef(false)

  // 스플래시가 걷힌 뒤(또는 스플래시 없으면 즉시) 연출 트리거. reduced-motion 은 바로 done.
  useEffect(() => {
    if (rm) { setPhase('done'); return }
    const begin = () => setIntro(true)
    if (typeof window === 'undefined' || !window.__appSplashActive) { begin(); return }
    window.addEventListener('app-splash-done', begin, { once: true })
    return () => window.removeEventListener('app-splash-done', begin)
  }, [rm])

  // paint 전에 슬롯 좌표를 재고 center 로 전환 → 깜빡임 없음
  useLayoutEffect(() => {
    if (intro && !startedRef.current && slotRef.current) {
      startedRef.current = true
      const r = slotRef.current.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width })
      setPhase('center')
    }
  }, [intro])

  // 정중앙 강조 유지 후 원위치로. center 스프링이 충분히 진정된 뒤 착지로 넘어가야 매끄럽다.
  useEffect(() => {
    if (phase !== 'center') return
    const t = setTimeout(() => setPhase('settle'), 1000)
    return () => clearTimeout(t)
  }, [phase])

  if (!hint) return null

  const go = () => navigate(`/join?code=${encodeURIComponent(hint.code)}`)
  const dismiss = (e) => { e.stopPropagation(); clearInviteHint(); setHint(null) }

  const centerTop = (typeof window !== 'undefined' ? window.innerHeight * 0.42 : 360)
  const animating = (phase === 'center' || phase === 'settle') && rect

  return (
    <div className="w-full">
      {/* 슬롯 — 레이아웃 예약. 연출 중엔 숨김(자리만), 완료 후 실제 클릭 대상 */}
      <div
        role="button"
        tabIndex={0}
        ref={slotRef}
        onClick={go}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } }}
        className="w-full cursor-pointer"
        style={{ visibility: phase === 'done' ? 'visible' : 'hidden' }}
      >
        <CardBody hint={hint} rm={rm} onDismiss={dismiss} />
      </div>

      {animating && (
        <>
          {/* 배경 딤 + 블러 — center 에서 인, settle 에서 이동과 같은 길이로 동기화해 부드럽게 해제 */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px] pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 'center' ? 1 : 0 }}
            transition={{ duration: phase === 'center' ? 0.3 : 0.7, ease: phase === 'center' ? 'easeOut' : [0.4, 0, 0.2, 1] }}
          />
          {/* fixed 클론 — 기준 위치는 슬롯(top:rect.top)에 고정하고 y(transform)만 애니메이션.
              top(레이아웃) 대신 y(GPU transform)로 이동해야 대시보드 로딩 중 잦은 리렌더에도
              스냅 없이 항상 부드럽다. 정중앙 팝(y 아래로+scale 1.08) → 슬롯 위치(y:0)로 착지. */}
          <motion.div
            className="fixed z-50 pointer-events-none"
            style={{ top: rect.top, left: rect.left, width: rect.width, transformOrigin: 'center' }}
            initial={{ y: centerTop - rect.top, scale: 0.85, opacity: 0 }}
            animate={
              phase === 'center'
                ? { y: centerTop - rect.top, scale: 1.08, opacity: 1 }
                : { y: 0, scale: 1, opacity: 1 }
            }
            transition={
              phase === 'center'
                ? { type: 'spring', stiffness: 420, damping: 16, mass: 0.9 }
                : { type: 'tween', duration: 0.7, ease: [0.4, 0, 0.2, 1] }
            }
            onAnimationComplete={() => { if (phase === 'settle') setPhase('done') }}
          >
            <motion.div
              className="rounded-[12px]"
              animate={{
                boxShadow: phase === 'center'
                  ? '0 0 0 6px rgba(16,185,129,0.18), 0 16px 36px rgba(16,185,129,0.30)'
                  : '0 0 0 0px rgba(16,185,129,0)',
              }}
              transition={{ duration: phase === 'center' ? 0.35 : 0.7, ease: phase === 'center' ? 'easeOut' : [0.4, 0, 0.2, 1] }}
            >
              <CardBody hint={hint} rm={rm} />
            </motion.div>
          </motion.div>
        </>
      )}
    </div>
  )
}

export default InviteHintCard
