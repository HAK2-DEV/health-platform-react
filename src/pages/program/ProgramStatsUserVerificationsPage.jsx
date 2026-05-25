import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { queryKeys, fetchProgram, fetchProgramStats } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'

// 한 유저의 인증 기록 — 묶음(카테고리) 목록 → 클릭 시 그 묶음의 인증 카드들
// 라우트: /programs/:id/stats/users/:userId/verifications
function ProgramStatsUserVerificationsPage() {
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

  const { data: userVerifications = [] } = useQuery({
    queryKey: ['stats', 'userVerifications', id, targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verifications')
        .select('id, mission_id, submitted_at, image_path, numeric_value, note, missions!inner(program_id, title, bundle_title)')
        .eq('missions.program_id', id)
        .eq('user_id', targetUserId)
        .eq('status', 'APPROVED')
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!id && !!targetUserId && isOwner,
  })

  const userInfo = stats?.userStats?.find(u => u.user_id === targetUserId) || null

  // bundle_title 별 그루핑 (목록만 — 카운트 + 미리보기)
  const bundleGroups = useMemo(() => {
    const map = new Map()
    for (const v of userVerifications) {
      const key = v.missions?.bundle_title || null
      if (!map.has(key)) {
        map.set(key, { bundleTitle: key, count: 0, latestAt: null })
      }
      const b = map.get(key)
      b.count += 1
      if (!b.latestAt || v.submitted_at > b.latestAt) b.latestAt = v.submitted_at
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.bundleTitle === null) return 1
      if (b.bundleTitle === null) return -1
      return b.count - a.count
    })
  }, [userVerifications])

  if (!program) {
    return <div className="p-6 max-w-4xl mx-auto text-center text-gray-500">불러오는 중...</div>
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}/stats/users/${targetUserId}`} title="돌아가기" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          운영자만 통계를 볼 수 있어요
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats/users/${targetUserId}`} title="돌아가기" />

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name} · {userInfo?.nickname || '(유저)'}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          📝 인증 기록
        </h1>
      </div>

      {bundleGroups.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
          아직 인증 기록이 없어요
        </div>
      ) : (
        <div className="grid gap-3">
          {bundleGroups.map(group => {
            const isSolo = group.bundleTitle === null
            const bundleParam = isSolo ? 'solo' : encodeURIComponent(group.bundleTitle)
            return (
              <button
                key={group.bundleTitle || '__solo__'}
                type="button"
                onClick={() => navigate(`/programs/${id}/stats/users/${targetUserId}/verifications/${bundleParam}`)}
                className="w-full flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-emerald-300 transition text-left"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 truncate">
                    {isSolo ? '🔹 단독 미션' : group.bundleTitle}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    인증 {group.count}건
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ProgramStatsUserVerificationsPage
