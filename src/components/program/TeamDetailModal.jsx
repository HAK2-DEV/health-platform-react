import { useState } from 'react'
import Modal from '../common/Modal'
import ConfirmModal from '../common/ConfirmModal'
import UserAvatar from '../common/UserAvatar'
import { removeTeamMember, leaveTeam, transferTeamLeader } from '../../lib/queries'

// 팀 상세 모달 — 멤버 목록 + 팀장 권한(추방/위임) + 자진 탈퇴.
// team: 랭킹 데이터 행 그대로 ({team_id, team_name, emoji, leader_id, capacity,
//        member_count, is_active, rank, members:[{user_id,nickname,avatar_path,score}]})
function TeamDetailModal({ team, userId, isOpen, onClose, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirm, setConfirm] = useState(null)  // { title, message, confirmLabel, danger, action, after }

  if (!team) return null
  const members = team.members || []
  const amMember = members.some(m => m.user_id === userId)
  const amLeader = team.leader_id === userId
  const alone = (team.member_count || members.length) <= 1

  const doConfirm = async () => {
    if (!confirm) return
    setBusy(true)
    setError(null)
    try {
      await confirm.action()
      onChanged?.()
      confirm.after?.()
      setConfirm(null)
    } catch (e) {
      setError(e?.message || '처리에 실패했어요')
      setConfirm(null)
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = (m) => setConfirm({
    title: '팀원 내보내기',
    message: `${m.nickname}님을 팀에서 내보낼까요?`,
    confirmLabel: '내보내기',
    danger: true,
    action: () => removeTeamMember(team.team_id, m.user_id),
  })
  const handleTransfer = (m) => setConfirm({
    title: '팀장 넘기기',
    message: `${m.nickname}님에게 팀장을 넘길까요?\n넘기면 본인은 일반 팀원이 돼요.`,
    confirmLabel: '넘기기',
    danger: false,
    action: () => transferTeamLeader(team.team_id, m.user_id),
  })
  const handleLeave = () => setConfirm({
    title: '팀 나가기',
    message: !amLeader
      ? `'${team.team_name}' 팀에서 나갈까요?`
      : alone
        ? '혼자인 팀을 나가면 팀이 해체돼요. 나갈까요?'
        : '팀을 나가면 팀장이 다음 팀원에게 넘어가요. 나갈까요?',
    confirmLabel: '나가기',
    danger: true,
    action: () => leaveTeam(team.team_id),
    after: onClose,
  })

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 pt-2">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">{team.emoji || '👥'}</span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-800 truncate">{team.team_name}</h2>
            <p className="text-xs text-gray-500">
              {team.is_active ? `팀 랭킹 ${team.rank}위 · ` : '모집중 · '}
              👤 {team.member_count}/{team.capacity}명
            </p>
          </div>
        </div>

        {error && (
          <p className="my-3 p-2.5 bg-red-50 text-red-600 rounded-lg text-sm text-center break-keep">{error}</p>
        )}

        {/* 멤버 목록 */}
        <div className="mt-4 divide-y divide-gray-100">
          {members.map(m => {
            const isLeader = m.user_id === team.leader_id
            const isMe = m.user_id === userId
            return (
              <div key={m.user_id} className="flex items-center gap-3 py-2.5">
                <UserAvatar avatarPath={m.avatar_path} nickname={m.nickname} size="md" viewable />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {m.nickname}
                    {isLeader && <span className="ml-1.5 text-xs text-violet-600 font-bold">👑 팀장</span>}
                    {isMe && <span className="ml-1 text-xs text-gray-400">(나)</span>}
                  </p>
                  <p className="text-[11px] text-gray-400">{Number(m.score || 0).toLocaleString()}P</p>
                </div>
                {/* 팀장 권한: 다른 멤버에게 위임/내보내기 */}
                {amLeader && !isMe && (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      type="button" disabled={busy} onClick={() => handleTransfer(m)}
                      className="px-2.5 py-1.5 rounded-full bg-violet-50 text-violet-600 text-xs font-bold hover:bg-violet-100 transition disabled:opacity-50"
                    >
                      팀장 넘기기
                    </button>
                    <button
                      type="button" disabled={busy} onClick={() => handleRemove(m)}
                      className="px-2.5 py-1.5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold hover:bg-gray-200 transition disabled:opacity-50"
                    >
                      내보내기
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 하단 — 내가 이 팀의 멤버일 때만 "팀 나가기" 노출 */}
        <div className="flex gap-2 mt-6">
          <button
            type="button" onClick={onClose} disabled={busy}
            className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition disabled:opacity-50"
          >
            닫기
          </button>
          {amMember && (
            <button
              type="button" onClick={handleLeave} disabled={busy}
              className="flex-1 px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl transition disabled:opacity-50"
            >
              팀 나가기
            </button>
          )}
        </div>
      </div>

      {/* 화면 중앙 확인 다이얼로그 */}
      <ConfirmModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={doConfirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        busy={busy}
      />
    </Modal>
  )
}

export default TeamDetailModal
