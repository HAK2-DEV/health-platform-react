import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Plus, Minus, X, Camera, Loader2 } from 'lucide-react'
import { searchFoods, computeNutrients, foodBasis, defaultAmount, recordPick, recognizeFoodPhoto } from '../../lib/foodDb'

// 식단 미션 인증 — 한 끼니(아침/점심/저녁/간식) 기록.
//   두 방법: 🔍 검색(32만 DB) · 📷 AI 사진(food-vision → 프리필). 그램 확정 → 영양치와 함께 제출.
//   onSubmit({ items, totals, source, photoFile }) — MissionVerifyPage 가 verifications 에 저장.

const MEAL_LABEL = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' }
const MEAL_EMOJI = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍪' }
const NUTRIENTS = [
  { key: 'carb', label: '탄수', text: 'text-amber-600', dot: 'bg-amber-400', bar: 'bg-amber-400' },
  { key: 'protein', label: '단백', text: 'text-sky-600', dot: 'bg-sky-400', bar: 'bg-sky-400' },
  { key: 'fat', label: '지방', text: 'text-rose-500', dot: 'bg-rose-400', bar: 'bg-rose-400' },
]

// 파일 → 리사이즈·압축 base64 dataURL (AI 전송량 절약)
function fileToDataUrl(file, maxDim = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      c.getContext('2d').drawImage(img, 0, 0, w, h)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

export default function MealVerify({ mealType = 'breakfast', onSubmit, submitting = false, onCancel }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState([])   // [{ key, food, amount }]
  const [customKcal, setCustomKcal] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoError, setPhotoError] = useState(null)
  const [source, setSource] = useState('search')   // 'search' | 'photo'
  const photoFileRef = useRef(null)
  const seq = useRef(0)
  const boxRef = useRef(null)

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); setSearching(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try { setResults(await searchFoods(q)) } finally { setSearching(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const addEntry = (food, amount) => setEntries((prev) => {
    const idx = prev.findIndex((e) => e.food.id === food.id)
    if (idx >= 0) {
      const next = [...prev]
      next[idx] = { ...next[idx], amount: +(next[idx].amount + amount).toFixed(1) }
      return next
    }
    return [...prev, { key: ++seq.current, food, amount }]
  })

  const addFood = (food) => {
    addEntry(food, defaultAmount(food))
    recordPick(food.id)
    setQuery(''); setResults([]); setOpen(false)
  }
  const addCustom = () => {
    const kc = parseInt(customKcal, 10)
    const nm = query.trim()
    if (!nm || !(kc >= 1)) return
    const n = ++seq.current
    setEntries((prev) => [...prev, { key: n, food: { id: `custom-${n}`, name: nm, maker: '직접입력', serving: '1인분', kcal: kc, carb: 0, protein: 0, fat: 0 }, amount: 1 }])
    setQuery(''); setResults([]); setCustomKcal(''); setOpen(false)
  }
  const stepAmount = (key, dir) => setEntries((prev) => prev.map((e) => {
    if (e.key !== key) return e
    const g = foodBasis(e.food).mode === 'gram'
    return { ...e, amount: Math.max(g ? 5 : 0.5, +(e.amount + (g ? dir * 10 : dir * 0.5)).toFixed(1)) }
  }))
  const setGrams = (key, val) => setEntries((prev) => prev.map((e) =>
    e.key === key ? { ...e, amount: Math.max(0, Math.round(Number(val) || 0)) } : e))
  const removeEntry = (key) => setEntries((prev) => prev.filter((e) => e.key !== key))

  // AI 사진 → 인식 → DB 매칭해 담기
  const onPhoto = async (ev) => {
    const file = ev.target.files?.[0]
    if (!file) return
    photoFileRef.current = file
    setPhotoError(null); setPhotoBusy(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      setPhotoPreview(dataUrl)
      const foods = await recognizeFoodPhoto(dataUrl)
      if (!foods.length) { setPhotoError('음식을 인식하지 못했어요. 검색으로 담아주세요.'); return }
      // 새 사진 = 목록 교체(누적 X). 같은 음식은 합침.
      const byId = new Map()
      for (const f of foods) {
        let db = null
        try { const r = await searchFoods(f.name); db = r?.[0] || null } catch { /* 무시 */ }
        let food, amount
        if (db) { const b = foodBasis(db); food = db; amount = b.mode === 'gram' ? (f.grams || b.base) : 1 }
        else { const n = ++seq.current; food = { id: `ai-${n}`, name: f.name, maker: 'AI 추정', serving: '1인분', kcal: f.kcal || 0, carb: 0, protein: 0, fat: 0 }; amount = 1 }
        if (byId.has(food.id)) byId.get(food.id).amount += amount
        else byId.set(food.id, { key: ++seq.current, food, amount })
      }
      setEntries([...byId.values()])
      setSource('photo')
    } catch (e) {
      setPhotoError(String(e?.message || e))
    } finally {
      setPhotoBusy(false)
      ev.target.value = ''
    }
  }

  const clearPhoto = () => { setPhotoPreview(null); photoFileRef.current = null; setPhotoError(null); setSource('search') }

  const totals = useMemo(() => entries.reduce((t, e) => {
    const n = computeNutrients(e.food, e.amount)
    return { kcal: t.kcal + n.kcal, carb: t.carb + n.carb, protein: t.protein + n.protein, fat: t.fat + n.fat }
  }, { kcal: 0, carb: 0, protein: 0, fat: 0 }), [entries])
  const macroTotal = totals.carb + totals.protein + totals.fat

  const submit = () => {
    if (entries.length === 0 || submitting) return
    const items = entries.map((e) => ({
      name: e.food.name, maker: e.food.maker || null, amount: e.amount,
      unit: foodBasis(e.food).mode === 'gram' ? foodBasis(e.food).unit : '인분',
      ...computeNutrients(e.food, e.amount),
    }))
    onSubmit?.({ items, totals, source, photoFile: photoFileRef.current })
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 — 끼니 */}
      <div className="flex-shrink-0 flex items-center gap-2 mb-2">
        <span className="text-[18px]">{MEAL_EMOJI[mealType] || '🍽️'}</span>
        <h2 className="text-[16px] font-extrabold text-gray-900">{MEAL_LABEL[mealType] || '식단'} 기록</h2>
        <span className="text-[11px] text-gray-400 ml-auto">검색 또는 사진으로 담아요</span>
      </div>

      {/* AI 사진 */}
      <label className="flex-shrink-0 flex items-center justify-center gap-2 h-11 rounded-2xl bg-emerald-500 text-white text-[14px] font-bold cursor-pointer active:bg-emerald-600 transition mb-2">
        {photoBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
        {photoBusy ? 'AI가 분석 중…' : '📷 사진으로 자동 담기 (AI)'}
        <input type="file" accept="image/*" capture="environment" onChange={onPhoto} disabled={photoBusy || submitting} className="hidden" />
      </label>
      {photoError && <p className="flex-shrink-0 text-[11px] text-rose-500 mb-2">{photoError}</p>}

      {/* 검색 */}
      <div ref={boxRef} className="flex-shrink-0 relative z-20">
        <div className="relative">
          <Search className="w-[18px] h-[18px] text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
            placeholder="먹은 음식 검색 (예: 우유, 닭가슴살)"
            className="w-full h-11 pl-10 pr-9 rounded-2xl bg-gray-50 border border-transparent text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-emerald-400 transition" />
          {query && (
            <button type="button" aria-label="지우기" onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center"><X className="w-3 h-3" /></button>
          )}
        </div>
        {open && query.trim() && (
          <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-white border border-gray-100 shadow-elevated divide-y divide-gray-50 overflow-hidden max-h-[42vh] overflow-y-auto overscroll-contain">
            {searching ? (
              <p className="px-4 py-3.5 text-[12px] text-gray-400">검색 중…</p>
            ) : results.length === 0 ? (
              <div className="px-4 py-3.5">
                <p className="text-[12px] text-gray-400 mb-2.5">'{query}' 검색 결과가 없어요. 직접 추가할 수 있어요.</p>
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0 text-[13px] font-semibold text-gray-800 truncate">{query}</span>
                  <input type="number" inputMode="numeric" min={1} value={customKcal} onChange={(e) => setCustomKcal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }} placeholder="kcal"
                    className="w-[68px] h-9 px-2 text-[13px] text-center bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-400" />
                  <button type="button" onClick={addCustom} disabled={!(parseInt(customKcal, 10) >= 1)}
                    className="h-9 px-3.5 rounded-xl bg-emerald-500 text-white text-[13px] font-semibold whitespace-nowrap disabled:bg-gray-200 disabled:text-gray-400">담기</button>
                </div>
              </div>
            ) : results.map((f) => (
              <button key={f.id} type="button" onClick={() => addFood(f)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition">
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-semibold text-gray-900 truncate">{f.name}{f.maker ? <span className="font-normal text-gray-400"> · {f.maker}</span> : null}</span>
                  <span className="block text-[11px] text-gray-400 mt-0.5">{foodBasis(f).mode === 'gram' ? `${f.serving || '100g'}당 ${f.kcal}kcal` : `${f.serving} · ${f.kcal}kcal`}</span>
                </span>
                <span className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0"><Plus className="w-4 h-4" /></span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 담은 목록 */}
      <div className="mt-3 flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {photoPreview && (
          <div className="relative">
            <img src={photoPreview} alt="" className="w-full max-h-40 object-cover rounded-2xl border border-gray-100" />
            <button type="button" onClick={clearPhoto} aria-label="사진 삭제"
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center">
            <p className="text-[13px] text-gray-400 leading-relaxed">사진을 찍거나 음식을 검색해<br />이 끼니를 담아보세요</p>
          </div>
        ) : entries.map((e) => {
          const n = computeNutrients(e.food, e.amount)
          const basis = foodBasis(e.food)
          const isGram = basis.mode === 'gram'
          return (
            <div key={e.key} className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 px-3.5 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{e.food.name}{e.food.maker ? <span className="font-normal text-gray-400"> · {e.food.maker}</span> : null}</p>
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
                <button type="button" aria-label="줄이기" onClick={() => stepAmount(e.key, -1)} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
                {isGram ? (
                  <span className="inline-flex items-center border border-gray-200 rounded-lg h-7 focus-within:border-emerald-400">
                    <input type="number" inputMode="numeric" min={0} value={e.amount} onChange={(ev) => setGrams(e.key, ev.target.value)} onFocus={(ev) => ev.target.select()}
                      className="w-10 h-full text-[13px] font-semibold text-gray-800 text-right bg-transparent focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <span className="text-[10px] text-gray-400 font-semibold pr-1.5 pl-0.5">{basis.unit}</span>
                  </span>
                ) : (
                  <span className="text-[13px] font-semibold text-gray-800 w-9 text-center tabular-nums">×{e.amount}</span>
                )}
                <button type="button" aria-label="늘리기" onClick={() => stepAmount(e.key, +1)} className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
                <button type="button" aria-label="삭제" onClick={() => removeEntry(e.key)} className="w-6 h-6 rounded-full text-gray-300 hover:text-rose-400 flex items-center justify-center"><X className="w-4 h-4" /></button>
              </div>
            </div>
          )
        })}
      </div>

      {/* 하단 — 합계 + 제출 */}
      <div className="flex-shrink-0 pt-4 mt-1 border-t border-gray-100">
        <div className="flex items-end justify-between gap-3 mb-2.5">
          <div>
            <p className="text-[11px] font-medium text-gray-400">이 끼니 합계</p>
            <p className="text-[26px] font-extrabold text-gray-900 leading-none mt-1 tabular-nums">{totals.kcal.toLocaleString()}<span className="text-[14px] text-gray-400 font-bold ml-1">kcal</span></p>
          </div>
          <div className="flex items-start gap-3 pb-1">
            {NUTRIENTS.map((nu) => (
              <div key={nu.key} className="text-right">
                <p className="text-[10px] font-medium text-gray-400 flex items-center gap-1 justify-end leading-none"><span className={`w-1.5 h-1.5 rounded-full ${nu.dot}`} />{nu.label}</p>
                <p className={`text-[14px] font-bold ${nu.text} tabular-nums leading-none mt-1`}>{totals[nu.key]}<span className="text-[10px] font-medium text-gray-400">g</span></p>
              </div>
            ))}
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden flex mb-3.5">
          {macroTotal > 0 && NUTRIENTS.map((nu) => (
            <span key={nu.key} className={`${nu.bar} h-full`} style={{ width: `${(totals[nu.key] / macroTotal) * 100}%` }} />
          ))}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} disabled={submitting} className="h-12 px-5 rounded-2xl bg-gray-100 text-gray-500 text-[15px] font-bold">취소</button>
          )}
          <button type="button" onClick={submit} disabled={entries.length === 0 || submitting}
            className="flex-1 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-[15px] font-bold transition disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center gap-2">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> 제출 중…</> : '이 식단으로 인증하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
