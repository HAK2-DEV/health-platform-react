import { useState } from 'react'
import DietChangeTab from '../../components/program/DietChangeTab'

// 🔧 「내 변화 · 식단」 UI 데모 — 목데이터. 라우트: /dev/diet-change
//   확정되면 DietChangeTab 을 프로그램 상세에 NavCard 탭으로 배선(+ weight_logs 마이그레이션).

// 체중: 5/4부터 주 1회, 72.0 → 68.4 완만한 하강 (목업과 동일 톤)
const W_SERIES = [72.0, 71.5, 71.0, 70.8, 70.2, 69.6, 69.1, 68.7, 68.4]
const WA_SERIES = [88.0, 87.4, 86.9, 86.5, 85.8, 85.2, 84.7, 84.3, 84.0]
const MOODS_DEMO = { 0: 3, 1: 4, 2: 3, 3: 4, 4: 4, 5: 5, 6: 4, 7: 5, 8: 4 }
const MEMOS_DEMO = {
  2: '저녁을 가볍게 먹으니 아침 컨디션이 좋다',
  5: '주말에 조금 과식… 내일부터 다시 조절하자',
  7: '물을 자주 마셨더니 붓기가 덜한 느낌',
}
const WEIGHT = W_SERIES.map((w, i) => {
  const d = new Date('2026-05-04T00:00:00'); d.setDate(d.getDate() + i * 7)
  return { date: d.toISOString().slice(0, 10), weight: w, waist: WA_SERIES[i], mood: MOODS_DEMO[i] || null, memo: MEMOS_DEMO[i] || null }
})

// 목표 달성: 4/1~6/28(약 13주), level 0~4 (0=미기록 … 4=목표달성).
//   최근으로 갈수록 성실해지는 자연스러운 곡선(오른쪽이 진해짐), 미기록은 드물게.
const ADHERENCE = (() => {
  const out = []
  const base = new Date('2026-04-01T00:00:00')
  const DAYS = 88
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(base); d.setDate(d.getDate() + i)
    const progress = i / DAYS // 성실도 상승
    const seed = (i * 7 + 5) % 10
    let level = seed === 0 ? 0 : seed <= 2 ? 1 : seed <= 5 ? 2 : 3
    if (level > 0 && progress > 0.4) level = Math.min(4, level + 1)
    if (level > 0 && progress > 0.75) level = Math.min(4, level + 1)
    out.push({ date: d.toISOString().slice(0, 10), level })
  }
  return out
})()

// 장기 영양 추이 — 주별은 날짜 범위 라벨(목업과 동일)
const NUTRITION = {
  week: [
    { label: '5/4~5/10', kcal: 2280, carb: 240, protein: 88, fat: 82 },
    { label: '5/11~5/17', kcal: 2150, carb: 224, protein: 94, fat: 74 },
    { label: '5/18~5/24', kcal: 1820, carb: 190, protein: 102, fat: 60 },
    { label: '5/25~5/31', kcal: 1760, carb: 182, protein: 106, fat: 57 },
    { label: '6/1~6/7', kcal: 1650, carb: 168, protein: 110, fat: 52 },
    { label: '6/8~6/14', kcal: 1580, carb: 160, protein: 112, fat: 49 },
  ],
  month: [
    { label: '4월', kcal: 2260, carb: 236, protein: 86, fat: 80 },
    { label: '5월', kcal: 1900, carb: 198, protein: 100, fat: 64 },
    { label: '6월', kcal: 1640, carb: 166, protein: 111, fat: 51 },
  ],
}

export default function DietChangeDemo() {
  const [weight, setWeight] = useState(WEIGHT)
  const [goalWeight, setGoalWeight] = useState(66)
  const addEntry = (entry) => {
    const date = '2026-06-15'
    setWeight((prev) => {
      const rest = prev.filter((p) => p.date !== date)
      const lastP = prev[prev.length - 1]
      return [...rest, { date, weight: entry.weight ?? lastP?.weight, waist: entry.waist ?? lastP?.waist, mood: entry.mood, memo: entry.memo }]
    })
  }
  return (
    <div className="max-w-md mx-auto px-5 py-6" style={{ background: '#fdfbf7', minHeight: '100dvh' }}>
      <header className="mb-5">
        <h1 className="text-[26px] font-extrabold text-gray-900 tracking-tight">내 변화 · 식단</h1>
        <p className="text-[14px] text-gray-400 mt-0.5">식단 프로그램 안의 개인 변화 대시보드</p>
      </header>
      <DietChangeTab
        data={{ weight, adherence: ADHERENCE, nutrition: NUTRITION, goalWeight, goalKcal: 1800, startWeight: 72 }}
        onAddEntry={addEntry}
        onSetGoalWeight={setGoalWeight}
      />
    </div>
  )
}
