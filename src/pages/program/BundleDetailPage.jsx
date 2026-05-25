import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, Trophy } from 'lucide-react'

// 트로피 주변 별 폭발 위치 (트로피 중앙 기준 픽셀 오프셋)
const SPARKLE_POSITIONS = [
  { x: -55, y: -35 },
  { x: 50, y: -45 },
  { x: -60, y: 25 },
  { x: 55, y: 20 },
  { x: -15, y: -60 },
  { x: 15, y: 55 },
]
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import MissionCard from '../../components/program/MissionCard'
import StickyBackBar from '../../components/common/StickyBackBar'
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
      queryClient.invalidateQueries({ queryKey: ['stats'] })
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

  // 묶음 완료 판정 — 모든 미션이 reachedLimit (한도 채움) + PENDING 없음 (모두 승인)
  // 한도가 NULL 인 미션은 "완료" 개념이 모호하므로 제외 — 본인 결정 시 진화 가능
  const allCompleted = bundleMissions.length > 0 && bundleMissions.every(m => {
    const todayCount = todayCounts[m.id]?.total || 0
    const pendingCount = todayCounts[m.id]?.pending || 0
    const limit = m.daily_limit
    return limit != null && todayCount >= limit && pendingCount === 0
  })

  // 축하 카드 자동 스크롤 — Hook 은 early return 위에 위치해야 함 (Rules of Hooks)
  const celebrateRef = useRef(null)
  useEffect(() => {
    if (allCompleted && celebrateRef.current) {
      const t = setTimeout(() => {
        celebrateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      return () => clearTimeout(t)
    }
  }, [allCompleted])

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

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}`} title="프로그램으로" />

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

      {/* 묶음 완료 축하 카드 — 극적 등장: 확대 + 글로우 펄스 + 트로피 바운스 + 별 폭발 */}
      {allCompleted && (
        <motion.div
          ref={celebrateRef}
          initial={{ opacity: 0, scale: 0.85, y: 30 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: 0,
            boxShadow: [
              '0 0 0 rgba(16, 185, 129, 0)',
              '0 0 50px rgba(16, 185, 129, 0.55)',
              '0 0 20px rgba(16, 185, 129, 0.25)',
              '0 1px 2px rgba(0, 0, 0, 0.05)',
            ],
          }}
          transition={{
            opacity: { duration: 0.35, ease: 'easeOut' },
            scale: { duration: 0.5, ease: [0.34, 1.4, 0.64, 1] }, // overshoot 살짝
            y: { duration: 0.5, ease: 'easeOut' },
            boxShadow: {
              duration: 1.8,
              delay: 0.2,
              times: [0, 0.3, 0.7, 1],
            },
          }}
          className="mt-6 p-6 bg-gradient-to-br from-emerald-50 via-emerald-50/80 to-teal-50 border border-emerald-200 rounded-2xl text-center"
        >
          {/* 트로피 — spring 바운스 + 살짝 흔들림 + 별 폭발 컨테이너 */}
          <div className="relative inline-flex items-center justify-center w-16 h-16 mb-3">
            <motion.div
              initial={{ scale: 0.2, rotate: -30 }}
              animate={{
                scale: [0.2, 1.25, 0.95, 1.05, 1],
                rotate: [-30, 15, -8, 4, 0],
              }}
              transition={{
                duration: 0.9,
                delay: 0.25,
                times: [0, 0.4, 0.6, 0.8, 1],
                ease: 'easeOut',
              }}
              className="absolute inset-0 inline-flex items-center justify-center bg-amber-100 rounded-full"
            >
              <Trophy className="w-8 h-8 text-amber-500" />
            </motion.div>

            {/* 별 폭발 — 트로피 중앙에서 6방향으로 튀어나감 */}
            {SPARKLE_POSITIONS.map((pos, i) => (
              <motion.span
                key={i}
                className="absolute text-lg pointer-events-none"
                style={{ left: '50%', top: '50%' }}
                initial={{ opacity: 0, scale: 0, x: -8, y: -10 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1.3, 1, 0.4],
                  x: [-8, pos.x - 8],
                  y: [-10, pos.y - 10],
                }}
                transition={{
                  duration: 1.0,
                  delay: 0.55 + i * 0.07,
                  times: [0, 0.3, 0.7, 1],
                  ease: 'easeOut',
                }}
              >
                ✨
              </motion.span>
            ))}
          </div>

          <motion.h3
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="text-lg font-medium text-emerald-800 mb-1"
          >
            오늘 모든 미션 완료!
          </motion.h3>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            className="text-sm text-emerald-700"
          >
            {bundleTitle} {bundleMissions.length}개 미션을 모두 인증했어요. 꾸준히 이어가봐요 🌿
          </motion.p>
          <motion.p
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.7, type: 'spring', stiffness: 250 }}
            className="mt-2 text-xs text-emerald-600 font-medium"
          >
            +{totalPoint}P 획득
          </motion.p>
        </motion.div>
      )}
    </div>
  )
}

export default BundleDetailPage
