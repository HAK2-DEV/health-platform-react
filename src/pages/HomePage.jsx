import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'


function HomePage() {
  const [session,isLoading] = useAuth()

  if (isLoading) {
    return<p>⏳ 로딩 중...</p>
  }

  if (session) {
    return <Navigate to ='/todos'/>
  }
  return<Navigate to="login" />
  }

export default HomePage