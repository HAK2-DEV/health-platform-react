import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Plus, X, Minus } from 'lucide-react'
import { searchFoods, scaleNutrients } from '../../lib/foodDb'

// 식단 입력 로거 — 검색 → 담기 → 수량조절 → 실시간 합계(칼로리+탄단지) → 완료.
//   UX 검증용(러프 UI). 데이터 소스는 lib/foodDb(현재 목, 나중에 실제 API로 스왑).
//   onComplete({ entries, totals }) — 나중에 미션 인증 저장에 연결.
function MealLogger({ onComplete }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [entries, setEntries] = useState([])   // [{ key, food, qty }]
  const seq = useRef(0)

  // 디바운스 검색 (300ms)
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try { setResults(await searchFoods(q)) } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const addFood = (food) => {
    setEntries((prev) => {
      // 같은 음식 이미 담겼으면 수량 +1
      const idx = prev.findIndex((e) => e.food.id === food.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: +(next[idx].qty + 1).toFixed(1) }
        return next
      }
      return [...prev, { key: ++seq.current, food, qty: 1 }]
    })
    setQuery('')   // 담고 검색어 비움 → 다음 음식 바로 검색
    setResults([])
  }
  const changeQty = (key, delta) => setEntries((prev) =>
    prev.map((e) => e.key === key ? { ...e, qty: Math.max(0.5, +(e.qty + delta).toFixed(1)) } : e))
  const removeEntry = (key) => setEntries((prev) => prev.filter((e) => e.key !== key))

  const totals = useMemo(() => entries.reduce((t, e) => {
    const n = scaleNutrients(e.food, e.qty)
    return { kcal: t.kcal + n.kcal, carb: t.carb + n.carb, protein: t.protein + n.protein, fat: t.fat + n.fat }
  }, { kcal: 0, carb: 0, protein: 0, fat: 0 }), [entries])

  return (
    <div className="flex flex-col h-full">
      {/* 검색 */}
      <div className="relative flex-shrink-0">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="먹은 음식 검색 (예: 김치찌개, 공기밥)"
          className="w-full h-11 pl-9 pr-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* 검색 결과 (검색어 있을 때만) */}
      {query.trim() && (
        <div className="mt-2 rounded-xl border border-gray-100 bg-white shadow-soft divide-y divide-gray-50 overflow-hidden flex-shrink-0 max-h-[40vh] overflow-y-auto">
          {searching ? (
            <p className="px-3 py-3 text-[12px] text-gray-400">검색 중…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-gray-400">검색 결과가 없어요. 다른 이름으로 찾아보세요.</p>
          ) : results.map((f) => (
            <button key={f.id} type="button" onClick={() => addFood(f)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-emerald-50/60 transition">
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-bold text-gray-800 truncate">{f.name}</span>
                <span className="block text-[11px] text-gray-400">{f.serving} · {f.kcal}kcal</span>
              </span>
              <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
                <Plus className="w-4 h-4" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 오늘의 식단 (담은 목록) */}
      <div className="mt-3 flex-1 min-h-0 overflow-y-auto">
        <p className="text-[12px] font-bold text-gray-500 mb-1.5 px-0.5">오늘의 식단 ({entries.length})</p>
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-3 py-8 text-center">
            <p className="text-[13px] text-gray-400">위에서 먹은 음식을 검색해 담아보세요 🍚</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => {
              const n = scaleNutrients(e.food, e.qty)
              return (
                <div key={e.key} className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white shadow-soft px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-800 truncate">{e.food.name}</p>
                    <p className="text-[11px] text-gray-400">{n.kcal}kcal · 탄{n.carb} 단{n.protein} 지{n.fat}</p>
                  </div>
                  {/* 수량 조절 (0.5 단위) */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button type="button" onClick={() => changeQty(e.key, -0.5)}
                      className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="text-[12px] font-bold text-gray-700 w-8 text-center tabular-nums">×{e.qty}</span>
                    <button type="button" onClick={() => changeQty(e.key, +0.5)}
                      className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                  <button type="button" onClick={() => removeEntry(e.key)}
                    className="w-6 h-6 rounded-md text-gray-300 hover:text-red-500 flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 하단 고정 — 합계 + 완료 */}
      <div className="flex-shrink-0 pt-3 mt-1 border-t border-gray-100">
        <div className="flex items-end justify-between mb-2.5">
          <div>
            <p className="text-[11px] font-semibold text-gray-400">오늘 합계</p>
            <p className="text-[26px] font-extrabold text-gray-900 leading-none mt-0.5 tabular-nums">
              {totals.kcal}<span className="text-[15px] text-gray-400 font-bold ml-0.5">kcal</span>
            </p>
          </div>
          <div className="flex gap-3 text-center pb-0.5">
            {[['탄수', totals.carb], ['단백', totals.protein], ['지방', totals.fat]].map(([l, v]) => (
              <div key={l}>
                <p className="text-[10px] text-gray-400">{l}</p>
                <p className="text-[14px] font-extrabold text-emerald-600 tabular-nums">{v}<span className="text-[10px] text-gray-400 font-medium">g</span></p>
              </div>
            ))}
          </div>
        </div>
        <button type="button" disabled={entries.length === 0}
          onClick={() => onComplete?.({ entries: entries.map((e) => ({ ...e.food, qty: e.qty, ...scaleNutrients(e.food, e.qty) })), totals })}
          className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[15px] font-bold transition disabled:bg-gray-300">
          이 식단으로 인증하기
        </button>
      </div>
    </div>
  )
}

export default MealLogger
