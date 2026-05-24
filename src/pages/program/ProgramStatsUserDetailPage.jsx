import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, Target, FileText } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { formatRelativeKstDay, getTodayKST } from '../../lib/formatters'
import { queryKeys, fetchProgram, fetchProgramStats, formatKstDate } from '../../lib/queries'
import StickyBackBar from '../../components/common/StickyBackBar'

// 한 유저의 활동 메인 — 핵심 지표 + 14일 차트 + 2개 진입 카드 (미션별 분포 / 인증 기록)
// 라우트: /programs/:id/stats/users/:userId
function ProgramStatsUserDetailPage() {
  const { id, userId: targetUserId } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const myUserId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })

  const isOwner = program?.owner_id === myUserId

  const { data: stats } = useQuery({
    queryKey: queryKeys.programStats(id),
    queryFn: () => fetchProgramStats(id),
    enabled: !!session && !!id && isOwner,
  })

  // 14일 차트용 — verifications 의 submitted_at 만 필요
  const { data: userVerifications = [] } = useQuery({
    queryKey: ['stats', 'userVerifications', id, targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verifications')
        .select('id, mission_id, submitted_at, image_path, numeric_value, note, missions!inner(program_id, title, bundle_title)')
        .eq('missions.program_id', id)
        .eq('user_id', targetUserId)
        .eq('status', 'APPROVED')
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!session && !!id && !!targetUserId && isOwner,
  })

  const userInfo = stats?.userStats?.find(u => u.user_id === targetUserId) || null

  // 최근 14일 활동 — Intl Asia/Seoul 로 정확
  const recent14Days = useMemo(() => {
    const todayKst = getTodayKST()
    const counts = new Map()
    for (const v of userVerifications) {
      const date = formatKstDate(new Date(v.submitted_at))
      counts.set(date, (counts.get(date) || 0) + 1)
    }
    const result = []
    const today = new Date(`${todayKst}T00:00:00+09:00`)
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = formatKstDate(d)
      result.push({ date: dateStr, count: counts.get(dateStr) || 0 })
    }
    return result
  }, [userVerifications])

  const maxDayCount = recent14Days.reduce((m, d) => Math.max(m, d.count), 0) || 1

  if (!program) {
    return <div className="p-6 max-w-4xl mx-auto text-center text-gray-500">불러오는 중...</div>
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <StickyBackBar onClick={() => navigate(`/programs/${id}/stats/users`)} title="목록으로" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">
          운영자만 통계를 볼 수 있어요
        </p>
      </div>
    )
  }
  if (!userInfo) {
    return (
      <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
        <StickyBackBar onClick={() => navigate(`/programs/${id}/stats/users`)} title="목록으로" />
        <p className="p-4 bg-gray-50 text-gray-500 text-center rounded">
          해당 유저의 활동 기록을 찾을 수 없어요
        </p>
        <Link to={`/programs/${id}/stats/users`} className="block mt-3 text-center text-sm text-emerald-600 hover:underline">
          유저 목록으로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      <StickyBackBar onClick={() => navigate(`/programs/${id}/stats/users`)} title="목록으로" />

      {/* 유저 헤더 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <p className="text-xs text-gray-500 mb-1">{program.name}</p>
        <h1 className="text-2xl font-medium text-gray-800 flex items-center gap-2">
          👤 {userInfo.nickname}
        </h1>
      </div>

      {/* 핵심 지표 4카드 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
      >
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center">
          <p className="text-[11px] text-gray-500 mb-1">💎 누적 점수</p>
          <p className="text-2xl font-bold text-emerald-700 leading-tight">
            {userInfo.totalScore}<span className="text-sm text-emerald-600 font-medium"> P</span>
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center">
          <p className="text-[11px] text-gray-500 mb-1">✅ 누적 인증</p>
          <p className="text-2xl font-bold text-gray-800 leading-tight">
            {userInfo.totalCount}<span className="text-sm text-gray-500 font-medium">건</span>
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center">
          <p className="text-[11px] text-gray-500 mb-1">🔥 활동 일수</p>
          <p className="text-2xl font-bold text-gray-800 leading-tight">
            {userInfo.activeDays}<span className="text-sm text-gray-500 font-medium">일</span>
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center">
          <p className="text-[11px] text-gray-500 mb-1">🕒 마지막 활동</p>
          <p className="text-sm font-medium text-gray-800 leading-tight pt-2">
            {formatRelativeKstDay(userInfo.lastActiveAt)}
          </p>
        </div>
      </motion.div>

      {/* 최근 14일 활동 */}
      <h2 className="text-lg font-medium text-gray-800 mb-3">📅 최근 14일 활동</h2>
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-end gap-1 h-20">
          {recent14Days.map(d => {
            const h = d.count === 0 ? 4 : Math.round((d.count / maxDayCount) * 76) + 4
            return (
              <div
                key={d.date}
                className="flex-1 flex flex-col items-center gap-0.5"
                title={`${d.date.replaceAll('-', '.')} — ${d.count}건`}
              >
                <div
                  className={`w-full rounded-sm transition-all ${d.count === 0 ? 'bg-gray-100' : 'bg-sky-400'}`}
                  style={{ height: `${h}px` }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-gray-400">
          <span>{recent14Days[0]?.date.slice(5).replace('-', '/')}</span>
          <span>오늘</span>
        </div>
      </div>

      {/* 2개 진입 카드 — 미션별 분포 / 인증 기록 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="grid gap-3"
      >
        <button
          type="button"
          onClick={() => navigate(`/programs/${id}/stats/users/${targetUserId}/missions`)}
          className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-emerald-300 transition text-left"
        >
          <div className="w-12 h-12 flex-shrink-0 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Target className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-medium text-gray-800 mb-0.5">
              🎯 미션별 분포
            </h2>
            <p className="text-xs text-gray-500">
              어떤 미션을 얼마나 했는지 묶음별 분석
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => navigate(`/programs/${id}/stats/users/${targetUserId}/verifications`)}
          className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-sky-300 transition text-left"
        >
          <div className="w-12 h-12 flex-shrink-0 bg-sky-100 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-sky-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-medium text-gray-800 mb-0.5">
              📝 인증 기록
            </h2>
            <p className="text-xs text-gray-500">
              실제 제출한 사진 · 기록 · 소감을 카테고리별로 확인
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </button>
      </motion.div>
    </div>
  )
}

export default ProgramStatsUserDetailPage
