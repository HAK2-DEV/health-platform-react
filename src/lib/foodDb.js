import { supabase } from '../supabaseClient'
import { aliasOf } from './foodAliases'

// 식품 영양 데이터 소스 — 검색 인터페이스. 목데이터 폴백 + 엣지함수(food-search) 프록시.
//   반환 음식 1개 = 1회 표준제공량 기준 { id, name, serving, kcal, carb, protein, fat }.
//   호출측(MealLogger)은 이 인터페이스만 사용 → 데이터 소스 교체에 영향 없음.
//
//   [나중에 실제 API 스왑]
//   searchFoods() 내부를 supabase.functions.invoke('food-search', { body:{ q } }) 로 교체.
//   실제 소스: data.go.kr / data.mfds.go.kr 「식품영양성분DB」(서비스키 필요, CORS 때문에 엣지함수 프록시).

// 목 식품 DB — 자주 먹는 한식/간편식 (1회 표준제공량 기준, 대략치). 실제 API 붙기 전 UX 검증용.
const MOCK_FOODS = [
  { id: 'rice',        name: '공기밥',       serving: '1공기 (210g)', kcal: 310, carb: 69, protein: 6,  fat: 1 },
  { id: 'kimchi_jji',  name: '김치찌개',     serving: '1인분 (400g)', kcal: 243, carb: 12, protein: 15, fat: 14 },
  { id: 'doenjang',    name: '된장찌개',     serving: '1인분 (400g)', kcal: 180, carb: 14, protein: 12, fat: 8 },
  { id: 'bibimbap',    name: '비빔밥',       serving: '1인분 (500g)', kcal: 560, carb: 90, protein: 18, fat: 14 },
  { id: 'kimbap',      name: '김밥',         serving: '1줄',          kcal: 480, carb: 78, protein: 12, fat: 12 },
  { id: 'ramen',       name: '라면',         serving: '1봉지',        kcal: 500, carb: 79, protein: 10, fat: 16 },
  { id: 'samgyeop',    name: '삼겹살',       serving: '100g',         kcal: 331, carb: 0,  protein: 17, fat: 28 },
  { id: 'chicken_br',  name: '닭가슴살',     serving: '100g',         kcal: 165, carb: 0,  protein: 31, fat: 4 },
  { id: 'fried_chick', name: '후라이드치킨', serving: '3조각',        kcal: 450, carb: 25, protein: 30, fat: 26 },
  { id: 'egg_fry',     name: '계란후라이',   serving: '1개',          kcal: 90,  carb: 1,  protein: 6,  fat: 7 },
  { id: 'egg_boil',    name: '삶은계란',     serving: '1개',          kcal: 68,  carb: 1,  protein: 6,  fat: 5 },
  { id: 'tofu',        name: '두부',         serving: '반 모 (150g)', kcal: 120, carb: 3,  protein: 13, fat: 7 },
  { id: 'salad',       name: '샐러드',       serving: '1접시',        kcal: 150, carb: 12, protein: 5,  fat: 9 },
  { id: 'banana',      name: '바나나',       serving: '1개',          kcal: 105, carb: 27, protein: 1,  fat: 0 },
  { id: 'apple',       name: '사과',         serving: '1개',          kcal: 95,  carb: 25, protein: 0,  fat: 0 },
  { id: 'sweetpotato', name: '고구마',       serving: '1개 (130g)',   kcal: 130, carb: 30, protein: 2,  fat: 0 },
  { id: 'milk',        name: '우유',         serving: '200ml',        kcal: 130, carb: 10, protein: 6,  fat: 7 },
  { id: 'yogurt',      name: '그릭요거트',   serving: '100g',         kcal: 97,  carb: 4,  protein: 9,  fat: 5 },
  { id: 'americano',   name: '아메리카노',   serving: '1잔',          kcal: 10,  carb: 2,  protein: 0,  fat: 0 },
  { id: 'latte',       name: '카페라떼',     serving: '1잔',          kcal: 180, carb: 15, protein: 9,  fat: 9 },
  { id: 'toast',       name: '식빵',         serving: '1장',          kcal: 80,  carb: 15, protein: 3,  fat: 1 },
  { id: 'jjajang',     name: '짜장면',       serving: '1인분',        kcal: 700, carb: 110, protein: 16, fat: 20 },
  { id: 'jjambbong',   name: '짬뽕',         serving: '1인분',        kcal: 540, carb: 78, protein: 22, fat: 15 },
  { id: 'gimchi',      name: '김치',         serving: '1접시 (50g)',  kcal: 15,  carb: 3,  protein: 1,  fat: 0 },
  { id: 'pork_cutlet', name: '돈까스',       serving: '1인분',        kcal: 650, carb: 45, protein: 30, fat: 38 },
  { id: 'sundubu',     name: '순두부찌개',   serving: '1인분',        kcal: 250, carb: 10, protein: 16, fat: 15 },
  { id: 'bulgogi',     name: '불고기',       serving: '1인분 (200g)', kcal: 400, carb: 18, protein: 30, fat: 22 },
  { id: 'protein_shk', name: '단백질쉐이크', serving: '1스쿱',        kcal: 120, carb: 5,  protein: 24, fat: 1 },
]

