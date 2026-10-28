// 비밀번호 재설정 메일 링크로 들어온 걸 부팅 때 붙잡는다 (2026-10-28, BUG_LOG 25).
//
// 왜 부팅 때인가:
//   재설정 링크는 #access_token=…&type=recovery 로 돌아오고, supabase 클라이언트가 생성 즉시 이 해시를
//   소비해 «그냥 로그인된 상태»로 만든다. PASSWORD_RECOVERY 이벤트도 그때 한 번뿐이라 나중에 구독하면 놓친다.
//   그래서 authUrlError 처럼 **createClient 직전**(supabaseClient.js)에 표시만 남긴다.
//   링크가 /reset-password 가 아니라 사이트 주소(/)로 돌아와도(Redirect URLs 허용 목록에 없을 때)
//   App 이 이 표시를 보고 재설정 화면으로 보낸다.
//
// sessionStorage — 이 탭에서만, 1시간. 새 비밀번호를 저장하면 지운다.
const KEY = 'pw_recovery'
const TTL_MS = 60 * 60_000

export function capturePasswordRecovery() {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
  if (params.get('type') !== 'recovery') return
  try { sessionStorage.setItem(KEY, String(Date.now())) } catch { /* 저장 불가 무시 */ }
}

export function isPasswordRecovery() {
  try {
    const at = Number(sessionStorage.getItem(KEY))
    return !!at && Date.now() - at < TTL_MS
  } catch { return false }
}

export function clearPasswordRecovery() {
  try { sessionStorage.removeItem(KEY) } catch { /* 무시 */ }
}
