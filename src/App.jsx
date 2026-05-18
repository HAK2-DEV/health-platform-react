import { useState, useEffect } from 'react' 
import './App.css'
import { supabase } from './supabaseClient'
import SupabaseTodos from './components/SupabaseTodos'
import AuthForm from './components/AuthForm'

function App() {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
      // 1. 처음에 할 일 로그인 세션 확인
      supabase.auth.getSession().then(({data: {session}}) => {
        setSession(session)
        setIsLoading(false)
      })
   //2. 계속 감시해야 할 일
      const{ data: {subscription}} = supabase.auth.onAuthStateChange((_event, session)=> setSession(session)
    )
     //3. 정리해야 할 일
    return () => subscription.unsubscribe()
  }, [])


    if (isLoading) {
       return (
      <div className='app'>
         <div className='loading-screen'>
          <p>⏳ 로딩 중...</p>
          </div> 
      </div>
      
      )
    }


  return (
    <div className='app'>
         {/* 헤더 - 로그인 시에만 */}
          {session && (<header className='app-header'>
              <h1>🏃 건강증진 플랫폼</h1>
              <div className='header-user'>
                <span className='user-email'>👤 {session.user.email.split('@')[0]}</span>
                <button onClick={()=> supabase.auth.signOut()} className='btn-logout'>
                  로그아웃
                </button>
              
              </div>
          </header>
        )}
      

     {/* 메인 - 로그인 상태에 따라 */}
      <main className='app-main'>
        {session ? (<SupabaseTodos session={session}/> 
        ) : ( 
        <div className='welcome-screen'>
            <h1>🏃 건강증진 플랫폼</h1>
            <p className="welcome-tagline">
              본인의 건강을 함께 관리해요
            </p>
            <AuthForm />
        </div>)}
      </main>
      </div>
   
  )
}

export default App