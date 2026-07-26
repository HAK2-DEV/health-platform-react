import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchProgramStats, fetchUserClassDetail } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import UserClassList from '../../components/program/UserClassList'

// 한 유저의 클래스 상세 — 신청·출석한 세션별 내역
// 라우트: /programs/:id/stats/users/:userId/classes
function ProgramStatsUserClassesPage() {
  const { id, userId: targetUserId } = useParams()
  const { session } = useAuth()
  const myUserId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(id), queryFn: () => fetchProgram(id), enabled: !!session && !!id,
  })
  const isOwner = program?.owner_id === myUserId

  const { data: stats } = useQuery({
    queryKey: queryKeys.programStats(id), queryFn: () => fetchProgramStats(id), enabled: !!session && !!id && isOwner,
  })
  const userInfo = stats?.userStats?.find(u => u.user_id === targetUserId) || null

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['stats', 'userClassDetail', id, targetUserId],
    queryFn: () => fetchUserClassDetail(id, targetUserId),
    enabled: !!session && !!id && !!targetUserId && isOwner,
  })

  if (!program) return <LoadingState variant="page" />
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}/stats/users/${targetUserId}`} title="돌아가기" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">운영자만 통계를 볼 수 있어요</p>
      </div>
    )
  }

  const attendedCount = classes.filter(c => c.att?.status === 'confirmed').length
  const earnedTotal = classes.reduce((s, c) => s + (c.earned || 0), 0)

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats/users/${targetUserId}`} title="돌아가기" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{userInfo?.nickname || '(유저)'}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2"><img src="/icons/feature/attendance.png" alt="" aria-hidden="true" className="w-7 h-7 object-contain" />클래스 기록</h1>
        <p className="text-sm text-gray-500 mt-2">
          신청 {classes.length} · 출석 <b className="text-emerald-700">{attendedCount}</b>
          {earnedTotal > 0 ? <> · 적립 <b className="text-emerald-700">{earnedTotal}P</b></> : null}
        </p>
      </div>

      {classes.length === 0 ? (
        <EmptyState icon="🧘" title="신청·출석한 클래스가 없어요" description="클래스를 신청하고 출석하면 여기 쌓여요" />
      ) : (
        <UserClassList classes={classes} />
      )}
    </div>
  )
}

export default ProgramStatsUserClassesPage
