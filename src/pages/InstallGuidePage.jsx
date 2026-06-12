import { useEffect, useState } from 'react'
import { Share, MoreVertical, Plus, Check, Smartphone, Monitor, Apple } from 'lucide-react'
import StickyBackBar from '../components/common/StickyBackBar'
import InAppBrowserWarning from '../components/install/InAppBrowserWarning'
import { detectInAppBrowser } from '../lib/inAppBrowser'

// Day 65 — PWA 설치 가이드 페이지.
// 사용자 플랫폼 감지 후 단계별 설치 안내. iOS Safari / Android Chrome / Desktop Chrome 분기.
// 이미 standalone(설치 완료) 상태면 "이미 설치됨" 노출.
//
// 라우트: /install
// 진입점: 로그인 페이지·로그인 후 첫 화면·프로필 메뉴에서 링크

// 플랫폼 감지 — UA 기반
function detectPlatform() {
  if (typeof window === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true
  if (isStandalone) return 'installed'
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

function InstallGuidePage() {
  const [platform, setPlatform] = useState('unknown')
  const [inAppBrowser, setInAppBrowser] = useState(null)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())
    setInAppBrowser(detectInAppBrowser())

    // Android Chrome / Desktop Chrome — beforeinstallprompt 이벤트 캐치
    const handleBeforeInstall = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    const handleAppInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      setInstalled(true)
    }
    setDeferredPrompt(null)
  }

  return (
    <div className="min-h-screen bg-surface-app">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">
        <StickyBackBar fallbackPath="/" title="뒤로" />

        <div className="mt-2 mb-5">
          <h1 className="text-2xl font-bold text-gray-800">📲 앱으로 설치하기</h1>
          <p className="text-sm text-gray-500 mt-1.5">
            홈 화면에 추가하면 일반 앱처럼 빠르게 열고, 알림도 받을 수 있어요
          </p>
        </div>

        {/* 인앱 브라우저(카톡 등) 감지 시 최상단에 경고 + 외부 브라우저 열기 안내.
            군 베타 환경 — 카메라 잠겨 QR 스캔 불가. 카톡 링크 → 외부 브라우저 흐름이 유일. */}
        <InAppBrowserWarning browser={inAppBrowser} />

        {(platform === 'installed' || installed) && <InstalledCard />}

        {/* 3개 기기 가이드 모두 노출 — 본인 기기엔 "현재 기기" 뱃지.
            사용자가 다른 기기 사용자에게 링크 공유할 때도 한 페이지에서 다 봄. */}
        <IOSGuide isCurrent={platform === 'ios'} />
        <AndroidGuide
          isCurrent={platform === 'android'}
          deferredPrompt={deferredPrompt}
          onInstall={handleInstallClick}
        />
        <DesktopGuide
          isCurrent={platform === 'desktop'}
          deferredPrompt={deferredPrompt}
          onInstall={handleInstallClick}
        />

        <BenefitsCard />
      </div>
    </div>
  )
}

function InstalledCard() {
  return (
    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-card-lg p-6 text-center mb-4">
      <Check className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
      <h2 className="text-lg font-bold text-gray-800 mb-1">이미 설치됨</h2>
      <p className="text-sm text-gray-600">
        홈 화면에서 앱 아이콘을 눌러 빠르게 접속할 수 있어요
      </p>
    </div>
  )
}

// iOS Safari — 자동 install prompt 미지원. 사용자 직접 「공유 → 홈 화면에 추가」 필요.
function IOSGuide({ isCurrent }) {
  return (
    <div className={`bg-white rounded-card-lg shadow-soft p-5 mb-4 ${isCurrent ? 'border-2 border-emerald-300' : 'border border-gray-100'}`}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Apple className="w-5 h-5 text-gray-700" />
          <h2 className="text-base font-bold text-gray-800">iPhone · iPad (Safari)</h2>
        </div>
        {isCurrent && (
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-pill">
            현재 기기
          </span>
        )}
      </div>

      <Step
        num={1}
        icon={<Share className="w-5 h-5 text-blue-500" />}
        title="화면 하단 「공유」 버튼 누르기"
        description="Safari 화면 아래쪽 가운데에 위쪽 화살표 모양 아이콘이 있어요"
      />
      <Step
        num={2}
        icon={<Plus className="w-5 h-5 text-gray-700" />}
        title="「홈 화면에 추가」 선택"
        description="공유 메뉴 안에서 아래로 살짝 스크롤하면 보여요"
      />
      <Step
        num={3}
        icon={<Check className="w-5 h-5 text-emerald-600" />}
        title="우상단 「추가」 탭"
        description="이름 확인 후 추가 — 홈 화면에 🌿 Health 아이콘이 생겨요"
      />

      <p className="mt-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
        ⚠️ Chrome · 다른 브라우저는 「홈 화면에 추가」 메뉴가 없어요. 반드시 <b>Safari</b> 로 이 페이지를 다시 열어주세요.
      </p>
    </div>
  )
}

