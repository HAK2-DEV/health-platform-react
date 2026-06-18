import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { checkMissionToday } from '../lib/formatters'
import { queryKeys, fetchActivePrograms, fetchTodayMissions, fetchTodayCounts } from '../lib/queries'
import MissionCard from '../components/program/MissionCard'
import StickyBackBar from '../components/common/StickyBackBar'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'

// 인증 가능 여부 — 지원 형식 있음 + 활성 + 일일 한도 미달
function isRecordable(m, todayCounts) {
  const supported = m.requires_image || m.requires_numeric || m.requires_note
  if (!supported) return false
  const now = new Date()
  if (m.active_from && now < new Date(m.active_from)) return false
  if (m.active_until && now > new Date(m.active_until)) return false
  if (!checkMissionToday(m).active) return false
  const cnt = todayCounts[m.id]?.total || 0
  if (m.daily_limit != null && cnt >= m.daily_limit) return false
  return true
}

// 기록하기 — 참여 전 프로그램의 오늘 인증 가능한 미션을 통합해서 보여줌.
//   인증 가능 미션이 딱 1개면 바로 인증 화면으로 건너뜀.
function RecordPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id
  const skippedRef = useRef(false)

  const { data: activePrograms = [], isLoading: isProgLoading } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  const programIds = activePrograms.map(p => p.id)
  const { data: missions = [], isLoading: isMissionLoading } = useQuery({
    queryKey: queryKeys.todayMissions(userId),
    queryFn: () => fetchTodayMissions(programIds),
    enabled: !!userId && programIds.length > 0,
  })

  const { data: todayCounts = {} } = useQuery({
    queryKey: queryKeys.todayCounts(userId),
    queryFn: () => fetchTodayCounts(userId),
    enabled: !!userId,
  })

  const loading = isProgLoading || (programIds.length > 0 && isMissionLoading)

  // 미션 1개면 바로 인증 화면으로 (한 번만)
  useEffect(() => {
    if (loading || skippedRef.current) return
    const recordable = missions.filter(m => isRecordable(m, todayCounts))
    if (recordable.length === 1) {
      skippedRef.current = true
      const m = recordable[0]
      navigate(`/programs/${m.program_id}/missions/${m.id}`, {
        replace: true,
        state: { returnPath: '/dashboard' },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, missions, todayCounts])

  // 프로그램별 그룹
  const groups = activePrograms
    .map(p => ({ program: p, missions: missions.filter(m => m.program_id === p.id) }))
    .filter(g => g.missions.length > 0)

  return (
    <div className="px-4 pt-2 pb-24 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath="/dashboard" title="기록하기" />

      <h1 className="text-2xl font-bold text-gray-800 mt-2 mb-1">📝 오늘의 기록</h1>
      <p className="text-sm text-gray-500 mb-5">참여 중인 프로그램의 오늘 미션을 인증하세요.</p>

      {loading ? (
        <LoadingState variant="page" />
      ) : activePrograms.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="참여 중인 프로그램이 없어요"
          description="프로그램에 참여하면 여기서 바로 인증할 수 있어요"
          action={{ label: '프로그램 둘러보기', onClick: () => navigate('/programs') }}
          variant="mint"
          size="lg"
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon="✅"
          title="오늘 기록할 미션이 없어요"
          description="오늘 활성화된 미션이 없거나 모두 완료했어요"
          variant="mint"
          size="lg"
        />
      ) : (
        <div className="space-y-6">
          {groups.map(({ program, missions: ms }) => (
            <section key={program.id}>
              <button
                type="button"
                onClick={() => navigate(`/programs/${program.id}`)}
                className="text-sm font-bold text-gray-700 mb-2 hover:text-emerald-700 transition"
              >
                {program.name}
              </button>
              <div className="grid grid-cols-1 gap-3">
                {ms.map(m => (
                  <MissionCard
                    key={m.id}
                    mission={m}
                    todayCounts={todayCounts}
                    isOwner={false}
                    programId={m.program_id}
                    navigateState={{ returnPath: '/record' }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default RecordPage
