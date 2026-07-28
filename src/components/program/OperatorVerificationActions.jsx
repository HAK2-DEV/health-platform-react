import { useState } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, Eye, EyeOff } from 'lucide-react'
import { queryKeys, excludeVerificationScore, setVerificationFeedVisible } from '../../lib/queries'
import ConfirmModal from '../common/ConfirmModal'

// 운영자 전용 인증 조치 — 커뮤니티 피드 + 통계(참여자별 인증 내역) 공용.
//   · 점수 제외: 점수 회수 + 반려 처리 (excludeVerificationScore RPC) — 자동승인 어뷰징 대응
//   · 피드 가리기/표시: feed_visible 토글 — 점수·승인은 유지, 커뮤니티 노출만 차단/복구
//
// 호출측에서 운영자 여부를 확인해 렌더링할 것 (이 컴포넌트는 권한 가정).
//   서버(RPC/RLS)에서도 owner 재검증하므로 UI 우회는 막힘.
//
// props:
//   verification: { id, status, feed_visible, nickname }
//   programId:    캐시 무효화(feedPosts)용
//   feedEnabled:  피드 활성 프로그램일 때만 「피드 가리기」 노출
//   layout:       'bar'(피드 액션바, 우측 정렬) | 'block'(통계 카드 하단, 구분선)
function OperatorVerificationActions({ verification, programId, feedEnabled = true, layout = 'bar' }) {
  const queryClient = useQueryClient()
  const isExcluded = verification.status === 'REJECTED'
  const isHidden = verification.feed_visible === false

  // 모달 상태 — 네이티브 prompt/confirm 대신 중앙 카드 UI
  const [excludeOpen, setExcludeOpen] = useState(false)
  useBodyScrollLock(excludeOpen)  // 점수 제외 확인 오버레이 — iOS 배경 스크롤 방지
  const [reason, setReason] = useState('')
  const [hideConfirmOpen, setHideConfirmOpen] = useState(false)

  const invalidateAll = () => {
    if (programId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.feedPosts(programId) })
      queryClient.invalidateQueries({ queryKey: ['feed', 'hidden', programId] })
    }
    queryClient.invalidateQueries({ queryKey: ['rankings'] })
    queryClient.invalidateQueries({ queryKey: ['scores'] })   // 대시보드 랭킹 포인트(totalPoints) 동기화
    queryClient.invalidateQueries({ queryKey: ['my-activity'] })
    queryClient.invalidateQueries({ queryKey: ['program-overview'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    queryClient.invalidateQueries({ queryKey: ['metricSummary'] })  // 승인 후 주요 기록 요약 반영
    queryClient.invalidateQueries({ queryKey: ['home-stats'] })     // 대시보드 「오늘의 운영 현황」 심사 대기 수 반영
  }

  const excludeMutation = useMutation({
    mutationFn: (r) => excludeVerificationScore(verification.id, r),
    onSuccess: () => { invalidateAll(); setExcludeOpen(false); setReason('') },
    onError: (err) => {
      console.error('점수 제외 실패:', err)
      alert(`점수 제외에 실패했어요: ${err.message}`)
    },
  })
  const hideMutation = useMutation({
    mutationFn: (visible) => setVerificationFeedVisible(verification.id, visible),
    onSuccess: () => { invalidateAll(); setHideConfirmOpen(false) },
    onError: (err) => {
      console.error('피드 표시 변경 실패:', err)
      alert(`피드 표시 변경에 실패했어요: ${err.message}`)
    },
  })

  const busy = excludeMutation.isPending || hideMutation.isPending
  const who = verification.nickname || '참가자'

  const handleToggleHide = () => {
    if (isHidden) hideMutation.mutate(true)   // 이미 가려짐 → 즉시 다시 표시 (확인 불필요)
    else setHideConfirmOpen(true)             // 가리기는 확인 모달
  }

  // 이미 점수 제외(반려)된 인증 — 통계에서 보일 수 있음. 라벨만 표시.
  if (isExcluded) {
    return <span className="text-xs text-red-400">점수 제외됨</span>
  }

  const wrapClass = layout === 'bar'
    ? 'ml-auto flex items-center gap-3'
    : 'flex items-center gap-4 pt-2 mt-2 border-t border-gray-100'

  return (
    <>
      <div className={wrapClass}>
        {feedEnabled && (
          <button
            type="button"
            onClick={handleToggleHide}
            disabled={busy}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition disabled:opacity-50"
            title={isHidden ? '피드에 다시 표시' : '피드에서 가리기'}
          >
            {isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            {isHidden ? '피드 표시' : '피드 가리기'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setExcludeOpen(true)}
          disabled={busy}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition disabled:opacity-50"
          title="이 인증을 점수에서 제외"
        >
          <Ban className="w-4 h-4" />
          점수 제외
        </button>
      </div>

      {/* 점수 제외 — 사유 입력 중앙 카드 */}
      {excludeOpen && (
        <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-5" style={{ touchAction: 'pan-y' }} onClick={() => !busy && setExcludeOpen(false)}>
          <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center flex-shrink-0"><Ban className="w-4 h-4" /></span>
              <h4 className="text-[15px] font-bold text-gray-800">점수에서 제외할까요?</h4>
            </div>
            <p className="text-[13px] text-gray-600 leading-relaxed break-keep" style={{ marginBottom: '12px' }}>
              <b className="text-gray-800">{who}</b> 님의 이 인증을 점수에서 제외해요.
              점수가 회수되고 인증은 반려 처리돼요. (사진·기록은 보존)
            </p>
            <label className="block text-[12px] font-semibold text-gray-500 mb-1">참가자에게 전달할 사유 <span className="text-gray-400 font-normal">(선택)</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              maxLength={100}
              placeholder="예: 미션과 무관한 사진이에요."
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-[10px] focus:outline-none focus:border-red-400 resize-none text-sm break-words"
              style={{ marginBottom: '14px' }}
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setExcludeOpen(false)} disabled={busy}
                className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50">취소</button>
              <button type="button" onClick={() => excludeMutation.mutate(reason)} disabled={busy}
                className="flex-[1.4] h-11 rounded-xl text-white text-sm font-bold bg-red-500 hover:bg-red-600 transition disabled:opacity-50">
                {busy ? '처리 중...' : '점수 제외'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 피드 가리기 — 확인 모달 */}
      <ConfirmModal
        isOpen={hideConfirmOpen}
        onClose={() => setHideConfirmOpen(false)}
        onConfirm={() => hideMutation.mutate(false)}
        title="피드에서 가릴까요?"
        message={'이 게시글을 커뮤니티 피드에서 가려요.\n다른 참가자에게 보이지 않게 돼요. (점수는 유지)'}
        confirmLabel="가리기"
        danger
        busy={hideMutation.isPending}
      />
    </>
  )
}

export default OperatorVerificationActions
