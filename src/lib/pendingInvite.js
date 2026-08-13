// 초대링크(/join?code=)로 진입 후 로그인·회원가입(소셜 OAuth 포함)을 거쳐도
// 원래 초대 화면으로 자동 복귀하기 위한 저장소.
//
//   왜 localStorage 인가: 기존 sessionStorage 는 (1) OAuth 전체페이지 리다이렉트,
//   (2) 인앱→외부 브라우저 전환, (3) 새 탭에서 열리는 로그인 등에서 유실될 수 있다.
//   localStorage 는 같은 브라우저 안에서 이 과정을 관통해 살아남는다.
//   30분 만료 — 오래 전 버려진 초대 흐름이 다음 일반 로그인 때 엉뚱하게 되살아나지 않도록.
const KEY = 'pending_invite_redirect'
const TTL_MS = 30 * 60_000

// path: 복귀할 앱 내부 경로(예: '/join?code=ABC123')
export function setPendingInvite(path) {
  if (!path) return
  try { localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() })) } catch { /* 저장 불가 환경 무시 */ }
}

// 1회 소비 — 읽는 즉시 삭제. 유효(30분 이내)하면 경로 반환, 아니면 null.
export function takePendingInvite() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    localStorage.removeItem(KEY)
    const { path, at } = JSON.parse(raw)
    if (!path || typeof at !== 'number' || Date.now() - at > TTL_MS) return null
    return path
  } catch { return null }
}
