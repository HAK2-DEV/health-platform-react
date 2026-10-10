// 마음 건강 프로그램 — 「힘들 때 연락할 곳」 안내(마이그 287 crisis_line_enabled). 소개글과 따로, 늘 보인다.
//   프로그램 홈 맨 아래(카드), 참여 전 화면(참여 모달·초대 페이지)의 소개 아래(plain).
//   조용하게 — 빨강·경고 톤을 쓰지 않는다(§4 색은 상호작용에만, §13-10 움직임 없음). 누를 수 있는 건 전화 걸기 하나뿐이라 그것만 색.
import { Phone } from 'lucide-react'
import { CRISIS_LINE, CRISIS_PHONE } from '../../lib/constants'

export default function CrisisLineCard({ text = CRISIS_LINE, plain = false }) {
  const body = (
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center" aria-hidden="true">
        <Phone className="w-4 h-4 text-gray-500" />
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <p className="text-[13px] text-gray-700 leading-snug break-keep">{text}</p>
        <a href={`tel:${CRISIS_PHONE}`} className="self-start text-[13px] font-semibold text-emerald-700 underline underline-offset-2 decoration-emerald-300">
          {CRISIS_PHONE} 전화하기
        </a>
      </div>
    </div>
  )
  if (plain) return <div className="rounded-xl bg-gray-50 px-3.5 py-3">{body}</div>
  return <div className="rounded-2xl p-3.5 bg-white border border-gray-100 shadow-soft">{body}</div>
}
