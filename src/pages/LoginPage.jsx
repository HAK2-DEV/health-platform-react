import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import AuthForm from '../components/AuthForm'
import { Activity } from 'lucide-react'

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
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6">

    <h1 className="flex items-center gap-2 text-xl font-medium whitespace-nowrap">
  <Activity className="w-6 h-6" />
  건강증진 플랫폼
</h1>
      <p className="text-gray-600 text-base mb-6">
        본인의 건강을 함께 관리해요
      </p>
      <AuthForm />
    </div>
  )
}

export default LoginPage