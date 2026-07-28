import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { registerSW } from 'virtual:pwa-register'
import { initSentry } from './lib/sentry'
import { installSwipeBackBlocker } from './lib/disableSwipeBack'
import { setUpdateSW, notifyNeedRefresh } from './lib/pwaUpdate'
import ErrorBoundary from './components/common/ErrorBoundary'
import ScreenTracker from './components/common/ScreenTracker'

// Sentry 초기화 — 지연 로딩(첫 페인트 이후 idle). DSN 없으면 no-op.
initSentry()

// 모바일 가로 스와이프 뒤로가기 차단 (좌·우 가장자리 터치) — PWA standalone 모드면 자동 skip.
installSwipeBackBlocker()

// 새 배포 후 구버전 탭 자가복구 —
//   배포 시 Vite 가 청크 해시를 바꿔 옛 청크가 사라짐 → 구버전 탭이 아직 안 불러온
//   화면(lazy)으로 이동하면 옛 청크 404 → "Failed to fetch dynamically imported module".
//   vite:preloadError 를 받아 1회 새로고침으로 최신 빌드 로드.
//   10초 가드 — 새로고침 직후 또 실패하면(네트워크 등) 무한 루프 방지.
window.addEventListener('vite:preloadError', () => {
  const KEY = 'vite-preload-reload-at'
  const last = Number(sessionStorage.getItem(KEY) || 0)
  if (Date.now() - last < 10_000) return
  sessionStorage.setItem(KEY, String(Date.now()))
  window.location.reload()
})

// Service Worker 등록 — prompt 전략
//   새 배포 감지 → 새 SW 대기 → onNeedRefresh 발생 → PwaUpdatePrompt 배너 노출.
//   사용자가 「새로고침」 누르면 브랜드 스플래시 뒤 updateSW(true)로 skipWaiting+reload.
//   오래 켜둔 세션도 15분마다 + 앱이 다시 포커스될 때 update() 로 새 배포 확인 → 기기 간
//   배너 노출 시점 편차 축소. 청크404 는 vite:preloadError 자가복구.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { notifyNeedRefresh() },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    setInterval(() => { registration.update() }, 15 * 60_000)   // 15분 주기
    // 앱으로 돌아오는 순간 확인 → 사용자가 배너를 볼 자연스러운 시점에 즉시 감지
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update()
    })
  },
})
setUpdateSW(updateSW)

// React Query 단일 client — 모든 화면이 같은 캐시를 봄
// staleTime: 5분 (Day 65 조정) — Egress 절감용. mutation onSuccess 의 invalidateQueries 가
//   잘 되어 있어 데이터 갱신은 보장되며, 페이지 재진입/탭 전환은 캐시 사용으로 네트워크 절약.
// gcTime: 10분 — 화면 이탈 후 10분간 캐시 유지 (재진입 시 즉시 표시 + 백그라운드 refetch).
// refetchOnWindowFocus: true — 탭 다시 보면 자동 갱신 (단 staleTime 5분 안이면 skip).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
          {/* 화면 체류 분석(자체, 콘텐츠 미수집·프로드 한정) — Router 안에서 useLocation 사용 */}
          <ScreenTracker />
        </BrowserRouter>
        {/* DevTools 는 dev 서버에서만 렌더 — production 빌드에서 일반 사용자에게 노출 방지 */}
        {import.meta.env.DEV && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        )}
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