function searchMock(q) {
  const lc = q.toLowerCase()
  return MOCK_FOODS.filter((f) => f.name.toLowerCase().includes(lc)).slice(0, 20)
}

// 검색 — 3단계: ① foods 테이블 RPC → ② 엣지함수 프록시(적재 전/미매칭) → ③ 목데이터.
//   opts.deep=false(기본): 앞일치만 — 글자수 무관 즉시. true: 부분일치까지(정밀·느림, "더보기").
//   opts.limit: 반환 개수(기본 15, 정밀검색은 크게).
export async function searchFoods(query, { deep = false, limit = 15 } = {}) {
  const q = (query || '').trim()
  if (!q) return []
  // ① foods 테이블(RPC) — 동의어(연상어)면 정식명으로 치환 검색, 0건이면 원문 폴백
  const alias = aliasOf(q)
  const runRpc = async (term) => {
    const { data, error } = await supabase.rpc('search_foods', { q: term, lim: limit, deep })
    if (error) throw error
    return Array.isArray(data) ? data.map((f) => ({ ...f, basis: 'per100' })) : []
  }
  try {
    let rows = await runRpc(alias || q)
    if (rows.length === 0 && alias) rows = await runRpc(q)   // 별칭 실패 시 원문
    if (rows.length > 0) return rows
  } catch { /* 다음 단계 */ }
  // ② 적재 전/미매칭 — 정부 API 프록시(prefix 한계 있음)
  try {
    const { data, error } = await supabase.functions.invoke('food-search', { body: { q } })
    if (error) throw error
    if (Array.isArray(data?.foods) && data.foods.length > 0) return data.foods.map((f) => ({ ...f, basis: 'per100' }))
  } catch { /* 다음 단계 */ }
  // ③ 최종 폴백
  return searchMock(q)
}

// 검색 실패(0건) 로깅 — 동의어 사전 보강용 데이터. fire-and-forget.
export function logSearchMiss(term) {
  const t = String(term || '').trim()
  if (t.length < 2) return
  try { supabase.rpc('log_search_miss', { p_term: t }) } catch { /* 무시 */ }
}

