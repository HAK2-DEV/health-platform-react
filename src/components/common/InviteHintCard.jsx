import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ticket, ChevronRight, X } from 'lucide-react'
import { getInviteHint, clearInviteHint } from '../../lib/pendingInvite'

// 대시보드 상단 「초대받은 프로그램」 카드 — 초대링크를 방문했으나 아직 참여하지 않은 경우의 리마인더.
//   자동복귀가 끊기거나 이미 로그인 상태로 초대만 보고 넘어간 경우의 안전망(본인 아이디어 2026-08-13).
//   참여 완료·닫기·7일 만료 시 사라짐. (저장: lib/pendingInvite 의 invite_hint)
function InviteHintCard() {
  const navigate = useNavigate()
  const [hint, setHint] = useState(() => getInviteHint())
  if (!hint) return null

  const go = () => navigate(`/join?code=${encodeURIComponent(hint.code)}`)
  const dismiss = (e) => { e.stopPropagation(); clearInviteHint(); setHint(null) }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } }}
      className="w-full flex items-center gap-3 p-3.5 rounded-[10px] bg-emerald-50 border border-emerald-200 text-left cursor-pointer active:scale-[.99] transition"
    >
      <span className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
        <Ticket className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] font-bold text-emerald-600">초대받은 프로그램</span>
        <span className="block text-[14px] font-bold text-gray-800 truncate">
          {hint.name ? `${hint.name} · 참여하기` : '참여하러 가기'}
        </span>
      </span>
      <ChevronRight className="w-5 h-5 text-emerald-400 flex-shrink-0" />
      <button type="button" onClick={dismiss} aria-label="초대 카드 닫기"
        className="flex-shrink-0 p-1 -mr-1 text-emerald-400 hover:text-emerald-600 transition">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export default InviteHintCard
