import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { Image as ImageIcon, BarChart3, MessageSquare, Calendar } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { formatRelativeKstDay } from '../../lib/formatters'
import { queryKeys, fetchProgram, fetchProgramStats, formatKstDate } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import OperatorVerificationActions from '../../components/program/OperatorVerificationActions'

// 인증 상태 배지
const STATUS_BADGE = {
  APPROVED:       { label: '승인됨',    cls: 'bg-emerald-50 text-emerald-600' },
  REJECTED:       { label: '거절됨',    cls: 'bg-red-50 text-red-500' },
  PENDING_REVIEW: { label: '심사 대기', cls: 'bg-amber-50 text-amber-600' },
}

// 개별 미션의 날짜별 인증 카드들
// 라우트: /programs/:id/stats/users/:userId/verifications/:bundleParam/:missionId
function ProgramStatsUserVerificationsMissionPage() {
  const { id, userId: targetUserId, bundleParam, missionId } = useParams()
  const [searchParams] = useSearchParams()
  const scoredOnly = searchParams.get('scored') === '1'      // 점수 요인에서 진입
  const fromMissions = searchParams.get('from') === 'missions' // 미션별 통계 → 인증자 명단에서 진입
  // 승인 인증만 표시해야 하는 진입 — 점수 요인·미션별 통계 둘 다 APPROVED 기준으로 집계된
  // 숫자를 보여주므로, 여기서 거절/대기까지 섞이면 건수가 안 맞아 보인다.
  const approvedOnly = scoredOnly || fromMissions
  // 진입 경로에 맞는 뒤로가기 대상
  const backPath = fromMissions
    ? `/programs/${id}/stats/missions`
    : scoredOnly
      ? `/programs/${id}/stats/users/${targetUserId}/points`
      : `/programs/${id}/stats/users/${targetUserId}/verifications/${bundleParam}`
  const backTitle = fromMissions ? '미션별' : scoredOnly ? '점수 요인' : '미션 목록'
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

  // ⚠️ 고유 키 사용 — 다른 통계 페이지들은 같은 prefix 로 'APPROVED'만(status 필드 없이) 캐시한다.
  // 키를 공유하면 그 캐시가 재사용돼 거절/대기건이 전부 '승인됨'으로 보이는 버그가 난다.
  const { data: userVerifications = [] } = useQuery({
    queryKey: ['stats', 'userVerificationsFull', id, targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verifications')
        .select('id, mission_id, submitted_at, image_path, numeric_value, metric_values, note, feed_visible, status, rejection_reason, missions!inner(program_id, title, bundle_title, metrics)')
        .eq('missions.program_id', id)
        .eq('user_id', targetUserId)
        .in('status', ['APPROVED', 'REJECTED', 'PENDING_REVIEW'])
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!id && !!targetUserId && isOwner,
  })

  const userInfo = stats?.userStats?.find(u => u.user_id === targetUserId) || null

  // 이 미션의 인증만 + 날짜별 그루핑 (KST)
  const missionVerifications = useMemo(
    () => userVerifications.filter(v =>
      v.mission_id === missionId && (!approvedOnly || v.status === 'APPROVED')
    ),
    [userVerifications, missionId, approvedOnly]
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
    return <LoadingState variant="page" />
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath={backPath} title={backTitle} />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          운영자만 통계를 볼 수 있어요
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={backPath} title={backTitle} />

      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{userInfo?.nickname || '(유저)'}</p>
        <h1 className="text-2xl font-medium text-gray-800">
          {missionTitle}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          인증 {missionVerifications.length}건 · {dateGroups.length}일
        </p>
      </div>

      {dateGroups.length === 0 ? (
        <EmptyState icon="📊" title="아직 인증 기록이 없어요" />
      ) : (
        <div className="space-y-5">
          {dateGroups.map(group => (
            <div key={group.date}>
              {/* 날짜 헤더 */}
              <div className="flex items-center gap-2 mb-2">
                <p className="flex items-center gap-1 text-sm font-medium text-gray-700">
                  <Calendar className="w-3.5 h-3.5 text-gray-500" /> {group.date.replaceAll('-', '.')}
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
                  // 다중 지표 (거리/시간/칼로리)
                  const mDefs = Array.isArray(v.missions?.metrics) ? v.missions.metrics : []
                  const mRows = v.metric_values ? mDefs.filter(d => v.metric_values[d.key] != null) : []
                  const minToClock = (min) => { const h = Math.floor(min / 60), m = min % 60; return `${h}시 ${String(m).padStart(2, '0')}분` }
                  const fmtMetric = (def, val) => {
                    if (def?.inputFormat === 'clock_multi') { const arr = Array.isArray(val) ? val : [val]; return arr.map(v => minToClock(Number(v))).join(', ') }
                    if (def?.inputFormat === 'clock') return minToClock(Number(val))
                    const n = Number(val)
                    if (def?.inputFormat === 'hms') { const sec = Math.round(n * 60), h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return h > 0 ? `${h}시간 ${m}분 ${s}초` : `${m}분 ${s}초` }
                    return `${n}${def?.unit ? ' ' + def.unit : ''}`
                  }
                  const badge = STATUS_BADGE[v.status] || STATUS_BADGE.APPROVED
                  return (
                    <div key={v.id} className="bg-white border border-gray-200 rounded-2xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-[11px] text-gray-500">
                          {new Date(v.submitted_at).toLocaleTimeString('ko-KR', {
                            timeZone: 'Asia/Seoul',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {v.feed_visible === false && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500">피드 숨김</span>
                          )}
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${badge.cls}`}>{badge.label}</span>
                        </div>
                      </div>

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

                      {mRows.length > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>기록</span>
                          </div>
                          <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-800 space-y-0.5">
                            {mRows.map(d => (
                              <p key={d.key}>{d.icon && <span className="mr-1">{d.icon}</span>}{d.label}: <span className="font-medium">{fmtMetric(d, v.metric_values[d.key])}</span></p>
                            ))}
                          </div>
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

                      {!hasImage && !hasNumeric && !hasNote && mRows.length === 0 && (
                        <p className="text-xs text-gray-400 italic">(인증 내용 없음)</p>
                      )}

                      {/* 거절 사유 — 거절(점수 제외)된 인증만 */}
                      {v.status === 'REJECTED' && v.rejection_reason && (
                        <div className="mt-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                          <p className="text-[11px] font-bold text-red-500 mb-0.5">거절 사유</p>
                          <p className="text-[13px] text-gray-700 whitespace-pre-wrap break-words">{v.rejection_reason}</p>
                        </div>
                      )}

                      {/* 운영자 액션 — 점수 제외 / 피드 가리기·표시 (상태별 분기) */}
                      <OperatorVerificationActions
                        verification={{ id: v.id, status: v.status, feed_visible: v.feed_visible, nickname: userInfo?.nickname }}
                        programId={id}
                        feedEnabled={!!program.feed_enabled}
                        layout="block"
                      />
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
