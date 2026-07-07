// 달리기 미션 화면 상단 히어로 — 프로그램명 + 미션수·총점 + 오늘 완료 원형 링(신발 자리).
//   props: programName, missionCount, totalPoints, todayDone, todayTotal
const BRAND = '#22A45C'

function ProgressRing({ done = 0, total = 0 }) {
  const pct = total > 0 ? Math.min(1, done / total) : 0
  const R = 26
  const C = 2 * Math.PI * R
  return (
    <div className="relative w-[72px] h-[72px] flex-shrink-0">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" stroke="#E5E7EB" strokeWidth="7" />
        {total > 0 && (
          <circle cx="32" cy="32" r={R} fill="none" stroke={BRAND} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {total > 0 ? (
          <>
            <span className="text-[16px] font-extrabold text-gray-900 leading-none">{done}/{total}</span>
            <span className="text-[11px] text-gray-400 mt-0.5">완료</span>
          </>
        ) : (
          <>
            <span className="text-[12px] font-extrabold text-gray-400 leading-none">휴식</span>
            <span className="text-[11px] text-gray-300 mt-0.5">오늘</span>
          </>
        )}
      </div>
    </div>
  )
}

function RunningMissionHero({ programName = '러닝 프로그램', missionCount = 0, totalPoints = 0, todayDone = 0, todayTotal = 0 }) {
  return (
    <div className="rounded-2xl p-4 mb-[9px] bg-white border border-gray-100 shadow-soft flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[20px] font-extrabold text-gray-900 leading-snug break-keep">{programName}</h2>
        <p className="text-[12px] text-gray-500 mt-1.5">{missionCount}개 미션 · 총 {totalPoints}P</p>
      </div>
      <ProgressRing done={todayDone} total={todayTotal} />
    </div>
  )
}

export default RunningMissionHero
