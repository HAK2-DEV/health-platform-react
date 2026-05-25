import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { Image as ImageIcon, BarChart3, MessageSquare } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { formatRelativeKstDay } from '../../lib/formatters'
import { queryKeys, fetchProgram, fetchProgramStats, formatKstDate } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'

// 개별 미션의 날짜별 인증 카드들
// 라우트: /programs/:id/stats/users/:userId/verifications/:bundleParam/:missionId
function ProgramStatsUserVerificationsMissionPage() {
  const { id, userId: targetUserId, bundleParam, missionId } = useParams()
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

  // 이 미션의 인증만 + 날짜별 그루핑 (KST)
  const missionVerifications = useMemo(
    () => userVerifications.filter(v => v.mission_id === missionId),
    [userVerifications, missionId]
  )

  const missionTitle = missionVerifications[0]?.missions?.title || '(삭제된 미션)'

  const dateGroups = useMemo(() => {
    const map = new Map()
    for (const v of missionVerifications) {
      const dateStr = formatKstDate(new Date(v.submitted_at))
      if (!map.has(dateStr)) map.set(dateStr, [])
      map.get(dateStr).push(v)
    }
    // 날짜 내림차순 (최신 위) — 각 그룹 안은 이미 submitted_at 내림차순
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, items]) => ({ date, items }))
  }, [missionVerifications])

  // 이미지 signed URL
  const [imageUrls, setImageUrls] = useState({})
  useEffect(() => {
    const targets = missionVerifications.filter(v => v.image_path)
    if (targets.length === 0) {
      setImageUrls({})
      return
    }
    let cancelled = false
    Promise.all(
      targets.map(v =>
        supabase.storage
          .from('verification-images')
          .createSignedUrl(v.image_path, 3600)
          .then(({ data }) => ({ id: v.id, url: data?.signedUrl || null }))
          .catch(() => ({ id: v.id, url: null }))
      )
    ).then(results => {
      if (cancelled) return
      const map = {}
      for (const r of results) if (r.url) map[r.id] = r.url
      setImageUrls(map)
    })
    return () => { cancelled = true }
  }, [missionVerifications.length])

  if (!program) {
    return <div className="p-6 max-w-4xl mx-auto text-center text-gray-500">불러오는 중...</div>
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}/stats/users/${targetUserId}/verifications/${bundleParam}`} title="미션 목록" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          운영자만 통계를 볼 수 있어요
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats/users/${targetUserId}/verifications/${bundleParam}`} title="미션 목록" />

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name} · {userInfo?.nickname || '(유저)'}</p>
        <h1 className="text-2xl font-medium text-gray-800">
          {missionTitle}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          인증 {missionVerifications.length}건 · {dateGroups.length}일
        </p>
      </div>

      {dateGroups.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
          아직 인증 기록이 없어요
        </div>
      ) : (
        <div className="space-y-5">
          {dateGroups.map(group => (
            <div key={group.date}>
              {/* 날짜 헤더 */}
              <div className="flex items-center gap-2 mb-2">
                <p className="text-sm font-medium text-gray-700">
                  📅 {group.date.replaceAll('-', '.')}
                </p>
                <span className="text-xs text-gray-400">
                  · {formatRelativeKstDay(group.items[0].submitted_at)}
                </span>
                <span className="ml-auto text-xs text-gray-500">
                  {group.items.length}건
                </span>
              </div>

              {/* 그 날의 인증 카드들 */}
              <div className="space-y-2">
                {group.items.map(v => {
                  const hasImage = !!v.image_path
                  const hasNumeric = v.numeric_value !== null && v.numeric_value !== undefined
                  const hasNote = !!v.note && v.note.trim().length > 0
                  return (
                    <div key={v.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-[11px] text-gray-500 mb-2">
                        {new Date(v.submitted_at).toLocaleTimeString('ko-KR', {
                          timeZone: 'Asia/Seoul',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>

                      {hasImage && (
                        <div className="mb-2">
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>사진</span>
                          </div>
                          {imageUrls[v.id] ? (
                            <a href={imageUrls[v.id]} target="_blank" rel="noopener noreferrer">
                              <img
                                src={imageUrls[v.id]}
                                alt="인증 사진"
                                className="max-h-64 max-w-full rounded-lg border border-gray-200 object-contain"
                              />
                            </a>
                          ) : (
                            <div className="p-3 bg-gray-50 text-gray-400 text-xs rounded text-center">
                              사진 불러오는 중...
                            </div>
                          )}
                        </div>
                      )}

                      {hasNumeric && (
                        <div className="mb-2">
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>기록</span>
                          </div>
                          <p className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-medium text-gray-800">
                            {v.numeric_value}
                          </p>
                        </div>
                      )}

                      {hasNote && (
                        <div className="mb-1">
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>소감</span>
                          </div>
                          <p className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                            {v.note}
                          </p>
                        </div>
                      )}

                      {!hasImage && !hasNumeric && !hasNote && (
                        <p className="text-xs text-gray-400 italic">(인증 내용 없음)</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProgramStatsUserVerificationsMissionPage
