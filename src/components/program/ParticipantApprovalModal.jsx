import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import Modal from '../common/Modal'
import UserAvatar from '../common/UserAvatar'
import LoadingState from '../common/LoadingState'
import { supabase } from '../../supabaseClient'
import { formatRelativeKstDay } from '../../lib/formatters'
import { queryKeys, invalidateParticipation } from '../../lib/queries'

// 참여자 승인 심사 모달 — 운영자 패널 「인증 심사」에서 진입.
//   PENDING 신청자 목록 + 입장 답변 확인 + 승인/거절.
//   ProgramStatsUsersPage 의 승인 대기 섹션과 동일 캐시 키(['program-pending', id]) 공유.
function ParticipantApprovalModal({ programId, isOpen, onClose }) {
  const queryClient = useQueryClient()

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['program-pending', programId],
    queryFn: async () => {
      const { data: pp, error } = await supabase
        .from('program_participants')
        .select('id, user_id, status, joined_at, entry_answer')
        .eq('program_id', programId)
        .eq('status', 'PENDING')
        .order('joined_at', { ascending: true })
      if (error) throw error
      if (!pp || pp.length === 0) return []
      const uids = pp.map(r => r.user_id)
      const { data: users } = await supabase
        .from('users')
        .select('id, nickname, avatar_path')
        .in('id', uids)
      const umap = new Map((users || []).map(u => [u.id, u]))
      return pp.map(r => ({ ...r, user: umap.get(r.user_id) || null }))
    },
    enabled: !!isOpen && !!programId,
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ participationId, action }) => {
      const newStatus = action === 'approve' ? 'ACTIVE' : 'REJECTED'
      const { error } = await supabase
        .from('program_participants')
        .update({ status: newStatus })
        .eq('id', participationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-pending', programId] })
      queryClient.invalidateQueries({ queryKey: ['program-pending-count', programId] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      // 승인 → PENDING→ACTIVE 로 참여자 수 증가 → 관련 화면 전부 갱신
      invalidateParticipation(queryClient, { programId })
    },
    onError: (err) => {
      console.error('승인/거절 실패:', err)
      alert(`처리에 실패했습니다: ${err.message}`)
    },
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800 mb-1">
          🙋 참여자 승인 심사
          {pending.length > 0 && <span className="text-sm font-medium text-amber-600">({pending.length})</span>}
        </h2>
        <p className="text-xs text-gray-500 mb-4">신청자의 입장 답변을 확인하고 승인/거절하세요.</p>

        {isLoading ? (
          <LoadingState size="sm" />
        ) : pending.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-4xl mb-2 leading-none">✅</div>
            <p className="text-sm text-gray-500">승인 대기 중인 신청자가 없어요</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {pending.map(p => (
              <div key={p.id} className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <UserAvatar avatarPath={p.user?.avatar_path} nickname={p.user?.nickname} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{p.user?.nickname || '(?)'}</p>
                    <p className="text-[11px] text-gray-500">신청 · {formatRelativeKstDay(p.joined_at)}</p>
                  </div>
                </div>

                {p.entry_answer && (
                  <div className="bg-white rounded-xl p-3 mb-3 border border-amber-100">
                    <p className="text-[11px] text-amber-700 font-medium mb-1">📝 입장 답변</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-all">{p.entry_answer}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => reviewMutation.mutate({ participationId: p.id, action: 'reject' })}
                    disabled={reviewMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-white border-2 border-red-200 hover:bg-red-50 text-red-700 text-sm font-medium rounded-xl transition disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    거절
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewMutation.mutate({ participationId: p.id, action: 'approve' })}
                    disabled={reviewMutation.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-medium rounded-xl transition disabled:from-gray-400 disabled:to-gray-400"
                  >
                    <Check className="w-4 h-4" />
                    승인
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ParticipantApprovalModal
