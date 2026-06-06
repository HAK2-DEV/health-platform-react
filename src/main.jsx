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

// Sentry 초기화 — VITE_SENTRY_DSN 있을 때만 활성. 가장 먼저 init 해야 이후 에러 추적 가능.
initSentry()

// 모바일 가로 스와이프 뒤로가기 차단 (좌·우 가장자리 터치) — PWA standalone 모드면 자동 skip.
installSwipeBackBlocker()

// Service Worker 등록 — autoUpdate 전략
//   새 배포 감지 시 백그라운드에서 새 SW 다운로드 → 다음 페이지 진입(또는 즉시 reload)에 적용
//   사용자가 PWA 를 매번 삭제·재추가할 필요 없음
registerSW({ immediate: true })

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
