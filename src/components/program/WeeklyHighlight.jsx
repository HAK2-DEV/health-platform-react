import { useState, useEffect } from 'react'
import { Lightbulb, ChevronRight } from 'lucide-react'

// 주간 리포트 넛지 배너 — 개요 상단. 이번 주 미열람 시 노출 → 탭하면 통계(이번 주 하이라이트)로 이동.
//   재방문 유도만 담당(리포트 본체는 통계에 있음 — 중복 제거). 이번 주 열람하면 사라짐.
//   props: programId, onOpen(통계로 이동), show(노출 조건 — 운영자·진행중·참여자 있음)
function weekKey() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}
const seenKey = (pid) => `whl-seen:${pid}`

export default function WeeklyHighlight({ programId, onOpen, show = true }) {
  const [seen, setSeen] = useState(true)
  useEffect(() => {
    try { setSeen(localStorage.getItem(seenKey(programId)) === weekKey()) } catch { setSeen(true) }
  }, [programId])

  if (!show || seen) return null

  const handle = () => {
    try { localStorage.setItem(seenKey(programId), weekKey()) } catch { /* 무시 */ }
    setSeen(true)
    onOpen?.()
  }

  return (
    <button type="button" onClick={handle}
      className="mb-3 w-full flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left hover:bg-amber-100/60 transition">
      <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0" />
      <span className="flex-1 text-[13px] font-bold text-gray-700">이번 주 리포트가 도착했어요 · 보기</span>
      <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
    </button>
  )
}
