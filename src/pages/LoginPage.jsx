import { useState, useEffect} from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import AuthForm from '../components/AuthForm'


function LoginPage() {
    // 
    const navigate = useNavigate()

    useEffect(() => {
        //로그인 됐으면 /todos로 자리 이동
        supabase.auth.getSession().then(({data: {session}}) => {
            if (session) {
                navigate ('/todos')

            }
        }
    )  

        //로그인 상태 감시
    const { data: {subscription}} = supabase.auth.onAuthStateChange(
        (_event, session) => {
            if (session) {
                navigate('/todos')
            }
        }
    )

        //감시 종료
        return ()=> subscription.unsubscribe()

    }, [navigate]) 
    
  return (
    <div className='welcome-screen'>
        <h1>🏃 건강증진 플랫폼</h1>
      <p className="welcome-tagline">
        본인의 건강을 함께 관리해요
      </p>
      <AuthForm />
    </div>
  )
}

export default LoginPage