import { useState, useEffect, useRef } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
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
  reminder: {
    title: '리마인드 보내기',
    desc: '오늘 인증 리마인드를 보내요',
    send: '리마인드 보내기',
    bulkSend: '일괄 리마인드 보내기',
    notifTitle: '⏰ 오늘 미션 인증을 잊지 마세요',
    done: '리마인드를 보냈어요 ⏰',
    emoji: '⏰',
    presets: [
      '오늘 미션 아직이에요! 잊지 말고 인증해요 ⏰',
      '조금만 시간 내서 오늘 인증 어때요? 🙌',
      '오늘도 함께해요, 인증 기다릴게요 🌱',
      '마감 전에 오늘 미션 완료해봐요 💪',
    ],
  },
  quizReminder: {
    title: '리마인드 보내기',
    desc: '퀴즈 리마인드를 보내요',
    send: '리마인드 보내기',
    bulkSend: '일괄 리마인드 보내기',
    notifTitle: '❓ 아직 안 푼 퀴즈가 있어요',
    done: '리마인드를 보냈어요 ❓',
    emoji: '❓',
    presets: [
      '아직 안 푼 퀴즈가 있어요! 풀어봐요 ❓',
      '잠깐 시간 내서 퀴즈 어때요? 🧠',
      '오늘 퀴즈도 함께해요, 기다릴게요 🌱',
      '마감 전에 퀴즈 완료해봐요 💪',
    ],
  },
  comeback: {
    title: '복귀 격려 보내기',
    desc: '오랜만인 참여자에게 다시 함께하자고 격려해요',
    send: '복귀 격려 보내기',
    bulkSend: '일괄 복귀 격려',
    notifTitle: '🌱 다시 함께해요',
    done: '복귀 격려를 보냈어요 🌱',
    emoji: '🌱',
    presets: [
      '요즘 못 봤네요! 다시 함께 걸어요 🌱',
      '오랜만이에요 😊 언제든 편하게 돌아와요',
      '조금 쉬었어도 괜찮아요, 다시 시작해봐요 🙌',
      '기다리고 있었어요! 오늘 가볍게 하나 어때요? 💪',
    ],
  },
}
const MAX = 200

export default function CheerModal({ programId, targetUserId, targetNickname, targetUserIds, targetNames, groupLabel, variant = 'cheer', onClose }) {
  useBodyScrollLock(true)  // 마운트=열림 → iOS 배경 스크롤 방지
  useBackButtonClose(true, onClose)  // 하드웨어 뒤로가기 = 닫기
  const toast = useToast()
  const v = VARIANTS[variant] || VARIANTS.cheer
  const isBulk = Array.isArray(targetUserIds)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  // 일괄 대상 이름 — 한 줄 넘으면 접고 「모두 보기」로 펼침
  const namesRef = useRef(null)
  const [namesOverflow, setNamesOverflow] = useState(false)
  const [namesExpanded, setNamesExpanded] = useState(false)
  useEffect(() => {
    const el = namesRef.current
    if (el) setNamesOverflow(el.scrollHeight > 30)
  }, [targetNames])
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
        <p className="text-[12px] text-gray-500 mt-0.5 mb-2">
          {isBulk
            ? <><b className="text-gray-700">{groupLabel}</b>에게 같은 {v.desc.replace('를 보내요', '')}를 보내요.<br /><span className="text-gray-400">(오늘 이미 받은 분은 제외)</span></>
            : <><b className="text-gray-700">{targetNickname}</b> 님에게 {v.desc}. (하루 1회)</>}
        </p>

        {/* 일괄 대상 이름 — 누구에게 가는지 확인. 여러 줄이면 접고 「모두 보기」 */}
        {isBulk && Array.isArray(targetNames) && targetNames.length > 0 && (
          <div className="mb-3">
            <div
              ref={namesRef}
              className="flex flex-wrap gap-1 overflow-hidden transition-[max-height] duration-200"
              style={{ maxHeight: namesExpanded ? 240 : 24 }}
            >
              {targetNames.map((n, i) => (
                <span key={i} className="text-[11px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 whitespace-nowrap">{n}</span>
              ))}
            </div>
            {namesOverflow && (
              <button
                type="button"
                onClick={() => setNamesExpanded((v) => !v)}
                className="mt-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
              >
                {namesExpanded ? '접기 ▴' : `모두 보기 (${targetNames.length}명) ▾`}
              </button>
            )}
          </div>
        )}

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
