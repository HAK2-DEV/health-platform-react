import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'

// 참여자 첫 진입 환영 시트 — 승인/가입 후 처음 들어왔을 때 1회.
//   차가운 개요 대신 "환대 + 소속감 + 첫 행동"을 준다(북극성: 동행).
//   운영자 작성 문구(program.welcome_message)가 있으면 그걸, 없으면 기본 문구.
//   닉네임·참여자 수는 자체 조회(1회성 마운트라 부담 적음).
export default function ParticipantWelcomeSheet({ program, userId, canCertify, onCertify, onClose }) {
  useBodyScrollLock(true)
  useBackButtonClose(true, onClose)

  const { data: nickname } = useQuery({
    queryKey: ['welcome-nickname', userId],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('nickname').eq('id', userId).maybeSingle()
      return data?.nickname || null
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: count } = useQuery({
    queryKey: ['welcome-count', program?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_active_participant_counts', { p_program_ids: [program.id] })
      return data?.[0]?.participant_count ?? null
    },
    enabled: !!program?.id,
  })

  const message = (program?.welcome_message || '').trim()
    || '오늘부터 함께예요. 혼자보다 오래, 함께라서 즐겁게 — 작은 한 걸음이면 충분해요.'

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-6">
      <motion.div className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} />
      <motion.div
        className="relative w-full max-w-sm bg-white rounded-3xl p-6 text-center shadow-2xl overflow-hidden"
        initial={{ opacity: 0, scale: 0.9, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        {/* 상단 은은한 그라데이션 헤일로 */}
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full bg-gradient-to-b from-emerald-200/50 to-transparent blur-2xl" />
        <motion.img
          src="/icons/operator/celebrate1.png" alt="" aria-hidden="true"
          className="relative w-20 h-20 object-contain mx-auto mb-1"
          initial={{ scale: 0.6, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.08 }}
          onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('div'), { textContent: '🎉', className: 'relative text-5xl mb-1 leading-none' })) }}
        />
        <h3 className="relative text-xl font-extrabold text-gray-900">
          {nickname ? `${nickname}님, 환영해요!` : '환영해요!'}
        </h3>
        <p className="relative text-[13.5px] text-gray-600 mt-2 leading-relaxed break-keep whitespace-pre-line">{message}</p>

        {count > 1 && (
          <div className="relative mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-[12px] font-bold">
            🌱 지금 {count}명이 함께하고 있어요
          </div>
        )}

        <div className="relative mt-5 flex flex-col gap-2">
          {canCertify ? (
            <button type="button" onClick={onCertify}
              className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition inline-flex items-center justify-center gap-1">
              첫 인증 하러 가기 <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={onClose}
              className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition">
              프로그램 둘러보기
            </button>
          )}
          {canCertify && (
            <button type="button" onClick={onClose}
              className="w-full h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-[14px] font-bold transition">
              먼저 둘러볼게요
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
