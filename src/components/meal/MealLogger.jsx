import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Plus, X, Minus } from 'lucide-react'
import { searchFoods, scaleNutrients, recordPick } from '../../lib/foodDb'

// 식단 입력 로거 — 끼니 선택 → 검색 → 담기 → 수량조절 → 끼니별 그룹 + 실시간 합계(칼로리+탄단지).
//   UX 검증용(러프 UI). 데이터 소스는 lib/foodDb(현재 목, 나중에 실제 API로 스왑).
//   onComplete({ entries, totals, byMeal }) — 나중에 미션 인증 저장에 연결.

const MEALS = [
  { key: 'breakfast', label: '아침', emoji: '🌅' },
  { key: 'lunch',     label: '점심', emoji: '☀️' },
  { key: 'dinner',    label: '저녁', emoji: '🌙' },
  { key: 'snack',     label: '간식', emoji: '🍪' },
]
// 영양소 색 구분 — 탄(앰버)·단(스카이)·지(로즈)
const NUTRIENTS = [
  { key: 'carb',    label: '탄수', text: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-400' },
  { key: 'protein', label: '단백', text: 'text-sky-600',   bg: 'bg-sky-50',   dot: 'bg-sky-400' },
  { key: 'fat',     label: '지방', text: 'text-rose-500',  bg: 'bg-rose-50',  dot: 'bg-rose-400' },
]

function MealLogger({ onComplete }) {
  const [meal, setMeal] = useState('breakfast')   // 담을 대상 끼니
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [entries, setEntries] = useState([])   // [{ key, meal, food, qty }]
  const [customKcal, setCustomKcal] = useState('')   // 직접입력 칼로리
  const seq = useRef(0)

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
      // 같은 끼니에 같은 음식이면 수량 +1
      const idx = prev.findIndex((e) => e.food.id === food.id && e.meal === meal)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: +(next[idx].qty + 1).toFixed(1) }
        return next
      }
      return [...prev, { key: ++seq.current, meal, food, qty: 1 }]
    })
    recordPick(food.id)   // 인기순(pick_count) 집계
    setQuery('')
    setResults([])
  }
  // 검색결과 없을 때 — 직접 입력(이름=검색어 + 칼로리)
  const addCustom = () => {
    const kc = parseInt(customKcal, 10)
    const nm = query.trim()
    if (!nm || !(kc >= 1)) return
    const n = ++seq.current
    const food = { id: `custom-${n}`, name: nm, maker: '직접입력', serving: '1인분', kcal: kc, carb: 0, protein: 0, fat: 0 }
    setEntries((prev) => [...prev, { key: n, meal, food, qty: 1 }])
    setQuery(''); setResults([]); setCustomKcal('')
  }
  const changeQty = (key, delta) => setEntries((prev) =>
    prev.map((e) => e.key === key ? { ...e, qty: Math.max(0.5, +(e.qty + delta).toFixed(1)) } : e))
  const removeEntry = (key) => setEntries((prev) => prev.filter((e) => e.key !== key))

  const totals = useMemo(() => entries.reduce((t, e) => {
    const n = scaleNutrients(e.food, e.qty)
    return { kcal: t.kcal + n.kcal, carb: t.carb + n.carb, protein: t.protein + n.protein, fat: t.fat + n.fat }
  }, { kcal: 0, carb: 0, protein: 0, fat: 0 }), [entries])

  const mealKcal = (mealKey) => entries.filter((e) => e.meal === mealKey)
    .reduce((s, e) => s + scaleNutrients(e.food, e.qty).kcal, 0)

  return (
    <div className="flex flex-col h-full">
      {/* 끼니 선택 — 담을 대상 */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-1.5 mb-2">
        {MEALS.map((m) => {
          const on = meal === m.key
          const kc = mealKcal(m.key)
          return (
            <button key={m.key} type="button" onClick={() => setMeal(m.key)}
              className={`rounded-xl py-2 flex flex-col items-center gap-0.5 border-2 transition ${on ? 'border-emerald-500 bg-emerald-50' : 'border-transparent bg-gray-100'}`}>
              <span className="text-[16px] leading-none">{m.emoji}</span>
              <span className={`text-[12px] font-bold ${on ? 'text-emerald-700' : 'text-gray-500'}`}>{m.label}</span>
              <span className={`text-[10px] tabular-nums ${kc > 0 ? 'text-gray-400' : 'text-transparent'}`}>{kc}kcal</span>
            </button>
          )
        })}
      </div>

      {/* 검색 */}
      <div className="relative flex-shrink-0">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${MEALS.find((m) => m.key === meal)?.label}에 담을 음식 검색`}
          className="w-full h-11 pl-9 pr-3 rounded-xl border-2 border-gray-200 bg-white text-sm focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* 검색 결과 */}
      {query.trim() && (
        <div className="mt-2 rounded-xl border border-gray-100 bg-white shadow-soft divide-y divide-gray-50 overflow-hidden flex-shrink-0 max-h-[36vh] overflow-y-auto">
          {searching ? (
            <p className="px-3 py-3 text-[12px] text-gray-400">검색 중…</p>
          ) : results.length === 0 ? (
            <div className="px-3 py-3">
              <p className="text-[12px] text-gray-400 mb-2">'{query}' 검색 결과가 없어요. 직접 추가할 수 있어요.</p>
              <div className="flex items-center gap-2">
                <span className="flex-1 min-w-0 text-[13px] font-bold text-gray-700 truncate">{query}</span>
                <input type="number" inputMode="numeric" min={1} value={customKcal}
                  onChange={(e) => setCustomKcal(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }}
                  placeholder="kcal"
                  className="w-[72px] h-9 px-2 text-sm text-center border-2 border-gray-200 rounded-lg focus:outline-none focus:border-emerald-500" />
                <button type="button" onClick={addCustom} disabled={!(parseInt(customKcal, 10) >= 1)}
                  className="h-9 px-3 rounded-lg bg-emerald-500 text-white text-[13px] font-bold whitespace-nowrap disabled:bg-gray-300">담기</button>
              </div>
            </div>
          ) : results.map((f) => (
            <button key={f.id} type="button" onClick={() => addFood(f)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-emerald-50/60 transition">
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-bold text-gray-800 truncate">
                  {f.name}{f.maker ? <span className="font-medium text-gray-400"> · {f.maker}</span> : null}
                </span>
                <span className="block text-[11px] text-gray-400">{f.serving} · {f.kcal}kcal</span>
              </span>
              <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center flex-shrink-0"><Plus className="w-4 h-4" /></span>
            </button>
          ))}
        </div>
      )}

      {/* 오늘의 식단 — 끼니별 그룹 */}
      <div className="mt-3 flex-1 min-h-0 overflow-y-auto">
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-3 py-8 text-center">
            <p className="text-[13px] text-gray-400">끼니를 고르고, 먹은 음식을 검색해 담아보세요 🍚</p>
          </div>
        ) : MEALS.map((m) => {
          const list = entries.filter((e) => e.meal === m.key)
          if (list.length === 0) return null
          return (
            <div key={m.key} className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                <span className="text-[13px]">{m.emoji}</span>
                <span className="text-[12px] font-bold text-gray-600">{m.label}</span>
                <span className="text-[11px] text-gray-400 tabular-nums">{mealKcal(m.key)}kcal</span>
              </div>
              <div className="space-y-2">
                {list.map((e) => {
                  const n = scaleNutrients(e.food, e.qty)
                  return (
                    <div key={e.key} className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white shadow-soft px-3 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-800 truncate">
                          {e.food.name}{e.food.maker ? <span className="font-medium text-gray-400"> · {e.food.maker}</span> : null}
                        </p>
                        <p className="text-[11px] mt-0.5 flex items-center gap-2">
                          <span className="font-bold text-gray-700 tabular-nums">{n.kcal}kcal</span>
                          {NUTRIENTS.map((nu) => (
                            <span key={nu.key} className={`inline-flex items-center gap-0.5 ${nu.text} font-semibold tabular-nums`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${nu.dot}`} />{n[nu.key]}
                            </span>
                          ))}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button type="button" onClick={() => changeQty(e.key, -0.5)} className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                        <span className="text-[12px] font-bold text-gray-700 w-8 text-center tabular-nums">×{e.qty}</span>
                        <button type="button" onClick={() => changeQty(e.key, +0.5)} className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                      </div>
                      <button type="button" onClick={() => removeEntry(e.key)} className="w-6 h-6 rounded-md text-gray-300 hover:text-red-500 flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 하단 고정 — 합계(색 구분) + 완료 */}
      <div className="flex-shrink-0 pt-3 mt-1 border-t border-gray-100">
        <div className="flex items-center justify-between mb-2.5 gap-3">
          <div className="flex-shrink-0">
            <p className="text-[11px] font-semibold text-gray-400">오늘 합계</p>
            <p className="text-[26px] font-extrabold text-gray-900 leading-none mt-0.5 tabular-nums">
              {totals.kcal}<span className="text-[15px] text-gray-400 font-bold ml-0.5">kcal</span>
            </p>
          </div>
          <div className="flex gap-2 flex-1 justify-end">
            {NUTRIENTS.map((nu) => (
              <div key={nu.key} className={`flex-1 max-w-[76px] rounded-xl ${nu.bg} px-2 py-1.5 text-center`}>
                <p className={`text-[10px] font-bold ${nu.text} flex items-center justify-center gap-1`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${nu.dot}`} />{nu.label}
                </p>
                <p className={`text-[15px] font-extrabold ${nu.text} tabular-nums leading-tight`}>{totals[nu.key]}<span className="text-[10px] font-medium text-gray-400">g</span></p>
              </div>
            ))}
          </div>
        </div>
        <button type="button" disabled={entries.length === 0}
          onClick={() => onComplete?.({
            entries: entries.map((e) => ({ meal: e.meal, ...e.food, qty: e.qty, ...scaleNutrients(e.food, e.qty) })),
            totals,
            byMeal: MEALS.map((m) => ({ meal: m.key, kcal: mealKcal(m.key) })).filter((x) => x.kcal > 0),
          })}
          className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[15px] font-bold transition disabled:bg-gray-300">
          이 식단으로 인증하기
        </button>
      </div>
    </div>
  )
}

export default MealLogger
