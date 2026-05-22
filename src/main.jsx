import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

// React Query 단일 client — 모든 화면이 같은 캐시를 봄
// staleTime: 1분 — 본인이 같은 화면을 1분 안에 다시 들어와도 재요청 안 함 (가벼움)
// gcTime: 5분 — 화면 이탈 후 5분간 캐시 유지
// refetchOnWindowFocus: true — 탭 다시 보면 자동 갱신 (본인이 원했던 미래 자동 갱신)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
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
