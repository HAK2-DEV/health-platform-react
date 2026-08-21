import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'

// 승인 대기(PENDING) 참여자 첫 진입 — 신청 완료 안심 + 승인되면 열릴 것들 미리보기.
//   차가운 "승인 대기" 배너만 있던 것을 보완: 기대감 + 방치 아님(운영자가 곧 확인).
//   활성 환영 시트와 구분(승인 후 열림에 초점). 프로그램별·유저별 1회.
export default function ParticipantPendingSheet({ program, userId, onClose }) {
  useBodyScrollLock(true)
  useBackButtonClose(true, onClose)

  const { data: nickname } = useQuery({
    queryKey: ['pending-nickname', userId],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('nickname').eq('id', userId).maybeSingle()
      return data?.nickname || null
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  // 승인 후 열릴 기능 — 프로그램 설정 반영(꺼둔 기능은 미리보기에서 제외).
  const unlocks = [
    { emoji: '✅', label: '미션 인증하고 포인트 쌓기' },
    ...(program?.ranking_enabled !== false ? [{ emoji: '🏆', label: '랭킹에서 함께 겨루기' }] : []),
    ...(program?.community_enabled !== false && program?.feed_enabled !== false ? [{ emoji: '💬', label: '커뮤니티에서 응원 주고받기' }] : []),
    ...(program?.quiz_enabled !== false ? [{ emoji: '🧠', label: '퀴즈로 건강 지식 쌓기' }] : []),
  ]

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-6">
      <motion.div className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.9, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-gradient-to-b from-amber-200/45 to-transparent blur-2xl" />
        <div className="relative text-center">
          <motion.img
            src="/icons/operator/hourglass.png" alt="" aria-hidden="true"
            className="w-20 h-20 object-contain mx-auto mb-1"
            initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.06 }}
            onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('div'), { textContent: '⏳', className: 'text-5xl mb-1 leading-none' })) }}
          />
          <h3 className="text-xl font-extrabold text-gray-900">
            {nickname ? `${nickname}님, 신청 완료!` : '참여 신청 완료!'}
          </h3>
          <p className="text-[13.5px] text-gray-600 mt-2 leading-relaxed break-keep">
            운영자가 확인하면 바로 함께할 수 있어요.<br />승인되면 알림으로 알려드릴게요.
          </p>
        </div>

        <div className="relative mt-4 rounded-2xl bg-gray-50 border border-gray-100 p-3">
          <p className="text-[11.5px] font-bold text-gray-400 mb-2 px-1">승인되면 이런 게 열려요</p>
          <ul className="flex flex-col gap-1.5">
            {unlocks.map((u) => (
              <li key={u.label} className="flex items-center gap-2.5 px-1">
                <span className="text-[17px] leading-none flex-shrink-0 grayscale opacity-60">{u.emoji}</span>
                <span className="flex-1 min-w-0 text-[13px] font-semibold text-gray-500">{u.label}</span>
                <Lock className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
              </li>
            ))}
          </ul>
        </div>

        <button type="button" onClick={onClose}
          className="relative mt-5 w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition">
          프로그램 둘러보기
        </button>
      </motion.div>
    </div>
  )
}
