import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../supabaseClient'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../lib/queries'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'

// 환영 메시지 작성 — 첫 프로그램 만들기 흐름(미션 → 환영 → 초대)의 2단계.
//   운영자가 참여자 첫 진입 인사말을 짧게 남긴다. 저장 시 programs.welcome_message 갱신.
export default function WelcomeMessageModal({ programId, initial = '', onClose, onSaved }) {
  useBodyScrollLock(true)
  useBackButtonClose(true, onClose)
  const qc = useQueryClient()
  const [text, setText] = useState(initial || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async () => {
    setSaving(true); setError(null)
    const { error: e } = await supabase.from('programs')
      .update({ welcome_message: text.trim() || null })
      .eq('id', programId)
    setSaving(false)
    if (e) { setError(e.message || '저장에 실패했어요'); return }
    qc.invalidateQueries({ queryKey: queryKeys.program(programId) })
    onSaved?.()
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
      <motion.div className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={saving ? undefined : onClose} />
      <motion.div
        className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
        initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        <div className="text-center">
          <div className="text-3xl mb-1 leading-none">💌</div>
          <h3 className="text-lg font-extrabold text-gray-900">환영 메시지</h3>
          <p className="text-[12.5px] text-gray-500 mt-1 leading-relaxed break-keep">
            새 참여자가 처음 들어왔을 때 딱 한 번 보여줄 인사말이에요.
          </p>
          <p className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11.5px] font-bold">
            💡 비워두면 기본 문구가 나가요
          </p>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={200}
          rows={4}
          autoFocus
          disabled={saving}
          placeholder="예) 반가워요! 우리 4주 동안 매일 조금씩, 함께 건강해져요. 궁금한 건 언제든 물어봐 주세요 :)"
          className="mt-4 w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl text-[13.5px] focus:outline-none focus:border-emerald-500 disabled:bg-gray-50 resize-none leading-relaxed"
        />
        <p className="mt-1 text-right text-[11px] text-gray-400">{text.length}/200</p>
        {error && <p className="text-[12px] text-red-500 mt-1">{error}</p>}
        <div className="mt-3 flex flex-col gap-2">
          <button type="button" onClick={save} disabled={saving}
            className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-[14px] font-bold transition">
            {saving ? '저장 중…' : '저장하고 계속'}
          </button>
          <button type="button" onClick={onClose} disabled={saving}
            className="w-full h-11 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-[14px] font-bold transition">
            닫기
          </button>
        </div>
      </motion.div>
    </div>
  )
}
