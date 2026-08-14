import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Plus, X, Minus } from 'lucide-react'
import { searchFoods, computeNutrients, foodBasis, defaultAmount, recordPick } from '../../lib/foodDb'

// 식단 입력 로거 — 끼니 선택 → 검색 → 담기 → 수량조절 → 끼니별 그룹 + 실시간 합계(칼로리+탄단지).
//   UX 검증용(러프 UI). 데이터 소스는 lib/foodDb(현재 목, 나중에 실제 API로 스왑).
//   onComplete({ entries, totals, byMeal }) — 나중에 미션 인증 저장에 연결.

const MEALS = [
  { key: 'breakfast', label: '아침', emoji: '🌅' },
  { key: 'lunch',     label: '점심', emoji: '☀️' },
  { key: 'dinner',    label: '저녁', emoji: '🌙' },
  { key: 'snack',     label: '간식', emoji: '🍪' },
]
// 영양소 색 구분 — 탄(앰버)·단(스카이)·지(로즈). 얇은 점+숫자로만 절제 사용.
const NUTRIENTS = [
  { key: 'carb',    label: '탄수', text: 'text-amber-600', dot: 'bg-amber-400', bar: 'bg-amber-400' },
  { key: 'protein', label: '단백', text: 'text-sky-600',   dot: 'bg-sky-400',   bar: 'bg-sky-400' },
  { key: 'fat',     label: '지방', text: 'text-rose-500',  dot: 'bg-rose-400',  bar: 'bg-rose-400' },
]

