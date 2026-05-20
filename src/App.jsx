import { Routes, Route } from 'react-router-dom'
import './index.css'
import './App.css'
import { supabase } from './supabaseClient'
import { useAuth } from './hooks/useAuth'
import HomePage from './pages/HomePage'
import TodosPage from './pages/TodosPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'                  // ⭐ 추가
import NicknameSetupPage from './pages/NicknameSetupPage'    // ⭐ 추가
import DashboardPage from './pages/DashboardPage'                       // ⭐ 새 경로
import ProgramNewPage from './pages/program/ProgramNewPage'            // ⭐ 추가
import { Activity, User, LogOut } from 'lucide-react'
import ProtectedRoute from './components/ProtectedRoute'   // ⭐ 추가

function App() {
  const { session, nickname } = useAuth()   

  return (
   <div className="app">
      {session && (
        <header className="bg-green-500 text-white px-6 py-4 flex justify-between items-center shadow-md">
          <h1 className="flex items-center gap-2 text-xl font-medium whitespace-nowrap">
            <Activity className="w-6 h-6" />
            건강증진 플랫폼
          </h1>
          
          <div className="flex items-center gap-4 text-sm whitespace-nowrap">
            <span className="hidden sm:flex items-center gap-1">
              <User className="w-4 h-4" />
              {nickname || session.user.email.split('@')[0]}   {/* ⭐ 진화 */}
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
      
      <main className="app-main">
        <Routes>
  {/* 보호 X (누구나) */}
  <Route path="/" element={<HomePage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/signup" element={<SignupPage />} />
  
  {/* 보호 O (로그인 필요) */}
  <Route path="/nickname-setup" element={
    <ProtectedRoute><NicknameSetupPage /></ProtectedRoute>
  } />
  <Route path="/dashboard" element={
    <ProtectedRoute><DashboardPage /></ProtectedRoute>
  } />
  <Route path="/programs/new" element={
    <ProtectedRoute><ProgramNewPage /></ProtectedRoute>
  } />
  <Route path="/todos" element={
    <ProtectedRoute><TodosPage /></ProtectedRoute>
  } />
</Routes>
      </main>
    </div>
  )
}
export default App