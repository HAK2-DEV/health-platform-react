// health-indicators — 국립암센터 암모니터링 지표 프록시 (data.go.kr B551172)
//   목적: 정부 API 를 서버에서 호출(CORS 우회 + 서비스키 숨김) → 앱 리포트의 '전국 평균 참고선'.
//   요청(POST): { indicator: 'smoking' }
//   응답: { indicator, label, unit, year, series: [{ name, value }], source } (성인 전체/남/여 최신 연도)
//
//   시크릿(Edge Function secrets, 대시보드/CLI):
//     HEALTH_DATA_API_KEY = data.go.kr 서비스키 (Encoding/Decoding 어느 쪽이든 OK — 아래서 자동 처리)

const KEY = (Deno.env.get('HEALTH_DATA_API_KEY') ?? '').trim()

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// 키가 이미 인코딩(%포함)이면 그대로, 아니면 인코딩 — 어느 쪽 저장이든 동작
const keyParam = () => (KEY.includes('%') ? KEY : encodeURIComponent(KEY))
const get = (row: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) if (row[k] != null && row[k] !== '') return String(row[k])
  return ''
}

// indicator → 국립암센터 서비스/오퍼레이션/라벨 (음주·비만은 승인 후 추가)
const SPECS: Record<string, { path: string; op: string; label: string }> = {
  smoking: { path: 'getPreventSmoking', op: 'TotalAdultSmokingTrend', label: '성인 현재흡연율' },
}

async function fetchOp(path: string, op: string) {
  const url = `https://apis.data.go.kr/B551172/${path}/${op}`
    + `?serviceKey=${keyParam()}&region=A&resultType=json&pageNo=1&numOfRows=1000`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return []
  const b = await res.json().catch(() => null)
  // 응답 래핑이 문서상 items / Items / body.items.item 로 제각각 → 모두 대응
  let items = b?.items ?? b?.Items ?? b?.body?.items?.item ?? []
  if (!Array.isArray(items)) items = items ? [items] : []
  return items as Record<string, unknown>[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { indicator } = await req.json().catch(() => ({ indicator: '' }))
    const spec = SPECS[String(indicator || '')]
    if (!spec) return json({ error: 'unknown_indicator' }, 400)
    if (!KEY) return json({ indicator, series: [], error: 'not_configured' })

    const items = await fetchOp(spec.path, spec.op)
    if (!items.length) return json({ indicator, series: [], error: 'no_data' })

    // 시리즈(전체/남/여)별로 각자 최신 연도의 값 추출 (연도가 시리즈마다 다를 수 있음)
    const wanted = ['전체', '남자', '여자']
    const series = wanted
      .map((name) => {
        const rows = items.filter((it) => get(it, ['SERIESNAME', 'seriesname']).trim() === name)
        let best = null
        for (const r of rows) {
          const y = parseInt(get(r, ['YEAR', 'year']), 10)
          const v = parseFloat(get(r, ['VALUE', 'value']))
          if (Number.isFinite(y) && Number.isFinite(v) && (!best || y > best.year)) best = { name, value: v, year: y }
        }
        return best
      })
      .filter(Boolean)
    const year = series.reduce((m, s) => Math.max(m, s.year), 0)

    return json({ indicator, label: spec.label, unit: '%', year, series, source: '국립암센터 국가암데이터센터' })
  } catch (e) {
    return json({ series: [], error: String(e) })
  }
})
