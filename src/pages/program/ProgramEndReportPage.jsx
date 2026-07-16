import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronDown, ChevronRight, Trophy, Target, TrendingUp, MessageSquare, Flag, Copy } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchProgramStats, formatKstDate } from '../../lib/queries'
import { formatKoreanDate } from '../../lib/formatters'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import CountUp from '../../components/common/CountUp'
import CloneProgramModal from '../../components/program/CloneProgramModal'
import { Icon3D } from '../../components/program/ProgramHome'

// 운영자 종료 리포트 — 프로그램이 끝난 뒤 "최종 성적표" 한 장.
//   본인 결정 (2026-06-27): 운영자 경험 먼저. A1(리포트 먼저, 복제는 후속) + B(고정 3구간) + C(종료 진입 시).
//   새 쿼리 없이 fetchProgramStats 데이터를 "종료" 맥락으로 재구성. 가독성 우선.
// 라우트: /programs/:id/report

const DAY_MS = 86_400_000

// 완주 3구간 (결정 B 고정 기준):
//   완주  — 활동일 ≥ 프로그램 기간의 50%
//   참여  — 활동일 ≥ 1 (완주 미만)
//   휴면  — 활동일 0 (참여만 하고 인증 없음)
function computeReport(stats, program) {
  if (!stats || !program) return null
  const userStats = stats.userStats || []
  const bundleStats = stats.bundleStats || []
  const raw = stats._raw || []

  const startKst = program.start_date ? new Date(`${program.start_date}T00:00:00+09:00`) : null
  const endKst = program.end_date ? new Date(`${program.end_date}T00:00:00+09:00`) : null
  const programDays = (startKst && endKst)
    ? Math.max(1, Math.round((endKst - startKst) / DAY_MS) + 1)
    : null
  const threshold = programDays ? Math.max(1, Math.ceil(programDays * 0.5)) : null

  // ─── 완주 분포 — 카운트가 아니라 실제 명단으로 (누가 완주했는지 보여주기 위해) ───
  const completedUsers = [], participatedUsers = [], dormantUsers = []
  for (const u of userStats) {
    const ad = u.activeDays || 0
    if (ad === 0) dormantUsers.push(u)
    else if (threshold && ad >= threshold) completedUsers.push(u)
    else participatedUsers.push(u)
  }
  // 활동일 많은 순 (완주·참여), 휴면은 닉네임 순
  completedUsers.sort((a, b) => (b.activeDays || 0) - (a.activeDays || 0))
  participatedUsers.sort((a, b) => (b.activeDays || 0) - (a.activeDays || 0))
  dormantUsers.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || ''))
  const totalParticipants = userStats.length
  const completionRate = (totalParticipants > 0 && threshold)
    ? Math.round((completedUsers.length / totalParticipants) * 100)
    : null

  // ─── 미션 베스트 / 아쉬운 ───
  const allMissions = bundleStats.flatMap(b => b.missions)
  const topMissions = [...allMissions].filter(m => m.count > 0).sort((a, b) => b.count - a.count).slice(0, 3)
  const maxMissionCount = topMissions[0]?.count || 1
  const zeroMissions = allMissions.filter(m => m.count === 0)

  // ─── 우수 참여자 Top 5 (인증 1건 이상) ───
  const topUsers = userStats.filter(u => (u.totalCount || 0) > 0).slice(0, 5)

  // ─── 전체 기간 인증 추이 (일자별) ───
  const counts = {}
  for (const r of raw) {
    const d = formatKstDate(new Date(r.submitted_at))
    counts[d] = (counts[d] || 0) + 1
  }
  const trend = []
  if (startKst) {
    const span = programDays || Math.min(120, Math.round((Date.now() - startKst) / DAY_MS) + 1)
    for (let i = 0; i < span; i++) {
      const d = new Date(startKst)
      d.setDate(d.getDate() + i)
      const ds = formatKstDate(d)
      trend.push({ date: ds, count: counts[ds] || 0 })
    }
  }
  const trendMax = Math.max(1, ...trend.map(t => t.count))
  const peakDay = trend.reduce((best, t) => (t.count > (best?.count ?? -1) ? t : best), null)

  return {
    programDays, threshold,
    totalParticipants,
    totalVerifications: stats.totalVerifications || 0,
    completedUsers, participatedUsers, dormantUsers, completionRate,
    topMissions, maxMissionCount, zeroMissions,
    topUsers,
    trend, trendMax, peakDay,
  }
}

function ProgramEndReportPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id

  const { data: program, isLoading: isProgramLoading } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })
  const isOwner = program?.owner_id === userId

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: queryKeys.programStats(id),
    queryFn: () => fetchProgramStats(id),
    enabled: !!session && !!id && isOwner,
  })

  const report = useMemo(() => computeReport(stats, program), [stats, program])
  const [cloneOpen, setCloneOpen] = useState(false)

  if (isProgramLoading) return <LoadingState variant="page" />
  if (!program) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="p-4 bg-red-100 text-red-700 rounded">프로그램을 찾을 수 없습니다</p>
        <Link to="/dashboard" className="block mt-4 text-emerald-600 hover:underline">← 대시보드로</Link>
      </div>
    )
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
        <button type="button" onClick={() => navigate(`/programs/${id}`)} className="flex items-center justify-center w-9 h-9 -ml-1 mb-2 rounded-full hover:bg-gray-100 transition">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">운영자만 종료 리포트를 볼 수 있어요</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-8 max-w-4xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}`} title="프로그램으로" breadcrumb={[program.name, '종료 리포트']} />

      {isStatsLoading || !report ? (
        <LoadingState />
      ) : (
        <div className="space-y-3">
          {/* ─── 히어로 — 흰 배경 + 3D 아이콘(본인 결정 2026-07-14).
               주의: App.css 의 전역 `p { margin: 0 }` 이 unlayered 라 <p> 에는 마진 유틸이
               무시된다 → 간격은 전부 flex 의 gap 으로 준다. */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
            className="rounded-card-lg bg-white border border-gray-100 p-6 shadow-elevated flex flex-col items-center gap-3"
          >
            <div className="flex flex-col items-center gap-1.5">
              <Icon3D src="/icons/feature/mission.png" emoji="🏁" className="w-16 h-16" />
              <h1 className="text-xl font-extrabold text-gray-900 leading-tight text-center">프로그램이 끝났어요</h1>
            </div>

            {/* 프로그램 제목 / 기간 / 일수 — 라벨+값.
                2열 그리드(auto 1fr)라 라벨 열 폭이 가장 긴 라벨에 자동으로 맞춰지고
                값들이 같은 x 에 정렬됨(고정폭 하드코딩 시 라벨이 길어지면 넘침). */}
            <div className="w-full rounded-xl bg-gray-50 px-4 py-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px] text-left">
              <span className="font-semibold text-gray-500 whitespace-nowrap">프로그램 제목</span>
              <span className="font-semibold text-gray-800 break-keep">{program.name}</span>

              {program.start_date && program.end_date && (
                <>
                  <span className="font-semibold text-gray-500 whitespace-nowrap">기간</span>
                  <span className="font-semibold text-gray-800">
                    {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                  </span>
                </>
              )}

              {report.programDays ? (
                <>
                  <span className="font-semibold text-gray-500 whitespace-nowrap">일수</span>
                  <span className="font-semibold text-gray-800">{report.programDays}일</span>
                </>
              ) : null}
            </div>
          </motion.div>

          {/* ─── 핵심 3지표 ─── */}
          <div className="grid grid-cols-3 gap-3">
            {/* 참여자 → 참여자 명단 / 누적 인증 → 미션별 인증 현황(유저 내역 포함) */}
            <StatTile src="/icons/report/participants.png" emoji="👥" label="참여자" value={report.totalParticipants} unit="명"
              onClick={() => navigate(`/programs/${id}/stats/users`)} />
            <StatTile src="/icons/report/verifications.png" emoji="📋" label="누적 인증" value={report.totalVerifications} unit="건"
              onClick={() => navigate(`/programs/${id}/stats/missions`)} />
            <StatTile src="/icons/report/completion.png" emoji="🏆" label="완주율" value={report.completionRate ?? 0} unit={report.completionRate == null ? '' : '%'} dim={report.completionRate == null} />
          </div>

          {/* ─── 완주 분포 ─── */}
          <CompletionCard report={report} />

          {/* ─── 전체 기간 인증 추이 ─── */}
          {report.trend.length > 1 && <TrendCard report={report} />}

          {/* ─── 베스트 미션 ─── */}
          {report.topMissions.length > 0 && <MissionsCard report={report} />}

          {/* ─── 우수 참여자 ─── */}
          {report.topUsers.length > 0 && <TopUsersCard users={report.topUsers} />}

          {/* ─── 다음 액션 ─── */}
          <NextActionsCard programId={id} feedEnabled={!!program.feed_enabled} navigate={navigate} onClone={() => setCloneOpen(true)} />
        </div>
      )}
      <CloneProgramModal isOpen={cloneOpen} onClose={() => setCloneOpen(false)} program={program} />
    </div>
  )
}

