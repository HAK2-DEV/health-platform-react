import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Ticket, X } from 'lucide-react'
import { getInviteHint, clearInviteHint } from '../../lib/pendingInvite'

// 대시보드 상단 「초대받은 프로그램」 카드 — 초대링크를 방문했으나 아직 참여하지 않은 경우의 리마인더.
//   자동복귀가 끊기거나 이미 로그인 상태로 초대만 보고 넘어간 경우의 안전망(본인 아이디어 2026-08-13).
//   참여 완료·닫기·7일 만료 시 사라짐. (저장: lib/pendingInvite 의 invite_hint)
//   가시성 강화(2026-08-13): 그라데이션 + 스프링 등장 + 시머 스윕 + 아이콘 위글(주목 유도).
function InviteHintCard() {
  const navigate = useNavigate()
  const rm = useReducedMotion()
  const [hint, setHint] = useState(() => getInviteHint())
  // 콜드 스타트 스플래시가 덮고 있는 동안 등장이 재생·완료돼 놓치는 문제 →
  //   스플래시가 걷힌 뒤(app-splash-done) 등장. 스플래시가 없으면 즉시.
  const [play, setPlay] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.__appSplashActive) { setPlay(true); return }
    const on = () => setPlay(true)
    window.addEventListener('app-splash-done', on, { once: true })
    return () => window.removeEventListener('app-splash-done', on)
  }, [])

  if (!hint) return null

  const go = () => navigate(`/join?code=${encodeURIComponent(hint.code)}`)
  const dismiss = (e) => { e.stopPropagation(); clearInviteHint(); setHint(null) }

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } }}
      initial={rm ? false : { opacity: 0, y: 14, scale: 0.96 }}
      animate={rm ? { opacity: 1 } : (play ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 14, scale: 0.96 })}
      transition={{ type: 'spring', stiffness: 380, damping: 24 }}
      className="relative w-full flex items-center gap-3 p-3.5 rounded-[12px] bg-gradient-to-r from-emerald-500 to-teal-500 text-white cursor-pointer overflow-hidden shadow-md"
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
  )
}

export default InviteHintCard
