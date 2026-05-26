import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { formatRelativeKstDay } from '../../lib/formatters'
import { queryKeys, fetchProgram, fetchProgramStats } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import UserAvatar from '../../components/common/UserAvatar'

// 운영자 — 유저별 인증 현황 디테일
// 라우트: /programs/:id/stats/users
function ProgramStatsUsersPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id

  const { data: program, isLoading: isProgramLoading } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })

  const isOwner = program?.owner_id === userId

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: queryKeys.programStats(id),
    queryFn: () => fetchProgramStats(id),
    enabled: !!session && !!id && isOwner,
  })

  if (isProgramLoading) {
    return <div className="p-6 max-w-4xl mx-auto text-center text-gray-500">불러오는 중...</div>
  }
  if (!program) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="p-4 bg-red-100 text-red-700 rounded">프로그램을 찾을 수 없습니다</p>
        <Link to="/dashboard" className="block mt-4 text-green-600 hover:underline">← 대시보드로</Link>
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

  const maxUserCount = stats?.userStats?.[0]?.totalCount || 1

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats`} title="통계로" />

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          👥 유저별 인증 현황
        </h1>
      </div>

      {isStatsLoading || !stats ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
          불러오는 중...
        </div>
      ) : stats.userStats.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
          아직 인증한 참여자가 없어요
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid gap-2"
        >
          {stats.userStats.map((u, idx) => {
            const percent = Math.round((u.totalCount / maxUserCount) * 100)
            const rankBadgeClass =
              idx === 0 ? 'bg-yellow-100 text-yellow-700'
              : idx === 1 ? 'bg-gray-200 text-gray-700'
              : idx === 2 ? 'bg-orange-100 text-orange-700'
              : 'bg-gray-50 text-gray-500'
            return (
              <button
                key={u.user_id}
                type="button"
                onClick={() => navigate(`/programs/${id}/stats/users/${u.user_id}`)}
                className="w-full p-3 bg-white border border-gray-200 rounded-lg hover:border-sky-300 hover:bg-sky-50/30 transition text-left"
              >
                {/* 헤더 — 등수 + 아바타 + 닉네임 + 총 인증 + > */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium flex-shrink-0 ${rankBadgeClass}`}>
                    {idx + 1}
                  </span>
                  <UserAvatar avatarPath={u.avatar_path} nickname={u.nickname} size="sm" />
                  <p className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0 pr-2">
                    {u.nickname}
                  </p>
                  <span className="text-sm text-gray-600 font-medium whitespace-nowrap">
                    {u.totalCount}건
                    {u.todayCount > 0 && (
                      <span className="ml-1 text-xs text-emerald-600">
                        (오늘 +{u.todayCount})
                      </span>
                    )}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </div>

                {/* 진행 막대 */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden ml-8 mb-2">
                  <div
                    className="h-full bg-sky-400 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* 추가 지표 — 점수 / 활동 일수 / 마지막 활동 */}
                <div className="ml-8 flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                  <span>
                    💎 <span className="text-gray-700 font-medium">{u.totalScore}P</span>
                  </span>
                  <span className="text-gray-300">·</span>
                  <span>
                    🔥 <span className="text-gray-700 font-medium">{u.activeDays}일</span> 활동
                  </span>
                  <span className="text-gray-300">·</span>
                  <span>
                    🕒 <span className="text-gray-700 font-medium">{formatRelativeKstDay(u.lastActiveAt)}</span>
                  </span>
                </div>
              </button>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

export default ProgramStatsUsersPage
