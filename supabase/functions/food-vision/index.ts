// food-vision — 음식 사진 → 멀티모달 LLM(Gemini)로 음식·추정 그램·대략 칼로리 인식.
//   목적: 사진 1장에서 "무슨 음식 + 대략 몇 g + 대략 kcal" 후보를 뽑아 로거에 프리필.
//         (정확한 영양치는 클라에서 우리 foods DB 매칭으로 보정. LLM은 인식+양 추정만.)
//   요청(POST): { image: string(base64, data:URL 접두 있어도 OK), mimeType?: string }
//   응답: { foods: [{ name, grams, kcal, confidence }] }  또는 { foods: [], error }
//
//   시크릿(Edge Function secrets):
//     GEMINI_API_KEY = Google AI Studio 키 (무료 티어)
//     GEMINI_MODELS  = (선택) 폴백 순서 쉼표구분. 기본 'gemini-flash-latest,gemini-flash-lite-latest'
//                      (앞 모델이 404(세대교체)/503(과부하)면 다음 모델로 자동 폴백)
//
//   ⚠️ 양(그램)은 근사치 — 사진만으론 스케일을 모름. 사용자가 최종 그램 확정하는 하이브리드 전제.

const API_KEY = (Deno.env.get('GEMINI_API_KEY') ?? '').trim()
const MODELS = (Deno.env.get('GEMINI_MODELS') ?? 'gemini-flash-latest,gemini-flash-lite-latest')
  .split(',').map((s) => s.trim()).filter(Boolean)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PROMPT = [
  '이 사진은 한 사람이 먹는(먹으려는) 음식입니다.',
  '보이는 음식·음료를 각각 한국어 일반 명칭으로 식별하세요(브랜드보다 일반명 우선, 예: "닭가슴살", "흰쌀밥", "아메리카노").',
  '각 항목의 1회 섭취량을 그램(음료는 ml를 g로 간주)으로 현실적으로 추정하세요 — 접시·식기·손 크기를 단서로.',
  '각 항목의 대략 칼로리도 추정하세요.',
  '확신도(confidence)는 high/mid/low 중 하나. 잘 안 보이거나 애매하면 low.',
  '음식이 아니면 빈 배열. 추측성 항목은 넣지 마세요.',
].join(' ')

const SCHEMA = {
  type: 'object',
  properties: {
    foods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'mid', 'low'] },
        },
        required: ['name', 'grams'],
      },
    },
  },
  required: ['foods'],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    if (!API_KEY) return json({ foods: [], error: 'not_configured' })
    const body = await req.json().catch(() => ({}))
    let image = String(body.image ?? '')
    if (!image) return json({ foods: [], error: 'no_image' })
    // data:URL 접두 제거 + mime 추출
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
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: SCHEMA,
      },
    }
    // 모델 폴백 — 404(세대교체)/503(과부하)/429(레이트)면 다음 모델로
    let data: Record<string, unknown> | null = null
    let lastErr = ''
    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(API_KEY)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) { data = await res.json(); break }
      lastErr = `gemini_${res.status}`
      const retryable = res.status === 404 || res.status === 503 || res.status === 429
      const t = await res.text().catch(() => '')
      if (!retryable) return json({ foods: [], error: lastErr, detail: t.slice(0, 300) }, 200)
    }
    if (!data) return json({ foods: [], error: lastErr || 'no_model' }, 200)
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    let parsed: { foods?: unknown[] } = {}
    try { parsed = JSON.parse(text) } catch { return json({ foods: [], error: 'parse_failed', raw: text.slice(0, 300) }, 200) }

    const foods = (Array.isArray(parsed.foods) ? parsed.foods : [])
      .map((f) => {
        const o = f as Record<string, unknown>
        const name = String(o.name ?? '').trim()
        if (!name) return null
        return {
          name,
          grams: Math.max(0, Math.round(Number(o.grams) || 0)),
          kcal: Math.max(0, Math.round(Number(o.kcal) || 0)),
          confidence: ['high', 'mid', 'low'].includes(String(o.confidence)) ? String(o.confidence) : 'mid',
        }
      })
      .filter(Boolean)
      .slice(0, 12)

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
