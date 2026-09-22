// 엣지 함수 공용 — 「로그인한 사용자만」 게이트 + 가벼운 호출 상한
//
// 왜 필요한가 (2026-09-22 실측):
//   config.toml 에 verify_jwt=false 가 없으면 게이트웨이가 JWT 를 검사하지만,
//   **앱 번들에 박혀 있는 익명 키 자체가 유효한 JWT** 라 누구나 통과한다.
//   실제로 익명 키만으로 food-search 가 200 을 돌려줬다. Gemini 프록시는
//   남의 호출이 곧 우리 요금이므로, 함수 안에서 «사용자» 를 확인해야 한다.
//   패턴은 delete-account 와 동일(서비스롤 클라이언트로 토큰 검증).
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') ?? '').trim()
const SERVICE_KEY = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()

/** Authorization 헤더의 토큰으로 사용자 id 를 얻는다. 익명 키·만료 토큰이면 null. */
export async function getUserId(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token || !SUPABASE_URL || !SERVICE_KEY) return null
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await admin.auth.getUser(token)
    if (error) return null
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

/** 401 응답 (호출부의 CORS 헤더를 그대로 붙인다) */
export function unauthorized(cors: Record<string, string>, message = '로그인이 필요해요') {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

// ── 호출 상한 ────────────────────────────────────────────────
//   인스턴스 메모리 기반이라 «완벽한» 제한은 아니다(인스턴스가 여러 개면 그만큼 곱해진다).
//   목적은 한 계정이 순간적으로 수백 번 호출해 요금을 태우는 것을 막는 것.
//   더 엄격히 하려면 DB 카운터로 옮긴다.
const hits = new Map<string, number[]>()

export function rateLimited(uid: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now()
  const list = (hits.get(uid) ?? []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(uid, list)
  if (hits.size > 5000) hits.clear()   // 메모리 상한 (단순 초기화)
  return list.length > limit
}

export function tooManyRequests(cors: Record<string, string>) {
  return new Response(JSON.stringify({ error: '잠시 후 다시 시도해 주세요' }), {
    status: 429,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
