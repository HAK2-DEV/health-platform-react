import { useState } from 'react'
import ProgramCompletionCelebration from '../components/program/ProgramCompletionCelebration'

// 완주 축하 모달 UI 데모 — /completion-demo. 실제 종료 프로그램 없이 두 변형을 바로 확인.
//   변형: 완주(활동일 ≥ 기간 50% → 트로피 + 완주 배지) / 미달(끝까지 수고했어요 → 3인 응원 아이콘)
const PROGRAM = { name: '참가링크 test', start_date: '2026-06-01', end_date: '2026-06-29' }

// 완주 기준 = 29일의 50% = 15일. 아래 값으로 두 변형을 갈라 보여줌.
const CASES = {
  short: { label: '미달 — 끝까지 수고했어요', activeDays: 0, totalCount: 0, streak: 0, points: 0 },
  done: { label: '완주 — 축하해요', activeDays: 24, totalCount: 57, streak: 12, points: 640 },
}

function CompletionDemoPage() {
  const [key, setKey] = useState('short')
  // 기본 닫힘 — 열려 있으면 오버레이가 변형 전환 버튼을 가림
  const [open, setOpen] = useState(false)
  const c = CASES[key]

  const pick = (k) => { setKey(k); setOpen(true) }

  return (
    <div className="min-h-screen bg-gray-100 py-6">
      <div className="max-w-[430px] mx-auto px-4">
        <h1 className="text-lg font-bold text-gray-900 mb-1">완주 축하 모달 데모</h1>
        <p className="text-[13px] text-gray-500 mb-4">버튼을 누르면 해당 변형의 모달이 열려요.</p>
        <div className="flex flex-col gap-2">
          {Object.entries(CASES).map(([k, v]) => (
            <button key={k} type="button" onClick={() => pick(k)}
              className={`h-11 rounded-xl text-sm font-bold border transition ${
                key === k ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600'
              }`}>
              {v.label}
            </button>
          ))}
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)}
            className="mt-4 w-full h-11 rounded-xl bg-emerald-500 text-white text-sm font-bold">
            다시 열기
          </button>
        )}
      </div>

      <ProgramCompletionCelebration
        isOpen={open}
        onClose={() => setOpen(false)}
        program={PROGRAM}
        activeDays={c.activeDays}
        totalCount={c.totalCount}
        streak={c.streak}
        points={c.points}
      />
    </div>
  )
}

export default CompletionDemoPage
