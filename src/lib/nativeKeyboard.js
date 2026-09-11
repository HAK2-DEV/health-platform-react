// 네이티브(구형 안드로이드) 키보드 대응 — «키보드 높이를 몰라도» 되는 포커스 기반 스크롤.
//   배경(실측 확정, 노트9=안드10):
//     - adjustResize : 키보드 시 웹뷰가 12px 로 붕괴 → 못 씀
//     - adjustNothing: 붕괴는 없으나 web visualViewport 도, @capacitor/keyboard 도 키보드를 감지 못 함(높이 0)
//   → 키보드 높이를 알 방법이 없으므로, «입력칸에 포커스가 생기면» 넉넉한 하단 여백(--kb-inset)으로
//     스크롤 공간을 만들고 그 입력칸을 화면 상단부(안전하게 키보드 위)로 스크롤한다. 포커스가 빠지면 원복.
//   MainActivity 는 안드14 이하에서 adjustNothing 을 씀(창 안 움직임 → 이 스크롤이 정확히 먹힘).
//   최신폰(안드15+)은 네이티브 adjustResize 가 처리하므로 이 경로를 건너뛴다(UA 로 분기).
import { isNativeApp } from './installPrompt'

function androidMajor() {
  const m = /Android (\d+)/.exec(navigator.userAgent || '')
  return m ? parseInt(m[1], 10) : 0
}

// 이 JS 스크롤 처리가 필요한 환경: 네이티브 + 안드로이드 15 미만(구형). iOS(=0)·최신 안드는 제외.
function needsJsKeyboard() {
  const maj = androidMajor()
  return isNativeApp() && maj > 0 && maj < 15
}

function isTextInput(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

// 고정 요소(모달 등, position:fixed/sticky) 안의 입력칸이면 window 스크롤로 못 올림 → 건너뜀.
function isInFixedContainer(el) {
  let n = el
  while (n && n !== document.body) {
    const pos = getComputedStyle(n).position
    if (pos === 'fixed' || pos === 'sticky') return true
    n = n.parentElement
  }
  return false
}

const TOP_TARGET = 140 // 입력칸을 화면 상단에서 이 지점(px)으로 — 상태바/헤더 아래, 어떤 키보드보다 위
let removeTimer = null

function activate(el) {
  clearTimeout(removeTimer)
  // 스크롤 공간 확보(넉넉히) — 페이지 하단 입력칸도 상단까지 끌어올릴 수 있게.
  document.documentElement.style.setProperty('--kb-inset', '60vh')
  // 키보드 애니메이션이 끝난 뒤 스크롤(포커스가 유지된 경우에만).
  setTimeout(() => {
    if (document.activeElement !== el) return
    const dy = el.getBoundingClientRect().top - TOP_TARGET
    if (Math.abs(dy) > 8) window.scrollBy({ top: dy, behavior: 'smooth' })
  }, 260)
}

function deactivate() {
  // 입력칸 간 전환(포커스아웃→즉시 포커스인) 시 깜빡임 방지 위해 지연 제거.
  removeTimer = setTimeout(() => {
    document.documentElement.style.setProperty('--kb-inset', '0px')
  }, 250)
}

let inited = false
export function initNativeKeyboard() {
  if (inited) return
  inited = true
  window.addEventListener('focusin', (e) => {
    if (!needsJsKeyboard() || !isTextInput(e.target) || isInFixedContainer(e.target)) return
    activate(e.target)
  })
  window.addEventListener('focusout', (e) => {
    if (!needsJsKeyboard() || !isTextInput(e.target)) return
    deactivate()
  })
}
