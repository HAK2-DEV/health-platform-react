// OAuth state — "어떤 provider 로 시작했는지" 와 CSRF nonce 를 한 문자열에 담는다 (2026-08-27).
//
// 기존 방식의 약점:
//   provider 를 sessionStorage 에 넣고 콜백 페이지에서 꺼내 썼다. sessionStorage 는
//   **탭·브라우징 컨텍스트 단위**라, OAuth 페이지가 새 탭/커스텀탭으로 열리거나 인앱→외부
//   브라우저로 전환되면 닿지 못한다. 그 결과가 "잘못된 접근이에요 (provider/code 누락)" —
//   사용자에겐 원인을 알 수 없는 실패였다.
//
// 처방 두 겹:
//   1) provider 는 **state 에 실어 URL 로 관통**시킨다. state 는 provider 가 콜백에 그대로
//      돌려주므로(카카오·네이버 모두 지원) 저장소가 끊겨도 판별된다.
//   2) CSRF nonce 는 저장소에 두되 sessionStorage → **localStorage** 로 넓힌다.
//      같은 브라우저 안이라면 탭이 바뀌어도 관통한다.
//      (초대코드 pendingInvite 와 같은 처방 — 그때도 같은 이유였다)
//
// 남는 경계: iOS 홈화면 PWA 와 Safari 는 저장소가 아예 분리돼 있어 localStorage 로도 못 넘는다.
//   그 경우 provider 는 state 로 알아내되 nonce 검증은 불가 → 'unavailable' 로 **구분해서**
//   돌려주고, 콜백 화면이 "이 브라우저에서 다시 로그인해주세요" 라고 정확히 안내한다.
//   (검증 없이 통과시키지 않는다 — 네이버 검수 요건이기도 하고 CSRF 방어를 포기할 수 없다)
//
// 곁다리 이득: 그동안 Kakao 는 state 를 아예 안 보내 CSRF 방어가 없었다. 이제 둘 다 검증한다.

const KEY = 'oauth_nonce'
const TTL_MS = 10 * 60_000   // OAuth 왕복은 몇 분이면 끝난다. 오래된 값이 다음 로그인에 끼어들지 않도록.
const SEP = '.'

function randomNonce() {
  try {
    if (crypto?.randomUUID) return crypto.randomUUID().replace(/-/g, '')
  } catch { /* crypto 미지원 환경 */ }
  return String(Math.random()).slice(2) + String(Date.now())
}

/**
 * OAuth 시작 — state 문자열을 만들고 nonce 를 저장한다.
 * @returns {string} `${provider}.${nonce}` — authorize 요청의 state 로 그대로 보낼 것
 */
export function startOAuthState(provider) {
  const nonce = randomNonce()
  try {
    localStorage.setItem(KEY, JSON.stringify({ nonce, provider, at: Date.now() }))
  } catch { /* 저장 불가 환경 — state 의 provider 로 판별은 되고, nonce 검증만 unavailable */ }
  return `${provider}${SEP}${nonce}`
}

/** 콜백에서 받은 state 를 분해. 형식이 아니면 null. */
export function parseOAuthState(state) {
  if (typeof state !== 'string' || !state.includes(SEP)) return null
  const i = state.indexOf(SEP)
  const provider = state.slice(0, i)
  const nonce = state.slice(i + 1)
  if (!/^[a-z]+$/.test(provider) || !nonce) return null
  return { provider, nonce }
}

/**
 * CSRF 검증. 결과를 셋으로 **구분**하는 게 요점 —
 *   'ok'          일치
 *   'mismatch'    저장된 값과 다름 → 진짜 의심스러운 상황
 *   'unavailable' 저장된 값 자체가 없음(만료·다른 브라우저·저장소 격리) → 안내가 달라야 한다
 */
export function verifyOAuthNonce(nonce) {
  let raw
  try { raw = localStorage.getItem(KEY) } catch { return 'unavailable' }
  if (!raw) return 'unavailable'
  try { localStorage.removeItem(KEY) } catch { /* 무시 */ }

  try {
    const saved = JSON.parse(raw)
    if (typeof saved?.at !== 'number' || Date.now() - saved.at > TTL_MS) return 'unavailable'
    if (!nonce || saved.nonce !== nonce) return 'mismatch'
    return 'ok'
  } catch {
    return 'unavailable'
  }
}
