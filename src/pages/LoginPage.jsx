import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AuthForm from '../components/AuthForm'

function LoginPage() {
    const {session} =useAuth()
     const navigate= useNavigate()
useEffect (()=> {
    //이미 로그인 됐으면 /todos 으로
    if (session) {
         navigate('/todos')
    }
}, [session, navigate])

return (
      <div className="welcome-screen">
      <h1>🏃 건강증진 플랫폼</h1>
      <p className="welcome-tagline">
        본인의 건강을 함께 관리해요
      </p>
      <AuthForm />
    </div>
  )
}

export default LoginPage