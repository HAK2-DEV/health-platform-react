import { useState, useEffect } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { supabase } from '../../supabaseClient'
import { useToast } from '../../contexts/ToastContext'

// 운영자 → 참여자 메시지 모달. 단일/일괄 겸용 + 변형(응원/환영).
//   단일: targetUserId + targetNickname → RPC send_operator_cheer
//   일괄: targetUserIds(배열) + groupLabel → RPC send_operator_cheer_bulk
//   variant: 'cheer'(기본) | 'welcome' — 제목·프리셋·알림 제목이 달라짐 (마이그 167 p_title)
//   프리셋 빠른문구 + 자유 편집. 남용방지(하루 1회/참여자)는 RPC 에서 처리.
const VARIANTS = {
  cheer: {
    title: '응원 보내기',
    desc: '격려 메시지를 보내요',
    send: '응원 보내기',
    bulkSend: '일괄 응원 보내기',
    notifTitle: '💌 운영자 응원이 도착했어요',
    done: '응원을 보냈어요 💌',
    emoji: '💌',
    presets: [
      '꾸준히 참여해줘서 고마워요! 💪',
      '오늘도 화이팅이에요 🌱',
      '잘 지내죠? 다시 함께해요 💌',
      '조금만 더 힘내봐요, 응원할게요 🙌',
    ],
  },
  welcome: {
    title: '환영 메시지 보내기',
    desc: '환영 메시지를 보내요',
    send: '환영 메시지 보내기',
    bulkSend: '환영 메시지 보내기',
    notifTitle: '👋 운영자 환영 메시지가 도착했어요',
    done: '환영 메시지를 보냈어요 👋',
    emoji: '👋',
    presets: [
      '우리 프로그램에 오신 걸 환영해요! 🎉',
      '함께하게 되어 반가워요 😊',
      '천천히 시작해봐요, 응원할게요 🌱',
      '궁금한 건 언제든 물어보세요 🙌',
    ],
  },
}
const MAX = 200

export default function CheerModal({ programId, targetUserId, targetNickname, targetUserIds, groupLabel, variant = 'cheer', onClose }) {
  useBodyScrollLock(true)  // 마운트=열림 → iOS 배경 스크롤 방지
  const toast = useToast()
  const v = VARIANTS[variant] || VARIANTS.cheer
  const isBulk = Array.isArray(targetUserIds)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  // 키보드가 올라오면 보이는 영역(visualViewport) 기준으로 모달을 가운데 정렬 → 상단 잘림 방지.
  const [vv, setVv] = useState({ top: 0, height: null })
  useEffect(() => {
    const win = window.visualViewport
    if (!win) return
    const update = () => setVv({ top: win.offsetTop, height: win.height })
    update()
    win.addEventListener('resize', update)
    win.addEventListener('scroll', update)
    return () => { win.removeEventListener('resize', update); win.removeEventListener('scroll', update) }
  }, [])

  const send = async () => {
    const m = msg.trim()
    if (!m) { setError('메시지를 입력해주세요'); return }
    setSending(true)
    setError(null)

    if (isBulk) {
      const { data, error: err } = await supabase.rpc('send_operator_cheer_bulk', {
        p_program_id: programId,
        p_target_user_ids: targetUserIds,
        p_message: m,
        p_title: v.notifTitle,
      })
      setSending(false)
      if (err) { setError(err.message || '전송에 실패했어요'); return }
      const sent = data ?? 0
      const skipped = targetUserIds.length - sent
      toast.show(
        sent > 0
          ? `${sent}명에게 보냈어요 ${v.emoji}${skipped > 0 ? ` (${skipped}명은 오늘 이미 받음)` : ''}`
          : '오늘은 대상 모두 이미 메시지를 받았어요'
      )
      onClose?.()
      return
    }

    const { error: err } = await supabase.rpc('send_operator_cheer', {
      p_program_id: programId,
      p_target_user_id: targetUserId,
      p_message: m,
      p_title: v.notifTitle,
    })
    setSending(false)
    if (err) { setError(err.message || '전송에 실패했어요'); return }
    toast.show(v.done)
    onClose?.()
  }

  return (
    <div
      className="fixed inset-0 z-[70]"
      style={{ background: 'rgba(15,23,42,0.45)' }}
      onClick={() => !sending && onClose?.()}
    >
      {/* 보이는 영역(키보드 위) 기준 가운데 정렬 — 내용이 길면 카드 내부 스크롤 */}
      <div className="absolute left-0 right-0 flex items-center justify-center p-4"
        style={{ top: vv.top, height: vv.height ?? '100%' }}>
        <div className="w-full max-w-[340px] max-h-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-[15px] font-bold text-gray-800">{v.emoji} {v.title}</h3>
        <p className="text-[12px] text-gray-500 mt-0.5 mb-3">
          {isBulk
            ? <><b className="text-gray-700">{groupLabel}</b>에게 같은 {v.desc.replace('를 보내요', '')}를 보내요. (오늘 이미 받은 분은 제외)</>
            : <><b className="text-gray-700">{targetNickname}</b> 님에게 {v.desc}. (하루 1회)</>}
        </p>

        {/* 프리셋 빠른문구 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {v.presets.map((p) => (
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
            placeholder="직접 메시지를 적어도 좋아요"
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
            {sending ? '보내는 중…' : (isBulk ? v.bulkSend : v.send)}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
