import { useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { recognizeFoodPhoto, searchFoods, computeNutrients } from '../../lib/foodDb'

// 🔧 사진 인식 PoC — 사진 → Gemini(food-vision)로 음식·추정g·대략 kcal 인식 → 우리 DB 매칭.
//   라우트: /dev/meal-photo.  양은 근사치(사용자가 그램 확정하는 하이브리드 전제).

// 파일 → 리사이즈·압축 base64 dataURL (토큰·전송량 절약)
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

const CONF = {
  high: { label: '높음', cls: 'text-emerald-600 bg-emerald-50' },
  mid: { label: '보통', cls: 'text-amber-600 bg-amber-50' },
  low: { label: '낮음', cls: 'text-gray-500 bg-gray-100' },
}

export default function MealPhotoDemo() {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState([])   // [{ name, origGrams, grams, kcal, confidence, db }]
  const [error, setError] = useState(null)

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null); setItems([]); setLoading(true)
    try {
      const dataUrl = await fileToDataUrl(file)
      setPreview(dataUrl)
      const foods = await recognizeFoodPhoto(dataUrl)
      // 각 인식 음식 → 우리 DB 최상위 매칭
      const matched = await Promise.all(foods.map(async (f) => {
        let db = null
        try { const r = await searchFoods(f.name); db = r?.[0] || null } catch { /* 매칭 실패 무시 */ }
        return { ...f, origGrams: f.grams || 0, db }
      }))
      setItems(matched)
    } catch (err) {
      setError(String(err?.message || err))
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const setGrams = (i, val) => setItems((prev) => prev.map((it, idx) =>
    idx === i ? { ...it, grams: Math.max(0, Math.round(Number(val) || 0)) } : it))

  // 표시 kcal — DB 매칭 있으면 DB 100g기준으로 정확 환산, 없으면 Gemini 추정을 그램비로 스케일
  const kcalOf = (it) => {
    if (it.db) return computeNutrients(it.db, it.grams).kcal
    const base = it.origGrams || it.grams || 1
    return Math.round((it.kcal || 0) * (it.grams / base))
  }
  const totalKcal = items.reduce((s, it) => s + kcalOf(it), 0)

  return (
    <div className="max-w-md mx-auto px-4 py-5 min-h-[100dvh] flex flex-col">
      <h1 className="text-lg font-extrabold text-gray-900">📷 사진으로 식단 (PoC)</h1>
      <p className="text-[12px] text-gray-400 mb-4">Gemini 인식 → 우리 32만 DB 매칭. 양은 추정치, 사용자가 확정.</p>

      {/* 사진 선택/촬영 */}
      <label className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-emerald-500 text-white text-[15px] font-bold cursor-pointer active:bg-emerald-600 transition">
        <Camera className="w-5 h-5" />
        {preview ? '다른 사진으로' : '사진 찍기 / 고르기'}
        <input type="file" accept="image/*" capture="environment" onChange={onFile} className="hidden" />
      </label>

      {preview && (
        <img src={preview} alt="선택한 음식" className="mt-3 w-full max-h-56 object-cover rounded-2xl border border-gray-100" />
      )}

      {loading && (
        <div className="mt-4 flex items-center gap-2 text-[13px] text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> AI가 사진을 분석하는 중…
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl bg-rose-50 text-rose-600 text-[12px] px-3 py-2.5">
          인식 실패: {error}
          {error === 'not_configured' && ' — GEMINI_API_KEY 시크릿이 아직 설정되지 않았습니다.'}
        </div>
      )}

      {/* 인식 결과 */}
      {items.length > 0 && (
        <>
          <div className="mt-4 space-y-2">
            {items.map((it, i) => {
              const conf = CONF[it.confidence] || CONF.mid
              return (
                <div key={i} className="rounded-2xl border border-gray-100 bg-white px-3.5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-gray-900 truncate">{it.name}</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${conf.cls}`}>확신 {conf.label}</span>
                    <span className="ml-auto text-[15px] font-extrabold text-gray-900 tabular-nums">{kcalOf(it)}<span className="text-[11px] text-gray-400 font-bold">kcal</span></span>
                  </div>

                  {/* DB 매칭 */}
                  <p className="text-[11px] mt-1 text-gray-400 truncate">
                    {it.db
                      ? <>DB: {it.db.name}{it.db.maker ? <span> · {it.db.maker}</span> : null} <span className="text-gray-300">(100g당 {it.db.kcal}kcal)</span></>
                      : <span className="text-amber-500">DB 매칭 없음 — Gemini 추정 사용</span>}
                  </p>

                  {/* 그램 조절 */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[11px] text-gray-400">먹은 양</span>
                    <span className="inline-flex items-center border border-gray-200 rounded-lg h-8 focus-within:border-emerald-400">
                      <input type="number" inputMode="numeric" min={0} value={it.grams}
                        onChange={(e) => setGrams(i, e.target.value)} onFocus={(e) => e.target.select()}
                        className="w-14 h-full text-[13px] font-semibold text-gray-800 text-right bg-transparent focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      <span className="text-[11px] text-gray-400 font-semibold pr-2 pl-0.5">g</span>
                    </span>
                    {it.origGrams > 0 && <span className="text-[10px] text-gray-300">추정 {it.origGrams}g</span>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-2xl bg-gray-900 text-white px-4 py-3">
            <span className="text-[12px] text-gray-400">합계</span>
            <span className="text-[20px] font-extrabold tabular-nums">{totalKcal}<span className="text-[12px] text-gray-400 font-bold ml-0.5">kcal</span></span>
          </div>
        </>
      )}
    </div>
  )
}
