// Day 65 — 인앱 브라우저 감지.
// PWA 설치는 외부 브라우저(Safari/Chrome) 에서만 가능 — 인앱 브라우저는 「홈 화면에 추가」 메뉴 자체 없음.
// 카톡 / 네이버 / 인스타 / 페북 / 라인 등 주요 메신저·소셜 인앱 브라우저 감지.

export function detectInAppBrowser() {
  if (typeof window === 'undefined' || !navigator?.userAgent) return null
  const ua = navigator.userAgent

  if (/KAKAOTALK/i.test(ua)) return 'kakao'
  if (/NAVER\(inapp/i.test(ua)) return 'naver'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/FBAN|FBAV/i.test(ua)) return 'facebook'
  if (/Line\//i.test(ua)) return 'line'
  // BAND, Telegram, Twitter 등 추가 가능
  return null
}

export const IN_APP_BROWSER_NAME = {
  kakao: '카카오톡',
  naver: '네이버',
  instagram: '인스타그램',
  facebook: '페이스북',
  line: '라인',
}

export function isIOSDevice() {
  if (typeof window === 'undefined' || !navigator?.userAgent) return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

export function isAndroidDevice() {
  if (typeof window === 'undefined' || !navigator?.userAgent) return false
  return /Android/.test(navigator.userAgent)
}

// Android 일부 환경에서 통하는 「Chrome 강제 실행」 intent URL.
// 카톡 등 인앱 브라우저가 이 클릭을 외부 Chrome 으로 넘김 (보장 X — 차단 가능).
export function buildChromeIntentUrl(targetUrl) {
  const stripped = targetUrl.replace(/^https?:\/\//, '')
  return `intent://${stripped}#Intent;scheme=https;package=com.android.chrome;end`
}
