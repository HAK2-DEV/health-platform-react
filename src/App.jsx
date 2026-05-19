import { Routes, Route } from 'react-router-dom'
import './index.css'
import './App.css'
import { supabase } from './supabaseClient'
import { useAuth } from './hooks/useAuth'
import HomePage from './pages/HomePage'
import TodosPage from './pages/TodosPage'
import LoginPage from './pages/LoginPage'
import { Activity, User, LogOut } from 'lucide-react'

function App() {
  const {session} = useAuth()



  return (
    <div className="app">
      {/* ⭐ 헤더 - Routes 밖 (모든 페이지 공통) */}
      {session && (
  <header className="bg-green-500 text-white px-6 py-4 flex justify-between items-center shadow-md">
    <h1 className="flex items-center gap-2 text-xl font-medium whitespace-nowrap">
      <Activity className="w-6 h-6" />
      건강증진 플랫폼
    </h1>
    
    <div className="flex items-center gap-4 text-sm whitespace-nowrap">
      <span className="hidden sm:flex items-center gap-1">
        <User className="w-4 h-4" />
        {session.user.email.split('@')[0]}
      </span>
      <button 
        onClick={() => supabase.auth.signOut()} 
        className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 border border-white/30 rounded text-sm transition whitespace-nowrap flex-shrink-0"
      >
        <LogOut className="w-4 h-4" />
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