// ─── 핵심 지표 타일 — 3D 아이콘(본인 제공 2026-07-14). 아이콘 자체가 색을 가져 색상 원 배경 제거.
//   간격은 flex gap 으로 — 전역 `p { margin: 0 }` 때문에 <p> 의 mt-* 는 무시됨.
function StatTile({ src, emoji, label, value, unit, dim, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      className={`w-full bg-white border border-gray-100 rounded-card-lg shadow-soft p-4 flex flex-col items-center gap-1.5 text-center${
        onClick ? ' hover:border-emerald-200 hover:shadow-elevated active:scale-[0.98] transition' : ''
      }`}
    >
      <Icon3D src={src} emoji={emoji} className="w-10 h-10" />
      <p className="text-2xl font-extrabold text-gray-900 leading-none">
        {dim ? '-' : <CountUp value={value} duration={1000} />}
        {unit && !dim && <span className="text-sm text-gray-500 font-bold ml-0.5">{unit}</span>}
      </p>
      {/* 클릭 가능한 타일은 라벨 옆 chevron 으로 진입 가능함을 표시 */}
      <p className="text-[11px] text-gray-500 inline-flex items-center gap-0.5">
        {label}
        {onClick && <ChevronRight className="w-3 h-3 text-gray-400" />}
      </p>
    </Tag>
  )
}

