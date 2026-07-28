import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import {
  queryKeys,
  fetchActivePrograms,
  fetchMyActivity,
  fetchProgram,
  formatKstDate,
} from '../lib/queries'
import { formatRelativeKstDay, getTodayKST } from '../lib/formatters'
import StickyBackBar from '../components/common/StickyBackBar'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'

// 본인 활동 메인 — 운영자용 ProgramStatsUserDetailPage 와 같은 구조
// 라우트: /profile/activity
//   참여 중 프로그램 칩 → 그 프로그램의 본인 4지표 + 14일 차트 + 2 진입 카드
function MyActivityPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id

  const [selectedProgramId, setSelectedProgramId] = useState(null)

  const { data: activePrograms = [], isLoading: isProgramsLoading } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  useEffect(() => {
    if (!selectedProgramId && activePrograms.length > 0) {
      setSelectedProgramId(activePrograms[0].id)
    }
  }, [activePrograms, selectedProgramId])

  const { data: activity, isLoading: isActivityLoading } = useQuery({
    queryKey: queryKeys.myActivity(selectedProgramId, userId),
    queryFn: () => fetchMyActivity(selectedProgramId, userId),
    enabled: !!selectedProgramId && !!userId,
  })

  // 퀴즈·클래스 카드 노출 판단 — 선택 프로그램의 기능 유무
  const { data: selProgram } = useQuery({
    queryKey: queryKeys.program(selectedProgramId),
    queryFn: () => fetchProgram(selectedProgramId),
    enabled: !!selectedProgramId,
  })
  const { data: hasQuiz = false } = useQuery({
    queryKey: ['myActivity', 'hasQuiz', selectedProgramId],
    queryFn: async () => {
      const { count, error } = await supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('program_id', selectedProgramId)
      if (error) throw error
      return (count || 0) > 0
    },
    enabled: !!selectedProgramId,
  })
  const classEnabled = !!selProgram?.class_feature_enabled   // 클래스 기능 켜진 프로그램만 클래스 항목 표시

  // 14일 활동 — 미션 인증 + 퀴즈 제출 + 클래스 출석(확정), 타입별 분해까지
  const recent14Days = useMemo(() => {
    const events = activity?.activityEvents
    if (!events) return []
    const todayKst = getTodayKST()
    const byDay = new Map()
    for (const e of events) {
      const date = formatKstDate(new Date(e.ts))
      if (!byDay.has(date)) byDay.set(date, { mission: 0, quiz: 0, class: 0 })
      const b = byDay.get(date)
      if (e.type in b) b[e.type] += 1
    }
    const result = []
    const today = new Date(`${todayKst}T00:00:00+09:00`)
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = formatKstDate(d)
      const b = byDay.get(dateStr) || { mission: 0, quiz: 0, class: 0 }
      result.push({ date: dateStr, mission: b.mission, quiz: b.quiz, class: b.class, count: b.mission + b.quiz + b.class })
    }
    return result
  }, [activity])
  const maxDayCount = recent14Days.reduce((m, d) => Math.max(m, d.count), 0) || 1

  // 막대 롱프레스 툴팁 — 모바일 롱프레스 부작용(콜아웃·선택·컨텍스트메뉴)은 CSS/이벤트로 차단
  const [tipIdx, setTipIdx] = useState(null)
  const pressTimer = useRef(null)
  const startPress = (i) => { clearTimeout(pressTimer.current); pressTimer.current = setTimeout(() => setTipIdx(i), 250) }
  const endPress = () => { clearTimeout(pressTimer.current); setTipIdx(null) }

  // 마지막 활동 시각 (가장 최근 verification)
  const lastActiveAt = activity?.verifications?.[0]?.submitted_at || null

  if (isProgramsLoading) return <LoadingState variant="page" />

  if (activePrograms.length === 0) {
    return (
      <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
        <StickyBackBar fallbackPath="/profile" title="프로필로" />
        <h1 className="flex items-center gap-2 text-2xl font-medium text-gray-800 mb-2">
          <img src="/icons/mypage/status.png" alt="" aria-hidden="true" className="w-7 h-7 object-contain" /> 내 인증 현황
        </h1>
        <EmptyState
          icon="📋"
          title="참여 중인 프로그램이 없어요"
          description="프로그램에 참여하면 활동 기록이 표시돼요"
          variant="mint"
          action={{ label: '프로그램 둘러보기', onClick: () => navigate('/programs') }}
        />
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath="/profile" title="프로필로" />

      <h1 className="flex items-center gap-2 text-2xl font-medium text-gray-800" style={{ marginBottom: '9px' }}>
        <img src="/icons/mypage/status.png" alt="" aria-hidden="true" className="w-7 h-7 object-contain" /> 내 인증 현황
      </h1>

      {/* 프로그램 선택 칩 */}
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 scrollbar-hide" style={{ paddingBottom: '4px', marginBottom: '9px' }}>
        {activePrograms.map(p => {
          const isActive = p.id === selectedProgramId
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedProgramId(p.id)}
              className={`
                flex-shrink-0 inline-flex items-center px-3 py-2 rounded-full text-sm transition
                ${isActive
                  ? 'bg-emerald-500 text-white shadow-sm font-medium'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-emerald-300'}
              `}
            >
              <span className="max-w-[140px] truncate">{p.name}</span>
            </button>
          )
        })}
      </div>

      {isActivityLoading || !activity ? (
        <LoadingState />
      ) : (
        <>
          {/* 4지표 카드 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 sm:grid-cols-4"
            style={{ gap: '9px', marginBottom: '9px' }}
          >
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center">
              <p className="text-[11px] text-gray-500 mb-1">💎 누적 점수</p>
              <p className="text-2xl font-bold text-emerald-700 leading-tight">
                {activity.totalScore}<span className="text-sm text-emerald-600 font-medium"> P</span>
              </p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center">
              <p className="text-[11px] text-gray-500 mb-1">✅ 누적 인증</p>
              <p className="text-2xl font-bold text-gray-800 leading-tight">
                {activity.approvedCount}<span className="text-sm text-gray-500 font-medium">건</span>
              </p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center">
              <p className="text-[11px] text-gray-500 mb-1">🔥 활동 일수</p>
              <p className="text-2xl font-bold text-gray-800 leading-tight">
                {activity.activeDays}<span className="text-sm text-gray-500 font-medium">일</span>
              </p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col items-center text-center">
              <p className="text-[11px] text-gray-500 mb-1">🕒 마지막 활동</p>
              <p className="text-sm font-medium text-gray-800 leading-tight pt-2">
                {lastActiveAt ? formatRelativeKstDay(lastActiveAt) : '-'}
              </p>
            </div>
          </motion.div>

          {/* 14일 활동 */}
          <h2 className="flex items-center gap-1.5 text-lg font-semibold text-gray-800" style={{ marginBottom: '2px' }}><img src="/icons/mypage/calendar.png" alt="" aria-hidden="true" className="w-5 h-5 object-contain" /> 최근 14일 활동</h2>
          <p className="text-[12px] text-gray-400 mb-2 pl-0.5">{['미션 인증', hasQuiz && '퀴즈 제출', classEnabled && '클래스 출석'].filter(Boolean).join(' · ')}을 합산했어요</p>
          <div className="bg-white border border-gray-200 rounded-2xl p-4" style={{ marginBottom: '9px' }}>
            <div
              className="flex items-end gap-1 h-20 select-none"
              style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
              onContextMenu={(e) => e.preventDefault()}
            >
              {recent14Days.map((d, i) => {
                const h = d.count === 0 ? 4 : Math.round((d.count / maxDayCount) * 76) + 4
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 relative">
                    {tipIdx === i && (
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full z-20 whitespace-nowrap rounded-lg bg-gray-900 text-white px-2.5 py-1.5 text-[11px] leading-relaxed shadow-lg pointer-events-none">
                        <p className="font-bold">{d.date.replaceAll('-', '.')} · 총 {d.count}건</p>
                        <p className="text-gray-200">{[`미션 ${d.mission}`, hasQuiz && `퀴즈 ${d.quiz}`, classEnabled && `클래스 ${d.class}`].filter(Boolean).join(' · ')}</p>
                        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                      </div>
                    )}
                    <div
                      className={`w-full rounded-sm transition-all cursor-pointer ${d.count === 0 ? 'bg-gray-100' : (tipIdx === i ? 'bg-sky-500' : 'bg-sky-400')}`}
                      style={{ height: `${h}px`, touchAction: 'pan-y' }}
                      onMouseEnter={() => setTipIdx(i)}
                      onMouseLeave={() => setTipIdx(null)}
                      onTouchStart={() => startPress(i)}
                      onTouchEnd={endPress}
                      onTouchMove={endPress}
                      onTouchCancel={endPress}
                    />
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>{recent14Days[0]?.date.slice(5).replace('-', '/')}</span>
              <span>오늘</span>
            </div>
          </div>

          {/* 2 진입 카드 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="grid grid-cols-1"
            style={{ gap: '9px' }}
          >
            <button
              type="button"
              onClick={() => navigate(`/profile/activity/${selectedProgramId}/missions`)}
              className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-emerald-300 transition text-left"
            >
              <img src="/icons/mypage/missions.png" alt="" aria-hidden="true" className="w-12 h-12 flex-shrink-0 object-contain" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-800 mb-0.5">미션별 분포</h3>
                <p className="text-xs text-gray-500">어떤 미션을 얼마나 했는지 묶음별 분석</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => navigate(`/profile/activity/${selectedProgramId}/verifications`)}
              className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-sky-300 transition text-left"
            >
              <img src="/icons/mypage/records.png" alt="" aria-hidden="true" className="w-12 h-12 flex-shrink-0 object-contain" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-800 mb-0.5">인증 기록</h3>
                <p className="text-xs text-gray-500">실제 제출한 사진 · 기록 · 소감을 시간순으로</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </button>

            {hasQuiz && (
              <button
                type="button"
                onClick={() => navigate(`/profile/activity/${selectedProgramId}/quizzes`)}
                className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-emerald-300 transition text-left"
              >
                <img src="/icons/feature/quiz.png" alt="" aria-hidden="true" className="w-12 h-12 flex-shrink-0 object-contain" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 mb-0.5">퀴즈 기록</h3>
                  <p className="text-xs text-gray-500">내가 푼 퀴즈 · 점수 · 문항별 정답</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            )}

            {selProgram?.class_feature_enabled && (
              <button
                type="button"
                onClick={() => navigate(`/profile/activity/${selectedProgramId}/classes`)}
                className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-teal-300 transition text-left"
              >
                <img src="/icons/feature/attendance.png" alt="" aria-hidden="true" className="w-12 h-12 flex-shrink-0 object-contain" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 mb-0.5">클래스 기록</h3>
                  <p className="text-xs text-gray-500">신청 · 출석 내역 · 적립 포인트</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate(`/profile/activity/${selectedProgramId}/posts`)}
              className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-violet-300 transition text-left"
            >
              <img src="/icons/mypage/posts.png" alt="" aria-hidden="true" className="w-12 h-12 flex-shrink-0 object-contain" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-800 mb-0.5">내가 쓴 게시글</h3>
                <p className="text-xs text-gray-500">커뮤니티에 작성한 글 모아보기</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => navigate(`/profile/activity/${selectedProgramId}/comments`)}
              className="w-full flex items-center gap-4 p-5 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-amber-300 transition text-left"
            >
              <img src="/icons/mypage/comments.png" alt="" aria-hidden="true" className="w-12 h-12 flex-shrink-0 object-contain" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-800 mb-0.5">내가 쓴 댓글</h3>
                <p className="text-xs text-gray-500">인증 피드 · 커뮤니티 댓글 모아보기</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </button>
          </motion.div>
        </>
      )}
    </div>
  )
}

export default MyActivityPage
