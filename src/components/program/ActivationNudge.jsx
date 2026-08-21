import { ChevronRight } from 'lucide-react'

// 운영자 활성화 넛지 — 첫 프로그램이 죽기 전에 "다음 액션 하나"를 개요 최상단에서 제시.
//   퍼널 최우선 1개만: 참여자 0명 → 초대 / 참여했는데 첫 인증 0 → 전체 응원.
//   건강(인증 발생 중)하면 null → 잔소리 방지.
//   props: state{participantCount,hasMission,hasActivity}, onInvite(), onCheer()
export default function ActivationNudge({ state, onInvite, onCheer }) {
  if (!state) return null
  const { participantCount, hasMission, hasActivity } = state

  let nudge = null
  if (participantCount === 0) {
    nudge = {
      emoji: '🙌',
      iconSrc: '/icons/onboarding/invite.png',
      title: '아직 함께할 사람이 없어요',
      desc: '프로그램은 같이할 때 힘이 나요. 지금 첫 참여자를 초대해볼까요?',
      label: '초대하기',
      onClick: onInvite,
    }
  } else if (hasMission && !hasActivity) {
    nudge = {
      emoji: '📣',
      title: `${participantCount}명이 시작을 기다리고 있어요`,
      desc: '첫 인증이 물꼬를 터요. 응원 한마디로 시동을 걸어볼까요?',
      label: '전체 응원 보내기',
      onClick: onCheer,
    }
  }
  if (!nudge) return null

  return (
    <div className="w-full rounded-2xl p-4 mb-[9px] bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 shadow-soft">
      <div className="flex items-start gap-3">
        {nudge.iconSrc
          ? <img src={nudge.iconSrc} alt="" aria-hidden="true" className="w-8 h-8 flex-shrink-0 mt-0.5 object-contain"
              onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('span'), { textContent: nudge.emoji, className: 'text-2xl flex-shrink-0 leading-none' })) }} />
          : <span className="text-2xl flex-shrink-0 leading-none mt-0.5" aria-hidden="true">{nudge.emoji}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-bold text-gray-800">{nudge.title}</p>
          <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed break-keep">{nudge.desc}</p>
          <button type="button" onClick={nudge.onClick}
            className="mt-2.5 inline-flex items-center gap-1 pl-3.5 pr-3 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[12.5px] font-bold transition active:scale-[0.98]">
            {nudge.label} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
