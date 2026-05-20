import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

function ProtectedRoute({ children }) {
  const { session, isLoading } = useAuth()
  
  // 세션 로딩 중 = 대기
  if (isLoading) {
    return <p className="text-center p-8">⏳ 로딩 중...</p>
  }
  
  // 세션 없음 = 로그인으로
  if (!session) {
    return <Navigate to="/login" replace />
  }
  
  // 세션 있음 = 자식 보여주기
  return children
}

export default ProtectedRoute