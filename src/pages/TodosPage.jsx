import { useAuth } from '../hooks/useAuth'
import { Navigate } from "react-router-dom";
import SupabaseTodos from '../components/SupabaseTodos'
 

function TodosPage() {
    const {session, isLoading} =useAuth()

    if(isLoading) {
        return <p>⏳ 로딩 중...</p>
  }

  if (!session) {
    return <Navigate to="/login" />
  }

    return <SupabaseTodos session={session} />
    
}

export default TodosPage