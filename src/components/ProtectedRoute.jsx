import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function ProtectedRoute({ children }) {
  const { session, isLoading } = useAuth()
  
  // 세션 로딩 중 = 대기 (화면 정중앙 — fixed 로 부모 패딩/세이프영역 무관하게 중앙)
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-2 text-gray-500">
        <span className="text-4xl animate-pulse" aria-hidden="true">⏳</span>
        <p className="text-sm">로딩 중...</p>
      </div>
    )
  }
  
  // 세션 없음 = 로그인으로
  if (!session) {
    return <Navigate to="/login" replace />
  }
  
  // 세션 있음 = 자식 보여주기
  return children
}

export default ProtectedRoute