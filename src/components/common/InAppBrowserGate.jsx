import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ExternalLink, Check } from 'lucide-react'
import { detectInAppBrowser, IN_APP_BROWSER_NAME, openExternalBrowser } from '../../lib/inAppBrowser'

// 온보딩 경로(초대/로그인/가입) 전용 「강한」 인앱 브라우저 게이트 — 전체화면 차단.
//   소프트 배너(InAppBrowserBanner, 닫기 가능)와 달리 화면을 가려 외부 브라우저 탈출을 강하게 유도.
//   왜: 카톡 등 인앱 브라우저는 (1) 세션이 PWA/외부 브라우저와 격리 (2) 구글·네이버 OAuth 차단
//   → 여기서 가입·로그인하면 밖과 안 이어져 "다시 로그인" 왕복 지옥. 초대는 카톡으로 퍼지므로
//   신규 유입 첫인상에 직결됨(본인 결정 2026-08-13: 강한 게이트).
//   현재 URL(초대 code 포함)을 그대로 외부 브라우저로 넘기므로, 한 번만 옮기면 코드가 이어짐.
const GATED_PREFIXES = ['/join', '/login', '/signup', '/nickname-setup']

function InAppBrowserGate() {
  const location = useLocation()
  const [browser] = useState(() => detectInAppBrowser())
  const [copied, setCopied] = useState(false)

  const onGatedRoute = GATED_PREFIXES.some(p => location.pathname === p || location.pathname.startsWith(p + '/'))
  if (!browser || !onGatedRoute) return null
  const name = IN_APP_BROWSER_NAME[browser] || '현재 앱'

  const handleOpen = async () => {
    if (openExternalBrowser()) return          // 탈출 시도됨 — 곧 이 페이지를 떠남
    try {                                       // iOS 인스타/페북 등 강제 불가 → 링크 복사 폴백
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true); setTimeout(() => setCopied(false), 3000)
    } catch {
      window.prompt('아래 주소를 복사해 브라우저 주소창에 붙여넣어주세요', window.location.href)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center px-7 text-center"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)', paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
    >
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
        <ExternalLink className="w-8 h-8 text-emerald-500" />
      </div>
      <h1 className="text-[19px] font-bold text-gray-900 mb-2 break-keep">브라우저에서 열어주세요</h1>
      <p className="text-[14px] text-gray-600 leading-relaxed break-keep mb-1">
        {name} 안에서는 로그인·회원가입이 제대로 안 돼요.
      </p>
      <p className="text-[13px] text-gray-400 leading-relaxed break-keep mb-7">
        아래 버튼을 누르면 크롬/사파리에서 열려요.<br />한 번만 옮기면 가입부터 참여까지 매끄럽게 끝나요.
      </p>
      <button
        type="button"
        onClick={handleOpen}
        className="w-full max-w-xs inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-[15px] font-bold rounded-2xl shadow-md transition active:scale-[.98]"
      >
        {copied
          ? (<><Check className="w-5 h-5" /> 주소 복사됨</>)
          : (<><ExternalLink className="w-5 h-5" /> 브라우저에서 열기</>)}
      </button>
      <p className="text-[12px] text-gray-400 leading-relaxed break-keep mt-5">
        버튼이 안 되면 — 우측 상단 <b className="text-gray-500">⋮ / 공유</b> →<br /><b className="text-gray-500">다른 브라우저로 열기</b> 를 눌러주세요.
      </p>
    </div>
  )
}

export default InAppBrowserGate
