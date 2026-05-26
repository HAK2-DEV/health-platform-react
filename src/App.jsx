import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
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
import BundleDetailPage from './pages/program/BundleDetailPage'
import ProgramStatsPage from './pages/program/ProgramStatsPage'
import ProgramStatsMissionsPage from './pages/program/ProgramStatsMissionsPage'
import ProgramStatsUsersPage from './pages/program/ProgramStatsUsersPage'
import ProgramStatsUserDetailPage from './pages/program/ProgramStatsUserDetailPage'
import ProgramStatsUserMissionsPage from './pages/program/ProgramStatsUserMissionsPage'
import ProgramStatsUserVerificationsPage from './pages/program/ProgramStatsUserVerificationsPage'
import ProgramStatsUserVerificationsBundlePage from './pages/program/ProgramStatsUserVerificationsBundlePage'
import ProgramStatsUserVerificationsMissionPage from './pages/program/ProgramStatsUserVerificationsMissionPage'
import ProgramReviewsPage from './pages/program/ProgramReviewsPage'
import ProgramReviewsBundlePage from './pages/program/ProgramReviewsBundlePage'
import ProgramReviewsMissionPage from './pages/program/ProgramReviewsMissionPage'
import ProgramFeedPage from './pages/program/ProgramFeedPage'
import MissionVerifyPage from './pages/program/MissionVerifyPage'
import ProgramListPage from './pages/program/ProgramListPage'
import RankingsPage from './pages/RankingsPage'
import NotificationsPage from './pages/NotificationsPage'
import ProfilePage from './pages/ProfilePage'
import JoinByCodePage from './pages/JoinByCodePage'
import BottomTabBar from './components/common/BottomTabBar'
import ProtectedRoute from './components/ProtectedRoute'   // ⭐ 추가

function AppShell() {
  const { session } = useAuth()
  const location = useLocation()

  // 라우트 변경 시 무조건 페이지 상단부터 시작 — 본인 결정 (Day 55)
  //   다른 페이지로 넘어가면 스크롤 위치가 어디든 reset
  //   같은 페이지에서 query/hash 만 바뀌는 경우 (예: 피드 ?v=&c=) 는 그 컴포넌트가 scrollIntoView 로 직접 제어하므로 별도 처리
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // App 레벨 헤더(인사말 + 종 아이콘) 제거 — 본인 결정 (Day 55)
  //   Dashboard 는 자체 그라데이션 헤더(인사말 + 종 + 마스코트)를 가짐.
  //   나머지 페이지는 BottomTabBar 의 🔔 알림 탭으로 충분 → 중복 헤더 제거.
  // BottomTabBar 숨김 — 운영자 집중(마법사) + 참여자 집중(미션 인증)
  const isMissionVerify = /^\/programs\/[^/]+\/missions\/[^/]+$/.test(location.pathname)
  const hideBottomBar = location.pathname === '/programs/new' || isMissionVerify

  return (
   <div className="app">
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
  <Route path="/programs/:id/bundles/:bundleParam" element={
    <ProtectedRoute><BundleDetailPage /></ProtectedRoute>
  } />
  <Route path="/programs/:id/stats" element={
    <ProtectedRoute><ProgramStatsPage /></ProtectedRoute>
  } />
  <Route path="/programs/:id/stats/missions" element={
    <ProtectedRoute><ProgramStatsMissionsPage /></ProtectedRoute>
  } />
  <Route path="/programs/:id/stats/users" element={
    <ProtectedRoute><ProgramStatsUsersPage /></ProtectedRoute>
  } />
  <Route path="/programs/:id/stats/users/:userId" element={
    <ProtectedRoute><ProgramStatsUserDetailPage /></ProtectedRoute>
  } />
  <Route path="/programs/:id/stats/users/:userId/missions" element={
    <ProtectedRoute><ProgramStatsUserMissionsPage /></ProtectedRoute>
  } />
  <Route path="/programs/:id/stats/users/:userId/verifications" element={
    <ProtectedRoute><ProgramStatsUserVerificationsPage /></ProtectedRoute>
  } />
  <Route path="/programs/:id/stats/users/:userId/verifications/:bundleParam" element={
    <ProtectedRoute><ProgramStatsUserVerificationsBundlePage /></ProtectedRoute>
  } />
  <Route path="/programs/:id/stats/users/:userId/verifications/:bundleParam/:missionId" element={
    <ProtectedRoute><ProgramStatsUserVerificationsMissionPage /></ProtectedRoute>
  } />
  <Route path="/programs/:id/reviews" element={
    <ProtectedRoute><ProgramReviewsPage /></ProtectedRoute>
  } />
  <Route path="/programs/:id/reviews/:bundleParam" element={
    <ProtectedRoute><ProgramReviewsBundlePage /></ProtectedRoute>
  } />
  <Route path="/programs/:id/reviews/:bundleParam/:missionId" element={
    <ProtectedRoute><ProgramReviewsMissionPage /></ProtectedRoute>
  } />
  <Route path="/programs/:id/feed" element={
    <ProtectedRoute><ProgramFeedPage /></ProtectedRoute>
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
  <Route path="/join" element={<JoinByCodePage />} />
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