function MealLogger({ onComplete }) {
  const [meal, setMeal] = useState('breakfast')   // 담을 대상 끼니
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [entries, setEntries] = useState([])   // [{ key, meal, food, amount }] amount=그램(per100) 또는 배수(unit)
  const [customKcal, setCustomKcal] = useState('')   // 직접입력 칼로리
  const [open, setOpen] = useState(false)   // 검색 결과 열림 여부
  const seq = useRef(0)
  const searchRef = useRef(null)
  const boxRef = useRef(null)   // 검색 영역(입력+결과) — 바깥 탭 감지용

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try { setResults(await searchFoods(q)) } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  // 검색 영역 바깥을 누르면 결과 닫기 (결과 내부 스크롤은 영향 없음)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const addFood = (food) => {
    const step = defaultAmount(food)   // gram=100(g/ml), unit=1(배수)
    setEntries((prev) => {
      // 같은 끼니에 같은 음식이면 한 번 더 담기(그램=+100, 배수=+1)
      const idx = prev.findIndex((e) => e.food.id === food.id && e.meal === meal)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], amount: +(next[idx].amount + step).toFixed(1) }
        return next
      }
      return [...prev, { key: ++seq.current, meal, food, amount: step }]
    })
    recordPick(food.id)   // 인기순(pick_count) 집계
    setQuery('')
    setResults([])
    setOpen(false)
  }
  // 검색결과 없을 때 — 직접 입력(이름=검색어 + 칼로리). 1회분 기준(배수 조절).
  const addCustom = () => {
    const kc = parseInt(customKcal, 10)
    const nm = query.trim()
    if (!nm || !(kc >= 1)) return
    const n = ++seq.current
    const food = { id: `custom-${n}`, name: nm, maker: '직접입력', serving: '1인분', kcal: kc, carb: 0, protein: 0, fat: 0 }
    setEntries((prev) => [...prev, { key: n, meal, food, amount: 1 }])
    setQuery(''); setResults([]); setCustomKcal(''); setOpen(false)
  }
  // 양 조절 — gram 기준은 그램 단위(최소 5), unit 기준은 배수(최소 0.5)
  const stepAmount = (key, dir) => setEntries((prev) => prev.map((e) => {
    if (e.key !== key) return e
    const g = foodBasis(e.food).mode === 'gram'
    const delta = g ? dir * 10 : dir * 0.5
    const min = g ? 5 : 0.5
    return { ...e, amount: Math.max(min, +(e.amount + delta).toFixed(1)) }
  }))
  // 그램 직접 입력
  const setGrams = (key, val) => setEntries((prev) => prev.map((e) => {
    if (e.key !== key) return e
    const g = Math.max(0, Math.round(Number(val) || 0))
    return { ...e, amount: g }
  }))
  const removeEntry = (key) => setEntries((prev) => prev.filter((e) => e.key !== key))
  // 끼니 카드의 "추가" → 그 끼니를 담을 대상으로 잡고 검색창 포커스
  const addToMeal = (mealKey) => { setMeal(mealKey); setOpen(true); setTimeout(() => searchRef.current?.focus(), 0) }

  const totals = useMemo(() => entries.reduce((t, e) => {
    const n = computeNutrients(e.food, e.amount)
    return { kcal: t.kcal + n.kcal, carb: t.carb + n.carb, protein: t.protein + n.protein, fat: t.fat + n.fat }
  }, { kcal: 0, carb: 0, protein: 0, fat: 0 }), [entries])

  const mealKcal = (mealKey) => entries.filter((e) => e.meal === mealKey)
    .reduce((s, e) => s + computeNutrients(e.food, e.amount).kcal, 0)

  const macroTotal = totals.carb + totals.protein + totals.fat   // 탄단지 비율 바 분모

  return (
    <div className="flex flex-col h-full">
      {/* ── 검색 (최상단, 결과는 아래로 떠서 리스트를 밀지 않음) ── */}
      <div ref={boxRef} className="flex-shrink-0 relative z-20">
        <div className="relative">
          <Search className="w-[18px] h-[18px] text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder={`${MEALS.find((m) => m.key === meal)?.label}에 담을 음식 검색`}
            className="w-full h-12 pl-10 pr-9 rounded-2xl bg-gray-50 border border-transparent text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-emerald-400 transition"
          />
          {query && (
            <button type="button" aria-label="지우기" onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center"><X className="w-3 h-3" /></button>
          )}
        </div>

        {open && query.trim() && (
          <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-white border border-gray-100 shadow-elevated divide-y divide-gray-50 overflow-hidden max-h-[46vh] overflow-y-auto overscroll-contain">
            {searching ? (
              <p className="px-4 py-3.5 text-[12px] text-gray-400">검색 중…</p>
            ) : results.length === 0 ? (
              <div className="px-4 py-3.5">
                <p className="text-[12px] text-gray-400 mb-2.5">'{query}' 검색 결과가 없어요. 직접 추가할 수 있어요.</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-[13px] font-semibold text-gray-800 truncate">{query}</span>
                  <input type="number" inputMode="numeric" min={1} value={customKcal}
                    onChange={(e) => setCustomKcal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }}
                    placeholder="kcal"
                    className="w-[68px] h-9 px-2 text-[13px] text-center bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400 focus:bg-white transition" />
                  <button type="button" onClick={addCustom} disabled={!(parseInt(customKcal, 10) >= 1)}
                    className="h-9 px-3.5 rounded-xl bg-emerald-500 text-white text-[13px] font-semibold whitespace-nowrap transition disabled:bg-gray-200 disabled:text-gray-400">담기</button>
                </div>
              </div>
            ) : results.map((f) => (
              <button key={f.id} type="button" onClick={() => addFood(f)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition">
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-semibold text-gray-900 truncate">
                    {f.name}{f.maker ? <span className="font-normal text-gray-400"> · {f.maker}</span> : null}
                  </span>
                  <span className="block text-[11px] text-gray-400 mt-0.5">
                    {foodBasis(f).mode === 'gram' ? `${f.serving || '100g'}당 ${f.kcal}kcal` : `${f.serving} · ${f.kcal}kcal`}
                  </span>
                </span>
                <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0"><Plus className="w-4 h-4" /></span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 끼니별 식단 카드 (항상 4끼니 표시, 각 카드에서 바로 추가) ── */}
      <div className="mt-3 flex-1 min-h-0 overflow-y-auto space-y-2.5 pb-1">
        {MEALS.map((m) => {
          const list = entries.filter((e) => e.meal === m.key)
          const kc = mealKcal(m.key)
          const active = meal === m.key
          return (
            <section key={m.key} className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
              {/* 카드 헤더 */}
              <div className="flex items-center gap-2 px-4 pt-3 pb-2.5">
                <span className="text-[15px] leading-none">{m.emoji}</span>
                <span className="text-[13px] font-bold text-gray-800">{m.label}</span>
                {kc > 0 && <span className="text-[12px] font-semibold text-gray-400 tabular-nums ml-auto">{kc}kcal</span>}
              </div>

              {/* 음식 항목들 */}
              {list.length > 0 && (
                <div className="divide-y divide-gray-50 border-t border-gray-50">
                  {list.map((e) => {
                    const n = computeNutrients(e.food, e.amount)
                    const basis = foodBasis(e.food)
                    const isGram = basis.mode === 'gram'
                    return (
                      <div key={e.key} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-gray-900 truncate">
                            {e.food.name}{e.food.maker ? <span className="font-normal text-gray-400"> · {e.food.maker}</span> : null}
                          </p>
                          <p className="text-[11px] mt-1 flex items-center gap-2.5">
                            <span className="font-bold text-gray-900 tabular-nums">{n.kcal}<span className="text-gray-400 font-medium">kcal</span></span>
                            {NUTRIENTS.map((nu) => (
                              <span key={nu.key} className={`inline-flex items-center gap-1 ${nu.text} font-semibold tabular-nums`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${nu.dot}`} />{n[nu.key]}
                              </span>
                            ))}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button type="button" aria-label="줄이기" onClick={() => stepAmount(e.key, -1)} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center transition active:bg-gray-200"><Minus className="w-3.5 h-3.5" /></button>
                          {isGram ? (
                            <span className="inline-flex items-center border border-gray-200 rounded-lg h-7 focus-within:border-emerald-400 transition">
                              <input type="number" inputMode="numeric" min={0} value={e.amount}
                                onChange={(ev) => setGrams(e.key, ev.target.value)}
                                onFocus={(ev) => ev.target.select()}
                                className="w-10 h-full text-[13px] font-semibold text-gray-800 text-right bg-transparent focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              <span className="text-[10px] text-gray-400 font-semibold pr-1.5 pl-0.5">{basis.unit}</span>
                            </span>
                          ) : (
                            <span className="text-[13px] font-semibold text-gray-800 w-9 text-center tabular-nums">×{e.amount}</span>
                          )}
                          <button type="button" aria-label="늘리기" onClick={() => stepAmount(e.key, +1)} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center transition active:bg-gray-200"><Plus className="w-3.5 h-3.5" /></button>
                          <button type="button" aria-label="삭제" onClick={() => removeEntry(e.key)} className="w-6 h-6 rounded-full text-gray-300 hover:text-rose-400 flex items-center justify-center flex-shrink-0 transition"><X className="w-4 h-4" /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* 추가 버튼 — 이 끼니를 담을 대상으로 */}
              <button type="button" onClick={() => addToMeal(m.key)}
                className={`w-full flex items-center justify-center gap-1.5 py-2.5 text-[12.5px] font-semibold border-t border-gray-50 transition ${active ? 'text-emerald-600 bg-emerald-50/50' : 'text-gray-400 hover:text-emerald-600 hover:bg-gray-50/60'}`}>
                <Plus className="w-4 h-4" />음식 추가
              </button>
            </section>
          )
        })}
      </div>

      {/* 하단 고정 — 합계 + 탄단지 비율 바 + 완료 */}
      <div className="flex-shrink-0 pt-4 mt-1 border-t border-gray-100">
        <div className="flex items-end justify-between gap-3 mb-2.5">
          <div className="flex-shrink-0">
            <p className="text-[11px] font-medium text-gray-400">오늘 합계</p>
            <p className="text-[30px] font-extrabold text-gray-900 leading-none mt-1 tabular-nums">
              {totals.kcal.toLocaleString()}<span className="text-[15px] text-gray-400 font-bold ml-1">kcal</span>
            </p>
          </div>
          <div className="flex items-start gap-3.5 pb-1">
            {NUTRIENTS.map((nu) => (
              <div key={nu.key} className="text-right">
                <p className="text-[10px] font-medium text-gray-400 flex items-center gap-1 justify-end leading-none">
                  <span className={`w-1.5 h-1.5 rounded-full ${nu.dot}`} />{nu.label}
                </p>
                <p className={`text-[15px] font-bold ${nu.text} tabular-nums leading-none mt-1`}>{totals[nu.key]}<span className="text-[10px] font-medium text-gray-400">g</span></p>
              </div>
            ))}
          </div>
        </div>
        {/* 탄단지 비율 바 */}
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden flex mb-3.5">
          {macroTotal > 0 && NUTRIENTS.map((nu) => (
            <span key={nu.key} className={`${nu.bar} h-full`} style={{ width: `${(totals[nu.key] / macroTotal) * 100}%` }} />
          ))}
        </div>
        <button type="button" disabled={entries.length === 0}
          onClick={() => onComplete?.({
            entries: entries.map((e) => ({
              meal: e.meal, ...e.food, amount: e.amount,
              amountLabel: foodBasis(e.food).mode === 'gram' ? `${e.amount}${foodBasis(e.food).unit}` : `×${e.amount}`,
              ...computeNutrients(e.food, e.amount),
            })),
            totals,
            byMeal: MEALS.map((m) => ({ meal: m.key, kcal: mealKcal(m.key) })).filter((x) => x.kcal > 0),
          })}
          className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-[15px] font-bold transition disabled:bg-gray-200 disabled:text-gray-400">
          이 식단으로 인증하기
        </button>
      </div>
    </div>
  )
}

export default MealLogger
