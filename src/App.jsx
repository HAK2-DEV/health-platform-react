import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import './index.css'
import './App.css'
import { useAuth } from './hooks/useAuth'
import HomePage from './pages/HomePage'
import TodosPage from './pages/TodosPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'                  // ⭐ 추가
import NicknameSetupPage from './pages/NicknameSetupPage'    // ⭐ 추가
import DashboardPage from './pages/DashboardPage'                       // ⭐ 새 경로
import ProgramNewPage from './pages/program/ProgramNewPage'            // ⭐ 추가
import ProgramDetailPage from './pages/program/ProgramDetailPage'
import MissionVerifyPage from './pages/program/MissionVerifyPage'
import ProgramListPage from './pages/program/ProgramListPage'
import RankingsPage from './pages/RankingsPage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePage from './pages/ProfilePage'
import BottomTabBar from './components/common/BottomTabBar'
import { Bell } from 'lucide-react'
import ProtectedRoute from './components/ProtectedRoute'   // ⭐ 추가

function AppShell() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // 자체 상단 영역을 갖는 페이지는 App 헤더 숨김
  // - /dashboard
  // - /programs/:id (ProgramDetailPage — 단, /programs 와 /programs/new 는 제외)
  // - /programs/:id/missions/:missionId (MissionVerifyPage — 풀스크린 인증)
  const isProgramDetail =
    location.pathname.startsWith('/programs/') &&
    location.pathname !== '/programs/new'
  const hideHeader = location.pathname === '/dashboard' || isProgramDetail
  // BottomTabBar 숨김 — 운영자 집중(마법사) + 참여자 집중(미션 인증)
  const isMissionVerify = /^\/programs\/[^/]+\/missions\/[^/]+$/.test(location.pathname)
  const hideBottomBar = location.pathname === '/programs/new' || isMissionVerify

  return (
   <div className="app">
      {session && !hideHeader && (
        <header className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 flex justify-between items-center">
          <p className="text-sm text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis pr-2">
            안녕하세요, 오늘도 건강한 하루 되세요! 🌿
          </p>
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition flex-shrink-0"
            title="알림"
          >
            <Bell className="w-4 h-4 text-gray-600" />
          </button>
        </header>
      )}
      
      <main className={`app-main ${session && !hideBottomBar ? 'pb-24' : 'pb-4'}`}>
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
  <Route path="/programs/:id" element={
    <ProtectedRoute><ProgramDetailPage /></ProtectedRoute>
  } />
  <Route path="/programs/:programId/missions/:missionId" element={
    <ProtectedRoute><MissionVerifyPage /></ProtectedRoute>
  } />
  <Route path="/programs" element={
    <ProtectedRoute><ProgramListPage /></ProtectedRoute>
  } />
  <Route path="/rankings" element={
    <ProtectedRoute><RankingsPage /></ProtectedRoute>
  } />
  <Route path="/notifications" element={
    <ProtectedRoute><NotificationsPage /></ProtectedRoute>
  } />
  <Route path="/profile" element={
    <ProtectedRoute><ProfilePage /></ProtectedRoute>
  } />
  <Route path="/todos" element={
    <ProtectedRoute><TodosPage /></ProtectedRoute>
  } />
</Routes>
      </main>

      {/* 하단 5탭 네비 (로그인 + 마법사 외 페이지) */}
      {session && !hideBottomBar && <BottomTabBar />}
    </div>
  )
}

// useNavigate/useLocation 은 Router 컨텍스트 안에서만 사용 가능하므로 main.jsx 의 BrowserRouter 안에서 렌더링.
function App() {
  return <AppShell />
}

export default App