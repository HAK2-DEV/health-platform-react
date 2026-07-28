import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, EyeOff, Eye, Check, ChevronRight, X } from 'lucide-react'
import { fetchProgramReports, fetchReporterReportStats, setCommunityPostStatus, setVerificationFeedVisible, resolveReports } from '../../lib/queries'
import { getSignedUrls } from '../../lib/signedUrls'
import { formatRelativeKstDay } from '../../lib/formatters'
import UserAvatar from '../common/UserAvatar'
import LoadingState from '../common/LoadingState'

// 운영자 신고 관리 — 신고된 콘텐츠를 대상별로 묶어 신고자·사유·횟수 + 현재 상태로.
//   신고자 신원은 운영자에게만 노출(피어/작성자에겐 영원히 비공개). 가리기·복구·보러가기.
//   onNavigate: 보러가기로 페이지 이동하기 직전 호출(운영자 메뉴 모달 닫기 등).
//   returnTo: 게시글 상세를 닫을 때 복귀할 경로(예: 오늘의 운영). 없으면 기본 닫기.
function ReportsManageSection({ programId, onNavigate, returnTo = null }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['reports', programId],
    queryFn: () => fetchProgramReports(programId),
    enabled: !!programId,
  })

  // 신고자별 오신고 이력 (운영자 전용) — 상습 허위신고자 식별용
  const { data: reporterStats = {} } = useQuery({
    queryKey: ['reporterStats', programId],
    queryFn: () => fetchReporterReportStats(programId),
    enabled: !!programId,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['reports', programId] })
    queryClient.invalidateQueries({ queryKey: ['reportsUnresolvedCount', programId] })
    queryClient.invalidateQueries({ queryKey: ['feed'] })
    queryClient.invalidateQueries({ queryKey: ['communityPosts'] })
    queryClient.invalidateQueries({ queryKey: ['home-stats'] })   // 대시보드 「오늘의 운영 현황」 미처리 신고 수 반영
  }

  // 가리기/복구 — 노출 상태를 바꾸고, 그 콘텐츠의 신고를 처리됨으로.
  const toggleMutation = useMutation({
    mutationFn: async ({ targetType, targetId, hide }) => {
      if (targetType === 'post') await setCommunityPostStatus({ id: targetId, status: hide ? 'hidden' : 'visible' })
      else await setVerificationFeedVisible(targetId, !hide)
      await resolveReports(programId, targetType, targetId)
    },
    onSuccess: invalidate,
    onError: (e) => alert(`처리 실패: ${e.message}`),
  })

  // 처리 완료 — 노출은 그대로 두고 신고만 처리됨으로 (오신고·경미한 신고 정리).
  const resolveMutation = useMutation({
    mutationFn: ({ targetType, targetId }) => resolveReports(programId, targetType, targetId),
    onSuccess: invalidate,
    onError: (e) => alert(`처리 실패: ${e.message}`),
  })

  // 인증 보기 — 신고된 인증은 대개 숨김(feed_visible=false)이라 피드에 안 뜬다.
  //   피드로 보내면 목록만 보이므로, 운영자 권한으로 가져온 데이터(이미지·메모)를
  //   패널 안 모달로 바로 띄워 판단하게 한다. ("부적절한 인증 사진" 판단엔 이미지가 핵심)
  const [viewVer, setViewVer] = useState(null)   // 인증 뷰어 모달 대상 group
  const [verUrl, setVerUrl] = useState(null)      // 인증 이미지 signed URL
  useEffect(() => {
    const path = viewVer?.target?.image_path
    if (!path) { setVerUrl(null); return }
    let cancelled = false
    setVerUrl(null)
    getSignedUrls('verification-images', [path]).then(byPath => {
      if (!cancelled) setVerUrl(byPath[path] || null)
    })
    return () => { cancelled = true }
  }, [viewVer])

  const goTo = (g) => {
    if (g.deleted) return
    if (g.targetType === 'verification') {
      setViewVer(g)   // 인증 → 패널 내 모달(숨김이어도 확실히 보임)
      return
    }
    onNavigate?.()
    // 게시글 상세를 닫으면(모달 backdrop) returnTo 로 복귀 — 오늘의 운영에서 진입 시 신고 처리 탭으로.
    const closeParam = returnTo ? `&closeTo=${encodeURIComponent(returnTo)}` : ''
    const board = g.target?.board_id || 'all'
    navigate(`/programs/${programId}?tab=community&board=${board}&post=${g.targetId}${closeParam}`)
  }

  const previewOf = (g) => {
    if (g.deleted) return '(삭제된 콘텐츠)'
    if (g.targetType === 'post') {
      const t = g.target
      return (t?.title?.trim() || t?.body?.trim() || '(내용 없음)')
    }
    const v = g.target
    return v?.missions?.title || '인증'
  }
  const authorOf = (g) => g.deleted ? null : (g.targetType === 'post' ? g.target?.author?.nickname : g.target?.user?.nickname)

  return (
    <div>
      <p className="text-[11px] text-gray-400 mb-2.5 leading-relaxed">
        신고된 글·인증을 모아봐요. <b className="text-gray-500">신고자 정보는 운영자만</b> 볼 수 있고, 작성자·다른 참여자에겐 공개되지 않아요.
      </p>

      {isLoading ? (
        <LoadingState />
      ) : groups.length === 0 ? (
        <p className="text-[12px] text-gray-400 bg-gray-50 border border-gray-100 rounded-xl p-4 text-center">
          접수된 신고가 없어요
        </p>
      ) : (
        <div className="space-y-2.5">
          {groups.map(g => {
            const kindLabel = g.targetType === 'post' ? '게시글' : '인증'
            const busy = toggleMutation.isPending
            return (
              <div key={`${g.targetType}:${g.targetId}`} className="bg-white border border-gray-200 rounded-2xl p-3.5">
                {/* 상단 — 종류 · 노출상태 · 처리상태 · 신고수 */}
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-bold flex-shrink-0">{kindLabel}</span>
                  {g.deleted ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 text-[10px] font-bold">삭제됨</span>
                  ) : g.hidden ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 text-[10px] font-bold">🚫 가려짐</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">노출 중</span>
                  )}
                  {g.unresolved > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold">처리 대기</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 text-[10px] font-bold">처리됨</span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-red-500 flex-shrink-0">
                    <Flag className="w-3 h-3" /> 신고 {g.reporters.length}건
                  </span>
                </div>

                {/* 대상 콘텐츠 미리보기 (제목만 클릭 → 보러가기) */}
                <button type="button" onClick={() => goTo(g)} disabled={g.deleted}
                  className={`w-full text-left flex items-center gap-2 ${g.deleted ? 'opacity-60' : 'hover:opacity-80'}`}>
                  <p className="flex-1 min-w-0 text-[13.5px] font-bold text-gray-800 line-clamp-1">{previewOf(g)}</p>
                  {!g.deleted && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                </button>

                {/* 라벨형 정보 — 작성자 / 신고자 / 신고내용 (신고자 정보는 운영자 전용) */}
                <div className="mt-2.5 pt-2.5 border-t border-gray-100 space-y-1.5">
                  {authorOf(g) && (
                    <div className="flex gap-2 text-[12.5px]">
                      <span className="w-[52px] flex-shrink-0 text-gray-400 font-semibold">작성자</span>
                      <span className="text-gray-700 font-medium truncate">{authorOf(g)}</span>
                    </div>
                  )}
                  {g.reporters.map((rp, i) => (
                    <div key={rp.id} className={`space-y-1.5 ${i > 0 ? 'pt-1.5 border-t border-gray-50' : ''}`}>
                      <div className="flex gap-2 text-[12.5px]">
                        <span className="w-[52px] flex-shrink-0 text-gray-400 font-semibold">신고자</span>
                        <span className="min-w-0 flex items-center gap-1.5 flex-wrap">
                          <UserAvatar avatarPath={rp.avatar_path} nickname={rp.nickname} size="sm" />
                          <span className="text-gray-700 font-medium truncate">{rp.nickname}</span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeKstDay(rp.created_at)}</span>
                          {rp.userId && reporterStats[rp.userId]?.dismissed > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold flex-shrink-0"
                              title="이 신고자가 낸 신고 중 운영자가 인용하지 않은(노출 유지·복구) 건수예요. 상습 오신고 참고용.">
                              ⚠️ 지난 오신고 {reporterStats[rp.userId].dismissed}건
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex gap-2 text-[12.5px]">
                        <span className="w-[52px] flex-shrink-0 text-gray-400 font-semibold">신고내용</span>
                        {rp.reason
                          ? <span className="text-gray-600 whitespace-pre-wrap break-words leading-snug">{rp.reason}</span>
                          : <span className="text-gray-400 italic">사유 미입력</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 액션 — 가리기/복구(처리 포함) · 처리 완료(노출 유지) · 보러가기 */}
                {(!g.deleted || g.unresolved > 0) && (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {!g.deleted && (g.hidden ? (
                      <button type="button" disabled={busy}
                        onClick={() => toggleMutation.mutate({ targetType: g.targetType, targetId: g.targetId, hide: false })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold transition disabled:opacity-50">
                        <Eye className="w-3.5 h-3.5" /> 다시 노출
                      </button>
                    ) : (
                      <button type="button" disabled={busy}
                        onClick={() => toggleMutation.mutate({ targetType: g.targetType, targetId: g.targetId, hide: true })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[12px] font-bold transition disabled:opacity-50">
                        <EyeOff className="w-3.5 h-3.5" /> 가리기
                      </button>
                    ))}
                    {g.unresolved > 0 && (
                      <button type="button" disabled={resolveMutation.isPending}
                        onClick={() => resolveMutation.mutate({ targetType: g.targetType, targetId: g.targetId })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 text-[12px] font-bold hover:bg-gray-50 transition disabled:opacity-50">
                        <Check className="w-3.5 h-3.5" /> 처리 완료
                      </button>
                    )}
                    {!g.deleted && (
                      <button type="button" onClick={() => goTo(g)}
                        className="px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 text-[12px] font-bold hover:bg-gray-50 transition">
                        보러가기
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 인증 뷰어 — 신고된 인증(숨김 포함)을 이미지와 함께 바로 확인 + 조치 */}
      {viewVer && (
        <div className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setViewVer(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
              <h3 className="text-[15px] font-bold text-gray-800 flex items-center gap-1.5">
                <img src="/icons/operator/report-flag.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" />
                신고된 인증
              </h3>
              <button type="button" onClick={() => setViewVer(null)} className="p-1 -mr-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-gray-400 font-semibold">인증</span>
                <span className="font-bold text-gray-800">{viewVer.target?.missions?.title || '인증'}</span>
                <span className="ml-auto text-gray-500">{viewVer.target?.user?.nickname || '(작성자)'}</span>
              </div>
              {viewVer.target?.image_path ? (
                verUrl ? (
                  <img src={verUrl} alt="인증 사진" className="w-full rounded-xl bg-gray-100 object-contain max-h-[55vh]" />
                ) : (
                  <div className="w-full aspect-square rounded-xl bg-gray-100 animate-pulse" />
                )
              ) : (
                <p className="text-[12px] text-gray-400 bg-gray-50 rounded-xl p-4 text-center">사진 없는 인증</p>
              )}
              {viewVer.target?.note && (
                <p className="text-[13px] text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{viewVer.target.note}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-gray-100 sticky bottom-0 bg-white">
              {viewVer.hidden ? (
                <button type="button" disabled={toggleMutation.isPending}
                  onClick={() => { toggleMutation.mutate({ targetType: 'verification', targetId: viewVer.targetId, hide: false }); setViewVer(null) }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold transition disabled:opacity-50">
                  <Eye className="w-3.5 h-3.5" /> 다시 노출
                </button>
              ) : (
                <button type="button" disabled={toggleMutation.isPending}
                  onClick={() => { toggleMutation.mutate({ targetType: 'verification', targetId: viewVer.targetId, hide: true }); setViewVer(null) }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white text-[12px] font-bold transition disabled:opacity-50">
                  <EyeOff className="w-3.5 h-3.5" /> 가리기
                </button>
              )}
              {viewVer.unresolved > 0 && (
                <button type="button" disabled={resolveMutation.isPending}
                  onClick={() => { resolveMutation.mutate({ targetType: 'verification', targetId: viewVer.targetId }); setViewVer(null) }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 text-[12px] font-bold hover:bg-gray-50 transition disabled:opacity-50">
                  <Check className="w-3.5 h-3.5" /> 처리 완료
                </button>
              )}
              <button type="button" onClick={() => setViewVer(null)}
                className="ml-auto px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 text-[12px] font-bold hover:bg-gray-50 transition">
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportsManageSection
