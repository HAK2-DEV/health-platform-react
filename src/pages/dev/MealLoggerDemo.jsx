import { useState } from 'react'
import MealLogger from '../../components/meal/MealLogger'

// 🔧 식단 입력 UX 데모 — 목데이터로 흐름 검증. 라우트: /dev/meal
//   완료 시 저장 대신 결과(JSON)만 화면에 표시. UI 폴리시·미션 연동은 이후 단계.
export default function MealLoggerDemo() {
  const [result, setResult] = useState(null)

  return (
    <div className="max-w-md mx-auto px-4 py-5 h-[100dvh] flex flex-col">
      <h1 className="text-lg font-extrabold text-gray-900 flex-shrink-0">🍚 식단 입력 (UX 데모)</h1>
      <p className="text-[12px] text-gray-400 mb-3 flex-shrink-0">목데이터 · 흐름 검증용. 실제 API/미션 연동은 이후.</p>

      <div className="flex-1 min-h-0">
        <MealLogger onComplete={setResult} />
      </div>

      {result && (
        <div className="flex-shrink-0 mt-3 rounded-xl bg-gray-900 text-emerald-200 p-3 font-mono text-[11px] leading-relaxed max-h-[30vh] overflow-y-auto">
          <p className="text-gray-400 mb-1">인증 payload (저장 예정 데이터)</p>
          <pre className="whitespace-pre-wrap break-all">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
