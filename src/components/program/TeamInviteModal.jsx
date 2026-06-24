import { useState } from 'react'
import { Check } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Modal from '../common/Modal'
import UserAvatar from '../common/UserAvatar'
import LoadingState from '../common/LoadingState'
import EmptyState from '../common/EmptyState'
import { fetchTeamInviteCandidates, inviteToTeam } from '../../lib/queries'

// 팀원 초대 모달 — 같은 프로그램 미소속 참여자 목록에서 골라 초대(앱 내, 초대 전용).
// teamId 의 팀장만 후보를 볼 수 있음(RPC가 팀장 아니면 빈 결과).
function TeamInviteModal({ teamId, isOpen, onClose, onChanged }) {
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['team-invite-candidates', teamId],
    queryFn: () => fetchTeamInviteCandidates(teamId),
    enabled: isOpen && !!teamId,
  })

  const handleInvite = async (userId) => {
    setBusyId(userId)
    setError(null)
    try {
      await inviteToTeam(teamId, userId)
      await queryClient.invalidateQueries({ queryKey: ['team-invite-candidates', teamId] })
      onChanged?.()
    } catch (e) {
      setError(e?.message || '초대에 실패했어요')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 pt-2">
        <h2 className="text-xl font-bold text-gray-800 mb-1">팀원 초대</h2>
        <p className="text-sm text-gray-500 mb-4 break-keep">
          같은 프로그램 참여자에게 초대를 보내요. 상대가 수락하면 팀에 합류해요.
        </p>

        {error && (
          <p className="mb-3 p-2.5 bg-red-50 text-red-600 rounded-lg text-sm text-center break-keep">{error}</p>
        )}

        {isLoading ? (
          <LoadingState />
        ) : candidates.length === 0 ? (
          <EmptyState
            icon="🙌"
            title="초대할 참여자가 없어요"
            description="모든 참여자가 이미 팀에 속해 있어요."
            variant="mint"
          />
        ) : (
          <div className="max-h-[50vh] overflow-y-auto -mx-1 px-1 divide-y divide-gray-100">
            {candidates.map(c => (
              <div key={c.user_id} className="flex items-center gap-3 py-2.5">
                <UserAvatar avatarPath={c.avatar_path} nickname={c.nickname} size="md" />
                <span className="flex-1 min-w-0 font-medium text-gray-800 truncate">{c.nickname}</span>
                {c.invited ? (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-violet-100 text-violet-600 text-xs font-bold">
                    <Check className="w-3.5 h-3.5" /> 초대됨
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleInvite(c.user_id)}
                    disabled={busyId === c.user_id}
                    className="flex-shrink-0 px-4 py-1.5 rounded-full bg-violet-500 hover:bg-violet-600 text-white text-sm font-bold transition disabled:opacity-50"
                  >
                    {busyId === c.user_id ? '...' : '초대'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-5 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition"
        >
          닫기
        </button>
      </div>
    </Modal>
  )
}

export default TeamInviteModal
