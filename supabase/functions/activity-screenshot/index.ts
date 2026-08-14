// activity-screenshot — 운동 기록 앱 스크린샷 → 멀티모달 LLM(Gemini)로 운동 요약 추출.
//   목적: 나이키런/삼성헬스/스트라바/애플건강/런데이 등 캡처를 올리면 미션의 거리·시간 등을 자동 입력.
//   요청(POST): { image: string(base64, data:URL 접두 OK), mimeType?: string }
//   응답: { ok, data?: { distance_km, duration_sec, pace_sec_per_km, kcal, steps, confidence }, error? }
//
//   시크릿: GEMINI_API_KEY / GEMINI_MODELS (food-vision 과 공유).

const API_KEY = (Deno.env.get('GEMINI_API_KEY') ?? '').trim()
const MODELS = (Deno.env.get('GEMINI_MODELS') ?? 'gemini-flash-latest,gemini-flash-lite-latest')
  .split(',').map((s) => s.trim()).filter(Boolean)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PROMPT = [
  '당신은 운동 기록 앱 스크린샷을 정확히 읽는 판독기입니다.',
  '나이키 런 클럽, 삼성 헬스, 스트라바, 애플 건강/피트니스, 런데이, 런키퍼, 가민 등 어떤 앱이든 대응하세요.',
  '',
  '[판독 절차] reasoning 에 먼저 서술한 뒤 값을 채우세요:',
  '1) 어떤 앱/화면인지, 요약 수치들이 어디에 있는지 파악.',
  '2) 한 번의 운동(러닝/걷기) 요약에서 값을 읽는다: 거리, 총 시간, 평균 페이스, 칼로리, 걸음수.',
  '',
  '[출력 규칙]',
  '- distance_km: 거리(km). 마일(mi) 표기면 km 로 환산(1mi=1.609km).',
  '- duration_sec: 총 운동 시간을 "초"로 (예: 32분 5초 → 1925).',
  '- pace_sec_per_km: 평균 페이스를 "km당 초"로 (예: 6\'20"/km → 380). 없으면 0.',
  '- kcal: 소모 칼로리(숫자). steps: 걸음수(숫자). 없으면 0.',
  '- 숫자만(단위 제외), 반올림 정수. 화면에 없으면 0.',
  '- 운동 요약이 아닌 사진이면 confidence=low, 값 0.',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    reasoning: { type: 'string' },
    distance_km: { type: 'number' },
    duration_sec: { type: 'number' },
    pace_sec_per_km: { type: 'number' },
    kcal: { type: 'number' },
    steps: { type: 'number' },
    confidence: { type: 'string', enum: ['high', 'mid', 'low'] },
  },
  propertyOrdering: ['reasoning', 'distance_km', 'duration_sec', 'pace_sec_per_km', 'kcal', 'steps', 'confidence'],
  required: ['reasoning', 'distance_km', 'duration_sec', 'confidence'],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (!API_KEY) return json({ ok: false, error: 'not_configured' })
    const body = await req.json().catch(() => ({}))
    let image = String(body.image ?? '')
    if (!image) return json({ ok: false, error: 'no_image' })
    let mimeType = String(body.mimeType ?? 'image/jpeg')
    const m = image.match(/^data:(.+?);base64,(.*)$/s)
    if (m) { mimeType = m[1]; image = m[2] }

    const payload = {
      contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: image } }, { text: PROMPT }] }],
      generationConfig: {
        temperature: 0, seed: 7,
        responseMimeType: 'application/json', responseSchema: SCHEMA, maxOutputTokens: 1200,
      },
    }
    let data: Record<string, unknown> | null = null
    let lastErr = ''
    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(API_KEY)}`
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) { data = await res.json(); break }
      lastErr = `gemini_${res.status}`
      const retryable = res.status === 404 || res.status === 503 || res.status === 429
      const t = await res.text().catch(() => '')
      if (!retryable) return json({ ok: false, error: lastErr, detail: t.slice(0, 300) })
    }
    if (!data) return json({ ok: false, error: lastErr || 'no_model' })
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(text) } catch { return json({ ok: false, error: 'parse_failed', raw: text.slice(0, 300) }) }

    const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0))
    const out = {
      distance_km: Math.max(0, Math.round((Number(parsed.distance_km) || 0) * 100) / 100),
      duration_sec: num(parsed.duration_sec),
      pace_sec_per_km: num(parsed.pace_sec_per_km),
      kcal: num(parsed.kcal),
      steps: num(parsed.steps),
      confidence: ['high', 'mid', 'low'].includes(String(parsed.confidence)) ? String(parsed.confidence) : 'mid',
    }
    return json({ ok: true, data: out })
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
