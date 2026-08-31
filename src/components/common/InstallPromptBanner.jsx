import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Share, CheckCircle2 } from 'lucide-react'
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
import { getInviteHint } from '../../lib/pendingInvite'

// 설치 유도 배너 — "홈 화면에 추가" 를 적절한 순간에 슬쩍 권함.
//   Android/Desktop Chrome: [설치] → 네이티브 설치 다이얼로그 원탭.
//   iOS Safari: 네이티브 이벤트가 없어 [방법 보기] → 설치 스크린샷 시트(InstallIOSSheet).
//   설치됨/스탠드얼론/네이티브앱/인앱브라우저 → 노출 안 함.
//   닫으면 "세션 한정"으로만 숨김(sessionStorage) — 앱을 다시 열면 재노출(설치 유도 우선).
//   설치되면 영구 숨김. 설치 완료(appinstalled) 시 → "설치 완료! 홈 화면 확인" 성공 배너.
const DISMISS_KEY = 'install-nudge-dismissed'
const SHOW_DELAY_MS = 4000
const DONE_SHOW_MS = 6000
// 실제 설치 완료 확인 폴링 — appinstalled 는 WebAPK 생성 전 이르게 올 수 있어,
// getInstalledRelatedApps() 로 "진짜 설치됨"을 확인될 때까지 폴링(최대 ~14초).
const CONFIRM_POLL_MS = 700
const CONFIRM_MAX_TRIES = 20

// 세션 한정 닫힘 — sessionStorage 는 탭/앱을 닫으면 비워지므로, 다시 들어오면 배너가 재노출된다.
function sessionDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

// 디자인 미리보기 — ?installpreview=1 이면 조건 무시하고 노출(dev 서버 http 에선 실제 이벤트가 안 나므로).
//   ?installpreview=ios 면 iOS 버전([방법 보기]+시트)을, =done 이면 설치 완료 배너를 강제 미리보기.
//   sessionStorage 에 기록해 라우트 이동(스플래시→로그인 등)으로 쿼리스트링이 사라져도 유지.
function detectPreview() {
  if (typeof window === 'undefined') return { forced: false, ios: false, done: false }
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
  if (!val) return { forced: false, ios: false, done: false }
  return { forced: true, ios: val === 'ios', done: val === 'done' }
}

function InstallPromptBanner() {
  const { deferredPrompt, installed } = useInstallPrompt()
  const online = useOnlineStatus()
  const [delayPassed, setDelayPassed] = useState(false)
  const [dismissed, setDismissed] = useState(sessionDismissed)
  const [iosSheetOpen, setIosSheetOpen] = useState(false)
  const [previewNote, setPreviewNote] = useState(false)
  const [preview] = useState(detectPreview)
  const previewForced = preview.forced
  const [justInstalled, setJustInstalled] = useState(preview.done)
  const prevInstalled = useRef(installed)
  const confirmingRef = useRef(false)

  useEffect(() => {
    const t = setTimeout(() => setDelayPassed(true), SHOW_DELAY_MS)
    return () => clearTimeout(t)
  }, [])

  // 실제 설치 "완료" 확인 — getInstalledRelatedApps() 로 앱이 진짜 설치됐는지 폴링해
  //   그 순간 완료 배너를 노출. appinstalled 는 WebAPK 생성 전 이르게 올 수 있어 이걸로 게이팅.
  const startConfirm = () => {
    if (confirmingRef.current || justInstalled) return
    confirmingRef.current = true
    const getApps =
      typeof navigator !== 'undefined' && navigator.getInstalledRelatedApps
        ? navigator.getInstalledRelatedApps.bind(navigator)
        : null
    if (!getApps) {
      setJustInstalled(true) // API 없음(구형/비지원) → appinstalled 확정으로 간주
      return
    }
    let tries = 0
    const poll = async () => {
      tries += 1
      let ok = false
      try {
        const apps = await getApps()
        ok = Array.isArray(apps) && apps.length > 0
      } catch {
        /* 무시하고 재시도 */
      }
      if (ok) {
        setJustInstalled(true)
        return
      }
      if (tries < CONFIRM_MAX_TRIES) setTimeout(poll, CONFIRM_POLL_MS)
      else setJustInstalled(true) // 확인 안 돼도 결국 노출(폴백)
    }
    poll()
  }

  // appinstalled(installed true 전환) → 실제 설치 완료 확인 시작
  useEffect(() => {
    const wasInstalled = prevInstalled.current
    prevInstalled.current = installed
    if (installed && !wasInstalled) startConfirm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installed])

  // 성공 배너는 잠깐 보여주고 자동으로 사라짐
  useEffect(() => {
    if (!justInstalled) return
    const t = setTimeout(() => setJustInstalled(false), DONE_SHOW_MS)
    return () => clearTimeout(t)
  }, [justInstalled])

  const ios = isIOSSafari() || preview.ios
  // 노출 부적격 — 이미 앱/닫음/인앱/오프라인
  //   ⚠️ 초대 미완료(inviteHint 존재) 중엔 숨김: 브라우저에서 설치 먼저 하면 localStorage 초대가
  //   설치된 앱(별도 저장소)으로 안 넘어가 프로그램 참여가 유실된다. 참여 완료(힌트 제거) 후 다시 노출.
  const blocked =
    installed ||
    dismissed ||
    isStandalone() ||
    isNativeApp() ||
    isInAppBrowser() ||
    !online ||
    (!previewForced && !!getInviteHint())
  const eligible = !blocked && (!!deferredPrompt || ios)
  const show = (previewForced ? !dismissed : delayPassed && eligible) && !justInstalled

  const markDismissed = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* sessionStorage 불가 — 세션 내 숨김(state)만 */
    }
    setDismissed(true)
  }

  const handleInstall = async () => {
    if (ios) {
      setIosSheetOpen(true) // iOS: 설치 스크린샷 시트 열기
    } else if (deferredPrompt) {
      const { outcome } = await promptInstall()
      // 수락 → 실제 설치 완료까지 확인 후 배너. 거절 → 당분간 침묵.
      if (outcome === 'accepted') startConfirm()
      else markDismissed()
    } else if (previewForced) {
      setPreviewNote(true) // 미리보기(dev http) — 실제 설치 불가 안내
    } else {
      setDismissed(true)
    }
  }

  return (
    <>
      <AnimatePresence>
        {/* 설치 완료 성공 배너 (우선) */}
        {justInstalled && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed left-1/2 -translate-x-1/2 z-[70] w-[calc(100%-2rem)] max-w-md"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 108px)' }}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3 bg-emerald-600/95 text-white rounded-2xl shadow-xl px-4 py-3 backdrop-blur-sm">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">설치 완료! 🎉</p>
                <p className="text-[11px] text-emerald-50 leading-tight mt-0.5">
                  홈 화면에서 도담 아이콘을 확인해보세요
                </p>
              </div>
              <button
                type="button"
                onClick={() => setJustInstalled(false)}
                className="flex-shrink-0 p-1 text-emerald-100 hover:text-white transition"
                title="닫기"
                aria-label="닫기"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* 설치 유도 배너 */}
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
