import { Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { lazy, Suspense, useEffect, useLayoutEffect } from 'react'
import './index.css'
import './App.css'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingState from './components/common/LoadingState'
import { ToastProvider } from './contexts/ToastContext'
import { AvatarViewerProvider } from './contexts/AvatarViewerContext'
import PwaUpdatePrompt from './components/common/PwaUpdatePrompt'
import OfflineBanner from './components/common/OfflineBanner'
import InstallPromptBanner from './components/common/InstallPromptBanner'
import NavDebug from './components/common/NavDebug'
import SplashScreen from './components/common/SplashScreen'
import BottomTabBar from './components/common/BottomTabBar'
import InAppBrowserBanner from './components/common/InAppBrowserBanner'
import { useRealtimeSync } from './hooks/useRealtimeSync'

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
const OnboardingTutorial = lazy(() => import('./pages/OnboardingTutorial'))
const ProgramNewPage = lazy(() => import('./pages/program/ProgramNewPage'))
const ProgramDetailPage = lazy(() => import('./pages/program/ProgramDetailPage'))
const BundleDetailPage = lazy(() => import('./pages/program/BundleDetailPage'))
const ProgramStatsPage = lazy(() => import('./pages/program/ProgramStatsPage'))
const ProgramEndReportPage = lazy(() => import('./pages/program/ProgramEndReportPage'))
const ProgramStatsMissionsPage = lazy(() => import('./pages/program/ProgramStatsMissionsPage'))
const ProgramStatsUsersPage = lazy(() => import('./pages/program/ProgramStatsUsersPage'))
const ProgramStatsUserDetailPage = lazy(() => import('./pages/program/ProgramStatsUserDetailPage'))
const ProgramStatsUserMissionsPage = lazy(() => import('./pages/program/ProgramStatsUserMissionsPage'))
const ProgramStatsUserVerificationsPage = lazy(() => import('./pages/program/ProgramStatsUserVerificationsPage'))
const ProgramStatsUserPostsPage = lazy(() => import('./pages/program/ProgramStatsUserPostsPage'))
const ProgramStatsUserPointsPage = lazy(() => import('./pages/program/ProgramStatsUserPointsPage'))
const ProgramStatsUserQuizzesPage = lazy(() => import('./pages/program/ProgramStatsUserQuizzesPage'))
const ProgramStatsUserClassesPage = lazy(() => import('./pages/program/ProgramStatsUserClassesPage'))
const ProgramStatsUserCommentsPage = lazy(() => import('./pages/program/ProgramStatsUserCommentsPage'))
const ProgramStatsUserVerificationsBundlePage = lazy(() => import('./pages/program/ProgramStatsUserVerificationsBundlePage'))
const ProgramStatsUserVerificationsMissionPage = lazy(() => import('./pages/program/ProgramStatsUserVerificationsMissionPage'))
const ProgramStatsQuizzesPage = lazy(() => import('./pages/program/ProgramStatsQuizzesPage'))
const ProgramStatsClassesPage = lazy(() => import('./pages/program/ProgramStatsClassesPage'))
const ProgramReviewsPage = lazy(() => import('./pages/program/ProgramReviewsPage'))
const ProgramReviewsBundlePage = lazy(() => import('./pages/program/ProgramReviewsBundlePage'))
const ProgramReviewsMissionPage = lazy(() => import('./pages/program/ProgramReviewsMissionPage'))
const ProgramFeedPage = lazy(() => import('./pages/program/ProgramFeedPage'))
const QuizCreatePage = lazy(() => import('./pages/program/QuizCreatePage'))
const QuizSolvePage = lazy(() => import('./pages/program/QuizSolvePage'))
const QuizResultsPage = lazy(() => import('./pages/program/QuizResultsPage'))
const MissionVerifyPage = lazy(() => import('./pages/program/MissionVerifyPage'))
const ProgramListPage = lazy(() => import('./pages/program/ProgramListPage'))
const RecordPage = lazy(() => import('./pages/RecordPage'))
const RankingsPage = lazy(() => import('./pages/RankingsPage'))
const GrowthPage = lazy(() => import('./pages/GrowthPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const AdminScreenStatsPage = lazy(() => import('./pages/AdminScreenStatsPage'))
const MyActivityPage = lazy(() => import('./pages/MyActivityPage'))
const TodayActivityPage = lazy(() => import('./pages/TodayActivityPage'))
const MyActivityMissionsPage = lazy(() => import('./pages/MyActivityMissionsPage'))
const MyActivityVerificationsPage = lazy(() => import('./pages/MyActivityVerificationsPage'))
const MyActivityVerificationsBundlePage = lazy(() => import('./pages/MyActivityVerificationsBundlePage'))
const MyActivityPostsPage = lazy(() => import('./pages/MyActivityPostsPage'))
const MyActivityCommentsPage = lazy(() => import('./pages/MyActivityCommentsPage'))
const MyActivityQuizzesPage = lazy(() => import('./pages/MyActivityQuizzesPage'))
const MyActivityClassesPage = lazy(() => import('./pages/MyActivityClassesPage'))
const JoinByCodePage = lazy(() => import('./pages/JoinByCodePage'))
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'))
const NotificationSettingsPage = lazy(() => import('./pages/NotificationSettingsPage'))
const AccountSettingsPage = lazy(() => import('./pages/AccountSettingsPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const InstallGuidePage = lazy(() => import('./pages/InstallGuidePage'))
const OperatorGuidePage = lazy(() => import('./pages/OperatorGuidePage'))
const SupportPage = lazy(() => import('./pages/SupportPage'))
const OperatorTodayPage = lazy(() => import('./pages/program/OperatorTodayPage'))
const RunnerAnimDemo = lazy(() => import('./pages/RunnerAnimDemo'))
const NoticeAnimDemo = lazy(() => import('./pages/NoticeAnimDemo'))
const TrophyAnimDemo = lazy(() => import('./pages/TrophyAnimDemo'))
const UpdateDemoPage = lazy(() => import('./pages/UpdateDemoPage'))
const CommentSheetDemo = lazy(() => import('./pages/CommentSheetDemo'))

// 가입 승인 알림(/programs/:id/participants) → 프로그램 상세 + 승인 심사 모달 자동 오픈
function ApprovalsRedirect() {
  const { id } = useParams()
  return <Navigate to={`/programs/${id}?approvals=1`} replace />
}

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()

  // 참여자 수·둘러보기 목록 실시간 동기화 (Realtime → 캐시 무효화). 로그아웃 시 자동 무시.
  useRealtimeSync()

  // 콜드 스타트 시 진입 화면 정규화 — 본인 결정 (Day 67)
  //   브라우저/설치형 PWA 가 직전에 보던 메인 탭(둘러보기/프로필)으로 "복원"되면
  //   "/" 를 거치지 않아 홈이 아닌 화면으로 시작됨. 이때만 홈으로 보낸다.
  //   딥링크(/programs/:id, /login, 통계 등)는 정규화 대상이 아니라 그대로 유지.
  useEffect(() => {
    if (['/programs', '/profile', '/rankings', '/growth'].includes(window.location.pathname)) {
      navigate('/dashboard', { replace: true })
    }
    // 최초 마운트 1회만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 라우트 변경 시 무조건 페이지 상단부터 시작 — 본인 결정 (Day 55)
  //   다른 페이지로 넘어가면 스크롤 위치가 어디든 reset
  //   같은 페이지에서 query/hash 만 바뀌는 경우 (예: 피드 ?v=&c=) 는 그 컴포넌트가 scrollIntoView 로 직접 제어하므로 별도 처리
  //   useLayoutEffect(페인트 전) + 다음 프레임 재확정 — lazy 청크/비동기 로딩·iOS 스크롤 지연으로
  //   이전 페이지 스크롤이 남는 경우(예: 스크롤 내린 상태에서 퀴즈 진입 시 살짝 내려간 채 시작)를 막음.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    const r = requestAnimationFrame(() => window.scrollTo(0, 0))
    return () => cancelAnimationFrame(r)
  }, [location.pathname])

  // 하단 탭바 — 메인 5탭(홈·프로그램·기록하기·랭킹·프로필)에서만 상시 노출.
  //   기록하기는 라우트가 아니라 액션(+ 버튼). 깊은 화면은 숨기고 뒤로가기.
  const showTabBar = ['/dashboard', '/programs', '/growth', '/profile'].includes(location.pathname)

  return (
   <div className="app">
      {/* 인앱 브라우저(카톡 등) 안내 — 화면 축소 이슈. 감지 안 되면 렌더 X */}
      <InAppBrowserBanner />
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
            <Route path="/onboarding" element={
              <ProtectedRoute><OnboardingTutorial /></ProtectedRoute>
            } />
            <Route path="/admin/screen-stats" element={
              <ProtectedRoute><AdminScreenStatsPage /></ProtectedRoute>
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
            <Route path="/programs/:id/report" element={
              <ProtectedRoute><ProgramEndReportPage /></ProtectedRoute>
            } />
            <Route path="/programs/:id/stats/missions" element={
              <ProtectedRoute><ProgramStatsMissionsPage /></ProtectedRoute>
            } />
            <Route path="/programs/:id/stats/users" element={
              <ProtectedRoute><ProgramStatsUsersPage /></ProtectedRoute>
            } />
            {/* 가입 승인 알림(PARTICIPANT_JOINED) link_path 가 /participants 로 생성됨(마이그 072) →
                해당 라우트가 없어 흰 화면. 프로그램 상세로 보내며 「참여 승인 심사」 모달 자동 오픈. */}
            <Route path="/programs/:id/participants" element={<ApprovalsRedirect />} />
            <Route path="/programs/:id/stats/users/:userId" element={
              <ProtectedRoute><ProgramStatsUserDetailPage /></ProtectedRoute>
            } />
            <Route path="/programs/:id/stats/users/:userId/missions" element={
              <ProtectedRoute><ProgramStatsUserMissionsPage /></ProtectedRoute>
            } />
            <Route path="/programs/:id/stats/users/:userId/verifications" element={
              <ProtectedRoute><ProgramStatsUserVerificationsPage /></ProtectedRoute>
            } />
            <Route path="/programs/:id/stats/users/:userId/posts" element={
              <ProtectedRoute><ProgramStatsUserPostsPage /></ProtectedRoute>
            } />
            <Route path="/programs/:id/stats/users/:userId/points" element={
              <ProtectedRoute><ProgramStatsUserPointsPage /></ProtectedRoute>
            } />
            <Route path="/programs/:id/stats/users/:userId/quizzes" element={
              <ProtectedRoute><ProgramStatsUserQuizzesPage /></ProtectedRoute>
            } />
            <Route path="/programs/:id/stats/users/:userId/classes" element={
              <ProtectedRoute><ProgramStatsUserClassesPage /></ProtectedRoute>
            } />
            <Route path="/programs/:id/stats/users/:userId/comments" element={
              <ProtectedRoute><ProgramStatsUserCommentsPage /></ProtectedRoute>
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
            <Route path="/programs/:id/stats/classes" element={
              <ProtectedRoute><ProgramStatsClassesPage /></ProtectedRoute>
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
            {/* /posts 인덱스(게시물 관리) 비활성화 — 「가려진 글·신고 관리」는 커뮤니티 관리자 안으로 이동.
                남은 quiz 하위 라우트(new/결과)는 유지. 잔존 링크는 커뮤니티 탭으로 보냄. */}
            <Route path="/programs/:id/posts" element={<Navigate to=".." replace />} />
            <Route path="/programs/:id/posts/quiz/new" element={
              <ProtectedRoute><QuizCreatePage /></ProtectedRoute>
            } />
            <Route path="/programs/:id/posts/quiz/:quizId/edit" element={
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
            <Route path="/record" element={
              <ProtectedRoute><RecordPage /></ProtectedRoute>
            } />
            <Route path="/rankings" element={
              <ProtectedRoute><RankingsPage /></ProtectedRoute>
            } />
            <Route path="/growth" element={
              <ProtectedRoute><GrowthPage /></ProtectedRoute>
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
            <Route path="/programs/:id/operator-today" element={
              <ProtectedRoute><OperatorTodayPage /></ProtectedRoute>
            } />
            <Route path="/runner-anim-demo" element={<RunnerAnimDemo />} />
            <Route path="/notice-anim-demo" element={<NoticeAnimDemo />} />
            <Route path="/trophy-anim-demo" element={<TrophyAnimDemo />} />
            <Route path="/update-demo" element={<UpdateDemoPage />} />
            <Route path="/comment-sheet-demo" element={<CommentSheetDemo />} />
            <Route path="/support" element={
              <ProtectedRoute><SupportPage /></ProtectedRoute>
            } />
            <Route path="/profile/activity" element={
              <ProtectedRoute><MyActivityPage /></ProtectedRoute>
            } />
            <Route path="/profile/activity/today" element={
              <ProtectedRoute><TodayActivityPage /></ProtectedRoute>
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
            <Route path="/profile/activity/:programId/posts" element={
              <ProtectedRoute><MyActivityPostsPage /></ProtectedRoute>
            } />
            <Route path="/profile/activity/:programId/comments" element={
              <ProtectedRoute><MyActivityCommentsPage /></ProtectedRoute>
            } />
            <Route path="/profile/activity/:programId/quizzes" element={
              <ProtectedRoute><MyActivityQuizzesPage /></ProtectedRoute>
            } />
            <Route path="/profile/activity/:programId/classes" element={
              <ProtectedRoute><MyActivityClassesPage /></ProtectedRoute>
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

      {/* 오프라인 상태 배너 — 연결 끊기면 노출, 재연결 시 자동 갱신 안내 */}
      <OfflineBanner />

      {/* 설치 유도 배너 — 진입 몇 초 뒤, 홈 화면 추가 권유 (닫으면 2주 침묵) */}
      <InstallPromptBanner />

      {/* 임시 네비게이션 디버그 — ?navdebug=1 일 때만 */}
      <NavDebug />
    </div>
  )
}

// useNavigate/useLocation 은 Router 컨텍스트 안에서만 사용 가능하므로 main.jsx 의 BrowserRouter 안에서 렌더링.
// ToastProvider 는 전역 마일스톤 토스트 등에 사용 (Day 65).
function App() {
  return (
    <ToastProvider>
      <AvatarViewerProvider>
        <AppShell />
      </AvatarViewerProvider>
      {/* 콜드 스타트 스플래시 — 약 1.5초 노출 후 페이드아웃 (라우터 무관 최상위 오버레이) */}
      <SplashScreen />
    </ToastProvider>
  )
}

export default App
