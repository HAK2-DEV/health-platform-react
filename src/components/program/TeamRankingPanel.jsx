import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import UserAvatar from '../common/UserAvatar'
import EmptyState from '../common/EmptyState'
import LoadingState from '../common/LoadingState'
import {
  queryKeys,
  fetchProgramTeamRanking,
  fetchMyTeamInvites,
  respondTeamInvite,
} from '../../lib/queries'
import TeamCreateModal from './TeamCreateModal'
import TeamInviteModal from './TeamInviteModal'
import TeamDetailModal from './TeamDetailModal'
import TeamInviteAcceptModal from './TeamInviteAcceptModal'

// 팀 랭킹 패널 — 프로그램 내 랭킹 탭 + 전역 랭킹 페이지 양쪽에서 공용.
// 받은 초대 / 팀 만들기·초대 / 팀 랭킹 리스트 / 생성·초대 모달을 모두 캡슐화.
// props: program(team_* 컬럼 포함), userId, periodStart(ISO|null), periodKey(쿼리키용)
function TeamRankingPanel({ program, userId, periodStart = null, periodKey = 'all' }) {
  const queryClient = useQueryClient()
  const programId = program?.id
  const scoreMode = program?.team_score_mode || 'sum'

  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [inviteTeamId, setInviteTeamId] = useState(null)
  const [detailTeamId, setDetailTeamId] = useState(null)
  const [acceptInviteId, setAcceptInviteId] = useState(null)  // 수락 모달 대상 초대
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const { data: teams = [], isLoading } = useQuery({
    queryKey: queryKeys.programTeamRanking(programId, periodKey),
    queryFn: () => fetchProgramTeamRanking(programId, periodStart),
    enabled: !!programId,
  })

  const { data: myInvites = [] } = useQuery({
    queryKey: ['my-team-invites', programId, userId],
    queryFn: () => fetchMyTeamInvites(programId, userId),
    enabled: !!programId && !!userId,
  })

  const myTeam = useMemo(
    () => teams.find(t => (t.members || []).some(m => m.user_id === userId)) || null,
    [teams, userId],
  )
  const myTeamId = myTeam?.team_id || null
  const amLeader = myTeam?.leader_id === userId

  const refetchTeamData = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.programTeamRanking(programId, periodKey) })
    queryClient.invalidateQueries({ queryKey: ['my-team-invites', programId, userId] })
  }

  // 알림 딥링크(?invite=)로 들어오면 해당 초대 수락 모달 자동 오픈 (1회) + 파라미터 정리
  const autoInvite = searchParams.get('invite')
  useEffect(() => {
    if (autoInvite && myInvites.some(i => i.id === autoInvite)) {
      setAcceptInviteId(autoInvite)
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.delete('invite')
        return next
      }, { replace: true })
    }
  }, [autoInvite, myInvites]) // eslint-disable-line react-hooks/exhaustive-deps

  // 수락 모달에 넘길 초대 정보 (팀장 닉네임은 팀 랭킹 데이터에서 해석)
  const acceptInvite = useMemo(() => {
    const inv = myInvites.find(i => i.id === acceptInviteId)
    if (!inv) return null
    const team = teams.find(t => t.team_id === inv.team_id)
    const leaderNickname = team
      ? (team.members || []).find(m => m.user_id === team.leader_id)?.nickname
      : null
    return {
      id: inv.id,
      teamName: inv.teams?.name,
      emoji: inv.teams?.emoji,
      leaderNickname,
      memberCount: team?.member_count ?? 1,
      capacity: team?.capacity ?? '?',
    }
  }, [acceptInviteId, myInvites, teams])

  const respondFromModal = async (accept) => {
    setInviteBusy(true)
    setInviteError(null)
    try {
      await respondTeamInvite(acceptInviteId, accept)
      refetchTeamData()
      setAcceptInviteId(null)
    } catch (e) {
      setInviteError(e?.message || '처리에 실패했어요')
    } finally {
      setInviteBusy(false)
    }
  }

  const closeAcceptModal = () => {
    setAcceptInviteId(null)
    setInviteError(null)
  }

  if (isLoading) return <LoadingState />

  return (
    <div className="space-y-4">
      {/* 받은 팀 초대 — 탭하면 화면 중앙 수락 모달 */}
      {myInvites.length > 0 && (
        <div className="space-y-2">
          {myInvites.map(inv => (
            <button
              key={inv.id}
              type="button"
              onClick={() => setAcceptInviteId(inv.id)}
              className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-2xl bg-violet-50 border border-violet-200 hover:bg-violet-100 transition"
            >
              <span className="text-xl flex-shrink-0">{inv.teams?.emoji || '👥'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-violet-800 truncate">{inv.teams?.name}</p>
                <p className="text-[11px] text-violet-500">팀 초대를 받았어요 · 눌러서 응답</p>
              </div>
              <span className="flex-shrink-0 px-3 py-1.5 rounded-full bg-violet-500 text-white text-xs font-bold">응답하기</span>
            </button>
          ))}
        </div>
      )}

      {/* 팀 미가입자 → 팀 만들기 / 팀장(정원 여유) → 팀원 초대하기 */}
      {!myTeamId ? (
        <button
          type="button"
          onClick={() => setShowCreateTeam(true)}
          className="w-full px-4 py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-bold shadow-sm hover:from-violet-600 hover:to-purple-600 transition"
        >
          ＋ 팀 만들기
        </button>
      ) : amLeader && myTeam.member_count < myTeam.capacity ? (
        <button
          type="button"
          onClick={() => setInviteTeamId(myTeamId)}
          className="w-full px-4 py-3 rounded-2xl bg-white border-2 border-violet-300 text-violet-700 font-bold hover:bg-violet-50 transition"
        >
          ＋ 팀원 초대하기
        </button>
      ) : null}

      <TeamRankingList teams={teams} userId={userId} scoreMode={scoreMode} onSelect={setDetailTeamId} />

      {/* 팀 상세 모달 — 멤버/권한 */}
      <TeamDetailModal
        team={teams.find(t => t.team_id === detailTeamId) || null}
        userId={userId}
        isOpen={!!detailTeamId && teams.some(t => t.team_id === detailTeamId)}
        onClose={() => setDetailTeamId(null)}
        onChanged={refetchTeamData}
      />

      {/* 생성 모달 — 생성 후 바로 초대 모달로 연결 */}
      {program && (
        <TeamCreateModal
          program={program}
          isOpen={showCreateTeam}
          onClose={() => setShowCreateTeam(false)}
          onCreated={(newTeamId) => {
            refetchTeamData()
            if (newTeamId) setInviteTeamId(newTeamId)
          }}
        />
      )}

      {/* 초대 모달 */}
      <TeamInviteModal
        teamId={inviteTeamId}
        isOpen={!!inviteTeamId}
        onClose={() => setInviteTeamId(null)}
        onChanged={refetchTeamData}
      />

      {/* 초대 수락 모달 (화면 중앙) */}
      <TeamInviteAcceptModal
        invite={acceptInvite}
        isOpen={!!acceptInvite}
        busy={inviteBusy}
        error={inviteError}
        onAccept={() => respondFromModal(true)}
        onDecline={() => respondFromModal(false)}
        onClose={closeAcceptModal}
      />
    </div>
  )
}