// 음식 사진 → 인식(음식 + 추정 그램 + 대략 kcal). 엣지함수 food-vision(Gemini) 프록시.
//   반환: [{ name, grams, kcal, confidence }]  — 양은 근사치(사용자가 최종 확정).
export async function recognizeFoodPhoto(imageDataUrl) {
  const { data, error } = await supabase.functions.invoke('food-vision', { body: { image: imageDataUrl } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return Array.isArray(data?.foods) ? data.foods : []
}

// 담을 때 호출 — 인기순(pick_count) 집계. 커스텀(직접입력)/목데이터는 건너뜀. fire-and-forget.
export function recordPick(foodId) {
  const id = String(foodId || '')
  if (!id || id.startsWith('custom')) return
  try { supabase.rpc('increment_food_pick', { p_id: id }) } catch { /* 무시 */ }
}

// ── 내 음식(즐겨찾기·최근) ─────────────────────────────────
//   임시 id(custom-/ai-)는 저장 안 함 — 안정적으로 재현 불가하므로.
const isTransientId = (id) => { const s = String(id || ''); return !s || s.startsWith('custom') || s.startsWith('ai-') }
const foodArgs = (food) => ({
  p_food_id: String(food.id), p_name: food.name, p_maker: food.maker || null,
  p_serving: food.serving || null,
  p_kcal: food.kcal ?? null, p_carb: food.carb ?? null, p_protein: food.protein ?? null, p_fat: food.fat ?? null,
  p_basis: food.basis || null,
})

// user_foods 행 → 담기 가능한 food 객체
export function rowToFood(r) {
  return { id: r.food_id, name: r.name, maker: r.maker, serving: r.serving,
    kcal: r.kcal, carb: r.carb, protein: r.protein, fat: r.fat, basis: r.basis || undefined }
}

// 담을 때: 사용기록(횟수+최근) upsert. fire-and-forget.
export function recordUse(food) {
  if (isTransientId(food?.id)) return
  try { supabase.rpc('touch_food', foodArgs(food)) } catch { /* 무시 */ }
}

// 하트 토글. 성공 여부 반환.
export async function setFavorite(food, on) {
  if (isTransientId(food?.id)) return false
  const { error } = await supabase.rpc('set_food_favorite', { ...foodArgs(food), p_on: !!on })
  return !error
}

// 내 음식 로드 → { favorites, recents }.
//   favorites = ♥ 등록(자주 담은 순), recents = 최근 담은(즐겨찾기 제외, 중복 방지).
export async function getUserFoods() {
  try {
    const { data, error } = await supabase.from('user_foods').select('*')
      .order('last_used_at', { ascending: false }).limit(100)
    if (error) throw error
    const rows = Array.isArray(data) ? data : []
    const favorites = rows.filter((r) => r.favorite)
      .sort((a, b) => (b.use_count - a.use_count) || (new Date(b.last_used_at) - new Date(a.last_used_at)))
    const recents = rows.filter((r) => !r.favorite && r.use_count > 0).slice(0, 20)
    return { favorites, recents }
  } catch { return { favorites: [], recents: [] } }
}

// 음식 기준(basis) 판별.
//   per100 = 정부DB(kcal/탄단지가 100g·100ml당) → 그램 입력(mode:'gram', base=100).
//   그 외(목·직접입력) = 1회 제공량 수치 → 배수 입력(mode:'unit', base=1).
export function foodBasis(food) {
  if (food?.basis === 'per100') {
    const s = String(food.serving || '')
    const m = s.match(/(\d+(?:\.\d+)?)\s*(g|ml|㎖|그램|밀리)/i)
    const base = m ? parseFloat(m[1]) : 100
    const unit = /ml|㎖|밀리/i.test(s) ? 'ml' : 'g'
    return { mode: 'gram', base: base > 0 ? base : 100, unit }
  }
  return { mode: 'unit', base: 1, unit: '' }
}

// 먹은 양(amount) → 반올림 영양치.
//   gram 기준: amount = 그램수 → factor = amount / base(100).
//   unit 기준: amount = 배수 → factor = amount.
export function computeNutrients(food, amount) {
  const b = foodBasis(food)
  const factor = b.mode === 'gram' ? (Number(amount) || 0) / b.base : (Number(amount) || 0)
  const r = (n) => Math.round((Number(n) || 0) * factor)
  return { kcal: r(food.kcal), carb: r(food.carb), protein: r(food.protein), fat: r(food.fat) }
}

// 담을 때 기본 양 — gram 기준=base(100g), unit 기준=1(1회분)
export function defaultAmount(food) {
  const b = foodBasis(food)
  return b.mode === 'gram' ? b.base : 1
}

// (구) 배수 스케일 — 하위호환 유지
export function scaleNutrients(food, qty) {
  const r = (n) => Math.round((Number(n) || 0) * qty)
  return { kcal: r(food.kcal), carb: r(food.carb), protein: r(food.protein), fat: r(food.fat) }
}
