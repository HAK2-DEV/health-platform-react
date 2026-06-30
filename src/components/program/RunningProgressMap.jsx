import { useRef, useState, useEffect } from 'react'

// 달리기 테마 — 프로그램 진행율(시간 기준)을 마라톤 코스로 시각화.
//   굽이진 SVG 코스 위를 진행율(%)만큼 러너(🏃)가 달림. 출발🚩 → 결승🏁.
//   "달리는 느낌" 위해 마라톤 풀코스(42.195km) 환산 지점도 표기.
//   props: progress(0~100), elapsedDays, totalDays
const COURSE = 'M14,84 C 70,84 64,34 120,34 S 196,86 244,64 S 300,30 306,30'
const MARATHON_KM = 42.195

function RunningProgressMap({ progress = 0, elapsedDays = null, totalDays = null }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
  const pathRef = useRef(null)
  const [len, setLen] = useState(0)
  const [pt, setPt] = useState(null)

  useEffect(() => {
    const p = pathRef.current
    if (!p) return
    const L = p.getTotalLength()
    setLen(L)
    const point = p.getPointAtLength((pct / 100) * L)
    setPt({ x: point.x, y: point.y })
  }, [pct])

  const km = (pct / 100 * MARATHON_KM).toFixed(1)
  const done = pct >= 100

  return (
    <div className="bg-white rounded-2xl shadow-elevated p-4 mb-[9px]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">🏃</span>
        <h3 className="text-sm font-bold text-gray-800">마라톤 코스</h3>
        <span className="text-[11px] text-gray-400 ml-auto">
          {elapsedDays != null && totalDays != null ? `${elapsedDays}일째 · 총 ${totalDays}일` : `${pct}%`}
        </span>
      </div>
      <p className="text-[12px] text-gray-600 mb-2">
        {done ? '완주했어요! 🎉' : <>코스 <b className="text-sky-600">{pct}%</b> 통과 · 풀코스 42.195km 중 <b className="text-sky-600">{km}km</b> 지점</>}
      </p>

      <svg viewBox="0 0 320 110" className="w-full" style={{ maxHeight: '120px' }}>
        {/* 코스(점선) */}
        <path d={COURSE} fill="none" stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 9" />
        {/* 달린 구간(채워짐) */}
        {len > 0 && (
          <path d={COURSE} fill="none" stroke="#0EA5E9" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={len * (1 - pct / 100)} />
        )}
        {/* 출발 / 결승 깃발 */}
        <text x="14" y="100" textAnchor="middle" fontSize="15">🚩</text>
        <text x="306" y="22" textAnchor="middle" fontSize="15">🏁</text>
        {/* 러너 — 코스 위 진행 위치 */}
        {pt && (
          <text x={pt.x} y={pt.y - 7} textAnchor="middle" fontSize="18">🏃</text>
        )}
      </svg>
    </div>
  )
}

export default RunningProgressMap
