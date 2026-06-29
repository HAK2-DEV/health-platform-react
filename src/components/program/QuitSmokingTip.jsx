import { useMemo } from 'react'

// 금연 팁 카드 — 금연 테마 개요. 흡연 욕구 대처 팁(일자 기준 순환).
//   일러스트: /illustrations/themes/quit-smoking-tip.png (없으면 텍스트만).
const TIPS = [
  { title: '흡연 욕구가 올라올 땐', highlight: '물 한 잔, 심호흡 3번 💧', sub: '짧은 실천이 큰 도움이 돼요!' },
  { title: '입이 심심할 땐', highlight: '물·견과류·껌으로 대신해요 🥜', sub: '손과 입을 바쁘게 해보세요!' },
  { title: '스트레스가 쌓일 땐', highlight: '잠깐 산책, 가볍게 스트레칭 🚶', sub: '기분을 바꾸면 욕구도 가라앉아요!' },
]

function QuitSmokingTip() {
  const tip = useMemo(() => TIPS[new Date().getDate() % TIPS.length], [])

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-elevated mb-[9px] mx-auto w-[398px] max-w-full h-[103px] bg-white border border-gray-100">
      {/* 일러스트 — 우측, 흰 배경이라 카드와 자연스럽게 이어짐 */}
      <img
        src="/illustrations/themes/quit-smoking-tip.png"
        alt="" aria-hidden="true"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
        className="absolute right-0 inset-y-0 h-full w-[50%] object-contain object-center"
      />
      {/* 좌측 가독 그라데이션 (흰색) — 우측 일러스트 직전까지만 */}
      <div className="absolute inset-0 bg-gradient-to-r from-white from-[30%] to-transparent to-[58%]" />

      <div className="relative z-10 p-3 max-w-[56%]">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold mb-1">🌿 금연 팁</span>
        <p className="text-[14px] font-bold text-gray-800 leading-tight">{tip.title}</p>
        <p className="text-[14px] font-extrabold text-emerald-600 leading-tight mt-0.5">{tip.highlight}</p>
        <p className="text-[11px] text-gray-500 mt-1">{tip.sub}</p>
      </div>
    </div>
  )
}

export default QuitSmokingTip
