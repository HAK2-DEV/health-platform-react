// 인증 링크 실패를 URL 에서 건져 올린다 (2026-08-27).
//
// 문제:
//   이메일 인증 링크가 만료·재사용되면 Supabase 가 앱으로 되돌려보내면서 URL 에 에러를 싣는다.
//     예) #error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid...
//   그런데 앱은 이 값을 **아무 데서도 읽지 않았다**. 세션이 없는 채로 부팅되고 →
//   HomePage 가 세션 없음을 보고 /login 으로 보내 → 사용자는 이유도 모른 채 로그인 화면에 선다.
//   ("가입했는데 왜 로그인 화면이지?") 메일 서비스의 링크 스캐너가 먼저 열어 토큰을 소모하는
//   경우가 흔해서(네이버·지메일) 실사용에서 자주 재현된다.
//
// 캡처 시점이 중요:
//   supabase 클라이언트는 생성 즉시 URL 해시를 소비하고 history 를 정리한다.
//   그래서 **createClient 호출 직전**(supabaseClient.js)에 이 모듈의 capture 를 부른다.
//
// implicit flow 는 해시(#), 서버 리다이렉트 계열은 쿼리(?) 로 실어 보내므로 둘 다 본다.

let captured = null

const MESSAGES = {
  otp_expired: '인증 링크가 만료됐어요. 아래에서 메일을 다시 받아주세요.',
  access_denied: '인증이 완료되지 않았어요. 링크가 만료됐거나 이미 사용됐을 수 있어요.',
  email_link_invalid: '인증 링크가 유효하지 않아요. 메일을 다시 받아주세요.',
  server_error: '인증 서버에 문제가 있었어요. 잠시 후 다시 시도해주세요.',
}

function parse(search, hash) {
  // hash 우선 — implicit flow 의 표준 위치
  const fromHash = new URLSearchParams((hash || '').replace(/^#/, ''))
  const fromQuery = new URLSearchParams(search || '')
  const pick = (k) => fromHash.get(k) || fromQuery.get(k)

  const error = pick('error')
  const errorCode = pick('error_code')
  if (!error && !errorCode) return null

  const description = (pick('error_description') || '').replace(/\+/g, ' ')
  return {
    code: errorCode || error,
    // 한글 안내가 있으면 그걸, 없으면 provider 원문(영문)이라도 보여준다 — 침묵보다 낫다.
    message: MESSAGES[errorCode] || MESSAGES[error] || description || '인증에 실패했어요.',
    // 만료·재사용 계열은 "메일 다시 받기" 로 해결되는 종류
    canResend: errorCode === 'otp_expired' || error === 'access_denied' || errorCode === 'email_link_invalid',
  }
}

/**
 * 부팅 시 1회 호출 — supabase 가 URL 을 정리하기 전에 에러를 붙잡아 둔다.
 * /auth/callback 은 자체 에러 화면이 있으므로 건너뛴다(같은 에러를 두 번 보여주지 않기).
 */
export function captureAuthUrlError() {
  if (typeof window === 'undefined') return
  if (window.location.pathname === '/auth/callback') return
  captured = parse(window.location.search, window.location.hash)
}

/** 1회 소비 — 읽는 즉시 URL 에서도 지워 새로고침 때 다시 뜨지 않게 한다. */
export function takeAuthUrlError() {
  const e = captured
  captured = null
  if (e && typeof window !== 'undefined') {
    try {
      window.history.replaceState({}, '', window.location.pathname)
    } catch { /* history 조작 불가 환경 무시 */ }
  }
  return e
}
