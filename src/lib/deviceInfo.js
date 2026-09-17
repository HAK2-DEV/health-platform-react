// 버그 신고에 «자동으로» 붙는 기기·환경 정보.
//
// 왜 자동인가 — 제보에서 가장 자주 비는 칸이 기기와 버전이다(docs/BUG_LOG.md).
// 사용자는 자기 폰의 안드로이드 버전을 모르는 게 정상이고, 물어보면 신고 자체를
// 포기한다. 브라우저가 이미 아는 것은 우리가 채우고, 사람만 아는 것(무엇을 하다가,
// 어떻게 하면 다시 나오는지)에 집중하게 한다.
//
// 여기 모으는 값은 전부 «화면 코드가 이미 알고 있는» 것이다. 연락처·위치·식별자는
// 건드리지 않는다. 신고 본문에 그대로 붙어 사용자가 보낼 내용을 직접 눈으로 확인할 수 있다.

import { isNativeApp, isStandalone, isInAppBrowser } from './installPrompt'

// 실제 적용된 글자 배율 — 10px 로 선언한 글자를 그려 실제 높이를 잰다
// (폰 「글자 크기」 설정이 웹뷰에 곱해진 값). 네이티브는 MainActivity 가 1.15배로 제한.
// 배너·버튼 넘침 제보의 공통 원인이라 반드시 같이 받는다. [[project_webview_font_scale_2026-09-15]]
export function measureTextScale() {
  try {
    const probe = document.createElement('span')
    probe.textContent = '가'
    probe.style.cssText = 'position:fixed;left:-9999px;top:0;font-size:10px;line-height:1;visibility:hidden'
    document.body.appendChild(probe)
    const h = probe.getBoundingClientRect().height
    probe.remove()
    return h > 0 ? (h / 10).toFixed(2) : '-'
  } catch {
    return '-'
  }
}

// UA 에서 OS 와 기기 모델을 뽑는다. 못 뽑으면 '알 수 없음' — 추측하지 않는다.
function parseOs(ua) {
  const and = ua.match(/Android\s+([\d.]+)/)
  if (and) return `Android ${and[1]}`
  const ios = ua.match(/OS\s+(\d+[._\d]*)\s+like Mac OS X/)
  if (ios) return `iOS ${ios[1].replace(/_/g, '.')}`
  if (/Windows NT 10/.test(ua)) return 'Windows 10/11'
  if (/Mac OS X/.test(ua)) return 'macOS'
  return '알 수 없음'
}

function parseModel(ua) {
  // 예) "Linux; Android 10; SM-N960N Build/QP1A..." → SM-N960N
  const and = ua.match(/Android\s+[\d.]+;\s*([^;)]+?)(?:\s+Build\/[^;)]*)?\)/)
  if (and) {
    const m = and[1].trim()
    if (m && !/^wv$/i.test(m)) return m
  }
  const ios = ua.match(/\b(iPhone|iPad|iPod)\b/)
  if (ios) return ios[1]
  return '알 수 없음'
}

function parseBrowser(ua) {
  let m
  if ((m = ua.match(/SamsungBrowser\/([\d.]+)/))) return `삼성 인터넷 ${m[1]}`
  if ((m = ua.match(/EdgA?\/([\d.]+)/))) return `Edge ${m[1]}`
  if ((m = ua.match(/FxiOS\/([\d.]+)|Firefox\/([\d.]+)/))) return `Firefox ${m[1] || m[2]}`
  if ((m = ua.match(/CriOS\/([\d.]+)/))) return `Chrome(iOS) ${m[1]}`
  if ((m = ua.match(/Chrome\/([\d.]+)/))) return `Chrome ${m[1]}`
  if ((m = ua.match(/Version\/([\d.]+).*Safari/))) return `Safari ${m[1]}`
  return '알 수 없음'
}

// 앱인지 웹인지 — 같은 화면이라도 원인이 완전히 달라진다.
function parseShell() {
  if (isNativeApp()) return '앱(Play 설치)'
  if (isInAppBrowser()) return '웹(카톡 등 인앱 브라우저)'
  if (isStandalone()) return '웹(홈 화면에 설치)'
  return '웹(브라우저)'
}

export function collectDeviceInfo() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || ''
  const now = new Date()
  let network = '알 수 없음'
  try {
    const c = navigator.connection
    network = (navigator.onLine === false ? '오프라인' : '온라인')
      + (c?.effectiveType ? ` · ${c.effectiveType}` : '')
  } catch { /* 무시 */ }

  return {
    shell: parseShell(),
    // 화면 코드 자체의 버전. Play 업데이트 첫 실행은 서비스워커 탓에 «옛 JS» 가 돌 수 있어
    // 이 값이 없으면 이미 고친 것을 다시 쫓게 된다. [[feedback_native_sw_cache_uninstall]]
    build: import.meta.env.VITE_APP_BUILD || 'dev',
    os: parseOs(ua),
    model: parseModel(ua),
    browser: parseBrowser(ua),
    screen: typeof window !== 'undefined'
      ? `${window.innerWidth}×${window.innerHeight} (DPR ${window.devicePixelRatio || 1})`
      : '알 수 없음',
    textScale: `×${measureTextScale()}`,
    network,
    at: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} `
      + `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    ua,
  }
}

const LABELS = [
  ['shell', '환경'],
  ['model', '기기'],
  ['os', 'OS'],
  ['browser', '브라우저'],
  ['build', '화면 버전'],
  ['textScale', '글자 배율'],
  ['screen', '화면 크기'],
  ['network', '네트워크'],
  ['at', '작성 시각'],
]

// 신고 본문 끝에 붙는 블록. 관리자는 기존 문의 상세 화면에서 그대로 읽는다.
export function formatDeviceInfo(info) {
  const lines = LABELS.map(([k, label]) => `· ${label}: ${info[k]}`)
  lines.push(`· UA: ${info.ua}`)
  return lines.join('\n')
}

// 모달에서 «펼쳐 보기» 로 보여줄 때 쓰는 요약 한 줄.
export function summarizeDeviceInfo(info) {
  return `${info.model} · ${info.os} · ${info.shell} · 화면 ${info.build}`
}
