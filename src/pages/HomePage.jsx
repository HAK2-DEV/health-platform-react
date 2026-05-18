import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Navigate } from 'react-router-dom'


function HomePage() {
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )

    return () => subscription.unsubscribe()
  }, [])

  if (isLoading) {
    return <p>⏳ 로딩 중...</p>
  }


if (isLoading) {
    return <p>⏳ 로딩 중...</p>
}
//로그인 됌 /todos/ 로그인 안됌 -> /login

if (session) { return <Navigate to="/todos" />
    }
    else {
        return <Navigate to = '/login' />
    }
}

export default HomePage