import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronLeft, Trophy } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import MissionCard from '../../components/program/MissionCard'
import {
  queryKeys,
  fetchProgram,
  fetchProgramMissions,
  fetchTodayCounts,
} from '../../lib/queries'

// 묶음 디테일 페이지 — bundle_title 매칭으로 한 묶음의 미션들만 표시
// 라우트: /programs/:id/bundles/:bundleParam  (bundleParam = encodeURIComponent(bundle_title))
// 캐시: ProgramDetailPage 와 동일 키 — invalidate 시 자동 갱신
function BundleDetailPage() {
  const { id, bundleParam } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const bundleTitle = bundleParam ? decodeURIComponent(bundleParam) : ''

  const { data: program, isLoading: isProgramLoading } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })

  const { data: missions = [] } = useQuery({
    queryKey: queryKeys.programMissions(id),
    queryFn: () => fetchProgramMissions(id),
    enabled: !!session && !!id,
  })

  const { data: todayCounts = {} } = useQuery({
    queryKey: queryKeys.todayCounts(userId),
    queryFn: () => fetchTodayCounts(userId),
    enabled: !!session,
  })

  const bundleMissions = missions.filter(m => m.bundle_title === bundleTitle)
  const isOwner = program?.owner_id === userId

  // 미션 삭제 — ProgramDetailPage 와 동일 패턴 (캐시 키 공유)
  const deleteMissionMutation = useMutation({
    mutationFn: async (missionId) => {
      const { error } = await supabase.from('missions').delete().eq('id', missionId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.programMissions(id) })
      queryClient.invalidateQueries({ queryKey: ['missions', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['scores'] })
      queryClient.invalidateQueries({ queryKey: ['verifications'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
    },
    onError: (err) => {
      console.error('미션 삭제 실패:', err)
      alert(`미션 삭제에 실패했습니다: ${err.message}`)
    },
  })

  const handleMissionDelete = (mission) => {
    if (!window.confirm(
      `"${mission.title}" 미션을 삭제할까요?\n\n` +
      `⚠️ 이 미션의 모든 인증 기록과 부여된 점수가 함께 삭제돼요. 되돌릴 수 없어요.`
    )) return
    deleteMissionMutation.mutate(mission.id)
  }

  // 미션 인증 클릭 시 현재 페이지 URL 을 returnPath 로 전달 →
  // MissionVerifyPage 가 제출/뒤로 후 여기로 자동 복귀
  const currentPath = location.pathname

  if (isProgramLoading || !program) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center text-gray-500">
        불러오는 중...
      </div>
    )
  }

  if (bundleMissions.length === 0) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => navigate(`/programs/${id}`)}
          className="flex items-center justify-center w-9 h-9 -ml-1 mb-2 rounded-full hover:bg-gray-100 transition"
          title="프로그램으로"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <p className="p-4 bg-gray-50 text-gray-500 text-center rounded">
          이 묶음에 미션이 없어요
        </p>
      </div>
    )
  }

  const totalPoint = bundleMissions.reduce((s, m) => s + (m.point || 0), 0)

  // 묶음 완료 판정 — 모든 미션이 reachedLimit (한도 채움) + PENDING 없음 (모두 승인)
  // 한도가 NULL 인 미션은 "완료" 개념이 모호하므로 제외 — 본인 결정 시 진화 가능
  const allCompleted = bundleMissions.length > 0 && bundleMissions.every(m => {
    const todayCount = todayCounts[m.id]?.total || 0
    const pendingCount = todayCounts[m.id]?.pending || 0
    const limit = m.daily_limit
    return limit != null && todayCount >= limit && pendingCount === 0
  })

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <button
        type="button"
        onClick={() => navigate(`/programs/${id}`)}
        className="flex items-center justify-center w-9 h-9 -ml-1 mb-2 rounded-full hover:bg-gray-100 transition"
        title="프로그램으로"
      >
        <ChevronLeft className="w-5 h-5 text-gray-600" />
      </button>

      {/* 묶음 헤더 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name}</p>
        <h1 className="text-2xl font-medium text-gray-800 mb-2">{bundleTitle}</h1>
        <p className="text-sm text-gray-500">
          {bundleMissions.length}개 미션 · 총 {totalPoint}P
        </p>
      </div>

      {/* 미션 목록 */}
      <div className="grid gap-3">
        {bundleMissions.map(m => (
          <MissionCard
            key={m.id}
            mission={m}
            todayCounts={todayCounts}
            isOwner={isOwner}
            isDeletePending={deleteMissionMutation.isPending}
            onDelete={handleMissionDelete}
            programId={id}
            navigateState={{ returnPath: currentPath }}
          />
        ))}
      </div>

      {/* 묶음 완료 축하 카드 — 모든 미션 인증 완료 시 등장 */}
      {allCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="mt-6 p-6 bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-teal-50 border border-emerald-200 rounded-2xl text-center shadow-sm"
        >
          <motion.div
            initial={{ scale: 0.6, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, delay: 0.15, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-3"
          >
            <Trophy className="w-8 h-8 text-amber-500" />
          </motion.div>
          <h3 className="text-lg font-medium text-emerald-800 mb-1">
            오늘 모든 미션 완료!
          </h3>
          <p className="text-sm text-emerald-700">
            {bundleTitle} {bundleMissions.length}개 미션을 모두 인증했어요. 꾸준히 이어가봐요 🌿
          </p>
          <p className="mt-2 text-xs text-emerald-600">
            +{totalPoint}P 획득
          </p>
        </motion.div>
      )}
    </div>
  )
}

export default BundleDetailPage
