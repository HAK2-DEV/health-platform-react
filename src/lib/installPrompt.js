// PWA 설치 유도 — beforeinstallprompt 전역 캐치 + 플랫폼/상태 판별.
//
// beforeinstallprompt 는 앱 로드 초기(Chrome 참여 휴리스틱 충족 시)에 한 번 발생한다.
// 특정 페이지 컴포넌트에서만 리스닝하면 그 페이지에 없을 때 이벤트를 놓치므로,
// main.jsx 에서 initInstallPrompt() 로 최상위에 등록해 보관한다.

let deferredPrompt = null
let installed = false
const subscribers = new Set()

function notify() {
  subscribers.forEach((cb) => cb())
}

// main.jsx 에서 렌더 전 1회 호출.
export function initInstallPrompt() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    // 브라우저 기본 미니 인포바 억제 → 우리가 원하는 시점에 유도 배너로 노출.
    e.preventDefault()
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferredPrompt = null
    notify()
  })
}

export function getInstallState() {
  return { deferredPrompt, installed }
}

export function subscribeInstall(cb) {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

// 네이티브 설치 다이얼로그 표시 (Android/Desktop Chrome).
//   deferredPrompt 는 1회용이라 성공/실패와 무관하게 소비 후 제거.
export async function promptInstall() {
  if (!deferredPrompt) return { outcome: 'unavailable' }
  const p = deferredPrompt
  deferredPrompt = null
  notify()
  p.prompt()
  try {
    return await p.userChoice // { outcome: 'accepted' | 'dismissed' }
  } catch {
    return { outcome: 'dismissed' }
  }
}

// ── 플랫폼/환경 판별 ─────────────────────────────────────────

export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

// Capacitor 네이티브 앱 안 — 웹 설치 유도 불필요(이미 앱).
export function isNativeApp() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()
}

// iOS 는 beforeinstallprompt 가 없어 수동 안내만 가능하고, 그마저 Safari 에서만 됨.
export function isIOSSafari() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua)
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  return ios && safari
}

// 카톡·인스타·페북·라인·네이버 등 인앱 브라우저 — 설치 불가(진짜 브라우저로 열어야 함).
export function isInAppBrowser() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER|DaumApps|; wv\)/i.test(ua)
}
