// program-draft — 「AI와 함께 만들기」 서버(기능 단계 1, 2026-10-09). 규칙·프롬프트·규칙 엔진은 core.ts.
//   요청(POST, 로그인 사용자만):
//     { action: 'draft', blueprint: Blueprint }
//        → { draft: Draft, engine, reason? }   (프리셋 객체 + 화면 표시 + 검사. DB 에는 아무것도 쓰지 않는다 — 만들기는 클라이언트가 확인 뒤에)
//     { action: 'read_plan', file: string(base64, data:URL 접두 OK), mimeType?: string }   ← 유료 플랜 전용
//        → { plan } | { error: 'plan_requires_subscription' }
//
//   ⭐ 엔진 고르기(본인 2026-10-09 「무료로 가자, 계획서 읽기는 유료 플랜」):
//     · 아는 목표 8개 → 자체 규칙 엔진(AI 호출 없음 — 즉시·무료·실패 없음)
//     · 처음 보는 목표 → AI(무료 키). 보내는 건 설계도뿐(forFreeAI — 처음 적은 문장·기관 이름·계획서 내용 제외).
//       AI 를 쓸 수 없으면 기본 틀(fallbackModel)로라도 짠다 — 실패 화면 대신 「다듬어 주세요」.
//     · 계획서 → 유료 플랜에서만, 그리고 «유료 키»로만(GEMINI_PAID_API_KEY). 무료 키는 보낸 내용이 학습·사람 검토에 쓰일 수 있어
//       기관 문서를 보내면 화면 약속(「만드는 데만 쓰고 지워요」)을 어긴다. 유료 키가 없으면 PLAN_READ_ENABLED 를 켜도 열리지 않고,
//       구독 확인(isPlanSubscriber)이 생기기 전엔 켜도 아무도 통과하지 못한다(클라이언트가 source:'plan' 을 보내 유료 키를 쓰는 길 차단).
//
//   🔒 출시 전 — AI 경로는 관리자(users.role='ADMIN')만(리뷰 2026-10-10). 이유:
//     같은 무료 Gemini 키를 참여자 기능(운동 캡처 자동 입력·식단 사진·영양 성분표)이 함께 쓴다. 로그인한 아무 계정이나 이 함수를
//     반복해 부르면 참여자 기능이 한도 초과로 멈춘다. 아래 하루 상한은 인스턴스 메모리라 워커가 바뀔 때마다 비워져 실제로는 거의 안 걸린다.
//     출시 때: DB 하루 카운터(예: ai_usage + 서비스롤 RPC) + program-draft 전용 Gemini 키로 바꾸고 DRAFT_AI_OPEN=1.
//     관리자가 아니면 AI 대신 기본 틀(reason: 'ai_locked'). 규칙 엔진(아는 목표)은 AI 를 안 써서 누구나.
//
//   시크릿: GEMINI_API_KEY(무료, food-vision 과 같은 키) · GEMINI_DRAFT_MODELS(선택) · DRAFT_AI_OPEN(출시 때 '1')
//           GEMINI_PAID_API_KEY + PLAN_READ_ENABLED='1' (유료 플랜 열 때만)
//   ⚠️ 비용 보호: 익명 키로는 못 부른다(getUserId), 분당 6회 + AI 를 부르는 요청만 인스턴스별 하루 30회(대략, 위 설명대로 순간 폭주 방지용).
//   ⚠️ 설계도는 sanitizeBlueprint 로 길이·형식을 먼저 정리한다(긴 글로 프롬프트를 키우거나 검사 정규식을 오래 돌리는 것 방지).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { getUserId, unauthorized, rateLimited, tooManyRequests } from '../_shared/auth.ts'
import { callGemini, draftPayload, planPayload, finalizeDraft, finalizePlan, canUseRules, ruleDraft, fallbackModel, forFreeAI, sanitizeBlueprint, type ModelDraft } from './core.ts'

const FREE_KEY = (Deno.env.get('GEMINI_API_KEY') ?? '').trim()
const PAID_KEY = (Deno.env.get('GEMINI_PAID_API_KEY') ?? '').trim()
const PLAN_READ_ENABLED = !!PAID_KEY && Deno.env.get('PLAN_READ_ENABLED') === '1'
const AI_OPEN = Deno.env.get('DRAFT_AI_OPEN') === '1'
// 무료 키에선 lite 가 먼저 — 실측(2026-10-09) 상위 모델은 무료 한도(429)·과부하로 거의 매번 실패, lite 는 2~3초에 답했다
const MODELS = (Deno.env.get('GEMINI_DRAFT_MODELS') ?? 'gemini-flash-lite-latest,gemini-flash-latest')
  .split(',').map((s) => s.trim()).filter(Boolean)
