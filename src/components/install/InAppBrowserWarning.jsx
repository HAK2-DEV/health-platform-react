import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'
import {
  IN_APP_BROWSER_NAME,
  isIOSDevice,
  isAndroidDevice,
  buildChromeIntentUrl,
} from '../../lib/inAppBrowser'

// 카톡 등 인앱 브라우저 진입 시 노출.
// UX 원칙 — 사용자는 1번의 행동만 하면 됨:
//   · Android: 「Chrome 으로 열기」 버튼 1번
//   · iOS: 「링크 복사」 버튼 1번 → Safari 주소창에 길게 눌러 붙여넣기
// 단계 안내·읽기 최소화.

function InAppBrowserWarning({ browser }) {
  const [copied, setCopied] = useState(false)
  if (!browser) return null

  const name = IN_APP_BROWSER_NAME[browser] || '앱'
  const isIOS = isIOSDevice()
  const isAndroid = isAndroidDevice()
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      window.prompt('아래 주소를 복사 후 Safari 주소창에 붙여넣어주세요', currentUrl)
    }
  }

  const handleOpenChrome = () => {
    window.location.href = buildChromeIntentUrl(currentUrl)
  }

  return (
    <div className="bg-white border-2 border-red-300 rounded-card-lg p-6 mb-4 text-center shadow-soft">
      <div className="text-5xl mb-3">😅</div>
      <h2 className="text-lg font-bold text-gray-800 mb-1.5">
        {name} 안에선 설치 불가
      </h2>
      <p className="text-sm text-gray-500 mb-5">
        {isIOS ? 'Safari' : isAndroid ? 'Chrome' : '기본 브라우저'} 에서 다시 열면 설치 가능해요
      </p>

      {/* 메인 액션 — Android: Chrome 열기 / iOS: 링크 복사 */}
      {isAndroid ? (
        <button
          type="button"
          onClick={handleOpenChrome}
          className="w-full px-4 py-4 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-base font-bold rounded-pill shadow-soft transition inline-flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-5 h-5" />
          Chrome 으로 열기
        </button>
      ) : (
        <button
          type="button"
          onClick={handleCopy}
          className={`w-full px-4 py-4 text-base font-bold rounded-pill shadow-soft transition inline-flex items-center justify-center gap-2 ${
            copied
              ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
              : 'bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-5 h-5" />
              복사됨 — Safari 주소창에 붙여넣기
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              링크 복사
            </>
          )}
        </button>
      )}

      {/* iOS 의 경우 한 줄 보조 안내 (선택) — Android 는 버튼 1개로 끝 */}
      {isIOS && (
        <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
          ↑ 버튼 누른 후 Safari 열고 주소창 길게 눌러 「붙여넣기 후 이동」
        </p>
      )}
      {isAndroid && (
        <p className="text-[11px] text-gray-400 mt-3">
          ↑ 안 통하면 ⋮ 메뉴 → 「다른 브라우저로 열기」
        </p>
      )}
    </div>
  )
}

export default InAppBrowserWarning
