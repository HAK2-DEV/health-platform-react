// activity-screenshot — 운동 기록 앱 스크린샷 → 멀티모달 LLM(Gemini)로 운동 요약 추출.
//   목적: 나이키런/삼성헬스/스트라바/애플건강/런데이 등 캡처를 올리면 미션의 거리·시간 등을 자동 입력.
//   요청(POST): { image: string(base64, data:URL 접두 OK), mimeType?: string }
//   응답: { ok, data?: { distance_km, duration_sec, pace_sec_per_km, kcal, steps, confidence }, error? }
//
//   시크릿: GEMINI_API_KEY / GEMINI_MODELS (food-vision 과 공유).

const API_KEY = (Deno.env.get('GEMINI_API_KEY') ?? '').trim()
// 이 함수(운동 스크린샷 OCR)는 속도 우선 → flash-lite 를 항상 1순위. 공유 시크릿(GEMINI_MODELS)이
//   flash 먼저로 설정돼 있어도 lite 를 앞에 끼워넣어 우선 시도(나머지는 폴백).
const _RAW = (Deno.env.get('GEMINI_MODELS') ?? 'gemini-flash-lite-latest,gemini-flash-latest')
  .split(',').map((s) => s.trim()).filter(Boolean)
const MODELS = [...new Set(['gemini-flash-lite-latest', ..._RAW])]
// 한 모델이 매달리면 60초씩 기다리지 않고 끊고 다음 모델로 — 클라 무한 스피너 방지.
const MODEL_TIMEOUT_MS = 20000

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PROMPT = [
  '당신은 운동 기록 앱 스크린샷을 정확히 읽는 판독기입니다.',
  '나이키 런 클럽, 삼성 헬스, 스트라바, 애플 건강/피트니스, 런데이, 런키퍼, 가민 등 어떤 앱이든 대응하세요.',
  '한 번의 운동(러닝/걷기) 요약에서 값을 읽어 바로 채우세요: 거리, 총 시간, 평균 페이스, 칼로리, 걸음수. 설명 없이 값만.',
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
    distance_km: { type: 'number' },
    duration_sec: { type: 'number' },
    pace_sec_per_km: { type: 'number' },
    kcal: { type: 'number' },
    steps: { type: 'number' },
    confidence: { type: 'string', enum: ['high', 'mid', 'low'] },
  },
  propertyOrdering: ['distance_km', 'duration_sec', 'pace_sec_per_km', 'kcal', 'steps', 'confidence'],
  required: ['distance_km', 'duration_sec', 'confidence'],
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
        // 속도: reasoning 필드 제거 + flash-lite 우선(사고 기본 OFF). thinkingConfig 는 일부
        //   모델 별칭이 400 을 뱉어(=사진 못 읽음) 넣지 않음. maxOutputTokens 는 '상한'이라 넉넉히.
        responseMimeType: 'application/json', responseSchema: SCHEMA, maxOutputTokens: 1024,
      },
    }
    let data: Record<string, unknown> | null = null
    let lastErr = ''
    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(API_KEY)}`
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(), MODEL_TIMEOUT_MS)
      let res: Response
      try {
        res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ac.signal })
      } catch (e) {
        // 타임아웃(abort)·네트워크 오류 → 매달리지 말고 다음 모델로.
        lastErr = ac.signal.aborted ? 'gemini_timeout' : `gemini_fetch_${String((e as Error)?.name || 'err')}`
        continue
      } finally {
        clearTimeout(timer)
      }
      if (res.ok) { data = await res.json(); break }
      lastErr = `gemini_${res.status}`
      // 400 포함 폴백 — 한 모델이 인자를 거부(400)해도 다음 모델(검증된 flash)로 넘어가 응답 보장.
      const retryable = res.status === 400 || res.status === 404 || res.status === 503 || res.status === 429
      const t = await res.text().catch(() => '')
      lastErr = `gemini_${res.status}${t ? ':' + t.slice(0, 120) : ''}`
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
