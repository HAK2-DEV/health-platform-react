// nutrition-label — 식품 「영양성분표」 사진 → 멀티모달 LLM(Gemini)로 영양정보 구조화 추출.
//   목적: 가공식품 라벨을 찍으면 등록 폼(제공량/열량/탄단지)을 자동 채움.
//   요청(POST): { image: string(base64, data:URL 접두 OK), mimeType?: string }
//   응답: { ok: bool, data?: { serving_g, kcal, carb, protein, fat, sodium, sugar, confidence }, error? }
//
//   시크릿: GEMINI_API_KEY / GEMINI_MODELS (food-vision 과 공유).
//   ⚠️ 라벨이 「1회 제공량」과 「100g당」을 함께 표기하면 1회 제공량 열을 우선.

const API_KEY = (Deno.env.get('GEMINI_API_KEY') ?? '').trim()
const MODELS = (Deno.env.get('GEMINI_MODELS') ?? 'gemini-flash-latest,gemini-flash-lite-latest')
  .split(',').map((s) => s.trim()).filter(Boolean)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PROMPT = [
  '당신은 한국 식품 「영양성분표」를 정확히 읽는 판독기입니다. 사진의 표에서 수치를 추출하세요.',
  '',
  '[판독 절차] reasoning 에 먼저 서술한 뒤 값을 채우세요:',
  '1) 기준량 파악 — 표의 기준이 "1회 제공량 N g(ml)", "총 내용량 N g", "100g(ml)당" 중 무엇인지.',
  '   · 「1회 제공량」이 있으면 그 열의 값을 사용(serving_g = 그 제공량의 그램/ml 수).',
  '   · 1회 제공량이 없고 총 내용량만 있으면 그 값을 사용.',
  '   · 100g당만 있으면 serving_g = 100.',
  '2) 그 기준량에 해당하는 값을 읽는다: 열량(kcal), 탄수화물(g), 단백질(g), 지방(g), 나트륨(mg), 당류(g).',
  '',
  '[출력 규칙]',
  '- 숫자 필드는 숫자만(단위 제외). 소수점 표기는 반올림 정수로.',
  '- 표에서 안 보이거나 없는 값은 0.',
  '- % 영양성분 기준치(퍼센트) 는 무시하고 실제 함량(g/mg/kcal)만 읽는다.',
  '- 영양성분표가 사진에 없으면 confidence=low, 값은 0.',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    reasoning: { type: 'string' },
    serving_g: { type: 'number' },
    kcal: { type: 'number' },
    carb: { type: 'number' },
    protein: { type: 'number' },
    fat: { type: 'number' },
    sodium: { type: 'number' },
    sugar: { type: 'number' },
    confidence: { type: 'string', enum: ['high', 'mid', 'low'] },
  },
  propertyOrdering: ['reasoning', 'serving_g', 'kcal', 'carb', 'protein', 'fat', 'sodium', 'sugar', 'confidence'],
  required: ['reasoning', 'serving_g', 'kcal', 'carb', 'protein', 'fat', 'confidence'],
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
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: image } },
          { text: PROMPT },
        ],
      }],
      generationConfig: {
        temperature: 0,
        seed: 7,
        responseMimeType: 'application/json',
        responseSchema: SCHEMA,
        maxOutputTokens: 1200,
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
      serving_g: Math.max(1, num(parsed.serving_g) || 100),
      kcal: num(parsed.kcal),
      carb: num(parsed.carb),
      protein: num(parsed.protein),
      fat: num(parsed.fat),
      sodium: num(parsed.sodium),
      sugar: num(parsed.sugar),
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
