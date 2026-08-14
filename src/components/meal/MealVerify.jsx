import { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Plus, Minus, X, Camera, Loader2, Heart, Check, Flag, Pencil, Trash2 } from 'lucide-react'
import { searchFoods, computeNutrients, foodBasis, defaultAmount, recordPick, recognizeFoodPhoto, recordUse, setFavorite, getUserFoods, rowToFood, logSearchMiss, submitFood, setFoodPublic, reportFood, readNutritionLabel, markFoodVerified, getMyRegisteredFoods, updateFood, deleteFood } from '../../lib/foodDb'

// 식단 미션 인증 — 한 끼니(아침/점심/저녁/간식) 기록.
//   두 방법: 🔍 검색(32만 DB) · 📷 AI 사진(food-vision → 프리필). 그램 확정 → 영양치와 함께 제출.
//   onSubmit({ items, totals, source, photoFile }) — MissionVerifyPage 가 verifications 에 저장.

const MEAL_LABEL = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' }
const MEAL_EMOJI = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍪' }
const NUTRIENTS = [
  { key: 'carb', label: '탄수', full: '탄수화물', text: 'text-amber-600', dot: 'bg-amber-400', bar: 'bg-amber-400' },
  { key: 'protein', label: '단백', full: '단백질', text: 'text-sky-600', dot: 'bg-sky-400', bar: 'bg-sky-400' },
  { key: 'fat', label: '지방', full: '지방', text: 'text-rose-500', dot: 'bg-rose-400', bar: 'bg-rose-400' },
]
const DAILY_VALUE = { kcal: 2000, carb: 324, protein: 55, fat: 54 }  // 1일 영양성분 기준치(식품표시기준)

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

