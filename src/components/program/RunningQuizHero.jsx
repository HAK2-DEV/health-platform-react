// 달리기 퀴즈 화면 상단 히어로 — 프로그램명 + 퀴즈 수 + 푼/전체 원형 링.
import { useEffect, useState } from 'react'
const BRAND = '#22A45C'
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

function QuizRing({ done = 0, total = 0 }) {
  const pct = total > 0 ? Math.min(1, done / total) : 0
  const R = 26
  const C = 2 * Math.PI * R
  // 진입(마운트) 시 0 → pct 로 링이 채워지는 연출
  const [fill, setFill] = useState(0)
  useEffect(() => {
    if (reduceMotion()) { setFill(pct); return }
    let r1, r2
    r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setFill(pct)) })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [pct])
  return (
    <div className="relative w-[72px] h-[72px] flex-shrink-0">
      <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" stroke="#E5E7EB" strokeWidth="7" />
        {total > 0 && done > 0 && (
          <circle cx="32" cy="32" r={R} fill="none" stroke={BRAND} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - fill)} style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.34,1.2,0.64,1)' }} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[16px] font-extrabold text-gray-900 leading-none">{done}/{total}</span>
        <span className="text-[11px] text-gray-400 mt-0.5">완료</span>
      </div>
    </div>
  )
}

function RunningQuizHero({ programName = '러닝 프로그램', quizCount = 0, solved = 0 }) {
  return (
    <div className="rounded-2xl p-4 mb-[9px] bg-white border border-gray-100 shadow-soft flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[20px] font-extrabold text-gray-900 leading-snug break-keep">{programName}</h2>
        <p className="text-[12px] text-gray-500 mt-1.5">건강 퀴즈 {quizCount}개</p>
      </div>
      <QuizRing done={solved} total={quizCount} />
    </div>
  )
}

export default RunningQuizHero
