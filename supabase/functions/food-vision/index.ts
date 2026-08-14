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
  '당신은 꼼꼼한 임상영양사입니다. 사진 속 사람이 먹는(먹으려는) 음식의 양을 신중히 추정하세요.',
  '',
  '[추론 절차] reasoning 필드에 아래를 먼저 서술한 뒤 foods를 채우세요:',
  '1) 스케일 기준 잡기 — 사진 속 기준물의 실제 크기로 음식 크기를 보정.',
  '   기준물 예: 숟가락 길이~15cm, 젓가락~23cm, 밥공기 지름~11.5cm·높이~5.5cm, 종이컵~200ml, 신용카드~8.6cm, 성인 손 한 뼘~18cm.',
  '2) 각 음식의 부피를 어림하고, 음식 밀도로 그램을 환산.',
  '3) 한국 표준 1인분과 교차검증.',
  '',
  '[한국 표준 1인분 참고]',
  '공기밥 1공기≈210g, 국·찌개 1대접≈350g, 김치 1접시≈40g, 구이 고기 1인분≈150~200g,',
  '라면 1봉(조리후)≈550g, 우유 1잔≈200ml, 계란 1개≈50g, 바나나 1개≈120g, 사과 1개≈240g, 식빵 1장≈35g.',
  '',
  '[출력 규칙]',
  '- 음식·음료는 한국어 일반 명칭으로(브랜드보다 일반명: "닭가슴살", "흰쌀밥", "아메리카노").',
  '- grams: 1회 섭취량(음료 ml는 g로 간주). portion: 사람이 이해할 표현("밥 1공기", "약 반 접시").',
  '- kcal: 대략 칼로리. confidence: high/mid/low (안 보이거나 애매하면 low).',
  '- 접시에 실제 보이는 것만. 추측으로 항목을 늘리지 말 것. 음식이 없으면 foods는 빈 배열.',
].join('\n')

const SCHEMA = {
  type: 'object',
  properties: {
    reasoning: { type: 'string' },   // 먼저 스케일·판단 근거를 서술 → 이후 숫자가 정확해짐
    foods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          portion: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'mid', 'low'] },
        },
        propertyOrdering: ['name', 'portion', 'grams', 'kcal', 'confidence'],
        required: ['name', 'grams'],
      },
    },
  },
  propertyOrdering: ['reasoning', 'foods'],   // reasoning 을 반드시 먼저 생성(think-then-answer)
  required: ['reasoning', 'foods'],
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
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: SCHEMA,
        maxOutputTokens: 1400,
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
          portion: String(o.portion ?? '').trim(),
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
