import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, Eye, EyeOff } from 'lucide-react'
import { queryKeys, excludeVerificationScore, setVerificationFeedVisible } from '../../lib/queries'

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
  }

  const excludeMutation = useMutation({
    mutationFn: (reason) => excludeVerificationScore(verification.id, reason),
    onSuccess: invalidateAll,
    onError: (err) => {
      console.error('점수 제외 실패:', err)
      alert(`점수 제외에 실패했어요: ${err.message}`)
    },
  })
  const hideMutation = useMutation({
    mutationFn: (visible) => setVerificationFeedVisible(verification.id, visible),
    onSuccess: invalidateAll,
    onError: (err) => {
      console.error('피드 표시 변경 실패:', err)
      alert(`피드 표시 변경에 실패했어요: ${err.message}`)
    },
  })

  const busy = excludeMutation.isPending || hideMutation.isPending

  const handleExclude = () => {
    const who = verification.nickname || '참가자'
    const reason = window.prompt(
      `${who} 님의 이 인증을 점수에서 제외할까요?\n` +
      `점수가 회수되고 인증은 반려 처리됩니다 (사진·기록은 보존).\n\n` +
      `참가자에게 전달할 사유 (선택):`,
      ''
    )
    if (reason === null) return // 취소
    excludeMutation.mutate(reason)
  }

  const handleToggleHide = () => {
    if (!isHidden) {
      if (!window.confirm('이 게시글을 커뮤니티 피드에서 가릴까요?\n다른 참가자에게 보이지 않게 됩니다. (점수는 유지)')) return
      hideMutation.mutate(false)
    } else {
      hideMutation.mutate(true) // 다시 표시
    }
  }

  // 이미 점수 제외(반려)된 인증 — 통계에서 보일 수 있음. 라벨만 표시.
  if (isExcluded) {
    return <span className="text-xs text-red-400">점수 제외됨</span>
  }

  const wrapClass = layout === 'bar'
    ? 'ml-auto flex items-center gap-3'
    : 'flex items-center gap-4 pt-2 mt-2 border-t border-gray-100'

  return (
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
        onClick={handleExclude}
        disabled={busy}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition disabled:opacity-50"
        title="이 인증을 점수에서 제외"
      >
        <Ban className="w-4 h-4" />
        점수 제외
      </button>
    </div>
  )
}

export default OperatorVerificationActions
