import { useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Target, Users, FileText } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  queryKeys,
  fetchProgram,
  fetchProgramStats,
  fetchProgramQuizStats,
} from '../../lib/queries'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import ProgramInsightsSummary from '../../components/program/ProgramInsightsSummary'

// 운영자 통계 메인 — 미션별 / 유저별 두 디테일 페이지로의 진입 카드 2장
// 라우트: /programs/:id/stats
function ProgramStatsPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = session?.user?.id
  // 통계에서 뒤로가기는 무조건 운영자 메뉴로 (진입 정보 없으면 root). 이땐 스크롤 저장 스킵(다음 진입 상단부터).
  const backToOpMenu = location.state?.backToOpMenu
  const skipScrollSaveRef = useRef(false)
  const handleBack = () => {
    skipScrollSaveRef.current = true
    navigate(`/programs/${id}?opmenu=${backToOpMenu || 'root'}`, { replace: true })
  }

  const { data: program, isLoading: isProgramLoading } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })

  const isOwner = program?.owner_id === userId

  // 요약 카드의 미리보기용 — 디테일 페이지와 같은 캐시 키라 fetch 1회 공유
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: queryKeys.programStats(id),
    queryFn: () => fetchProgramStats(id),
    enabled: !!session && !!id && isOwner,
  })

  // 퀴즈 요약 — 카드 미리보기 + 디테일 페이지 공유 캐시
  const { data: quizStats = [] } = useQuery({
    queryKey: queryKeys.programQuizStats(id),
    queryFn: () => fetchProgramQuizStats(id),
    enabled: !!session && !!id && isOwner,
  })

  // 스크롤 위치 저장·복원 — 미션별/참여 유저 등으로 갔다 뒤로 돌아올 때 이전 위치 그대로.
  //   App 전역 scrollTo(0,0)(useLayoutEffect+rAF) 이후 double rAF 로 복원하므로 이쪽이 이김.
  //   운영자 메뉴로 나갈 땐(skip) 저장 안 하고 지워서, 다음에 통계를 새로 열면 상단부터 시작.
  useEffect(() => {
    const key = `stats-scroll:${id}`
    const saved = sessionStorage.getItem(key)
    if (saved != null) {
      sessionStorage.removeItem(key)
      const y = parseInt(saved, 10)
      if (y > 0) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
    }
    return () => {
      if (skipScrollSaveRef.current) { try { sessionStorage.removeItem(key) } catch { /* noop */ }; return }
      try { sessionStorage.setItem(key, String(window.scrollY)) } catch { /* sessionStorage 미지원 */ }
    }
  }, [id])

  if (isProgramLoading) {
    return <LoadingState variant="page" />
  }
  if (!program) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="p-4 bg-red-100 text-red-700 rounded">프로그램을 찾을 수 없습니다</p>
        <Link to="/dashboard" className="block mt-4 text-emerald-600 hover:underline">← 대시보드로</Link>
      </div>
    )
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(`/programs/${id}`)}
          className="flex items-center justify-center w-9 h-9 -ml-1 mb-2 rounded-full hover:bg-gray-100 transition"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          운영자만 통계를 볼 수 있어요
        </p>
      </div>
    )
  }

  // 요약 정보
  const missionTotalCount = stats?.bundleStats?.reduce((s, b) => s + b.totalCount, 0) || 0
  const missionGroupCount = stats?.bundleStats?.length || 0
  const userCount = stats?.userStats?.length || 0
  const topUser = stats?.userStats?.[0] || null

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      {/* 헤더 — 퀴즈 탭과 동일한 중앙정렬 앱바. 뒤로가기 + 「프로그램명 통계」 */}
      <div className="sticky top-0 z-30 -mx-4 mb-2 px-2 bg-white/90 backdrop-blur-sm">
        <div className="relative flex items-center justify-center h-12">
          <button
            type="button"
            onClick={handleBack}
            className="absolute left-1 flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 transition"
            title="운영자 메뉴로"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="max-w-[75%] truncate text-lg font-extrabold text-gray-900">{program.name} 통계</h1>
        </div>
      </div>

      {isStatsLoading || !stats ? (
        <LoadingState />
      ) : (
        <>
        {/* Day 65 — 운영자 인사이트 위젯 4종 (상단). 본인 정체성 (전문성+따뜻함) 반영 */}
        <ProgramInsightsSummary stats={stats} program={program} />

        {/* 「자세히 보기」 드릴다운 카드 3종 (기존) */}
        <p className="text-xs text-gray-500 font-medium px-1 mb-2">자세히 보기</p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 gap-3"
        >
          {/* 미션별 카드 */}
          <button
            type="button"
            onClick={() => navigate(`/programs/${id}/stats/missions`)}
            className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-emerald-300 transition text-left"
          >
            <div className="w-12 h-12 flex-shrink-0 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-800 mb-0.5">
                🎯 미션별 인증 현황
              </h3>
              <p className="text-xs text-gray-500">
                {missionTotalCount === 0
                  ? '아직 인증 기록이 없어요'
                  : `누적 ${missionTotalCount}건 · ${missionGroupCount}개 그룹`}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </button>

          {/* 유저별 카드 */}
          <button
            type="button"
            onClick={() => navigate(`/programs/${id}/stats/users`)}
            className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-sky-300 transition text-left"
          >
            <div className="w-12 h-12 flex-shrink-0 bg-sky-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-sky-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-800 mb-0.5">
                👥 참여 유저 관리
              </h3>
              <p className="text-xs text-gray-500">
                {userCount === 0
                  ? '아직 인증한 참여자가 없어요'
                  : topUser
                    ? `${userCount}명 참여 · 최다 ${topUser.nickname} (${topUser.totalCount}건)`
                    : `${userCount}명 참여`}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </button>

          {/* 퀴즈 카드 */}
          <button
            type="button"
            onClick={() => navigate(`/programs/${id}/stats/quizzes`)}
            className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-violet-300 transition text-left"
          >
            <div className="w-12 h-12 flex-shrink-0 bg-violet-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-800 mb-0.5">
                📝 퀴즈 현황
              </h3>
              <p className="text-xs text-gray-500">
                {(() => {
                  if (quizStats.length === 0) return '아직 만든 퀴즈가 없어요'
                  const totalSub = quizStats.reduce((s, q) => s + q.submissionCount, 0)
                  const totalPending = quizStats.reduce((s, q) => s + q.pendingCount, 0)
                  return `퀴즈 ${quizStats.length}개 · 누적 제출 ${totalSub}건${totalPending > 0 ? ` · 채점 대기 ${totalPending}` : ''}`
                })()}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </button>
        </motion.div>
        </>
      )}
    </div>
  )
}

export default ProgramStatsPage
