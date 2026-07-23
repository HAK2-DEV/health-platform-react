import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../contexts/ToastContext'

// 운영자 → 참여자 응원 보내기 모달. 단일(1명) / 일괄(그룹) 겸용.
//   단일: props targetUserId + targetNickname → RPC send_operator_cheer (마이그 165)
//   일괄: props targetUserIds(배열) + groupLabel → RPC send_operator_cheer_bulk (마이그 166)
//   프리셋 빠른문구 + 자유 편집. 남용방지(하루 1회/참여자)는 RPC 에서 처리.
const PRESETS = [
  '꾸준히 참여해줘서 고마워요! 💪',
  '오늘도 화이팅이에요 🌱',
  '잘 지내죠? 다시 함께해요 💌',
  '조금만 더 힘내봐요, 응원할게요 🙌',
]
const MAX = 200

export default function CheerModal({ programId, targetUserId, targetNickname, targetUserIds, groupLabel, onClose }) {
  const toast = useToast()
  const isBulk = Array.isArray(targetUserIds)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const send = async () => {
    const m = msg.trim()
    if (!m) { setError('응원 메시지를 입력해주세요'); return }
    setSending(true)
    setError(null)

    if (isBulk) {
      const { data, error: err } = await supabase.rpc('send_operator_cheer_bulk', {
        p_program_id: programId,
        p_target_user_ids: targetUserIds,
        p_message: m,
      })
      setSending(false)
      if (err) { setError(err.message || '전송에 실패했어요'); return }
      const sent = data ?? 0
      const skipped = targetUserIds.length - sent
      toast.show(
        sent > 0
          ? `${sent}명에게 응원을 보냈어요 💌${skipped > 0 ? ` (${skipped}명은 오늘 이미 받음)` : ''}`
          : '오늘은 대상 모두 이미 응원을 받았어요'
      )
      onClose?.()
      return
    }

    const { error: err } = await supabase.rpc('send_operator_cheer', {
      p_program_id: programId,
      p_target_user_id: targetUserId,
      p_message: m,
    })
    setSending(false)
    if (err) { setError(err.message || '전송에 실패했어요'); return }
    toast.show('응원을 보냈어요 💌')
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-5"
      style={{ background: 'rgba(15,23,42,0.45)' }}
      onClick={() => !sending && onClose?.()}
    >
      <div className="w-full max-w-[340px] rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-bold text-gray-800">💌 {isBulk ? '응원 일괄 보내기' : '응원 보내기'}</h3>
        <p className="text-[12px] text-gray-500 mt-0.5 mb-3">
          {isBulk
            ? <><b className="text-gray-700">{groupLabel}</b>에게 같은 메시지를 보내요. (오늘 이미 받은 분은 제외)</>
            : <><b className="text-gray-700">{targetNickname}</b> 님에게 격려 메시지를 보내요. (하루 1회)</>}
        </p>

        {/* 프리셋 빠른문구 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setMsg(p); setError(null) }}
              className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition ${
                msg === p ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* 자유 편집 */}
        <div className="relative">
          <textarea
            value={msg}
            onChange={(e) => { setMsg(e.target.value.slice(0, MAX)); setError(null) }}
            placeholder="직접 응원 메시지를 적어도 좋아요"
            rows={3}
            autoFocus
            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 text-sm resize-none"
          />
          <span className="absolute right-2.5 bottom-2 text-[11px] text-gray-400">{msg.length}/{MAX}</span>
        </div>

        {error && <p className="mt-2 text-[12px] text-red-600 break-keep">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => onClose?.()}
            disabled={sending}
            className="flex-1 h-10 rounded-lg border border-gray-200 text-gray-500 text-[14px] font-bold disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={send}
            disabled={sending || !msg.trim()}
            className="flex-[1.4] h-10 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition disabled:opacity-50"
          >
            {sending ? '보내는 중…' : (isBulk ? '일괄 응원 보내기' : '응원 보내기')}
          </button>
        </div>
      </div>
    </div>
  )
}