// 검색결과·즐겨찾기·최근 공용 행 — 담기 + 하트 토글 (+ 공유음식 신고)
function FoodRow({ food, faved, onAdd, onToggleFav, onReport }) {
  const basis = foodBasis(food)
  const sub = basis.mode === 'gram'
    ? `${food.serving || '100g'}당 ${food.kcal}kcal`
    : `${food.serving ? food.serving + ' · ' : ''}${food.kcal}kcal`
  const isUser = food.source === 'user'
  return (
    <div className="w-full flex items-center gap-1.5 px-4 py-3">
      <button type="button" onClick={() => onAdd(food)} className="flex-1 min-w-0 text-left">
        <span className="block text-[13.5px] font-semibold text-gray-900 truncate">
          {food.name}{food.maker ? <span className="font-normal text-gray-400"> · {food.maker}</span> : null}
          {isUser && (
            <span className={`ml-1.5 align-middle text-[9px] font-bold px-1.5 py-0.5 rounded-full ${food.verified ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
              {food.verified ? '✓ 검증' : '사용자 등록'}
            </span>
          )}
        </span>
        <span className="block text-[11px] text-gray-400 mt-0.5">{sub}</span>
      </button>
      {onReport && isUser && !food.verified && (
        <button type="button" onClick={() => onReport(food)} aria-label="신고"
          className="w-7 h-7 flex items-center justify-center flex-shrink-0 text-gray-300 hover:text-amber-500 transition"><Flag className="w-[15px] h-[15px]" /></button>
      )}
      <button type="button" onClick={() => onToggleFav(food)} aria-label={faved ? '즐겨찾기 해제' : '즐겨찾기'}
        className="w-8 h-8 flex items-center justify-center flex-shrink-0 active:scale-90 transition">
        <Heart className={`w-[18px] h-[18px] transition ${faved ? 'fill-rose-400 text-rose-400' : 'text-gray-300'}`} />
      </button>
      <button type="button" onClick={() => onAdd(food)} aria-label="담기"
        className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0"><Plus className="w-4 h-4" /></button>
    </div>
  )
}

function SectionLabel({ icon, children }) {
  return <p className="flex items-center gap-1.5 text-[11.5px] font-bold text-gray-400 px-1 mb-1.5">{icon}{children}</p>
}

// 즐겨찾기 가능 여부 — 임시(직접입력/AI 미매칭)는 저장 불가
const canFav = (id) => { const s = String(id || ''); return !!s && !s.startsWith('custom') && !s.startsWith('ai-') }

// 직접 등록 폼 초기값
const REG_EMPTY = { name: '', g: '100', kcal: '', carb: '', protein: '', fat: '', share: false, fromLabel: false, editId: null }

export default function MealVerify({ mealType = 'breakfast', onSubmit, submitting = false, onCancel }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState([])   // [{ key, food, amount }]
  const [reg, setReg] = useState({ name: '', g: '100', kcal: '', carb: '', protein: '', fat: '', share: false, fromLabel: false, editId: null })
  const [myRegistered, setMyRegistered] = useState([])    // 내가 등록한 음식 목록
  const [deleteFoodTarget, setDeleteFoodTarget] = useState(null)
  const [detailEntry, setDetailEntry] = useState(null)    // 영양 상세 시트 대상
  const [regBusy, setRegBusy] = useState(false)
  const [panel, setPanel] = useState(null)          // null | 'favorites' | 'register'
  const [favSel, setFavSel] = useState(() => new Set())   // 즐겨찾기 복수선택
  const [reportTarget, setReportTarget] = useState(null)  // 신고 확인 대상 food
  const [labelBusy, setLabelBusy] = useState(false)       // 영양성분표 OCR 중
  const [labelHint, setLabelHint] = useState(null)        // OCR 결과 안내
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoError, setPhotoError] = useState(null)
  const [source, setSource] = useState('search')   // 'search' | 'photo'
  const [myFoods, setMyFoods] = useState({ favorites: [], recents: [] })
  const [favIds, setFavIds] = useState(() => new Set())
  const [deepLoading, setDeepLoading] = useState(false)
  const [deepDone, setDeepDone] = useState(false)
  const [fastEmpty, setFastEmpty] = useState(false)   // 앞일치 0건 → 등록 폼 + 제안
  const photoFileRef = useRef(null)
  const seq = useRef(0)
  const boxRef = useRef(null)
  const loggedMiss = useRef(new Set())

  const applyMyFoods = (uf) => {
    setMyFoods(uf)
    setFavIds(new Set(uf.favorites.map((r) => String(r.food_id))))
  }
  const refreshMyFoods = () => getUserFoods().then(applyMyFoods)
  useEffect(() => {
    let alive = true
    getUserFoods().then((uf) => { if (alive) applyMyFoods(uf) })
    return () => { alive = false }
  }, [])

  const toggleFav = async (food) => {
    const id = String(food.id)
    const on = !favIds.has(id)
    setFavIds((prev) => { const n = new Set(prev); if (on) n.add(id); else n.delete(id); return n })  // 낙관적
    await setFavorite(food, on)
    refreshMyFoods()
  }

  useEffect(() => {
    const q = query.trim()
    setDeepDone(false); setFastEmpty(false)
    if (!q) { setResults([]); setSearching(false); return }
    setSearching(true)
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        let r = await searchFoods(q)                        // 빠른 앞일치(+초성)
        const wasEmpty = r.length === 0
        if (!cancelled) setFastEmpty(wasEmpty)              // 정확히 없음 → 등록 폼 노출
        if (!cancelled && wasEmpty) {                       // 비슷한 음식 제안(정밀·오타보정)
          r = await searchFoods(q, { deep: true, limit: 20 })
          if (!cancelled) setDeepDone(true)
        }
        if (cancelled) return
        setResults(r)
        if (r.length === 0 && !loggedMiss.current.has(q)) {  // 제안도 0건 → 실패 로깅(1회)
          loggedMiss.current.add(q); logSearchMiss(q)
        }
      } finally { if (!cancelled) setSearching(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [query])

  // 더보기 — 부분일치까지 정밀 검색(느림, 사용자 대기)
  const runDeep = async () => {
    const q = query.trim()
    if (!q || deepLoading) return
    setDeepLoading(true)
    try { setResults(await searchFoods(q, { deep: true, limit: 40 })); setDeepDone(true) }
    finally { setDeepLoading(false) }
  }

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
    recordUse(food)   // 최근·자주 목록 갱신(다음 열 때 반영)
    setQuery(''); setResults([]); setOpen(false)
  }
  const refreshMyRegistered = () => getMyRegisteredFoods().then(setMyRegistered)

  // 개별 등록/수정 — 영구 저장. 신규는 담기까지, 수정은 목록 갱신.
  const registerFood = async () => {
    const name = reg.name.trim()
    const g = Math.max(1, parseFloat(reg.g) || 100)
    const kcal = parseFloat(reg.kcal) || 0
    if (!name || !(kcal >= 1) || regBusy) return
    const nutr = { name, servingG: g, kcal, carb: parseFloat(reg.carb) || 0, protein: parseFloat(reg.protein) || 0, fat: parseFloat(reg.fat) || 0 }
    setRegBusy(true)
    try {
      if (reg.editId) {                                   // 수정
        try {
          const n = await updateFood(reg.editId, nutr)
          if (n > 0) { await setFoodPublic(reg.editId, reg.share); setReg({ ...REG_EMPTY }); setLabelHint('✓ 수정 저장됐어요'); refreshMyRegistered() }
          else setLabelHint('수정 대상을 찾지 못했어요. 다시 시도해 주세요.')
        } catch (e) { setLabelHint('수정 실패: ' + (e?.message || String(e))) }
      } else {                                             // 신규 등록 + 담기
        const food = await submitFood(nutr)
        if (food) {
          if (reg.fromLabel) { markFoodVerified(food.id); food.verified = true }  // 라벨 OCR → 자동 검증
          if (reg.share) { setFoodPublic(food.id, true) }                          // 모두에게 공유
          addEntry(food, g); recordUse(food)
          setQuery(''); setResults([]); setOpen(false); setPanel(null); setReg({ ...REG_EMPTY })
        }
      }
    } catch { /* 실패 시 유지 */ } finally { setRegBusy(false) }
  }

  const openRegister = (prefill = '') => {
    setReg({ ...REG_EMPTY, name: prefill })
    setLabelHint(null); setOpen(false); setPanel('register'); refreshMyRegistered()
  }
  const fillEditFood = (f) => {   // 내 음식 → 폼에 채워 수정 모드 (저장된 제공량 기준)
    const m = String(f.serving || '').match(/(\d+(?:\.\d+)?)/)
    setReg({ name: f.name || '', g: m ? m[1] : '100', kcal: String(f.kcal ?? ''), carb: String(f.carb ?? ''), protein: String(f.protein ?? ''), fat: String(f.fat ?? ''), share: !!f.is_public, fromLabel: false, editId: f.id })
    setLabelHint(null)
  }
  const confirmDeleteFood = async () => {
    const f = deleteFoodTarget; if (!f) return
    setDeleteFoodTarget(null)
    await deleteFood(f.id)
    if (reg.editId === f.id) { setReg({ ...REG_EMPTY }); setLabelHint(null) }
    refreshMyRegistered()
  }

  // 영양성분표 사진 → OCR → 등록 폼 자동 채움
  const onLabelPhoto = async (ev) => {
    const file = ev.target.files?.[0]
    if (!file) return
    setLabelBusy(true); setLabelHint(null)
    try {
      const dataUrl = await fileToDataUrl(file)
      const d = await readNutritionLabel(dataUrl)
      setReg((r) => ({
        ...r,
        g: d.serving_g ? String(d.serving_g) : r.g,
        kcal: d.kcal ? String(d.kcal) : r.kcal,
        carb: d.carb ? String(d.carb) : r.carb,
        protein: d.protein ? String(d.protein) : r.protein,
        fat: d.fat ? String(d.fat) : r.fat,
        fromLabel: d.kcal ? true : r.fromLabel,   // 라벨로 읽었으면 등록 시 자동 검증
      }))
      setLabelHint(d.kcal ? `표에서 읽었어요 · ${d.serving_g}g당 ${d.kcal}kcal · ✓ 검증으로 등록돼요` : '표를 읽지 못했어요. 직접 입력해 주세요.')
    } catch {
      setLabelHint('표를 읽지 못했어요. 직접 입력해 주세요.')
    } finally { setLabelBusy(false); ev.target.value = '' }
  }

  const confirmReport = async () => {
    const f = reportTarget
    if (!f) return
    setReportTarget(null)
    const ok = await reportFood(f.id)
    setResults((prev) => prev.filter((x) => x.id !== f.id))   // 목록에서 즉시 제거
    setPhotoError(ok ? null : '신고 처리에 실패했어요')
  }
  const openFavorites = () => { refreshMyFoods(); setFavSel(new Set()); setPanel('favorites') }
  const toggleSel = (id) => setFavSel((prev) => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n
  })
  const addSelectedFavorites = () => {
    myFoods.favorites.filter((r) => favSel.has(String(r.food_id))).forEach((r) => addFood(rowToFood(r)))
    setPanel(null)
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
        try { const r = await searchFoods(f.name, { deep: true, limit: 5 }); db = r?.[0] || null } catch { /* 무시 */ }
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

  // 즐겨찾기한 항목을 검색결과 최상단으로
  const sortedResults = useMemo(
    () => [...results].sort((a, b) => (favIds.has(String(b.id)) ? 1 : 0) - (favIds.has(String(a.id)) ? 1 : 0)),
    [results, favIds])

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
    <div className="relative flex flex-col h-full">
      {/* 헤더 — 끼니 */}
      <div className="flex-shrink-0 flex items-center gap-2 mb-2">
        <span className="text-[18px]">{MEAL_EMOJI[mealType] || '🍽️'}</span>
        <h2 className="text-[16px] font-extrabold text-gray-900">{MEAL_LABEL[mealType] || '식단'} 기록</h2>
        <span className="text-[11px] text-gray-400 ml-auto">검색 또는 사진으로 담아요</span>
      </div>

      {/* AI 사진 — 점선 박스 탭 → 촬영/앨범 선택 */}
      <label className={`flex-shrink-0 flex flex-col items-center justify-center gap-1.5 px-4 py-6 rounded-2xl border-2 border-dashed cursor-pointer transition mb-3 ${photoBusy ? 'border-emerald-300 bg-emerald-50/60' : 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40 active:bg-emerald-50'}`}>
        {photoBusy ? (
          <>
            <Loader2 className="w-7 h-7 text-emerald-500 animate-spin" />
            <span className="text-[13px] font-semibold text-emerald-600">AI가 사진을 분석 중…</span>
          </>
        ) : (
          <>
            <span className="w-11 h-11 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center"><Camera className="w-[22px] h-[22px]" /></span>
            <span className="text-[14px] font-bold text-gray-800 text-center">사진을 올리면 자동으로 칼로리를 계산해줘요</span>
            <span className="text-[11.5px] text-gray-400">탭해서 촬영하거나 앨범에서 선택</span>
          </>
        )}
        <input type="file" accept="image/*" onChange={onPhoto} disabled={photoBusy || submitting} className="hidden" />
      </label>
      {photoError && <p className="flex-shrink-0 text-[11px] text-rose-500 mb-2 text-center">{photoError}</p>}

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
            ) : fastEmpty ? (
              <>
                <button type="button" onClick={() => openRegister(query)}
                  className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-emerald-50/50 transition">
                  <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0"><Plus className="w-4 h-4" /></span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-gray-900 truncate">'{query}' 직접 등록하기</span>
                    <span className="block text-[11px] text-gray-400">칼로리를 입력해 내 음식으로 저장해요</span>
                  </span>
                </button>
                {results.length > 0 && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold text-gray-400">혹시 이 음식인가요?</p>
                    {sortedResults.map((f) => (
                      <FoodRow key={f.id} food={f} faved={favIds.has(String(f.id))} onAdd={addFood} onToggleFav={toggleFav} onReport={setReportTarget} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {sortedResults.map((f) => (
                  <FoodRow key={f.id} food={f} faved={favIds.has(String(f.id))} onAdd={addFood} onToggleFav={toggleFav} onReport={setReportTarget} />
                ))}
                {!deepDone && (
                  <button type="button" onClick={runDeep} disabled={deepLoading}
                    className="w-full px-4 py-3 text-[12.5px] font-semibold text-emerald-600 hover:bg-emerald-50 flex items-center justify-center gap-1.5 disabled:text-gray-400">
                    {deepLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> 정밀 검색 중…</> : '🔎 못 찾으셨나요? 더 정확히 찾기'}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 담은 목록 + 내 음식(즐겨찾기·최근) */}
      <div className="mt-3 flex-1 min-h-0 overflow-y-auto space-y-3">
        {photoPreview && (
          <div className="relative">
            <img src={photoPreview} alt="" className="w-full max-h-40 object-cover rounded-2xl border border-gray-100" />
            <button type="button" onClick={clearPhoto} aria-label="사진 삭제"
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm transition">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {entries.length > 0 && (
          <div className="space-y-1.5">
            {entries.map((e) => {
          const n = computeNutrients(e.food, e.amount)
          const basis = foodBasis(e.food)
          const isGram = basis.mode === 'gram'
          return (
            <div key={e.key} className="flex items-center gap-3 rounded-2xl bg-white border border-gray-100 px-3.5 py-3">
              <button type="button" onClick={() => setDetailEntry(e)} className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{e.food.name}{e.food.maker ? <span className="font-normal text-gray-400"> · {e.food.maker}</span> : null}</p>
                <p className="text-[11px] mt-1 flex items-center gap-2.5">
                  <span className="font-bold text-gray-900 tabular-nums">{n.kcal}<span className="text-gray-400 font-medium">kcal</span></span>
                  {NUTRIENTS.map((nu) => (
                    <span key={nu.key} className={`inline-flex items-center gap-1 ${nu.text} font-semibold tabular-nums`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${nu.dot}`} />{n[nu.key]}
                    </span>
                  ))}
                </p>
              </button>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {canFav(e.food.id) && (
                  <button type="button" aria-label="즐겨찾기" onClick={() => toggleFav(e.food)}
                    className="w-7 h-7 flex items-center justify-center active:scale-90 transition mr-0.5">
                    <Heart className={`w-[17px] h-[17px] transition ${favIds.has(String(e.food.id)) ? 'fill-rose-400 text-rose-400' : 'text-gray-300'}`} />
                  </button>
                )}
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
        )}

        {/* 즐겨찾기 · 직접 등록 버튼 */}
        <div className="flex gap-2">
          <button type="button" onClick={openFavorites}
            className="flex-1 h-11 rounded-2xl bg-white border border-gray-200 text-[13px] font-bold text-gray-700 flex items-center justify-center gap-1.5 active:bg-gray-50 transition">
            <Heart className="w-4 h-4 fill-rose-400 text-rose-400" /> 즐겨찾기
          </button>
          <button type="button" onClick={() => openRegister('')}
            className="flex-1 h-11 rounded-2xl bg-white border border-gray-200 text-[13px] font-bold text-gray-700 flex items-center justify-center gap-1.5 active:bg-gray-50 transition">
            <Plus className="w-4 h-4 text-emerald-500" /> 직접 등록
          </button>
        </div>

        {/* 최근에 담은 음식 */}
        {myFoods.recents.length > 0 && (
          <section>
            <SectionLabel icon={<span className="text-[12px] leading-none">🕘</span>}>최근에 담은 음식</SectionLabel>
            <div className="rounded-2xl bg-white border border-gray-100 divide-y divide-gray-50 overflow-hidden">
              {myFoods.recents.map((r) => (
                <FoodRow key={r.food_id} food={rowToFood(r)} faved={favIds.has(String(r.food_id))} onAdd={addFood} onToggleFav={toggleFav} />
              ))}
            </div>
          </section>
        )}

        {/* 처음 — 아무 기록도 없을 때 */}
        {entries.length === 0 && myFoods.recents.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center">
            <p className="text-[13px] text-gray-400 leading-relaxed">사진·검색으로 담거나<br />즐겨찾기·직접 등록에서 추가하세요</p>
          </div>
        )}
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

      {/* ── 중앙 패널: 즐겨찾기 복수선택 ────────────── */}
      {panel === 'favorites' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
          <button type="button" aria-label="닫기" onClick={() => setPanel(null)} className="absolute inset-0 bg-black/15" />
          <div className="relative w-full max-w-sm max-h-[82%] flex flex-col rounded-3xl bg-white shadow-elevated border border-gray-100 overflow-hidden">
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Heart className="w-4 h-4 fill-rose-400 text-rose-400" />
              <h3 className="text-[14px] font-extrabold text-gray-900">즐겨찾기에서 담기</h3>
              <button type="button" onClick={() => setPanel(null)} aria-label="닫기" className="ml-auto w-7 h-7 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain divide-y divide-gray-50">
              {myFoods.favorites.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-[13px] text-gray-400 leading-relaxed">즐겨찾기한 음식이 없어요.<br />검색 결과에서 <Heart className="inline w-3.5 h-3.5 text-gray-300 align-middle" /> 를 눌러 추가하세요.</p>
                </div>
              ) : myFoods.favorites.map((r) => {
                const sel = favSel.has(String(r.food_id))
                const f = rowToFood(r)
                const b = foodBasis(f)
                const sub = b.mode === 'gram' ? `${f.serving || '100g'}당 ${f.kcal}kcal` : `${f.serving ? f.serving + ' · ' : ''}${f.kcal}kcal`
                return (
                  <button key={r.food_id} type="button" onClick={() => toggleSel(String(r.food_id))}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${sel ? 'bg-emerald-50/60' : 'hover:bg-gray-50'}`}>
                    <span className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border ${sel ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'}`}>
                      {sel && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] font-semibold text-gray-900 truncate">{f.name}{f.maker ? <span className="font-normal text-gray-400"> · {f.maker}</span> : null}</span>
                      <span className="block text-[11px] text-gray-400 mt-0.5">{sub}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex-shrink-0 p-3 border-t border-gray-100">
              <button type="button" onClick={addSelectedFavorites} disabled={favSel.size === 0}
                className="w-full h-11 rounded-2xl bg-emerald-500 text-white text-[14px] font-bold disabled:bg-gray-200 disabled:text-gray-400 transition">
                {favSel.size > 0 ? `${favSel.size}개 담기` : '음식을 선택하세요'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 중앙 패널: 직접 등록 ────────────────────── */}
      {panel === 'register' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
          <button type="button" aria-label="닫기" onClick={() => setPanel(null)} className="absolute inset-0 bg-black/15" />
          <div className="relative w-full max-w-sm max-h-[85%] flex flex-col rounded-3xl bg-white shadow-elevated border border-gray-100 overflow-hidden">
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Plus className="w-4 h-4 text-emerald-500" />
              <h3 className="text-[14px] font-extrabold text-gray-900">{reg.editId ? '음식 수정' : '직접 등록'}</h3>
              {reg.editId && <button type="button" onClick={() => { setReg({ ...REG_EMPTY }); setLabelHint(null) }} className="text-[11px] text-gray-400 hover:text-gray-600">＋새 등록</button>}
              <button type="button" onClick={() => setPanel(null)} aria-label="닫기" className="ml-auto w-7 h-7 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-2.5 overflow-y-auto">
              <label className={`flex items-center justify-center gap-2 h-11 rounded-xl border-2 border-dashed cursor-pointer transition ${labelBusy ? 'border-emerald-300 bg-emerald-50/60 text-emerald-600' : 'border-gray-200 text-gray-600 hover:border-emerald-300 hover:bg-emerald-50/40'}`}>
                {labelBusy ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-[13px] font-bold">표 읽는 중…</span></> : <><Camera className="w-4 h-4" /><span className="text-[13px] font-bold">영양성분표 찍어서 자동 입력</span></>}
                <input type="file" accept="image/*" onChange={onLabelPhoto} disabled={labelBusy} className="hidden" />
              </label>
              {labelHint && <p className="text-[10.5px] text-emerald-600 text-center">{labelHint}</p>}
              <input value={reg.name} onChange={(e) => setReg((r) => ({ ...r, name: e.target.value }))} placeholder="음식 이름 (예: 엄마 김치찌개)" autoFocus
                className="w-full h-11 px-3.5 rounded-xl bg-gray-50 border border-gray-200 text-[14px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-emerald-400 transition" />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 flex-1 h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl focus-within:border-emerald-400">
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">1회</span>
                  <input type="number" inputMode="numeric" min={1} value={reg.g} onChange={(e) => setReg((r) => ({ ...r, g: e.target.value }))}
                    className="w-full text-[14px] text-right bg-transparent focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <span className="text-[11px] text-gray-400">g</span>
                </label>
                <label className="flex items-center gap-1 flex-1 h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl focus-within:border-emerald-400">
                  <input type="number" inputMode="numeric" min={1} value={reg.kcal} onChange={(e) => setReg((r) => ({ ...r, kcal: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') registerFood() }} placeholder="칼로리"
                    className="w-full text-[14px] text-right bg-transparent focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <span className="text-[11px] text-gray-400">kcal</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                {[['carb', '탄수'], ['protein', '단백'], ['fat', '지방']].map(([k, lab]) => (
                  <label key={k} className="flex items-center gap-1 flex-1 h-11 px-3 bg-gray-50 border border-gray-200 rounded-xl focus-within:border-emerald-400">
                    <span className="text-[11px] text-gray-400 whitespace-nowrap">{lab}</span>
                    <input type="number" inputMode="numeric" min={0} value={reg[k]} onChange={(e) => setReg((r) => ({ ...r, [k]: e.target.value }))} placeholder="0"
                      className="w-full text-[14px] text-right bg-transparent focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                    <span className="text-[10px] text-gray-400">g</span>
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => setReg((r) => ({ ...r, share: !r.share }))}
                className="w-full flex items-center gap-2.5 px-1 py-1 text-left">
                <span className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border transition ${reg.share ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'}`}>
                  {reg.share && <Check className="w-3.5 h-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-semibold text-gray-700">🌐 모두에게 공유</span>
                  <span className="block text-[10.5px] text-gray-400">다른 사람도 검색할 수 있어요 · 검증 전까진 「사용자 등록」 표시</span>
                </span>
              </button>
              <button type="button" onClick={registerFood} disabled={regBusy || !reg.name.trim() || !(parseFloat(reg.kcal) >= 1)}
                className="w-full h-11 rounded-2xl bg-emerald-500 text-white text-[14px] font-bold disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center gap-1.5 transition">
                {regBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> {reg.editId ? '저장 중…' : '등록 중…'}</> : (reg.editId ? '수정 저장' : '등록하고 담기')}
              </button>
              <p className="text-[10px] text-gray-400 text-center">{reg.editId ? '수정하면 라벨 검증(✓)은 해제돼요' : '입력한 1회 제공량 기준으로 저장돼요'}</p>

              {/* 내가 등록한 음식 — 수정·삭제 */}
              {myRegistered.length > 0 && (
                <div className="pt-2.5 mt-1 border-t border-gray-100">
                  <p className="text-[11px] font-bold text-gray-400 mb-1.5">내가 등록한 음식 {myRegistered.length}</p>
                  <div className="space-y-1">
                    {myRegistered.map((f) => (
                      <div key={f.id} className={`flex items-center gap-2 rounded-xl px-2.5 py-2 border ${reg.editId === f.id ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-transparent'}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-semibold text-gray-800 truncate">{f.name}
                            {f.verified ? <span className="ml-1 text-[9px] font-bold text-emerald-600">✓</span> : null}
                            {f.is_public ? <span className="ml-1 text-[9px] text-gray-400">🌐</span> : null}
                          </p>
                          <p className="text-[10.5px] text-gray-400">{f.serving || '100g'}당 {f.kcal}kcal</p>
                        </div>
                        <button type="button" onClick={() => fillEditFood(f)} aria-label="수정" className="w-7 h-7 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center flex-shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => setDeleteFoodTarget(f)} aria-label="삭제" className="w-7 h-7 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 flex items-center justify-center flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 신고 확인 ─────────────────────────────── */}
      {reportTarget && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
          <button type="button" aria-label="닫기" onClick={() => setReportTarget(null)} className="absolute inset-0 bg-black/20" />
          <div className="relative w-full max-w-xs rounded-3xl bg-white shadow-elevated border border-gray-100 p-5 text-center">
            <div className="w-11 h-11 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3"><Flag className="w-5 h-5" /></div>
            <p className="text-[14px] font-bold text-gray-900 mb-1">이 음식 정보를 신고할까요?</p>
            <p className="text-[12px] text-gray-500 mb-3 truncate">{reportTarget.name}</p>
            <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">칼로리·이름이 잘못됐거나 부적절하면 신고해 주세요. 여러 명이 신고하면 공개 목록에서 자동으로 내려가요.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setReportTarget(null)} className="flex-1 h-10 rounded-2xl bg-gray-100 text-gray-500 text-[13px] font-bold">취소</button>
              <button type="button" onClick={confirmReport} className="flex-1 h-10 rounded-2xl bg-amber-500 text-white text-[13px] font-bold">신고</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 내 음식 삭제 확인 ─────────────────────── */}
      {deleteFoodTarget && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
          <button type="button" aria-label="닫기" onClick={() => setDeleteFoodTarget(null)} className="absolute inset-0 bg-black/20" />
          <div className="relative w-full max-w-xs rounded-3xl bg-white shadow-elevated border border-gray-100 p-5 text-center">
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3"><Trash2 className="w-5 h-5" /></div>
            <p className="text-[14px] font-bold text-gray-900 mb-1">이 음식을 삭제할까요?</p>
            <p className="text-[12px] text-gray-500 mb-4 truncate">{deleteFoodTarget.name}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDeleteFoodTarget(null)} className="flex-1 h-10 rounded-2xl bg-gray-100 text-gray-500 text-[13px] font-bold">취소</button>
              <button type="button" onClick={confirmDeleteFood} className="flex-1 h-10 rounded-2xl bg-rose-500 text-white text-[13px] font-bold">삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 영양 상세 시트 ─────────────────────────── */}
      {detailEntry && (() => {
        const dn = computeNutrients(detailEntry.food, detailEntry.amount)
        const db = foodBasis(detailEntry.food)
        const amtLabel = db.mode === 'gram' ? `${detailEntry.amount}${db.unit}` : `×${detailEntry.amount}`
        return (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
            <button type="button" aria-label="닫기" onClick={() => setDetailEntry(null)} className="absolute inset-0 bg-black/20" />
            <div className="relative w-full max-w-sm rounded-3xl bg-white shadow-elevated border border-gray-100 overflow-hidden">
              <div className="flex items-start gap-2 px-4 py-3 border-b border-gray-100">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-extrabold text-gray-900 truncate">{detailEntry.food.name}</h3>
                  <p className="text-[11px] text-gray-400 truncate">{detailEntry.food.maker ? detailEntry.food.maker + ' · ' : ''}{amtLabel} 기준</p>
                </div>
                <button type="button" onClick={() => setDetailEntry(null)} aria-label="닫기" className="w-7 h-7 rounded-full text-gray-400 hover:bg-gray-100 flex items-center justify-center flex-shrink-0"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4">
                <div className="text-center mb-4">
                  <p className="text-[30px] font-extrabold text-gray-900 leading-none tabular-nums">{dn.kcal.toLocaleString()}<span className="text-[14px] text-gray-400 font-bold ml-1">kcal</span></p>
                  <p className="text-[11px] text-gray-400 mt-1.5">1일 기준 2,000kcal 대비 <b className="text-gray-600">{Math.round(dn.kcal / DAILY_VALUE.kcal * 100)}%</b></p>
                </div>
                <div className="space-y-3">
                  {NUTRIENTS.map((nu) => {
                    const val = dn[nu.key], dv = DAILY_VALUE[nu.key], pct = Math.round(val / dv * 100)
                    return (
                      <div key={nu.key}>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[12.5px] font-semibold text-gray-700 flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${nu.dot}`} />{nu.full}</span>
                          <span className="text-[12px] tabular-nums"><b className="text-gray-900">{val}g</b> <span className="text-gray-400">/ {dv}g · {pct}%</span></span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden"><span className={`block h-full ${nu.bar}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10.5px] text-gray-400 text-center mt-4 leading-relaxed">나트륨·당류·포화/트랜스지방 등 상세 영양소는 준비 중이에요<br />※ 1일 영양성분 기준치 대비 · 참고용</p>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
