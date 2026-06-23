import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Flag, EyeOff, Eye, Check, ChevronRight } from 'lucide-react'
import { fetchProgramReports, setCommunityPostStatus, setVerificationFeedVisible, resolveReports } from '../../lib/queries'
import { formatRelativeKstDay } from '../../lib/formatters'
import UserAvatar from '../common/UserAvatar'
import LoadingState from '../common/LoadingState'

// 운영자 신고 관리 — 신고된 콘텐츠를 대상별로 묶어 신고자·사유·횟수 + 현재 상태로.
//   신고자 신원은 운영자에게만 노출(피어/작성자에겐 영원히 비공개). 가리기·복구·보러가기.
//   onNavigate: 보러가기로 페이지 이동하기 직전 호출(운영자 메뉴 모달 닫기 등).
function ReportsManageSection({ programId, onNavigate }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['reports', programId],
    queryFn: () => fetchProgramReports(programId),
    enabled: !!programId,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['reports', programId] })
    queryClient.invalidateQueries({ queryKey: ['reportsUnresolvedCount', programId] })
    queryClient.invalidateQueries({ queryKey: ['feed'] })
    queryClient.invalidateQueries({ queryKey: ['communityPosts'] })
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

  const goTo = (g) => {
    if (g.deleted) return
    onNavigate?.()
    if (g.targetType === 'post') {
      const board = g.target?.board_id || 'all'
      navigate(`/programs/${programId}?tab=community&board=${board}&post=${g.targetId}`)
    } else {
      navigate(`/programs/${programId}/feed?v=${g.targetId}`)
    }
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

                {/* 대상 콘텐츠 미리보기 */}
                <button type="button" onClick={() => goTo(g)} disabled={g.deleted}
                  className={`w-full text-left flex items-start gap-2 ${g.deleted ? 'opacity-60' : 'hover:opacity-80'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-gray-800 line-clamp-1">{previewOf(g)}</p>
                    {authorOf(g) && <p className="text-[11px] text-gray-400 mt-0.5">작성자 {authorOf(g)}</p>}
                  </div>
                  {!g.deleted && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />}
                </button>

                {/* 신고자 목록 (운영자 전용) */}
                <ul className="mt-2.5 pt-2.5 border-t border-gray-100 space-y-2">
                  {g.reporters.map(rp => (
                    <li key={rp.id} className="flex items-start gap-2">
                      <UserAvatar avatarPath={rp.avatar_path} nickname={rp.nickname} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] font-semibold text-gray-700 truncate">{rp.nickname}</span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{formatRelativeKstDay(rp.created_at)}</span>
                        </div>
                        {rp.reason
                          ? <p className="text-[12px] text-gray-600 whitespace-pre-wrap break-words leading-snug">{rp.reason}</p>
                          : <p className="text-[12px] text-gray-400 italic">사유 미입력</p>}
                      </div>
                    </li>
                  ))}
                </ul>

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
    </div>
  )
}

export default ReportsManageSection
