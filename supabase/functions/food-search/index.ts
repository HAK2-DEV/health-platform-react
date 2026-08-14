// food-search — 식품영양성분 검색 프록시 (data.go.kr 「전국통합식품영양성분정보」)
//   목적: 정부 API 를 서버에서 호출(CORS 우회 + 서비스키 숨김) → 우리 앱 형태로 매핑해 반환.
//   요청(POST): { q: string }  → 응답: { foods: [{ id, name, serving, kcal, carb, protein, fat }] }
//
//   시크릿(Edge Function secrets, 대시보드에서 설정):
//     FOOD_API_KEY   = data.go.kr 서비스키 **Decoding(디코딩) 값** (%2F 없는 원문)
//     FOOD_ENDPOINTS = 3개 데이터셋 엔드포인트 URL 을 쉼표(,)로 구분
//                      (전국통합식품영양성분정보 음식/가공식품/원재료성식품 — serviceKey 없이 base URL만)
//   표준데이터는 odcloud(api.odcloud.kr) 규격 가정:
//     GET {endpoint}?serviceKey=..&page=1&perPage=..&cond[식품명::LIKE]={q}
//     응답 { data: [ { "식품명":.., "에너지(kcal)":.., "탄수화물(g)":.., ... } ] }

const KEY = Deno.env.get('FOOD_API_KEY') ?? ''
const ENDPOINTS = (Deno.env.get('FOOD_ENDPOINTS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const PER = 12   // 데이터셋당 최대 결과

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 여러 후보 키 중 첫 값 (odcloud 는 컬럼명이 곧 키)
function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return String(row[k])
  }
  return ''
}
const num = (s: string) => {
  const n = parseFloat((s || '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? Math.round(n) : 0
}

async function queryEndpoint(base: string, q: string) {
  const sep = base.includes('?') ? '&' : '?'
  const url = `${base}${sep}serviceKey=${encodeURIComponent(KEY)}&page=1&perPage=${PER}`
    + `&cond[식품명::LIKE]=${encodeURIComponent(q)}`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const json = await res.json()
    const rows: Record<string, unknown>[] = Array.isArray(json?.data) ? json.data
      : Array.isArray(json?.items) ? json.items : []
    return rows
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
    const seen = new Set<string>()
    const foods: unknown[] = []
    for (const rows of batches) {
      for (const row of rows) {
        const name = pick(row, ['식품명', 'FOOD_NM_KR'])
        if (!name) continue
        const basis = pick(row, ['영양성분함량기준량', '영양성분함량 기준량'])
        const weight = pick(row, ['식품중량', '1회 섭취참고량', '1회섭취참고량'])
        const id = pick(row, ['식품코드', 'FOOD_CD']) || name
        const dedup = `${name}|${id}`
        if (seen.has(dedup)) continue
        seen.add(dedup)
        foods.push({
          id,
          name,
          serving: weight || basis || '1회 제공량',
          kcal: num(pick(row, ['에너지(kcal)', '에너지', 'AMT_NUM1'])),
          carb: num(pick(row, ['탄수화물(g)', '탄수화물'])),
          protein: num(pick(row, ['단백질(g)', '단백질'])),
          fat: num(pick(row, ['지방(g)', '지방'])),
        })
        if (foods.length >= 20) break
      }
      if (foods.length >= 20) break
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