// Android Chrome — beforeinstallprompt 자동 활성 가능
function AndroidGuide({ isCurrent, deferredPrompt, onInstall }) {
  return (
    <div className={`bg-white rounded-card-lg shadow-soft p-5 mb-4 ${isCurrent ? 'border-2 border-emerald-300' : 'border border-gray-100'}`}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-bold text-gray-800">Android (Chrome)</h2>
        </div>
        {isCurrent && (
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-pill">
            현재 기기
          </span>
        )}
      </div>

      {deferredPrompt ? (
        <>
          <p className="text-sm text-gray-600 mb-3">
            아래 버튼 한 번이면 설치돼요!
          </p>
          <button
            type="button"
            onClick={onInstall}
            className="w-full px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold rounded-pill shadow-soft transition flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            지금 설치하기
          </button>
          <p className="mt-3 text-xs text-gray-500 text-center">
            버튼이 안 보이면 아래 수동 방법을 따라주세요
          </p>
          <div className="my-4 border-t border-gray-100" />
        </>
      ) : null}

      <Step
        num={1}
        icon={<MoreVertical className="w-5 h-5 text-gray-700" />}
        title="Chrome 우상단 「⋮」 메뉴"
      />
      <Step
        num={2}
        icon={<Smartphone className="w-5 h-5 text-emerald-600" />}
        title="「앱 설치」 또는 「홈 화면에 추가」 선택"
      />
      <Step
        num={3}
        icon={<Check className="w-5 h-5 text-emerald-600" />}
        title="「설치」 확인"
        description="잠깐 기다리면 홈 화면에 🌿 Health 아이콘이 생겨요"
      />
    </div>
  )
}

// Desktop Chrome/Edge — 주소창에 install 아이콘
function DesktopGuide({ isCurrent, deferredPrompt, onInstall }) {
  return (
    <div className={`bg-white rounded-card-lg shadow-soft p-5 mb-4 ${isCurrent ? 'border-2 border-emerald-300' : 'border border-gray-100'}`}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Monitor className="w-5 h-5 text-gray-700" />
          <h2 className="text-base font-bold text-gray-800">데스크탑 (Chrome · Edge)</h2>
        </div>
        {isCurrent && (
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-pill">
            현재 기기
          </span>
        )}
      </div>

      {deferredPrompt && (
        <>
          <button
            type="button"
            onClick={onInstall}
            className="w-full mb-4 px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold rounded-pill shadow-soft transition flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            지금 설치하기
          </button>
        </>
      )}

      <Step
        num={1}
        icon={<Plus className="w-5 h-5 text-emerald-600" />}
        title="주소창 오른쪽 끝의 「설치」 아이콘"
        description="📌 모니터에 화살표 들어가는 모양"
      />
      <Step
        num={2}
        icon={<Check className="w-5 h-5 text-emerald-600" />}
        title="「설치」 클릭"
        description="별도 창으로 열리고 바탕화면에 바로가기 생성"
      />
    </div>
  )
}

function Step({ num, icon, title, description }) {
  return (
    <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-shrink-0 w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm">
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {icon}
          <p className="font-semibold text-gray-800 text-sm">{title}</p>
        </div>
        {description && (
          <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  )
}

function BenefitsCard() {
  return (
    <div className="bg-emerald-50/60 border border-emerald-100 rounded-card-lg p-5 mt-4">
      <h3 className="font-bold text-gray-800 mb-2">💡 설치하면 좋은 점</h3>
      <ul className="text-sm text-gray-700 space-y-1.5 list-disc list-inside">
        <li>홈 화면에서 한 번 탭으로 빠르게 열림</li>
        <li>주소창·브라우저 메뉴가 사라져 화면을 더 크게 사용</li>
        <li>알림 받기 가능 (추후 추가 예정)</li>
        <li>오프라인에서도 일부 기능 동작</li>
        <li>일반 앱처럼 자동 업데이트 — 매번 새 버전 신경 X</li>
      </ul>
    </div>
  )
}

export default InstallGuidePage
