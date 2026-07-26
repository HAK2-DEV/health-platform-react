import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchProgramStats, fetchUserScoreBreakdown } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'

// 한 유저의 누적 점수 요인 — 미션별/퀴즈별 점수 내역
// 라우트: /programs/:id/stats/users/:userId/points
function ProgramStatsUserPointsPage() {
  const { id, userId: targetUserId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const myUserId = session?.user?.id
  const [expand, setExpand] = useState(null)   // 'quiz' | 'other' | null — 인라인 펼침

  // 미션 행 클릭 → 그 미션의 인증 기록 상세로 이동
  // scored=1: 점수의 '요인'만 보여주면 되므로 승인된 인증만 (거절/대기 제외)
  const goToMission = (m) => {
    const bundleParam = m.bundleTitle ? encodeURIComponent(m.bundleTitle) : 'solo'
    navigate(`/programs/${id}/stats/users/${targetUserId}/verifications/${bundleParam}/${m.id}?scored=1`)
  }

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
  const userInfo = stats?.userStats?.find(u => u.user_id === targetUserId) || null

  const { data: bd } = useQuery({
    queryKey: ['stats', 'userScoreBreakdown', id, targetUserId],
    queryFn: () => fetchUserScoreBreakdown(id, targetUserId),
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

  const missions = bd?.missions || []
  const quiz = bd?.quiz || { point: 0, count: 0 }
  const other = bd?.other || { point: 0, count: 0 }
  const total = bd?.total ?? 0
  const hasAny = missions.length > 0 || quiz.point !== 0 || other.point !== 0

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats/users/${targetUserId}`} title="돌아가기" />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{userInfo?.nickname || '(유저)'}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">💎 점수 요인</h1>
        <p className="text-sm text-gray-500 mt-2">누적 <b className="text-emerald-700">{total}P</b> 가 어디서 왔는지 미션별로 보여줘요.</p>
      </div>

      {!hasAny ? (
        <EmptyState icon="💎" title="아직 획득한 점수가 없어요" description="미션 인증이 승인되면 점수가 쌓여요" />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
          {missions.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => goToMission(m)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition active:bg-gray-100"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800 truncate">{m.title}</p>
                <p className="text-[12px] text-gray-400 mt-0.5">{m.count}건 인증 · 자세히 보기</p>
              </div>
              <span className="text-base font-bold text-emerald-600 flex-shrink-0">+{m.point}P</span>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </button>
          ))}
          {quiz.point !== 0 && (
            <button type="button" onClick={() => navigate(`/programs/${id}/stats/users/${targetUserId}/quizzes`)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition active:bg-gray-100">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">📝 퀴즈</p>
                <p className="text-[12px] text-gray-400 mt-0.5">{quiz.count}회 · 자세히 보기</p>
              </div>
              <span className="text-base font-bold text-emerald-600 flex-shrink-0">+{quiz.point}P</span>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </button>
          )}
          {other.point !== 0 && (
            <div>
              <button type="button" onClick={() => setExpand(e => e === 'other' ? null : 'other')}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition active:bg-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">기타</p>
                  <p className="text-[12px] text-gray-400 mt-0.5">{other.count}건 · 자세히 보기</p>
                </div>
                <span className="text-base font-bold text-emerald-600 flex-shrink-0">{other.point > 0 ? '+' : ''}{other.point}P</span>
                <ChevronDown className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform ${expand === 'other' ? 'rotate-180' : ''}`} />
              </button>
              {expand === 'other' && (other.items || []).length > 0 && (
                <div className="bg-gray-50/60 px-4 pb-3 pt-0.5">
                  {other.items.map((o, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 pl-3 border-l-2 border-emerald-100">
                      <p className="flex-1 min-w-0 text-[13px] text-gray-700 truncate">{o.reason}</p>
                      <span className="text-[13px] font-bold text-emerald-600 flex-shrink-0">{o.point > 0 ? '+' : ''}{o.point}P</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ProgramStatsUserPointsPage