// ─── 완주 분포 (스택바 + 범례 + 탭하면 실제 명단) ───
function CompletionCard({ report }) {
  const { completedUsers, participatedUsers, dormantUsers, totalParticipants, threshold } = report
  // 완주자를 바로 보여주려 기본 펼침 (완주자 없으면 닫힘)
  const [open, setOpen] = useState(completedUsers.length > 0 ? 'c' : null)
  const total = totalParticipants || 1
  const segs = [
    { key: 'c', label: '완주', users: completedUsers, color: 'bg-emerald-500', dot: '🟢', desc: threshold ? `${threshold}일 이상 활동` : '기준 활동' },
    { key: 'p', label: '참여', users: participatedUsers, color: 'bg-amber-400', dot: '🟡', desc: '1일 이상 인증' },
    { key: 'd', label: '휴면', users: dormantUsers, color: 'bg-gray-300', dot: '⚪', desc: '인증 없음' },
  ]
  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-2 mb-3">
        <Flag className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-bold text-gray-800">완주 분포</h3>
        <span className="text-xs text-gray-400 ml-auto">총 {totalParticipants}명 · 탭해서 명단 보기</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 mb-3">
        {segs.map(s => s.users.length > 0 && (
          <div key={s.key} className={s.color} style={{ width: `${(s.users.length / total) * 100}%` }} title={`${s.label} ${s.users.length}명`} />
        ))}
      </div>
      <div className="space-y-0.5">
        {segs.map(s => {
          const count = s.users.length
          const isOpen = open === s.key
          return (
            <div key={s.key}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : s.key)}
                disabled={count === 0}
                className={`w-full flex items-center justify-between text-xs px-2 py-2 rounded-lg transition text-left ${count === 0 ? 'opacity-50 cursor-default' : 'hover:bg-gray-50 cursor-pointer'}`}
              >
                <span className="flex items-center gap-1.5 text-gray-600">
                  <span>{s.dot}</span><span className="font-medium text-gray-700">{s.label}</span>
                  <span className="text-gray-400">· {s.desc}</span>
                </span>
                <span className="flex items-center gap-1 text-gray-800 font-semibold">
                  {count}명 <span className="text-gray-400 font-normal">({Math.round((count / total) * 100)}%)</span>
                  {count > 0 && <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && count > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }} className="overflow-hidden"
                  >
                    <ul className="max-h-56 overflow-y-auto px-2 pt-1 pb-2 space-y-1">
                      {s.users.map((u, i) => (
                        <li key={u.user_id} className="flex items-center gap-2 text-xs">
                          <span className="w-5 text-right text-gray-400 flex-shrink-0">{i + 1}</span>
                          <span className="flex-1 min-w-0 truncate text-gray-800 font-medium">{u.nickname}</span>
                          <span className="text-gray-500 flex-shrink-0">활동 <b className="text-gray-700">{u.activeDays}</b>일</span>
                          <span className="text-gray-400 flex-shrink-0">· 인증 {u.totalCount}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 전체 기간 인증 추이 (일자별 막대 — 전 기간, 길면 가로 스크롤) ───
function TrendCard({ report }) {
  const { trend, trendMax, peakDay } = report
  const sum = trend.reduce((s, t) => s + t.count, 0)
  const avg = (sum / trend.length).toFixed(1)
  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-bold text-gray-800">전체 기간 인증 추이</h3>
        <span className="text-[11px] text-gray-400 ml-auto">전체 {trend.length}일 · 하루 평균 {avg}건</span>
      </div>
      {peakDay && peakDay.count > 0 && (
        <p className="text-xs text-gray-600 mb-3">
          <span className="font-semibold text-emerald-700">{formatKoreanDate(peakDay.date)}</span> 에 가장 활발했어요 ({peakDay.count}건)
        </p>
      )}
      {/* 전 기간 — flex-1 로 짧으면 꽉 차고, 길면 막대 최소폭 유지하며 가로 스크롤 */}
      <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
        <div className="flex items-end gap-[2px] h-20 min-w-full">
          {trend.map((t, i) => {
            const pct = trendMax > 0 ? (t.count / trendMax) * 100 : 0
            const isPeak = peakDay && t.date === peakDay.date && t.count > 0
            return (
              <div key={i} className="flex-1 min-w-[7px] flex flex-col justify-end h-full" title={`${formatKoreanDate(t.date)} · ${t.count}건`}>
                <div
                  className={`w-full rounded-sm transition-all ${t.count === 0 ? 'bg-gray-100' : isPeak ? 'bg-emerald-500' : 'bg-emerald-300'}`}
                  style={{ height: t.count === 0 ? '3px' : `${Math.max(6, pct)}%` }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex justify-between mt-1.5 text-[11px] text-gray-400">
        <span>{formatKoreanDate(trend[0].date)} 시작</span>
        <span>{formatKoreanDate(trend[trend.length - 1].date)} 종료</span>
      </div>
    </div>
  )
}

// ─── 베스트 / 아쉬운 미션 ───
function MissionsCard({ report }) {
  const { topMissions, maxMissionCount, zeroMissions } = report
  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-emerald-600" />
        <h3 className="text-sm font-bold text-gray-800">가장 사랑받은 미션</h3>
      </div>
      <div className="space-y-2.5">
        {topMissions.map((m, i) => (
          <div key={m.mission_id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-700 truncate pr-2">{['🥇', '🥈', '🥉'][i]} {m.title}</span>
              <span className="text-xs font-bold text-gray-800 flex-shrink-0">{m.count}건</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${(m.count / maxMissionCount) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      {zeroMissions.length > 0 && (
        <p className="text-[11px] text-gray-500 mt-3 pt-3 border-t border-gray-100">
          🌱 아쉽게 인증이 없던 미션 {zeroMissions.length}개 — 다음 기수엔 시간대·난이도를 조정해보세요
        </p>
      )}
    </div>
  )
}

// ─── 우수 참여자 Top 5 ───
const MEDALS = ['🥇', '🥈', '🥉']
function TopUsersCard({ users }) {
  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-bold text-gray-800">우수 참여자</h3>
        <span className="text-[11px] text-gray-400 ml-auto">감사 인사를 전해보세요</span>
      </div>
      <div className="space-y-1">
        {users.map((u, i) => (
          <div key={u.user_id} className="flex items-center gap-3 px-1 py-1.5">
            <span className="w-6 text-center text-sm flex-shrink-0">{MEDALS[i] || <span className="text-gray-400 font-bold">{i + 1}</span>}</span>
            <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{u.nickname}</span>
            <span className="flex items-center gap-2.5 text-[11px] text-gray-500 flex-shrink-0">
              <span>인증 <b className="text-gray-700">{u.totalCount}</b></span>
              <span>활동 <b className="text-gray-700">{u.activeDays}</b>일</span>
              <span className="text-emerald-700 font-semibold">{u.totalScore}P</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 다음 액션 ───
function NextActionsCard({ programId, feedEnabled, navigate, onClone }) {
  return (
    <div className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-5">
      <h3 className="text-sm font-bold text-gray-800 mb-1">수고하셨어요! 다음은?</h3>
      <p className="text-[12px] text-gray-500 mb-3">이 프로그램을 이어가거나, 참여자에게 인사를 전해보세요.</p>
      <div className="space-y-2">
        {/* 다음 기수 열기 — 같은 구성으로 새 프로그램 (운영자 리텐션 핵심) */}
        <button
          type="button"
          onClick={onClone}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 transition text-left"
        >
          <span className="w-9 h-9 rounded-full bg-white/20 text-white flex items-center justify-center flex-shrink-0">
            <Copy className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">다음 기수 열기</p>
            <p className="text-[11px] text-white/85">미션·퀴즈·설정 그대로 새 프로그램을 만들어요</p>
          </div>
        </button>
        {/* 감사 인사 */}
        {feedEnabled && (
          <button
            type="button"
            onClick={() => navigate(`/programs/${programId}?tab=community`)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/70 transition text-left"
          >
            <span className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800">감사 인사 남기기</p>
              <p className="text-[11px] text-gray-500">커뮤니티에 마무리 공지를 올려요</p>
            </div>
          </button>
        )}
      </div>
    </div>
  )
}

export default ProgramEndReportPage
