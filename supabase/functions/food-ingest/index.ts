// food-ingest — 정부 통합식품영양성분(3종) → public.foods 적재(재개 가능 배치).
//   요청(POST): { token, epIndex, page, pages? }
//     token   = INGEST_TOKEN 시크릿과 일치해야 함(무단 트리거 방지)
//     epIndex = 0(음식) | 1(가공식품) | 2(원재료성)  (FOOD_ENDPOINTS 순서)
//     page    = 시작 페이지(1-base), pages = 이번 호출에서 처리할 페이지 수(기본 20)
//   응답: { epIndex, from, to, upserted, totalCount, nextPage, done }
//   1페이지=1000행. service role(SUPABASE_SERVICE_ROLE_KEY)로 PostgREST upsert(merge-duplicates).

const KEY = (Deno.env.get('FOOD_API_KEY') ?? '').trim()
const ENDPOINTS = (Deno.env.get('FOOD_ENDPOINTS') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const INGEST_TOKEN = Deno.env.get('INGEST_TOKEN') ?? ''
const SB_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ROWS = 1000

const keyParam = () => (KEY.includes('%') ? KEY : encodeURIComponent(KEY))
const pick = (r: Record<string, unknown>, k: string) => (r[k] != null && r[k] !== '' ? String(r[k]) : '')
const num = (s: string) => { const n = parseFloat((s || '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? Math.round(n) : null }
const num2 = (s: string) => { const n = parseFloat((s || '').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null }  // 소수 2자리 보존(그램 영양소)

async function fetchPage(ep: string, page: number) {
  const url = `${ep}?serviceKey=${keyParam()}&pageNo=${page}&numOfRows=${ROWS}&type=json`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return { rows: [], total: 0 }
  const j = await res.json()
  const body = j?.body ?? {}
  let items = body?.items?.item
  if (!items) items = []
  if (!Array.isArray(items)) items = [items]
  return { rows: items as Record<string, unknown>[], total: Number(body?.totalCount) || 0 }
}

function mapRow(r: Record<string, unknown>) {
  const id = pick(r, 'foodCd')
  const name = pick(r, 'foodNm')
  if (!id || !name) return null
  let maker: string | null = pick(r, 'mfrNm') || pick(r, 'restNm') || ''
  if (maker === '해당없음' || maker === '없음' || maker === '') maker = null
  return {
    id, name, maker,
    type_nm: pick(r, 'typeNm') || null,
    serving: pick(r, 'nutConSrtrQua') || null,
    food_size: pick(r, 'foodSize') || null,
    kcal: num(pick(r, 'enerc')),
    carb: num(pick(r, 'chocdf')),
    protein: num(pick(r, 'prot')),
    fat: num(pick(r, 'fatce')),
    sodium: num(pick(r, 'nat')),
    sugar: num2(pick(r, 'sugar')),        // 당류(g)
    sat_fat: num2(pick(r, 'fasat')),      // 포화지방(g)
    trans_fat: num2(pick(r, 'fatrn')),    // 트랜스지방(g)
    cholesterol: num(pick(r, 'chole')),   // 콜레스테롤(mg)
    fiber: num2(pick(r, 'fibtg')),        // 식이섬유(g)
  }
}

async function upsert(rows: unknown[]) {
  if (rows.length === 0) return
  const res = await fetch(`${SB_URL}/rest/v1/foods?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: SB_SERVICE,
      Authorization: `Bearer ${SB_SERVICE}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`upsert ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

Deno.serve(async (req) => {
  try {
    const b = await req.json().catch(() => ({}))
    if (!INGEST_TOKEN || b.token !== INGEST_TOKEN) return json({ error: 'unauthorized' }, 401)
    const epIndex = Number(b.epIndex ?? 0)
    const startPage = Math.max(1, Number(b.page ?? 1))
    const pages = Math.max(1, Math.min(40, Number(b.pages ?? 20)))
    const ep = ENDPOINTS[epIndex]
    if (!ep) return json({ error: 'bad epIndex' }, 400)

    // 디버그 — 원본 응답 첫 행의 키/값 반환(적재 안 함). 필드키 확인용.
    if (b.debug) {
      const { rows } = await fetchPage(ep, startPage)
      const first = (rows[0] ?? {}) as Record<string, unknown>
      return json({ epIndex, keys: Object.keys(first), sample: first })
    }

    let upserted = 0, total = 0, page = startPage
    for (let i = 0; i < pages; i++) {
      const { rows, total: t } = await fetchPage(ep, page)
      total = t || total
      if (rows.length === 0) break
      const mapped = rows.map(mapRow).filter(Boolean)
      // 같은 배치 내 id 중복 제거(upsert on_conflict 안전)
      const uniq = Array.from(new Map(mapped.map((m) => [(m as { id: string }).id, m])).values())
      await upsert(uniq)
      upserted += uniq.length
      page++
      if (total && (page - 1) * ROWS >= total) break   // 마지막 페이지 처리 완료
    }
    const done = total > 0 && (page - 1) * ROWS >= total
    return json({ epIndex, from: startPage, to: page - 1, upserted, totalCount: total, nextPage: page, done })
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