const PLAN_MAX_BYTES = 8 * 1024 * 1024
const PLAN_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').trim()
const SERVICE_KEY = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// 인스턴스별 하루 상한(대략) — AI 를 부르는 요청만 센다. 규칙 엔진은 돈이 들지 않는다. 워커가 바뀌면 비워진다(위 🔒 설명)
const daily = new Map<string, { day: string, n: number }>()
function overDaily(uid: string, limit = 30): boolean {
  const day = new Date().toISOString().slice(0, 10)
  const cur = daily.get(uid)
  const n = cur && cur.day === day ? cur.n + 1 : 1
  daily.set(uid, { day, n })
  if (daily.size > 5000) daily.clear()
  return n > limit
}

// 관리자인가 — public.users.role = 'ADMIN'(is_admin() 과 같은 기준). 서비스롤로 읽는다. 실패하면 아니라고 본다
async function isAdmin(uid: string): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_KEY) return false
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await admin.from('users').select('role').eq('id', uid).maybeSingle()
    return !error && data?.role === 'ADMIN'
  } catch {
    return false
  }
}
async function canUseAI(uid: string): Promise<boolean> {
  return AI_OPEN || await isAdmin(uid)
}
// 계획서(유료 플랜) 구독자인가 — 구독 기능이 생기기 전엔 아무도 아니다. 생기면 여기서 구독 상태를 확인한다
async function isPlanSubscriber(_uid: string): Promise<boolean> {
  return false
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const uid = await getUserId(req)
  if (!uid) return unauthorized(CORS)
  if (rateLimited(uid, 6)) return tooManyRequests(CORS)

  try {
    const body = await req.json().catch(() => ({}))

    if (body.action === 'draft') {
      const raw = sanitizeBlueprint(body.blueprint)
      if (!raw.goal) return json({ error: 'no_goal' })
      // 유료 플랜(계획서)이 아니면 «계획서에서 온 설계도»는 있을 수 없다 — 일반 설계도로 다룬다(규칙 엔진·무료 경로)
      const paidPlan = raw.source === 'plan' && PLAN_READ_ENABLED && await isPlanSubscriber(uid)
      const bp = raw.source === 'plan' && !paidPlan ? { ...raw, source: 'text' as const } : raw
      // 아는 목표 → 규칙 엔진(AI 없이)
      if (!paidPlan && canUseRules(bp)) return json({ draft: finalizeDraft(ruleDraft(bp), bp, 'rules'), engine: 'rules' })
      // 처음 보는 목표 → AI. 출시 전엔 관리자만(위 🔒) — 아니면 기본 틀
      if (!paidPlan && !(await canUseAI(uid))) return json({ draft: finalizeDraft(fallbackModel(bp), bp, 'fallback'), engine: 'fallback', reason: 'ai_locked' })
      if (overDaily(uid)) return tooManyRequests(CORS)
      // 계획서(유료) → 유료 키로 설계도 전부 / 처음 보는 목표 → 무료 키로 설계도만. 안 되면 기본 틀
      const key = paidPlan ? PAID_KEY : FREE_KEY
      if (!key) return json({ draft: finalizeDraft(fallbackModel(bp), bp, 'fallback'), engine: 'fallback', reason: 'not_configured' })
      const r = await callGemini(key, MODELS, draftPayload(paidPlan ? bp : forFreeAI(bp)))
      let parsed: ModelDraft | null = null
      if (r.text) { try { parsed = JSON.parse(r.text) as ModelDraft } catch { parsed = null } }
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.missions) || parsed.missions.length === 0) {
        return json({ draft: finalizeDraft(fallbackModel(bp), bp, 'fallback'), engine: 'fallback', reason: 'ai_failed', attempts: r.attempts })
      }
      return json({ draft: finalizeDraft(parsed, bp, 'ai'), engine: 'ai', model: r.model, attempts: r.attempts })
    }

    if (body.action === 'read_plan') {
      // 유료 플랜 전용(본인 2026-10-09) — 유료 키 + 켜짐 + 구독자일 때만
      if (!PLAN_READ_ENABLED || !(await isPlanSubscriber(uid))) return json({ error: 'plan_requires_subscription' })
      if (overDaily(uid)) return tooManyRequests(CORS)
      let file = String(body.file ?? '')
      let mimeType = String(body.mimeType ?? 'application/pdf')
      const m = file.match(/^data:(.+?);base64,(.*)$/s)
      if (m) { mimeType = m[1]; file = m[2] }
      if (!file) return json({ error: 'no_file' })
      if (!PLAN_TYPES.includes(mimeType)) return json({ error: 'unsupported_type', mimeType })
      if (file.length * 0.75 > PLAN_MAX_BYTES) return json({ error: 'too_large' })
      const r = await callGemini(PAID_KEY, MODELS, planPayload(mimeType, file))
      if (!r.text) return json({ error: r.error || 'no_answer', attempts: r.attempts })
      let parsed: Record<string, unknown>
      try { parsed = JSON.parse(r.text) } catch { return json({ error: 'parse_failed' }) }
      return json({ plan: finalizePlan(parsed), model: r.model, attempts: r.attempts })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch {
    // 안쪽 오류 문구는 돌려주지 않는다(내부 정보) — 클라이언트는 기본 틀로 넘어간다
    return json({ error: 'server_error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}
