import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { queryKeys, fetchProgram, fetchUserClassDetail } from '../lib/queries'
import StickyBackBar from '../components/common/StickyBackBar'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'
import UserClassList from '../components/program/UserClassList'

// 참가자 본인 — 내 클래스 기록 (신청·출석·적립)
// 라우트: /profile/activity/:programId/classes
function MyActivityClassesPage() {
  const { programId } = useParams()
  const { session } = useAuth()
  const userId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(programId), queryFn: () => fetchProgram(programId), enabled: !!session && !!programId,
  })
  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['myActivity', 'classDetail', programId, userId],
    queryFn: () => fetchUserClassDetail(programId, userId),
    enabled: !!session && !!programId && !!userId,
  })

  if (isLoading || !program) return <LoadingState variant="page" />

  const attendedCount = classes.filter(c => c.att?.status === 'confirmed').length
  const earnedTotal = classes.reduce((s, c) => s + (c.earned || 0), 0)

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath="/profile/activity" title="돌아가기" />
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2"><img src="/icons/feature/attendance.png" alt="" aria-hidden="true" className="w-7 h-7 object-contain" />내 클래스 기록</h1>
        <p className="text-sm text-gray-500 mt-2">
          신청 {classes.length} · 출석 <b className="text-emerald-700">{attendedCount}</b>
          {earnedTotal > 0 ? <> · 적립 <b className="text-emerald-700">{earnedTotal}P</b></> : null}
        </p>
      </div>
      {classes.length === 0
        ? <EmptyState icon="🧘" title="신청·출석한 클래스가 없어요" description="클래스를 신청하고 출석하면 여기 쌓여요" />
        : <UserClassList classes={classes} />}
    </div>
  )
}

export default MyActivityClassesPage
