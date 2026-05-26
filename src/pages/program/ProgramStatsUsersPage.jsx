import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { formatRelativeKstDay } from '../../lib/formatters'
import { queryKeys, fetchProgram, fetchProgramStats } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import UserAvatar from '../../components/common/UserAvatar'

// 운영자 — 유저별 인증 현황 디테일
// 라우트: /programs/:id/stats/users
function ProgramStatsUsersPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
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

  // 승인 대기 신청자들 — APPROVAL 흐름에서 사용
  const { data: pendingApplicants = [] } = useQuery({
    queryKey: ['program-pending', id],
    queryFn: async () => {
      const { data: pp, error } = await supabase
        .from('program_participants')
        .select('id, user_id, status, joined_at, entry_answer')
        .eq('program_id', id)
        .eq('status', 'PENDING')
        .order('joined_at', { ascending: true })
      if (error) throw error
      if (!pp || pp.length === 0) return []
      const uids = pp.map(r => r.user_id)
      const { data: users } = await supabase
        .from('users')
        .select('id, nickname, avatar_path')
        .in('id', uids)
      const umap = new Map((users || []).map(u => [u.id, u]))
      return pp.map(r => ({ ...r, user: umap.get(r.user_id) || null }))
    },
    enabled: !!session && !!id && isOwner,
  })

  // 승인/거절 mutation
  const reviewParticipationMutation = useMutation({
    mutationFn: async ({ participationId, action }) => {
      const newStatus = action === 'approve' ? 'ACTIVE' : 'REJECTED'
      const { error } = await supabase
        .from('program_participants')
        .update({ status: newStatus })
        .eq('id', participationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-pending', id] })
      queryClient.invalidateQueries({ queryKey: queryKeys.programStats(id) })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
    },
    onError: (err) => {
      console.error('승인/거절 실패:', err)
      alert(`처리에 실패했습니다: ${err.message}`)
    },
  })

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

  const maxUserCount = stats?.userStats?.[0]?.totalCount || 1

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats`} title="통계로" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          👥 유저별 인증 현황
        </h1>
      </div>

      {/* 승인 대기 신청자 — APPROVAL 프로그램만 / 있을 때만 */}
      {pendingApplicants.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-3 flex items-center gap-2">
            🙋 승인 대기 <span className="text-sm text-amber-600">({pendingApplicants.length})</span>
          </h2>
          <div className="grid gap-2">
            {pendingApplicants.map(p => (
              <div key={p.id} className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <UserAvatar avatarPath={p.user?.avatar_path} nickname={p.user?.nickname} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {p.user?.nickname || '(?)'}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      신청 · {formatRelativeKstDay(p.joined_at)}
                    </p>
                  </div>
                </div>

                {/* 입장 답변 (있으면) */}
                {p.entry_answer && (
                  <div className="bg-white rounded-xl p-3 mb-3 border border-amber-100">
                    <p className="text-[11px] text-amber-700 font-medium mb-1">📝 입장 답변</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {p.entry_answer}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => reviewParticipationMutation.mutate({ participationId: p.id, action: 'reject' })}
                    disabled={reviewParticipationMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-white border-2 border-red-200 hover:bg-red-50 text-red-700 text-sm font-medium rounded-xl transition disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    거절
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewParticipationMutation.mutate({ participationId: p.id, action: 'approve' })}
                    disabled={reviewParticipationMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-medium rounded-xl transition disabled:from-gray-400 disabled:to-gray-400"
                  >
                    <Check className="w-4 h-4" />
                    승인
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isStatsLoading || !stats ? (
        <LoadingState />
      ) : stats.userStats.length === 0 ? (
        <EmptyState icon="👥" title="아직 인증한 참여자가 없어요" />
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
                className="w-full p-3 bg-white border border-gray-200 rounded-2xl hover:border-sky-300 hover:bg-sky-50/30 transition text-left"
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
