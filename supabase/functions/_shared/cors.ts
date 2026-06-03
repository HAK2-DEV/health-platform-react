// 공용 CORS 헤더 — 모든 Edge Function 에서 import 해 사용.
// 외부 호출(프론트) 허용. 프로덕션에서는 Access-Control-Allow-Origin 을 본인 도메인으로 제한 권장.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function jsonError(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status)
}
