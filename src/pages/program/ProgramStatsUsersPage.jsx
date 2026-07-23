import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Check, X, UserPlus } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { formatRelativeKstDay } from '../../lib/formatters'
import { queryKeys, fetchProgram, fetchProgramStats } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import UserAvatar from '../../components/common/UserAvatar'
import CheerModal from '../../components/program/CheerModal'

// 활동 상태 필터 (?filter=active|normal|dormant) — ProgramInsightsSummary 위젯 3 클릭 시 도착
const DAY_MS = 86_400_000
const FILTER_META = {
  new: { label: '✨ 이번 주 신규', short: '신규 참여자', threshold: null },
  active: { label: '🟢 활발 (3일 내)', short: '활발 참여자', threshold: 3 },
  normal: { label: '🟡 보통 (3-7일)', short: '보통 참여자', threshold: 7 },
  dormant: { label: '🔴 휴면 (7일+)', short: '휴면 참여자', threshold: null },
}
function matchesFilter(user, filterKey) {
  if (!filterKey || !FILTER_META[filterKey]) return true
  const now = Date.now()
  // 신규: 최근 7일 내 가입(joinedAt) — 활동 여부와 무관
  if (filterKey === 'new') return !!user.joinedAt && (now - new Date(user.joinedAt).getTime()) < 7 * DAY_MS
  const lastTs = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0
  const days3 = now - 3 * DAY_MS
  const days7 = now - 7 * DAY_MS
  if (filterKey === 'active') return lastTs >= days3
  if (filterKey === 'normal') return lastTs < days3 && lastTs >= days7
  if (filterKey === 'dormant') return lastTs < days7
  return true
}

