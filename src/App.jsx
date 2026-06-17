import { Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import './index.css'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingState from './components/common/LoadingState'
import { ToastProvider } from './contexts/ToastContext'
import PwaUpdatePrompt from './components/common/PwaUpdatePrompt'
import SplashScreen from './components/common/SplashScreen'
import BottomTabBar from './components/common/BottomTabBar'

// 코드 스플리팅 — 페이지별 lazy chunk 분리 (Day 65 본인 결정)
//   첫 진입 시 메인 번들(~1.2MB) 한 번에 다운로드 X → 필요한 페이지만 점진적 로드.
//   PWA Service Worker 가 chunk 도 캐시 → 두 번째 진입부터는 즉시.
//   각 chunk 는 라우트 첫 진입 시에만 fetch — Suspense fallback 으로 LoadingState 표시.
const HomePage = lazy(() => import('./pages/HomePage'))
const TodosPage = lazy(() => import('./pages/TodosPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const NicknameSetupPage = lazy(() => import('./pages/NicknameSetupPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProgramNewPage = lazy(() => import('./pages/program/ProgramNewPage'))
const ProgramDetailPage = lazy(() => import('./pages/program/ProgramDetailPage'))
const BundleDetailPage = lazy(() => import('./pages/program/BundleDetailPage'))
const ProgramStatsPage = lazy(() => import('./pages/program/ProgramStatsPage'))
const ProgramStatsMissionsPage = lazy(() => import('./pages/program/ProgramStatsMissionsPage'))
const ProgramStatsUsersPage = lazy(() => import('./pages/program/ProgramStatsUsersPage'))
const ProgramStatsUserDetailPage = lazy(() => import('./pages/program/ProgramStatsUserDetailPage'))
const ProgramStatsUserMissionsPage = lazy(() => import('./pages/program/ProgramStatsUserMissionsPage'))
const ProgramStatsUserVerificationsPage = lazy(() => import('./pages/program/ProgramStatsUserVerificationsPage'))
const ProgramStatsUserVerificationsBundlePage = lazy(() => import('./pages/program/ProgramStatsUserVerificationsBundlePage'))
const ProgramStatsUserVerificationsMissionPage = lazy(() => import('./pages/program/ProgramStatsUserVerificationsMissionPage'))
const ProgramStatsQuizzesPage = lazy(() => import('./pages/program/ProgramStatsQuizzesPage'))
const ProgramReviewsPage = lazy(() => import('./pages/program/ProgramReviewsPage'))
const ProgramReviewsBundlePage = lazy(() => import('./pages/program/ProgramReviewsBundlePage'))
const ProgramReviewsMissionPage = lazy(() => import('./pages/program/ProgramReviewsMissionPage'))
const ProgramFeedPage = lazy(() => import('./pages/program/ProgramFeedPage'))
const PostsManagePage = lazy(() => import('./pages/program/PostsManagePage'))
const QuizCreatePage = lazy(() => import('./pages/program/QuizCreatePage'))
const QuizSolvePage = lazy(() => import('./pages/program/QuizSolvePage'))
const QuizResultsPage = lazy(() => import('./pages/program/QuizResultsPage'))
const MissionVerifyPage = lazy(() => import('./pages/program/MissionVerifyPage'))
const ProgramListPage = lazy(() => import('./pages/program/ProgramListPage'))
const RankingsPage = lazy(() => import('./pages/RankingsPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const MyActivityPage = lazy(() => import('./pages/MyActivityPage'))
const MyActivityMissionsPage = lazy(() => import('./pages/MyActivityMissionsPage'))
const MyActivityVerificationsPage = lazy(() => import('./pages/MyActivityVerificationsPage'))
const MyActivityVerificationsBundlePage = lazy(() => import('./pages/MyActivityVerificationsBundlePage'))
const JoinByCodePage = lazy(() => import('./pages/JoinByCodePage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage'))
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const InstallGuidePage = lazy(() => import('./pages/InstallGuidePage'))
const OperatorGuidePage = lazy(() => import('./pages/OperatorGuidePage'))

function AppShell() {
  const location = useLocation()

  // 라우트 변경 시 무조건 페이지 상단부터 시작 — 본인 결정 (Day 55)
  //   다른 페이지로 넘어가면 스크롤 위치가 어디든 reset
  //   같은 페이지에서 query/hash 만 바뀌는 경우 (예: 피드 ?v=&c=) 는 그 컴포넌트가 scrollIntoView 로 직접 제어하므로 별도 처리
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  // 하단 탭바 — 메인 3탭(홈·프로그램·프로필)에서만 상시 노출. 상세/마법사 등 깊은 화면은 숨기고 뒤로가기.
  //   알림은 탭이 아니라 헤더 종 아이콘으로 진입(랭킹은 프로그램 안에서).
  const showTabBar = ['/dashboard', '/programs', '/profile'].includes(location.pathname)

  return (
   <div className="app">
      <main
        className={`app-main ${showTabBar ? 'pb-24' : 'pb-4'}`}
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      >
        {/* Suspense — lazy chunk 로딩 중 fallback. variant="page" 로 전체 페이지 스피너 */}
        <Suspense fallback={<LoadingState variant="page" />}>
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
            <Route path="/programs/:id/stats/quizzes" element={
              <ProtectedRoute><ProgramStatsQuizzesPage /></ProtectedRoute>
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
            <Route path="/programs/:id/posts" element={
              <ProtectedRoute><PostsManagePage /></ProtectedRoute>
            } />
            <Route path="/programs/:id/posts/quiz/new" element={
              <ProtectedRoute><QuizCreatePage /></ProtectedRoute>
            } />
            <Route path="/programs/:id/posts/quiz/:quizId" element={
              <ProtectedRoute><QuizResultsPage /></ProtectedRoute>
            } />
            <Route path="/programs/:id/quiz/:quizId" element={
              <ProtectedRoute><QuizSolvePage /></ProtectedRoute>
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
            <Route path="/profile/notifications-settings" element={
              <ProtectedRoute><NotificationSettingsPage /></ProtectedRoute>
            } />
            <Route path="/profile/account-settings" element={
              <ProtectedRoute><AccountSettingsPage /></ProtectedRoute>
            } />
            <Route path="/operator-guide" element={
              <ProtectedRoute><OperatorGuidePage /></ProtectedRoute>
            } />
            <Route path="/profile/activity" element={
              <ProtectedRoute><MyActivityPage /></ProtectedRoute>
            } />
            <Route path="/profile/activity/:programId/missions" element={
              <ProtectedRoute><MyActivityMissionsPage /></ProtectedRoute>
            } />
            <Route path="/profile/activity/:programId/verifications" element={
              <ProtectedRoute><MyActivityVerificationsPage /></ProtectedRoute>
            } />
            <Route path="/profile/activity/:programId/verifications/:bundleParam" element={
              <ProtectedRoute><MyActivityVerificationsBundlePage /></ProtectedRoute>
            } />
            <Route path="/join" element={<JoinByCodePage />} />
            {/* 약관/정책 — 공개 페이지 (비로그인도 접근 가능) */}
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfServicePage />} />
            <Route path="/install" element={<InstallGuidePage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/todos" element={
              <ProtectedRoute><TodosPage /></ProtectedRoute>
            } />
          </Routes>
        </Suspense>
      </main>

      {/* 하단 탭바 — 메인 3탭에서만 */}
      {showTabBar && <BottomTabBar />}

      {/* 새 버전 알림 배너 — 새 SW 대기 시 노출 (PWA prompt 전략) */}
      <PwaUpdatePrompt />
    </div>
  )
}

// useNavigate/useLocation 은 Router 컨텍스트 안에서만 사용 가능하므로 main.jsx 의 BrowserRouter 안에서 렌더링.
// ToastProvider 는 전역 마일스톤 토스트 등에 사용 (Day 65).
function App() {
  return (
    <ToastProvider>
      <AppShell />
      {/* 콜드 스타트 스플래시 — 약 1.5초 노출 후 페이드아웃 (라우터 무관 최상위 오버레이) */}
      <SplashScreen />
    </ToastProvider>
  )
}

export default App