// ─── 팀 랭킹 리스트 ───────────────────────────────────────
function TeamRankingList({ teams, userId, scoreMode, onSelect }) {
  if (!teams || teams.length === 0) {
    return (
      <EmptyState
        icon="👥"
        title="아직 만들어진 팀이 없어요"
        description="팀을 만들어 함께 도전해보세요!"
        variant="mint"
      />
    )
  }
  const myTeamId = teams.find(t => (t.members || []).some(m => m.user_id === userId))?.team_id
  const active = teams.filter(t => t.is_active)
  const recruiting = teams.filter(t => !t.is_active)

  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div className="bg-white rounded-2xl shadow-elevated divide-y divide-gray-100 overflow-hidden">
          {active.map(t => (
            <TeamRow key={t.team_id} team={t} isMine={t.team_id === myTeamId} scoreMode={scoreMode} onSelect={onSelect} />
          ))}
        </div>
      )}
      {recruiting.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 px-1 mb-2">모집 중 — 정원을 채우면 랭킹에 반영돼요</p>
          <div className="bg-white rounded-2xl shadow-elevated divide-y divide-gray-100 overflow-hidden">
            {recruiting.map(t => (
              <TeamRow key={t.team_id} team={t} isMine={t.team_id === myTeamId} scoreMode={scoreMode} onSelect={onSelect} recruiting />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TeamRow({ team, isMine, scoreMode, onSelect, recruiting = false }) {
  const total = team.total_score || 0
  const avg = Number(team.avg_score || 0)
  const avgLabel = avg.toLocaleString(undefined, { maximumFractionDigits: 1 })
  const members = team.members || []
  const memberNames = members.slice(0, 3).map(m => m.nickname).join(', ')
    + (members.length > 3 ? ` 외 ${members.length - 3}` : '')

  return (
    <button
      type="button"
      onClick={() => onSelect?.(team.team_id)}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50 ${isMine ? 'bg-violet-50/60 hover:bg-violet-100/60' : ''}`}
    >
      <span className="w-6 text-center text-base font-bold text-gray-500 flex-shrink-0">
        {recruiting ? '·' : team.rank}
      </span>
      <span className="text-xl flex-shrink-0 w-7 text-center">{team.emoji || '👥'}</span>
      <div className="flex-1 min-w-0">
        <p className={`font-bold truncate ${isMine ? 'text-violet-800' : 'text-gray-800'}`}>
          {team.team_name}
          {isMine && <span className="ml-1.5 text-xs text-violet-600 font-medium">(내 팀)</span>}
        </p>
        <p className="text-xs text-gray-500 truncate">
          👤 {team.member_count}/{team.capacity}
          {members.length > 0 && ` · ${memberNames}`}
        </p>
      </div>
      {recruiting ? (
        <span className="text-xs text-gray-400 font-medium flex-shrink-0">모집중</span>
      ) : (
        <div className="text-right flex-shrink-0 leading-tight">
          {scoreMode === 'average' ? (
            <>
              <span className="text-violet-600 font-extrabold">인당 {avgLabel}</span>
              <p className="text-[11px] text-gray-400">합계 {total.toLocaleString()}</p>
            </>
          ) : (
            <>
              <span className="text-violet-600 font-extrabold">
                {total.toLocaleString()}<span className="text-xs font-bold text-violet-500 ml-0.5">P</span>
              </span>
              <p className="text-[11px] text-gray-400">인당 {avgLabel}</p>
            </>
          )}
        </div>
      )}
    </button>
  )
}

export default TeamRankingPanel
