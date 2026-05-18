import { useState, useEffect} from "react"
import { supabase } from "../supabaseClient"
import { Navigate } from "react-router-dom"
import SupabaseTodos from "../components/SupabaseTodos"

function TodosPage() {
    const [session, setSession] = useState(null)
    const [isLoading, setIsLoading]= useState(true)
//처음 화면에서 렌더링. 
    useEffect ( ()=> {
        supabase.auth.getSession().then( ({data: { session } }) => {
        setSession(session)
        setIsLoading(false)
        })
// 로그인 상태 지속 감시
        const {data: {subscription}} = supabase.auth.onAuthStateChange(
         (_event, session) => setSession(session)   
        )
 // 지속 감시 중단   
        return() => subscription.unsubscribe()
    }, [])

if (isLoading) { return<p>⏳ 로딩 중...</p>}

// 로그인 안 됐으면 .login으로 이동
if (!session) { return <Navigate to="/login" />
}
    return<SupabaseTodos session={session} />
} 

export default TodosPage