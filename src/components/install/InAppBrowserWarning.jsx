import { useState } from 'react'
import { AlertTriangle, Copy, Check, ExternalLink } from 'lucide-react'
import {
  IN_APP_BROWSER_NAME,
  isIOSDevice,
  isAndroidDevice,
  buildChromeIntentUrl,
} from '../../lib/inAppBrowser'

// 카톡 등 인앱 브라우저에서 진입한 경우 노출되는 경고 + 외부 브라우저 열기 안내.
// PWA 설치는 인앱 브라우저에선 절대 안 됨 — 사용자를 Safari/Chrome 으로 유도해야 함.

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
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // clipboard API 차단 시 — 사용자가 직접 선택·복사하도록 안내
      window.prompt('아래 주소를 복사해 Safari/Chrome 에 붙여넣어주세요', currentUrl)
    }
  }

  // Android 인앱에서 Chrome 강제 실행 시도 (보장 X)
  const handleOpenChrome = () => {
    window.location.href = buildChromeIntentUrl(currentUrl)
  }

  return (
    <div className="bg-red-50 border-2 border-red-300 rounded-card-lg p-5 mb-4">
      <div className="flex items-start gap-3 mb-3">
        <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="text-base font-bold text-red-700">
            {name} 안에선 설치할 수 없어요
          </h2>
          <p className="text-sm text-red-600 mt-1 leading-relaxed">
            {name} 브라우저는 「홈 화면에 추가」 메뉴를 지원하지 않아요.
            <br />아래 방법으로 <b>{isIOS ? 'Safari' : 'Chrome'}</b> 에서 다시 열어주세요.
          </p>
        </div>
      </div>

      {/* 플랫폼별 외부 브라우저 열기 안내 */}
      {isIOS ? (
        <IOSKakaoSteps />
      ) : isAndroid ? (
        <AndroidKakaoSteps onOpenChrome={handleOpenChrome} />
      ) : (
        <p className="text-sm text-gray-600 mt-3">
          기기에서 직접 Safari 또는 Chrome 을 실행 후, 아래 URL 을 붙여넣어주세요.
        </p>
      )}

      {/* URL 복사 — 외부 브라우저에 직접 붙여넣을 수 있게 */}
      <div className="mt-4 pt-4 border-t border-red-200">
        <p className="text-xs text-red-600 font-medium mb-2">
          또는 이 페이지 URL 을 복사해서 {isIOS ? 'Safari' : 'Chrome'} 에 붙여넣기:
        </p>
        <div className="flex items-stretch gap-2">
          <input
            type="text"
            value={currentUrl}
            readOnly
            onClick={(e) => e.target.select()}
            className="flex-1 min-w-0 px-3 py-2 bg-white border border-red-200 rounded-md text-xs text-gray-700 font-mono truncate"
          />
          <button
            type="button"
            onClick={handleCopy}
            className={`flex-shrink-0 px-3 py-2 rounded-md text-xs font-semibold transition inline-flex items-center gap-1 ${
              copied
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {copied ? <><Check className="w-3.5 h-3.5" />복사됨</> : <><Copy className="w-3.5 h-3.5" />복사</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// iOS 카카오톡 안에서 Safari 로 여는 절차 (텍스트 안내)
function IOSKakaoSteps() {
  return (
    <ol className="mt-3 space-y-2 text-sm text-gray-700">
      <Step num={1}>
        화면 <b>우측 하단의 「⋯」</b> 또는 <b>「공유」 버튼</b> 탭
      </Step>
      <Step num={2}>
        메뉴에서 <b>「Safari 로 열기」</b> 또는 <b>「다른 앱으로 열기 → Safari」</b> 선택
      </Step>
      <Step num={3}>
        Safari 가 열리면 같은 페이지가 다시 보이고, 그때부터 설치 안내를 따라주세요
      </Step>
    </ol>
  )
}

// Android 카카오톡 안에서 Chrome 으로 여는 절차
function AndroidKakaoSteps({ onOpenChrome }) {
  return (
    <>
      <ol className="mt-3 space-y-2 text-sm text-gray-700">
        <Step num={1}>
          화면 <b>우측 상단의 「⋮」 메뉴</b> 탭
        </Step>
        <Step num={2}>
          <b>「다른 브라우저로 열기」</b> 또는 <b>「Chrome 으로 열기」</b> 선택
        </Step>
        <Step num={3}>
          Chrome 이 열리면 같은 페이지가 다시 보이고, 그때부터 설치 안내를 따라주세요
        </Step>
      </ol>
      <button
        type="button"
        onClick={onOpenChrome}
        className="w-full mt-3 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-pill transition inline-flex items-center justify-center gap-2"
      >
        <ExternalLink className="w-4 h-4" />
        Chrome 으로 즉시 열기 시도
      </button>
      <p className="text-[11px] text-red-600 mt-1.5 text-center">
        ※ 위 버튼이 안 통하면 위 1-3 단계 수동 진행
      </p>
    </>
  )
}

function Step({ num, children }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex-shrink-0 w-6 h-6 bg-red-100 text-red-700 rounded-full flex items-center justify-center font-bold text-xs">
        {num}
      </span>
      <span className="flex-1 leading-relaxed">{children}</span>
    </li>
  )
}

export default InAppBrowserWarning
