// 네이티브 앱 소셜 로그인 복귀 — «서버 302» 로 앱 딥링크에 보낸다 (Vercel Serverless Function, 2026-10-08).
//
// 왜 서버인가: 카카오·네이버는 https redirect 만 받으므로 앱은 라이브 /auth/callback 으로 돌아온다. 거기서
//   JS 로 com.healthplatform.app:// 에 보내면 크롬(Custom Tab)이 «사용자 제스처 없는 앱 전환» 으로 막아
//   「앱으로 돌아가는 중…」 페이지에서 멈춘다(폰 재현). 반면 **서버가 302 로 앱 주소를 주면** 사용자가 시작한
//   내비게이션 사슬(로그인 버튼 → provider 302 → 여기 302)이라 크롬이 앱을 연다 — Supabase 호스팅 OAuth 가
//   구글 로그인에서 앱으로 돌아올 때 쓰는 것과 같은 원리다.
//
// 어떻게 여기로 오나: vercel.json rewrites — /auth/callback 에 state 가 `.native` 로 끝날 때만 이 함수로.
//   웹 로그인(state 에 .native 없음)은 그대로 SPA 콜백 페이지. code 는 여기서 쓰지 않는다(앱이 교환한다).
const SCHEME = 'com.healthplatform.app'
const APP_CALLBACK = `${SCHEME}://auth/callback`

export default function handler(req, res) {
  const q = req.query || {}
  const state = typeof q.state === 'string' ? q.state : ''
  const [provider] = state.split('.')
  const p = new URLSearchParams()
  if (/^[a-z]+$/.test(provider)) p.set('provider', provider)
  for (const k of ['code', 'state', 'error', 'error_description']) {
    if (typeof q[k] === 'string' && q[k]) p.set(k, q[k])
  }
  const target = `${APP_CALLBACK}?${p}`

  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Location', target)
  // 302 본문 — 크롬이 어떤 이유로 따라가지 않으면 사람이 누를 수 있는 링크 하나
  res.statusCode = 302
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.end(`<!doctype html><meta charset="utf-8"><title>도담</title>
<body style="font-family:sans-serif;text-align:center;padding:48px 24px">
<p>앱으로 돌아가는 중…</p>
<p><a href="${target.replace(/"/g, '&quot;')}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#10b981;color:#fff;text-decoration:none;font-weight:700">도담 앱 열기</a></p>
</body>`)
}
