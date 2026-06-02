import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { registerSW } from 'virtual:pwa-register'

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
  </StrictMode>,
)
