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

// ⚠️ «키보드가 실제로 뜨는» 입력만 대상. checkbox·radio·date·file·range 등은 제외해야
//   탭할 때마다 60vh 여백이 생기고 화면이 튀는 일이 없다(2026-09-14 리뷰).
const TEXT_INPUT_TYPES = new Set(['', 'text', 'search', 'url', 'tel', 'email', 'password', 'number'])
function isTextInput(el) {
  if (!el) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA') return true
  if (tag !== 'INPUT') return false
  return TEXT_INPUT_TYPES.has((el.getAttribute('type') || 'text').toLowerCase())
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
// 모달 «올리기» 를 늦추는 타이머. 왜 늦추는지는 focusin 핸들러 주석 참고.
let legacyOpenTimer = null

// ── 고정 모달 안 입력칸 (2026-09-16 노트9 「글쓰기 내용 칸이 키보드에 가림」 제보) ──────────
//   모달은 position:fixed 라 window 스크롤로 못 올린다. 키보드 높이도 알 수 없으므로(이 기기는
//   visualViewport·@capacitor/keyboard 둘 다 무반응), «키보드가 떴다» 는 사실만 알려주고
//   Modal 컴포넌트가 스스로 화면 위쪽으로 붙어 어떤 키보드보다 위에 있게 한다.
let legacyKbOpen = false
const legacyKbSubs = new Set()
function setLegacyKbOpen(v) {
  if (legacyKbOpen === v) return
  legacyKbOpen = v
  legacyKbSubs.forEach((cb) => { try { cb(v) } catch { /* 구독자 오류는 무시 */ } })
}
export function getLegacyKeyboardOpen() { return legacyKbOpen }
export function subscribeLegacyKeyboard(cb) { legacyKbSubs.add(cb); return () => legacyKbSubs.delete(cb) }

function activate(el) {
  clearTimeout(removeTimer)
  setLegacyKbOpen(false)   // 모달 밖 입력칸 — 모달 들어올림은 필요 없다
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
  clearTimeout(legacyOpenTimer)   // 올리기 예약 중이었다면 취소
  // 입력칸 간 전환(포커스아웃→즉시 포커스인) 시 깜빡임 방지 위해 지연 제거.
  removeTimer = setTimeout(() => {
    document.documentElement.style.setProperty('--kb-inset', '0px')
    setLegacyKbOpen(false)
  }, 250)
}

let inited = false
export function initNativeKeyboard() {
  if (inited) return
  inited = true
  window.addEventListener('focusin', (e) => {
    if (!needsJsKeyboard() || !isTextInput(e.target)) return
    if (isInFixedContainer(e.target)) {
      clearTimeout(removeTimer); clearTimeout(legacyOpenTimer)
      // ⚠️ 즉시 올리면 안 된다. focusin 은 mousedown 직후에 오는데, 여기서 레이아웃을 바꾸면
      //    뒤이어 합성되는 «click» 의 대상이 입력칸이 아니라 뒤쪽 배경(backdrop)으로 바뀌어
      //    오버레이가 그대로 닫혀버린다(2026-09-16 노트9 CDP 이벤트 로그로 확인:
      //    touchend→INPUT 인데 click→.fixed.inset-0). click 이 끝난 뒤에 올린다.
      legacyOpenTimer = setTimeout(() => setLegacyKbOpen(true), 300)
      return
    }
    activate(e.target)
  })
  window.addEventListener('focusout', (e) => {
    if (!needsJsKeyboard() || !isTextInput(e.target)) return
    deactivate()
  })
}
