// 만회 인증(283) 안내 배너 — 반려된 인증을 «다시 올리는 중»임을 알린다.
//   MissionVerifyPage 안에 인라인으로 있던 것을 그대로 꺼냈다(마크업 변경 없음).
//   따로 둔 이유: 배포 공지에 넣을 사진을 이 컴포넌트로 찍기 위해서다(/dev/release?shot=makeup).
//   비슷하게 생긴 걸 새로 만들어 찍으면, 이 화면이 바뀐 뒤에도 사진만 옛 모습으로 남아 조용히 거짓이 된다.
//
// props
//   dayLabel   — 어느 날 인증으로 인정되는지 ("10월 4일" 등)
//   left       — 남은 시간 ("12시간" 등). 반려 시각부터 24시간.
//   reason     — 운영자가 남긴 반려 사유 (없으면 숨김)
//   needsImage — 사진이 필요한 미션이면 「반려된 사진은 다시 쓸 수 없어요」
//   lastChance — 한 번 더 반려되면 그날 인증이 마감되는 상태(묶음 반려 2번째)
function MakeupBanner({ dayLabel, left, reason = null, needsImage = false, lastChance = false }) {
  return (
    <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl">
      <p className="text-sm font-bold text-rose-700 mb-0.5">🔁 다시 올리는 인증이에요</p>
      <p className="text-xs text-rose-700">{dayLabel} 인증으로 인정돼요 · {left} 남았어요</p>
      {reason && (
        <div className="mt-2 px-2.5 py-2 bg-white rounded-lg">
          <p className="text-[11px] font-bold text-gray-500 mb-0.5">운영자 메모</p>
          <p className="text-xs text-gray-700 whitespace-pre-line break-keep">{reason}</p>
        </div>
      )}
      {needsImage && <p className="mt-2 text-xs text-rose-700">반려된 사진은 다시 쓸 수 없어요. 다른 사진을 올려 주세요.</p>}
      {lastChance && (
        <p className="mt-1 text-xs font-bold text-rose-700">한 번 더 반려되면 그날 인증은 마감돼요.</p>
      )}
    </div>
  )
}

export default MakeupBanner
