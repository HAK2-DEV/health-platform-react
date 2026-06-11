import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { registerSW } from 'virtual:pwa-register'
import { initSentry, SentryErrorBoundary } from './lib/sentry'
import { installSwipeBackBlocker } from './lib/disableSwipeBack'
import { setUpdateSW, notifyNeedRefresh } from './lib/pwaUpdate'

// Sentry 초기화 — VITE_SENTRY_DSN 있을 때만 활성. 가장 먼저 init 해야 이후 에러 추적 가능.
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
//   새 배포 감지 시 onNeedRefresh → 배너(PwaUpdatePrompt) 노출. 사용자가 「새로고침」 누르면
//   updateSW(true) 로 새 SW 활성화 + reload. 그 전까진 옛 버전 유지 (작업 중 강제 갱신 방지).
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    notifyNeedRefresh()
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
    <SentryErrorBoundary
      fallback={({ error }) => (
        <div className="min-h-screen flex items-center justify-center p-6 bg-surface-app">
          <div className="max-w-sm bg-white rounded-2xl shadow-soft border border-gray-100 p-6 text-center">
            <div className="text-3xl mb-2">😢</div>
            <h1 className="text-base font-bold text-gray-800 mb-1">앗, 문제가 발생했어요</h1>
            <p className="text-xs text-gray-500 mb-4 break-words">
              {error?.message || '예상치 못한 오류'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-full transition"
            >
              새로고침
            </button>
          </div>
        </div>
      )}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
        {/* DevTools 는 dev 서버에서만 렌더 — production 빌드에서 일반 사용자에게 노출 방지 */}
        {import.meta.env.DEV && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        )}
      </QueryClientProvider>
    </SentryErrorBoundary>
  </StrictMode>,
)
