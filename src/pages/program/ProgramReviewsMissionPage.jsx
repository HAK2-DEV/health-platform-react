import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { Check, X, Image as ImageIcon, BarChart3, MessageSquare } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { queryKeys, fetchProgram, fetchPendingReviewsEnriched } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'
import UserAvatar from '../../components/common/UserAvatar'

// 운영자 심사 — 개별 미션의 PENDING 인증들 + 승인/반려 액션
// 라우트: /programs/:id/reviews/:bundleParam/:missionId
function ProgramReviewsMissionPage() {
  const { id, bundleParam, missionId } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })

  const isOwner = program?.owner_id === userId

  const { data: pending = [] } = useQuery({
    queryKey: queryKeys.pendingReviews(id),
    queryFn: () => fetchPendingReviewsEnriched(id),
    enabled: !!session && !!id && isOwner,
  })

  // 이 미션의 PENDING 인증만
  const missionPending = useMemo(
    () => pending.filter(r => r.m_id === missionId),
    [pending, missionId]
  )

  const missionTitle = missionPending[0]?.m_title || '(미션)'
  const missionPoint = missionPending[0]?.m_point ?? 0

  // 사진 signed URL
  const [imageUrls, setImageUrls] = useState({})
  useEffect(() => {
    const targets = missionPending.filter(r => r.v_image_path)
    if (targets.length === 0) {
      setImageUrls({})
      return
    }
    let cancelled = false
    Promise.all(
      targets.map(r =>
        supabase.storage
          .from('verification-images')
          .createSignedUrl(r.v_image_path, 3600)
          .then(({ data }) => ({ id: r.v_id, url: data?.signedUrl || null }))
          .catch(() => ({ id: r.v_id, url: null }))
      )
    ).then(results => {
      if (cancelled) return
      const map = {}
      for (const r of results) if (r.url) map[r.id] = r.url
      setImageUrls(map)
    })
    return () => { cancelled = true }
  }, [missionPending.length])

  // 인증 mutation 후 invalidate — 점수/카운트/랭킹/통계/심사/피드 모두
  const invalidateAfterReview = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingReviews(id) })
    queryClient.invalidateQueries({ queryKey: ['scores'] })
    queryClient.invalidateQueries({ queryKey: ['verifications'] })
    queryClient.invalidateQueries({ queryKey: ['rankings'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    queryClient.invalidateQueries({ queryKey: ['feed'] })
  }

  const approveMutation = useMutation({
    mutationFn: async (verificationId) => {
      const { error } = await supabase
        .from('verifications')
        .update({
          status: 'APPROVED',
          reviewed_at: new Date().toISOString(),
          reviewer_id: session.user.id,
        })
        .eq('id', verificationId)
      if (error) throw error
    },
    onSuccess: invalidateAfterReview,
  })

  const rejectMutation = useMutation({
    mutationFn: async ({ verificationId, reason }) => {
      const { error } = await supabase
        .from('verifications')
        .update({
          status: 'REJECTED',
          reviewed_at: new Date().toISOString(),
          reviewer_id: session.user.id,
          rejection_reason: reason,
        })
        .eq('id', verificationId)
      if (error) throw error
    },
    onSuccess: invalidateAfterReview,
  })

  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const isProcessing = approveMutation.isPending || rejectMutation.isPending

  const handleApprove = (verificationId) => {
    approveMutation.mutate(verificationId)
  }
  const handleReject = () => {
    if (!rejectReason.trim()) return
    rejectMutation.mutate(
      { verificationId: rejectingId, reason: rejectReason.trim() },
      {
        onSuccess: () => {
          setRejectingId(null)
          setRejectReason('')
        },
      }
    )
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts))
  }

  if (!program) {
    return <div className="p-6 max-w-4xl mx-auto text-center text-gray-500">불러오는 중...</div>
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}/reviews/${bundleParam}`} title="미션 목록" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          운영자만 심사할 수 있어요
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/reviews/${bundleParam}`} title="미션 목록" />

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name}</p>
        <h1 className="text-2xl font-medium text-gray-800">{missionTitle}</h1>
        <p className="text-sm text-amber-700 mt-1">
          ⏳ 심사 대기 {missionPending.length}건 · {missionPoint}P
        </p>
      </div>

      {missionPending.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-2xl text-center">
          <div className="text-4xl mb-2 opacity-60">📭</div>
          <p className="text-sm text-gray-500">이 미션의 심사 대기 인증을 모두 처리했어요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {missionPending.map(r => {
            const hasImage = !!r.v_image_path
            const hasNumeric = r.v_numeric_value !== null && r.v_numeric_value !== undefined
            const hasNote = !!r.v_note && r.v_note.trim().length > 0
            return (
              <div key={r.v_id} className="bg-white border border-gray-200 rounded-2xl p-4">
                {/* 헤더 — 참여자 + 일시 */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <UserAvatar avatarPath={r.u_avatar_path} nickname={r.u_nickname} size="sm" />
                    <p className="text-sm font-medium text-gray-800">{r.u_nickname}</p>
                  </div>
                  <span className="text-[11px] text-gray-500 whitespace-nowrap">
                    {formatTime(r.v_submitted_at)}
                  </span>
                </div>

                {hasImage && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>사진</span>
                    </div>
                    {imageUrls[r.v_id] ? (
                      <a href={imageUrls[r.v_id]} target="_blank" rel="noopener noreferrer">
                        <img
                          src={imageUrls[r.v_id]}
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
                      {r.v_numeric_value}
                    </p>
                  </div>
                )}

                {hasNote && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>소감</span>
                    </div>
                    <p className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                      {r.v_note}
                    </p>
                  </div>
                )}

                {!hasImage && !hasNumeric && !hasNote && (
                  <p className="text-xs text-gray-400 italic mb-2">(인증 내용 없음)</p>
                )}

                {/* 승인/반려 액션 */}
                {rejectingId === r.v_id ? (
                  <div className="mt-3">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="반려 사유를 입력해주세요"
                      rows={2}
                      maxLength={200}
                      disabled={isProcessing}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-red-500 disabled:bg-gray-50 resize-none text-sm"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => { setRejectingId(null); setRejectReason('') }}
                        disabled={isProcessing}
                        className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md transition disabled:opacity-50"
                      >
                        취소
                      </button>
                      <button
                        type="button"
                        onClick={handleReject}
                        disabled={isProcessing || !rejectReason.trim()}
                        className="flex-[2] px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-md transition disabled:bg-gray-400"
                      >
                        {isProcessing ? '처리 중...' : '반려 확정'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => setRejectingId(r.v_id)}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-1 flex-1 px-3 py-2 bg-white border-2 border-red-200 hover:bg-red-50 text-red-600 text-sm rounded-md transition disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      반려
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(r.v_id)}
                      disabled={isProcessing}
                      className="flex items-center justify-center gap-1 flex-[2] px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-md transition disabled:bg-gray-400"
                    >
                      <Check className="w-4 h-4" />
                      승인
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ProgramReviewsMissionPage
