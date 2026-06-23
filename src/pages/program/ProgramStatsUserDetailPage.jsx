import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, Target, FileText, MessageCircle } from 'lucide-react'
import DoorIcon from '../../components/common/DoorIcon'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { formatRelativeKstDay, getTodayKST } from '../../lib/formatters'
import { queryKeys, fetchProgram, fetchProgramStats, formatKstDate } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import UserAvatar from '../../components/common/UserAvatar'
import ConfirmModal from '../../components/common/ConfirmModal'

// 한 유저의 활동 메인 — 핵심 지표 + 14일 차트 + 2개 진입 카드 (미션별 분포 / 인증 기록)
// 라우트: /programs/:id/stats/users/:userId
function ProgramStatsUserDetailPage() {
  const { id, userId: targetUserId } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const myUserId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })

  const isOwner = program?.owner_id === myUserId

  const { data: stats } = useQuery({
    queryKey: queryKeys.programStats(id),
    queryFn: () => fetchProgramStats(id),
    enabled: !!session && !!id && isOwner,
  })

  // 14일 차트용 — verifications 의 submitted_at 만 필요
  //   status 필터 없음: APPROVED + PENDING_REVIEW + REJECTED 모두 "활동"으로 카운트
  //   (사용자가 제출한 자체가 활동. 승인 여부와 별개로 참여도 가시화)
  const { data: userVerifications = [] } = useQuery({
    queryKey: ['stats', 'userVerifications', id, targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verifications')
        .select('id, mission_id, submitted_at, image_path, numeric_value, note, missions!inner(program_id, title, bundle_title)')
        .eq('missions.program_id', id)
        .eq('user_id', targetUserId)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!id && !!targetUserId && isOwner,
  })

  // 이 유저가 작성한 커뮤니티 게시글 (운영자 SELECT 가능)
  const { data: userPosts = [] } = useQuery({
    queryKey: ['stats', 'userPosts', id, targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_posts')
        .select('id, board_id, title, body, image_path, status, created_at')
        .eq('program_id', id)
        .eq('author_id', targetUserId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!id && !!targetUserId && isOwner,
  })

  // 이 유저가 작성한 커뮤니티 댓글 (105) — 부모 글 정보 join, 이 프로그램만
  const { data: userComments = [] } = useQuery({
    queryKey: ['stats', 'userComments', id, targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_post_comments')
        .select('id, content, created_at, community_posts!inner(id, board_id, title, program_id)')
        .eq('community_posts.program_id', id)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!id && !!targetUserId && isOwner,
  })

  // 이 유저가 인증 피드(verifications)에 단 댓글 (036/085) — 운영자 SELECT 허용
  const { data: userVerifComments = [] } = useQuery({
    queryKey: ['stats', 'userVerifComments', id, targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, content, created_at, verifications!inner(id, missions!inner(program_id, title))')
        .eq('verifications.missions.program_id', id)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!id && !!targetUserId && isOwner,
  })

  const userInfo = stats?.userStats?.find(u => u.user_id === targetUserId) || null

  // 입장 질문 답변 — 승인제 + 입장질문 있는 프로그램일 때 표시 (program_participants.entry_answer)
  const { data: participant } = useQuery({
    queryKey: ['participant', 'entry', id, targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('program_participants')
        .select('entry_answer')
        .eq('program_id', id)
        .eq('user_id', targetUserId)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!session && !!id && !!targetUserId && isOwner,
  })
  const showEntryAnswer = program?.join_type === 'APPROVAL' && !!program?.entry_question && !!participant?.entry_answer

  // 운영자 — 참여자 내보내기(탈퇴): status='LEFT' → 랭킹·집계 제외 + 인증 차단 (086 RPC)
  const queryClient = useQueryClient()
  const removeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('remove_participant_from_program', {
        p_program_id: id,
        p_user_id: targetUserId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programStats(id) })
      // LEFT 참여자 목록 — 활성 목록은 이걸로 걸러내므로 반드시 갱신해야 즉시 빠짐
      queryClient.invalidateQueries({ queryKey: ['program-left', id] })
      // 승인 대기였던 참여자를 내보낸 경우(APPROVAL)도 즉시 반영
      queryClient.invalidateQueries({ queryKey: ['program-pending', id] })
      queryClient.invalidateQueries({ queryKey: ['program-pending-count', id] })
      queryClient.invalidateQueries({ queryKey: queryKeys.program(id) })   // 참여자 수 배지 등
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      navigate(`/programs/${id}/stats/users`)
    },
    onError: (err) => {
      console.error('참여자 내보내기 실패:', err)
      alert(err.message || '내보내기에 실패했어요')
    },
  })
  // 내보내기 — 중앙 카드 2단계 확인 (정말로 내보내겠습니까? × 2)
  const [removeStep, setRemoveStep] = useState(0)   // 0=닫힘 1=1차 2=2차
  const handleRemove = () => { if (userInfo) setRemoveStep(1) }

  // 최근 14일 활동 — Intl Asia/Seoul 로 정확
  const recent14Days = useMemo(() => {
    const todayKst = getTodayKST()
    const counts = new Map()
    for (const v of userVerifications) {
      const date = formatKstDate(new Date(v.submitted_at))
      counts.set(date, (counts.get(date) || 0) + 1)
    }
    const result = []
    const today = new Date(`${todayKst}T00:00:00+09:00`)
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = formatKstDate(d)
      result.push({ date: dateStr, count: counts.get(dateStr) || 0 })
    }
    return result
  }, [userVerifications])

  const maxDayCount = recent14Days.reduce((m, d) => Math.max(m, d.count), 0) || 1

  // 게시판 id → 이름 (운영자 설정). 미설정/삭제 게시판이면 id 표시.
  const boardName = (bid) => {
    const boards = program?.community_settings?.boards
    const b = Array.isArray(boards) ? boards.find(x => x.id === bid) : null
    return b?.name || bid
  }

  // 작성한 댓글 통합 — 커뮤니티 글 댓글(105) + 인증 피드 댓글(036). 최신순.
  const allComments = useMemo(() => {
    const a = userComments.map(c => ({
      id: c.id, content: c.content, created_at: c.created_at,
      tag: boardName(c.community_posts?.board_id), parent: c.community_posts?.title || '게시글',
    }))
    const b = userVerifComments.map(c => ({
      id: c.id, content: c.content, created_at: c.created_at,
      tag: '인증', parent: c.verifications?.missions?.title || '인증 미션',
    }))
    return [...a, ...b].sort((x, y) => new Date(y.created_at) - new Date(x.created_at))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userComments, userVerifComments, program])

  if (!program) {
    return <LoadingState variant="page" />
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}/stats/users`} title="목록으로" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          운영자만 통계를 볼 수 있어요
        </p>
      </div>
    )
  }
  if (!userInfo) {
    return (
      <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}/stats/users`} title="목록으로" />
        <p className="p-4 bg-gray-50 text-gray-500 text-center rounded">
          해당 유저의 활동 기록을 찾을 수 없어요
        </p>
        <Link to={`/programs/${id}/stats/users`} className="block mt-3 text-center text-sm text-emerald-600 hover:underline">
          유저 목록으로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats/users`} title="목록으로" />

      {/* 유저 헤더 */}
      <div className="bg-white border border-gray-200 rounded-[10px] p-6" style={{ marginBottom: '9px' }}>
        <p className="text-xs text-gray-500 mb-2">{program.name}</p>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <UserAvatar avatarPath={userInfo.avatar_path} nickname={userInfo.nickname} size="md" />
            <h1 className="text-xl font-medium text-gray-800 break-words leading-tight min-w-0">
              {userInfo.nickname}
            </h1>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removeMutation.isPending}
            className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 border-2 border-red-400 rounded-full hover:bg-red-50 transition disabled:opacity-50"
            title="프로그램에서 내보내기"
          >
            <DoorIcon className="w-5 h-5" />
            {removeMutation.isPending ? '처리 중…' : '내보내기'}
          </button>
        </div>

        {/* 입장 질문 답변 — 승인제 + 입장질문 프로그램만 */}
        {showEntryAnswer && (
          <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-[10px]" style={{ marginTop: '9px' }}>
            <p className="text-[11px] font-semibold text-emerald-700 mb-1">입장 질문</p>
            <p className="text-xs text-gray-500 mb-1.5 whitespace-pre-wrap break-all">{program.entry_question}</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-all">💬 {participant.entry_answer}</p>
          </div>
        )}
      </div>

      {/* 핵심 지표 4카드 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-2 sm:grid-cols-4"
        style={{ gap: '9px', marginBottom: '9px' }}
      >
        <button
          type="button"
          onClick={() => navigate(`/programs/${id}/stats/users/${targetUserId}/points`)}
          className="relative bg-white border border-gray-100 rounded-[10px] p-4 shadow-sm flex flex-col items-center text-center transition active:scale-[0.98] hover:border-emerald-200"
        >
          <ChevronRight className="absolute top-2.5 right-2 w-3.5 h-3.5 text-gray-300" />
          <p className="text-[11px] text-gray-500 mb-1">💎 누적 점수</p>
          <p className="text-2xl font-bold text-emerald-700 leading-tight">
            {userInfo.totalScore}<span className="text-sm text-emerald-600 font-medium"> P</span>
          </p>
          <span className="text-[10px] text-emerald-600/70 mt-0.5">점수 요인 보기</span>
        </button>
        <div className="bg-white border border-gray-100 rounded-[10px] p-4 shadow-sm flex flex-col items-center text-center">
          <p className="text-[11px] text-gray-500 mb-1">✅ 누적 인증</p>
          <p className="text-2xl font-bold text-gray-800 leading-tight">
            {userInfo.totalCount}<span className="text-sm text-gray-500 font-medium">건</span>
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-[10px] p-4 shadow-sm flex flex-col items-center text-center">
          <p className="text-[11px] text-gray-500 mb-1">🔥 활동 일수</p>
          <p className="text-2xl font-bold text-gray-800 leading-tight">
            {userInfo.activeDays}<span className="text-sm text-gray-500 font-medium">일</span>
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-[10px] p-4 shadow-sm flex flex-col items-center text-center">
          <p className="text-[11px] text-gray-500 mb-1">🕒 마지막 활동</p>
          <p className="text-sm font-medium text-gray-800 leading-tight pt-2">
            {formatRelativeKstDay(userInfo.lastActiveAt)}
          </p>
        </div>
      </motion.div>

      {/* 최근 14일 활동 */}
      <h2 className="text-lg font-semibold text-gray-800" style={{ marginBottom: '9px' }}>📅 최근 14일 활동</h2>
      <div className="bg-white border border-gray-200 rounded-[10px] p-4" style={{ marginBottom: '9px' }}>
        <div className="flex items-end gap-1 h-20">
          {recent14Days.map(d => {
            const h = d.count === 0 ? 4 : Math.round((d.count / maxDayCount) * 76) + 4
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center gap-0.5"
                title={`${d.date.replaceAll('-', '.')} — ${d.count}건`}
              >
                <div
                  className={`w-full rounded-sm transition-all ${d.count === 0 ? 'bg-gray-100' : 'bg-sky-400'}`}
                  style={{ height: `${h}px` }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{recent14Days[0]?.date.slice(5).replace('-', '/')}</span>
          <span>오늘</span>
        </div>
      </div>

      {/* 2개 진입 카드 — 미션별 분포 / 인증 기록 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="grid grid-cols-1"
        style={{ gap: '9px' }}
      >
        <button
          type="button"
          onClick={() => navigate(`/programs/${id}/stats/users/${targetUserId}/missions`)}
          className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-[10px] hover:bg-gray-50 hover:border-emerald-300 transition text-left"
        >
          <div className="w-12 h-12 flex-shrink-0 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Target className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-800 mb-0.5">
              🎯 미션별 분포
            </h3>
            <p className="text-xs text-gray-500">
              어떤 미션을 얼마나 했는지 묶음별 분석
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => navigate(`/programs/${id}/stats/users/${targetUserId}/verifications`)}
          className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-[10px] hover:bg-gray-50 hover:border-sky-300 transition text-left"
        >
          <div className="w-12 h-12 flex-shrink-0 bg-sky-100 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-sky-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-800 mb-0.5">
              📝 인증 기록
            </h3>
            <p className="text-xs text-gray-500">
              실제 제출한 사진 · 기록 · 소감을 카테고리별로 확인
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </button>
      </motion.div>

      {/* 커뮤니티 활동 — 작성한 게시글 / 댓글 (클릭 시 새 페이지) */}
      <div className="grid grid-cols-1" style={{ gap: '9px', marginTop: '9px' }}>
        <button
          type="button"
          onClick={() => navigate(`/programs/${id}/stats/users/${targetUserId}/posts`)}
          className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-[10px] hover:bg-gray-50 hover:border-violet-300 transition text-left"
        >
          <div className="w-12 h-12 flex-shrink-0 bg-violet-100 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-800 mb-0.5">📝 작성한 게시글 ({userPosts.length})</h3>
            <p className="text-xs text-gray-500">이 유저가 게시판에 쓴 글을 확인</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => navigate(`/programs/${id}/stats/users/${targetUserId}/comments`)}
          className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-[10px] hover:bg-gray-50 hover:border-amber-300 transition text-left"
        >
          <div className="w-12 h-12 flex-shrink-0 bg-amber-100 rounded-xl flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-800 mb-0.5">💬 작성한 댓글 ({allComments.length})</h3>
            <p className="text-xs text-gray-500">게시판 글 · 인증 피드에 단 댓글</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </button>
      </div>

      {/* 내보내기 — 중앙 카드 2단계 확인 */}
      <ConfirmModal
        isOpen={removeStep > 0}
        onClose={() => { if (!removeMutation.isPending) setRemoveStep(0) }}
        onConfirm={() => { if (removeStep === 1) setRemoveStep(2); else removeMutation.mutate() }}
        title="정말로 내보내겠습니까?"
        message={removeStep === 1
          ? `${userInfo?.nickname} 님을 이 프로그램에서 내보내요.\n랭킹·집계에서 제외되고 더 이상 인증할 수 없어요. (기록은 보존)`
          : `마지막 확인이에요. ${userInfo?.nickname} 님을 정말로 내보낼까요?\n되돌리려면 다시 초대해야 해요.`}
        confirmLabel={removeStep === 1 ? '내보내기' : '정말 내보내기'}
        danger
        busy={removeMutation.isPending}
      />
    </div>
  )
}

export default ProgramStatsUserDetailPage
