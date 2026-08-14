// food-search — 식품영양성분 검색 프록시 (data.go.kr 「전국통합식품영양성분정보」 tn_pubr_public API)
//   목적: 정부 API 를 서버에서 호출(CORS 우회 + 서비스키 숨김) → 우리 앱 형태로 매핑해 반환.
//   요청(POST): { q: string }  → 응답: { foods: [{ id, name, serving, kcal, carb, protein, fat }] }
//
//   시크릿(Edge Function secrets, 대시보드에서 설정):
//     FOOD_API_KEY   = data.go.kr 서비스키 (Encoding/Decoding 어느 쪽이든 OK — 아래서 자동 처리)
//     FOOD_ENDPOINTS = 데이터셋 엔드포인트 URL 을 쉼표(,)로 (지금은 음식 1개, 나중에 가공식품/원재료성 추가)
//       예) https://api.data.go.kr/openapi/tn_pubr_public_nutri_food_info_api
//
//   실제 응답 형식(확인됨): { body: { items: { item: [ { foodNm, enerc, chocdf, prot, fatce, nat,
//     nutConSrtrQua, foodSize, foodCd, ... } ] }, totalCount } }.  영양치는 nutConSrtrQua(보통 100g) 기준.

const KEY = (Deno.env.get('FOOD_API_KEY') ?? '').trim()   // 저장 시 딸려온 공백/개행 제거
const ENDPOINTS = (Deno.env.get('FOOD_ENDPOINTS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const PER = 20   // 데이터셋당 최대 결과

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 키가 이미 인코딩(%포함)이면 그대로, 아니면 인코딩 — 어느 쪽 저장이든 동작
const keyParam = () => (KEY.includes('%') ? KEY : encodeURIComponent(KEY))

const pick = (row: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) if (row[k] != null && row[k] !== '') return String(row[k])
  return ''
}
const num = (s: string) => {
  const n = parseFloat((s || '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? Math.round(n) : 0
}

async function queryEndpoint(base: string, q: string) {
  const sep = base.includes('?') ? '&' : '?'
  const url = `${base}${sep}serviceKey=${keyParam()}&pageNo=1&numOfRows=${PER}&type=json`
    + `&foodNm=${encodeURIComponent(q)}`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const jsonBody = await res.json()
    let items = jsonBody?.body?.items?.item
    if (!items) return []
    if (!Array.isArray(items)) items = [items]   // 결과 1건이면 객체 → 배열화
    return items as Record<string, unknown>[]
  } catch {
    return []
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { q } = await req.json().catch(() => ({ q: '' }))
    const query = String(q || '').trim()
    if (!query) return json({ foods: [] })
    if (!KEY || ENDPOINTS.length === 0) return json({ foods: [], error: 'not_configured' })

    const batches = await Promise.all(ENDPOINTS.map((ep) => queryEndpoint(ep, query)))
    const seen = new Set<string>()   // 이름+칼로리 동일한 것만 중복 제거(값 다르면 다 보임)
    const foods: unknown[] = []
    for (const rows of batches) {
      for (const row of rows) {
        const name = pick(row, ['foodNm', '식품명'])
        if (!name) continue
        const kcal = num(pick(row, ['enerc', '에너지(kcal)']))
        // 제조사(브랜드) — 가공식품 제품 구분용. '해당없음'/빈값은 제외.
        let maker = pick(row, ['mfrNm', '제조사명']) || pick(row, ['restNm', '업체명']) || ''
        if (maker === '해당없음' || maker === '없음') maker = ''
        const dedup = `${name}|${maker}|${kcal}`
        if (seen.has(dedup)) continue
        seen.add(dedup)
        foods.push({
          id: pick(row, ['foodCd', '식품코드']) || `${name}-${maker}-${kcal}`,
          name,
          maker,
          serving: pick(row, ['nutConSrtrQua', '영양성분함량기준량']) || '100g',
          kcal,
          carb: num(pick(row, ['chocdf', '탄수화물(g)'])),
          protein: num(pick(row, ['prot', '단백질(g)'])),
          fat: num(pick(row, ['fatce', '지방(g)'])),
        })
        if (foods.length >= 30) break
      }
      if (foods.length >= 30) break
    }
    return json({ foods })
  } catch (e) {
    return json({ foods: [], error: String((e as Error)?.message || e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
