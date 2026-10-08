import { ChevronRight } from 'lucide-react'

// 「오늘 할 일」 맨 위 — 다시 올릴 수 있는 반려 인증 한 건(마이그 283).
//   색은 빨강이 아니라 «장미색»이다: 잘못했다는 뜻이 아니라 「한 번 더」라는 뜻이라서(dev 시안에서 정한 톤).
//   운영자 메모를 운영자 이름으로 보여 준다 — 앱이 아니라 «사람»이 봐 준 것이라는 느낌이 남아야 한다.
//
// props: item(useRedoVerifications 한 건) · ownerName · onGo(만회 화면으로)
function TodayRedoCard({ item, ownerName, onGo }) {
  const who = ownerName ? `${ownerName} 운영자` : '운영자'
  return (
    <div className="w-full rounded-2xl p-4 bg-rose-50 border border-rose-200 text-left">
      <p className="text-[11px] font-bold text-rose-500 tracking-[0.14em]">오늘 할 일</p>
      <p className="text-[16px] font-extrabold text-rose-900 mt-1 break-keep">🔁 {item.title}</p>
      <p className="text-[12.5px] text-rose-700/90 mt-0.5">{item.dayWord} 인증 · 다시 확인이 필요해요</p>

      {item.reason && (
        <div className="mt-2.5 px-2.5 py-2 bg-white rounded-lg">
          <p className="text-[11px] font-bold text-gray-500 mb-0.5">{who}</p>
          <p className="text-[12.5px] text-gray-700 whitespace-pre-line break-keep leading-relaxed">{item.reason}</p>
        </div>
      )}

      <p className={`text-[12.5px] mt-2 break-keep ${item.lastChance ? 'font-bold text-rose-700' : 'text-rose-700/90'}`}>
        {item.lastChance
          ? `${item.left} 안에 다시 올려 주세요 · 마지막 기회예요`
          : `${item.left} 안에 다시 올리면 원래 날짜로 인정돼요`}
      </p>

      <button type="button" onClick={onGo}
        className="mt-3 w-full h-11 rounded-xl bg-rose-500 text-white text-[14px] font-extrabold flex items-center justify-center gap-1 active:scale-[0.98] transition">
        다시 인증 <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

export default TodayRedoCard
