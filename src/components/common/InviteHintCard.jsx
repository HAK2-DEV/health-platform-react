import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Ticket, X } from 'lucide-react'
import { getInviteHint, clearInviteHint } from '../../lib/pendingInvite'

// 대시보드 상단 「초대받은 프로그램」 카드 — 초대링크를 방문했으나 아직 참여하지 않은 경우의 리마인더.
//   자동복귀가 끊기거나 이미 로그인 상태로 초대만 보고 넘어간 경우의 안전망(본인 아이디어 2026-08-13).
//   참여 완료·닫기·7일 만료 시 사라짐. (저장: lib/pendingInvite 의 invite_hint)
//
//   등장 연출(2026-08-13): 콜드스타트 스플래시가 걷힌 뒤, 배경을 블러하며 살짝 튀어올랐다가
//   제자리로 착지하면서 블러가 부드럽게 풀림(주목 유도). 스플래시가 없으면(앱 내 이동) 즉시.
//   조상에 transform 없음(.app=relative) → fixed 블러 오버레이가 뷰포트 기준으로 정상.
//   오버레이(z-45)와 카드(z-46)는 형제라 카드가 위 → 카드는 선명, 대시보드 본문만 블러.
function InviteHintCard() {
  const navigate = useNavigate()
  const rm = useReducedMotion()
  const [hint, setHint] = useState(() => getInviteHint())
  const [phase, setPhase] = useState('wait')   // wait(스플래시/대기) → pop(등장) → done

  useEffect(() => {
    const start = () => setPhase(rm ? 'done' : 'pop')
    if (typeof window === 'undefined' || !window.__appSplashActive) { start(); return }
    const on = () => start()
    window.addEventListener('app-splash-done', on, { once: true })
    return () => window.removeEventListener('app-splash-done', on)
  }, [rm])

  if (!hint) return null

  const go = () => navigate(`/join?code=${encodeURIComponent(hint.code)}`)
  const dismiss = (e) => { e.stopPropagation(); clearInviteHint(); setHint(null) }

  const POP_MS = 1.15
  const POP_TIMES = [0, 0.45, 1]

  return (
    <>
      <motion.div
        role="button"
        tabIndex={0}
        onClick={go}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } }}
        initial={rm ? false : { opacity: 0, scale: 0.92, y: 8 }}
        animate={
          rm ? { opacity: 1 }
            : phase === 'wait' ? { opacity: 0, scale: 0.92, y: 8 }
            : phase === 'pop' ? { opacity: 1, scale: [0.92, 1.07, 1], y: [8, -8, 0] }
            : { opacity: 1, scale: 1, y: 0 }
        }
        transition={phase === 'pop'
          ? { duration: POP_MS, times: POP_TIMES, ease: [0.22, 1, 0.36, 1] }
          : { duration: 0.3 }}
        onAnimationComplete={() => { if (phase === 'pop') setPhase('done') }}
        className={`relative w-full flex items-center gap-3 p-3.5 rounded-[12px] bg-gradient-to-r from-emerald-500 to-teal-500 text-white cursor-pointer overflow-hidden shadow-md ${phase === 'pop' ? 'z-[46] shadow-xl' : ''}`}
      >
        {/* 시머 스윕 — 주기적으로 빛이 훑고 지나가 주목 유도 */}
        {!rm && (
          <motion.span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-white/25 blur-[2px]"
            initial={{ x: '-160%' }}
            animate={{ x: '460%' }}
            transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.6 }}
          />
        )}

        {/* 아이콘 — 가끔 살짝 흔들림 */}
        <motion.span
          className="relative w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0"
          animate={rm ? undefined : { rotate: [0, -9, 8, -6, 0] }}
          transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.8 }}
        >
          <Ticket className="w-5 h-5" />
        </motion.span>

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
          onClick={dismiss}
          aria-label="초대 카드 닫기"
          className="relative flex-shrink-0 p-1 -mr-1 text-white/70 hover:text-white transition"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>

      {/* 배경 블러 — 팝 구간에만. 대시보드 본문을 흐리게 했다가 착지하며 부드럽게 해제 */}
      {phase === 'pop' && !rm && (
        <motion.div
          aria-hidden="true"
          className="fixed inset-0 z-[45] bg-white/10 backdrop-blur-md pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: POP_MS, times: POP_TIMES, ease: 'easeInOut' }}
        />
      )}
    </>
  )
}

export default InviteHintCard
