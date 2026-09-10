// 금연 응원 푸터 — 금연 테마 개요 제일 하단. "혼자가 아니에요" 메시지 + 응원 3인 일러스트.
//   일러스트: /illustrations/themes/quit-smoking-cheer.png (흰 배경, 없으면 텍스트만).
function QuitSmokingCheer() {
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-elevated mb-[9px] mx-auto w-[398px] max-w-full min-h-[60px] bg-white border border-gray-100">
      {/* 일러스트 — 좌측 배치, 흰 배경이라 카드와 자연스럽게 이어짐 (페이드 없음) */}
      <img
        src="/illustrations/themes/quit-smoking-cheer.webp"
        alt="" aria-hidden="true"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
        className="absolute left-0 inset-y-0 h-full w-[46%] object-contain object-center"
      />

      {/* 텍스트 — 우측 */}
      <div className="relative z-10 min-h-[60px] flex flex-col justify-center px-4 pl-[44%] py-2">
        <p className="text-[12.5px] font-extrabold text-gray-900 leading-tight break-keep">금연은 혼자가 아니에요</p>
        <p className="text-[11px] font-bold text-emerald-600 mt-0.5 break-keep">함께라서 더 강해요! <span>💚</span></p>
      </div>
    </div>
  )
}

export default QuitSmokingCheer
