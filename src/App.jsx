import { Routes, Route } from 'react-router-dom'
import './index.css'
import './App.css'
import { supabase } from './supabaseClient'
import { useAuth } from './hooks/useAuth'
import HomePage from './pages/HomePage'
import TodosPage from './pages/TodosPage'
import LoginPage from './pages/LoginPage'

function App() {
  const {session} = useAuth()



  return (
    <div className="app">
      {/* ⭐ 헤더 - Routes 밖 (모든 페이지 공통) */}
      {session && (
        <header className="app-header">
          <h1>🏃 건강증진 플랫폼</h1>
          <div className="header-user">
            <span className="user-email">
              👤 {session.user.email.split('@')[0]}
            </span>
            <button 
              onClick={() => supabase.auth.signOut()} 
              className="btn-logout"
            >
              로그아웃
            </button>
          </div>
        </header>
      )}
      
      {/* ⭐ 메인 - Routes 안에 페이지들 */}
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/todos" element={<TodosPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </main>
    </div>
  )
}
export default App