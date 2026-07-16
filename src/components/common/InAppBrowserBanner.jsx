import { useState } from 'react'
import { ExternalLink, X, Check } from 'lucide-react'
import { detectInAppBrowser, IN_APP_BROWSER_NAME, openExternalBrowser } from '../../lib/inAppBrowser'

// 인앱 브라우저(카톡·네이버·인스타 등) 진입 시 상단 안내 배너 — 「브라우저에서 열기」 1번으로 탈출.
//
// 배경 (2026-07-14 실제 제보 · 갤럭시 폴드 + 카카오톡 링크):
//   카톡 인앱 브라우저가 <meta viewport> 의 width=device-width 를 무시하고 넓은 레이아웃
//   뷰포트(≈800px)로 렌더한 뒤, 좁은 커버 화면(≈344px)에 맞추려 ~43% 로 축소(shrink-to-fit)
//   → 글자가 전부 아주 작게 보임. 우리 레이아웃은 정상(320~412px 어디서도 가로 오버플로 0)이라
//   CSS 로는 못 고침. 외부 브라우저 유도가 유일한 실질 해법.
//   초대 링크가 카카오톡으로 퍼지는 구조라 신규 유입 첫인상에 직결됨.
//
// 탈출 수단은 lib/inAppBrowser 의 openExternalBrowser() 재사용:
//   카톡 = kakaotalk:// 스킴(iOS·Android 공통) / 라인 = 쿼리 / 안드로이드 = Chrome intent.
//   iOS 의 카톡 외 인앱(인스타·페북)은 강제 수단이 없어 → 링크 복사 폴백.
// 설치 안내용 InAppBrowserWarning(설치 가이드 페이지 전용)과는 목적·문구가 다름.
const DISMISS_KEY = 'inapp_banner_dismissed'

function InAppBrowserBanner() {
  const [browser] = useState(() => detectInAppBrowser())
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })
  const [copied, setCopied] = useState(false)

  if (!browser || hidden) return null
  const name = IN_APP_BROWSER_NAME[browser] || '현재 앱'

  const handleOpen = async () => {
    if (openExternalBrowser()) return          // 탈출 시도됨 — 곧 이 페이지를 떠남
    try {                                       // iOS 카톡 외 인앱 — 강제 불가 → 링크 복사
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      window.prompt('아래 주소를 복사해 Safari 주소창에 붙여넣어주세요', window.location.href)
    }
  }

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* 저장 실패해도 닫기는 동작 */ }
    setHidden(true)
  }

  return (
    <div className="bg-amber-500 text-white px-3 py-2.5 flex items-center gap-2">
      <p className="flex-1 min-w-0 text-[13px] font-bold leading-snug break-keep">
        {name} 브라우저에서는 화면이 작게 보일 수 있어요
      </p>
      <button
        type="button"
        onClick={handleOpen}
        className="flex-shrink-0 inline-flex items-center gap-1 px-3 h-8 rounded-full bg-white text-amber-700 text-[12px] font-bold whitespace-nowrap"
      >
        {copied
          ? (<><Check className="w-3.5 h-3.5" /> 복사됨</>)
          : (<><ExternalLink className="w-3.5 h-3.5" /> 브라우저에서 열기</>)}
      </button>
      <button type="button" onClick={dismiss} aria-label="안내 닫기" className="flex-shrink-0 p-1 -mr-1 text-white/80 hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export default InAppBrowserBanner