// 운영자 — 유저별 인증 현황 디테일
// 라우트: /programs/:id/stats/users
function ProgramStatsUsersPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id
  const [searchParams, setSearchParams] = useSearchParams()
  const filterKey = searchParams.get('filter')  // 'active' | 'normal' | 'dormant' | null
  const focusPendingId = searchParams.get('pending')  // 가입 알림 딥링크 — 그 신청자로 스크롤
  const pendingRefs = useRef({})
  const [highlightPending, setHighlightPending] = useState(null)
  const [cheerOpen, setCheerOpen] = useState(false)   // 일괄 응원 모달

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

  // 가입 알림(?pending=) 진입 — 그 신청자 행으로 스크롤 + 하이라이트 (여러 명일 때 화면 중앙)
  useEffect(() => {
    if (!focusPendingId || pendingApplicants.length === 0) return
    if (!pendingApplicants.some(p => p.id === focusPendingId)) return
    const el = pendingRefs.current[focusPendingId]
    if (!el) return
    const t = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightPending(focusPendingId)
      setTimeout(() => setHighlightPending(null), 2500)
    }, 250)
    return () => clearTimeout(t)
  }, [focusPendingId, pendingApplicants])

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
      queryClient.invalidateQueries({ queryKey: ['program-pending-count', id] })
      queryClient.invalidateQueries({ queryKey: queryKeys.programStats(id) })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
    },
    onError: (err) => {
      console.error('승인/거절 실패:', err)
      alert(`처리에 실패했습니다: ${err.message}`)
    },
  })

  // 내보낸(LEFT) 참여자 — 통계 목록에서 숨기고, 재참여 허용 섹션에 노출
  const { data: leftParticipants = [] } = useQuery({
    queryKey: ['program-left', id],
    queryFn: async () => {
      const { data: pp, error } = await supabase
        .from('program_participants')
        .select('id, user_id, left_at')
        .eq('program_id', id)
        .eq('status', 'LEFT')
        .order('left_at', { ascending: false })
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

  // 재참여 허용 — status 를 ACTIVE 로 복구 (승인 흐름과 동일하게 RLS 로 owner 제한)
  const restoreMutation = useMutation({
    mutationFn: async (participationId) => {
      const { error } = await supabase
        .from('program_participants')
        .update({ status: 'ACTIVE', left_at: null })
        .eq('id', participationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-left', id] })
      queryClient.invalidateQueries({ queryKey: queryKeys.programStats(id) })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
    },
    onError: (err) => {
      console.error('재참여 처리 실패:', err)
      alert(`재참여 처리에 실패했습니다: ${err.message}`)
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
  const leftUserIds = new Set(leftParticipants.map(p => p.user_id))
  const filteredUserStats = stats?.userStats?.filter(u => matchesFilter(u, filterKey) && !leftUserIds.has(u.user_id)) || []
  const activeFilterMeta = filterKey ? FILTER_META[filterKey] : null

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar
        fallbackPath={`/programs/${id}/stats`}
        title="통계로"
        breadcrumb={[program.name, '통계', '참여 유저 관리']}
      />

      {/* 활성 필터 칩 — 위젯 3 클릭으로 진입 시 표시 */}
      {activeFilterMeta && (
        <div className="mt-2 mb-4 flex items-center gap-2">
          <span className="text-xs text-gray-500">필터:</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-pill text-sm font-medium">
            {activeFilterMeta.label}
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="p-0.5 hover:bg-emerald-100 rounded-full"
              title="필터 해제"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
          <span className="text-xs text-gray-400 ml-1">{filteredUserStats.length}명</span>
        </div>
      )}

      {/* 일괄 응원 — 필터로 좁힌 그룹(활발/보통/휴면) 전체에게 격려 (오늘 이미 받은 사람은 자동 제외) */}
      {activeFilterMeta && filteredUserStats.length > 0 && (
        <button
          type="button"
          onClick={() => setCheerOpen(true)}
          className="w-full flex items-center justify-center gap-2 h-11 mb-4 rounded-[10px] bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition"
        >
          {filterKey === 'new' ? '👋' : '💌'} {activeFilterMeta.short} {filteredUserStats.length}명에게 {filterKey === 'new' ? '환영 메시지' : '응원'} 보내기
        </button>
      )}

      {/* 승인 대기 신청자 — APPROVAL 프로그램만 / 있을 때만 */}
      {pendingApplicants.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            🙋 승인 대기 <span className="text-sm text-amber-600">({pendingApplicants.length})</span>
          </h2>
          <div className="grid grid-cols-1 gap-2">
            {pendingApplicants.map(p => (
              <div
                key={p.id}
                ref={(el) => { pendingRefs.current[p.id] = el }}
                className={`bg-amber-50/60 border rounded-2xl p-4 min-w-0 transition-all duration-500 ${highlightPending === p.id ? 'border-amber-400 ring-2 ring-amber-300 scroll-mt-20' : 'border-amber-200'}`}
              >
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
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-all">
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
      ) : filteredUserStats.length === 0 ? (
        <EmptyState icon="🔍" title={`${activeFilterMeta?.label || ''} 그룹에 해당하는 참여자가 없어요`} />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid gap-2"
        >
          {filteredUserStats.map((u, idx) => {
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
                    🕒 <span className={`font-medium ${u.lastActiveAt ? 'text-gray-700' : 'text-rose-500'}`}>
                      {u.lastActiveAt ? formatRelativeKstDay(u.lastActiveAt) : '활동 없음'}
                    </span>
                  </span>
                </div>
              </button>
            )
          })}
        </motion.div>
      )}

      {/* 내보낸 참여자 — 재참여 허용 */}
      {leftParticipants.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-1 flex items-center gap-2">
            🚪 내보낸 참여자 <span className="text-sm text-gray-400">({leftParticipants.length})</span>
          </h2>
          <p className="text-xs text-gray-500 mb-3">재참여를 허용하면 다시 활동·랭킹에 포함돼요.</p>
          <div className="grid gap-2">
            {leftParticipants.map(p => (
              <div key={p.id} className="bg-gray-50 border border-gray-200 rounded-2xl p-3 flex items-center gap-3">
                <UserAvatar avatarPath={p.user?.avatar_path} nickname={p.user?.nickname} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 truncate">{p.user?.nickname || '(?)'}</p>
                  <p className="text-[11px] text-gray-400">내보냄 · {formatRelativeKstDay(p.left_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => restoreMutation.mutate(p.id)}
                  disabled={restoreMutation.isPending}
                  className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-emerald-700 border border-emerald-200 rounded-full hover:bg-emerald-50 transition disabled:opacity-50"
                  title="재참여 허용"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  재참여
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 일괄 응원 모달 — 현재 필터 그룹 전체 대상 */}
      {cheerOpen && activeFilterMeta && (
        <CheerModal
          programId={id}
          targetUserIds={filteredUserStats.map(u => u.user_id)}
          groupLabel={`${activeFilterMeta.short} ${filteredUserStats.length}명`}
          variant={filterKey === 'new' ? 'welcome' : 'cheer'}
          onClose={() => setCheerOpen(false)}
        />
      )}
    </div>
  )
}

export default ProgramStatsUsersPage
