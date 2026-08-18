// 운영자 「이탈 조짐」 배너 — N일+ 미인증 ACTIVE 참여자가 있으면 노출. 원터치 복귀 격려.
//   알람(빨강) 아닌 부드러운 rose 톤 — "멀어지고 있어요, 다시 손 내밀어요"(격려·관계). props:
//   count(대상 수), thresholdDays(기준일), onRemind(복귀 격려 발송), onList(명단 보기)
export default function OperatorAtRiskBanner({ count, thresholdDays = 3, onRemind, onList }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <img src="/icons/operator/decline.png" alt="" aria-hidden="true" className="w-9 h-9 object-contain flex-shrink-0 -my-1"
          onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement('span'), { textContent: '🌡️', className: 'text-[15px]' })) }} />
        <p className="text-[13px] font-extrabold text-rose-900">{count}명이 멀어지고 있어요</p>
        <span className="ml-auto text-[11px] text-rose-700/70 break-keep">{thresholdDays}일+ 미인증</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={onRemind}
          className="h-9 rounded-xl bg-rose-500 text-white text-[13px] font-bold active:scale-[0.98] transition">
          복귀 격려 보내기
        </button>
        <button type="button" onClick={onList}
          className="h-9 rounded-xl bg-white border border-rose-200 text-rose-800 text-[13px] font-bold active:scale-[0.98] transition">
          명단 보기
        </button>
      </div>
    </div>
  )
}
