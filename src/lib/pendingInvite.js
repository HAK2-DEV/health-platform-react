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

// ── 대시보드 「초대받은 프로그램」 카드 힌트 ──────────────────────────
//   위 pendingInvite(자동복귀, 1회 소비)와 별개의 "지속 리마인더".
//   자동복귀가 중간에 끊기거나 이미 로그인 상태로 초대만 보고 넘어간 경우의 안전망.
//   초대링크 방문 시 심고, 참여 완료·사용자 닫기·7일 만료 전까지 유지.
const HINT_KEY = 'invite_hint'
const HINT_TTL_MS = 7 * 24 * 60 * 60_000

export function setInviteHint(code, name) {
  if (!code) return
  try {
    const prev = getInviteHint()
    localStorage.setItem(HINT_KEY, JSON.stringify({
      code,
      name: name || prev?.name || '',
      at: prev?.code === code ? prev.at : Date.now(),   // 같은 코드면 최초 방문시각 유지
    }))
  } catch { /* 저장 불가 무시 */ }
}

export function getInviteHint() {
  try {
    const raw = localStorage.getItem(HINT_KEY)
    if (!raw) return null
    const h = JSON.parse(raw)
    if (!h?.code || typeof h.at !== 'number' || Date.now() - h.at > HINT_TTL_MS) {
      localStorage.removeItem(HINT_KEY)
      return null
    }
    return h
  } catch { return null }
}

// code 지정 시 해당 코드일 때만 삭제(다른 초대로 덮인 경우 오삭제 방지). 미지정 시 무조건 삭제.
export function clearInviteHint(code) {
  try {
    if (code) { const h = getInviteHint(); if (h && h.code !== code) return }
    localStorage.removeItem(HINT_KEY)
  } catch { /* 무시 */ }
}
