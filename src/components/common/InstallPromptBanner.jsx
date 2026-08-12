import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Share } from 'lucide-react'
import { useInstallPrompt } from '../../hooks/useInstallPrompt'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import InstallIOSSheet from './InstallIOSSheet'
import {
  promptInstall,
  isStandalone,
  isNativeApp,
  isIOSSafari,
  isInAppBrowser,
} from '../../lib/installPrompt'

// 설치 유도 배너 — "홈 화면에 추가" 를 적절한 순간에 슬쩍 권함.
//   Android/Desktop Chrome: [설치] → 네이티브 설치 다이얼로그 원탭.
//   iOS Safari: 네이티브 이벤트가 없어 [방법 보기] → 설치 스크린샷 시트(InstallIOSSheet).
//   설치됨/스탠드얼론/네이티브앱/인앱브라우저/최근 닫음 → 노출 안 함.
//   닫으면 2주 침묵(localStorage), 설치되면 영구 숨김.
const DISMISS_KEY = 'install-nudge-dismissed-at'
const DISMISS_DAYS = 14
const SHOW_DELAY_MS = 4000

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (!at) return false
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

// 디자인 미리보기 — ?installpreview=1 이면 조건 무시하고 노출(dev 서버 http 에선 실제 이벤트가 안 나므로).
//   ?installpreview=ios 면 iOS 버전([방법 보기]+시트)을 안드로이드에서도 강제 미리보기.
//   sessionStorage 에 기록해 라우트 이동(스플래시→로그인 등)으로 쿼리스트링이 사라져도 유지.
function detectPreview() {
  if (typeof window === 'undefined') return { forced: false, ios: false }
  const params = new URLSearchParams(window.location.search)
  let val = null
  if (params.has('installpreview')) {
    val = params.get('installpreview') || '1'
    try {
      sessionStorage.setItem('installpreview', val)
    } catch {
      /* 무시 */
    }
  } else {
    try {
      val = sessionStorage.getItem('installpreview')
    } catch {
      /* 무시 */
    }
  }
  if (!val) return { forced: false, ios: false }
  return { forced: true, ios: val === 'ios' }
}

function InstallPromptBanner() {
  const { deferredPrompt, installed } = useInstallPrompt()
  const online = useOnlineStatus()
  const [delayPassed, setDelayPassed] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [iosSheetOpen, setIosSheetOpen] = useState(false)
  const [previewNote, setPreviewNote] = useState(false)
  const [preview] = useState(detectPreview)
  const previewForced = preview.forced

  useEffect(() => {
    const t = setTimeout(() => setDelayPassed(true), SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [])

  const ios = isIOSSafari() || preview.ios
  // 노출 부적격 — 이미 앱/닫음/인앱/오프라인
  const blocked =
    installed ||
    dismissed ||
    dismissedRecently() ||
    isStandalone() ||
    isNativeApp() ||
    isInAppBrowser() ||
    !online
  const eligible = !blocked && (!!deferredPrompt || ios)
  const show = previewForced ? !dismissed : delayPassed && eligible

  const markDismissed = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* localStorage 불가(사생활 모드 등) — 세션 내 숨김만 */
    }
    setDismissed(true)
  }

  const handleInstall = async () => {
    if (ios) {
      setIosSheetOpen(true) // iOS: 설치 스크린샷 시트 열기
    } else if (deferredPrompt) {
      const { outcome } = await promptInstall()
      // 거절해도 당분간 다시 안 띄움
      if (outcome !== 'accepted') markDismissed()
    } else if (previewForced) {
      setPreviewNote(true) // 미리보기(dev http) — 실제 설치 불가 안내
    } else {
      setDismissed(true)
    }
  }

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 108px)' }}
            role="dialog"
            aria-label="홈 화면에 추가"
          >
            <div className="flex items-center gap-3 bg-gray-900/95 text-white rounded-2xl shadow-xl px-4 py-3 backdrop-blur-sm">
              <img
                src="/app-icon.png"
                alt=""
                className="w-9 h-9 rounded-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">
                  도담을 홈 화면에 추가
                </p>
                <p className="text-[11px] text-gray-300 leading-tight mt-0.5">
                  {previewNote
                    ? '미리보기 — 실제 원탭 설치는 배포(HTTPS)에서 동작해요'
                    : '앱처럼 빠르게 열고 알림도 받아요'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleInstall}
                className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-full transition"
              >
                {ios ? (
                  <Share className="w-3.5 h-3.5" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {ios ? '방법 보기' : '설치'}
              </button>
              <button
                type="button"
                onClick={markDismissed}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-white transition"
                title="나중에"
                aria-label="나중에"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InstallIOSSheet isOpen={iosSheetOpen} onClose={() => setIosSheetOpen(false)} />
    </>
  )
}

export default InstallPromptBanner
