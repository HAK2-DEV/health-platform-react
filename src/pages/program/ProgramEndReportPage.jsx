import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronDown, ChevronRight, Trophy, MessageSquare, Copy, Download } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchProgramStats, fetchProgramOperatorLoad, fetchProgramQuizStats, fetchProgramCommunityStats, fetchProgramReports, fetchEndReportPerUser, fetchProgramScoreBreakdown, fetchProgramTeamRanking, fetchProgramDistanceByUser, fetchProgramMetricsByUser, fetchProgramCommentsDetail, fetchProgramQuizAnswersDetail, fetchProgramClassStats, fetchProgramClassRoster, fetchProgramScoreLedger, REPORT_REASON_PRESETS, formatKstDate } from '../../lib/queries'
import { catOf } from '../../lib/classCategories'
import { PROGRAM_THEME } from '../../lib/constants'
import { formatKoreanDate } from '../../lib/formatters'
import StickyBackBar from '../../components/common/StickyBackBar'
import Modal from '../../components/common/Modal'
import ReportsManageSection from '../../components/program/ReportsManageSection'
import HiddenPostsSection from '../../components/program/HiddenPostsSection'
import LoadingState from '../../components/common/LoadingState'
import CountUp from '../../components/common/CountUp'
import CloneProgramModal from '../../components/program/CloneProgramModal'
import { Icon3D } from '../../components/program/ProgramHome'
import ParticipationTrendChart from '../../components/program/ParticipationTrendChart'
import { Reveal } from '../../components/program/statsAnim'
import { StatusDonut } from '../../components/program/ProgramInsightsSummary'
import { exportEndReportXlsx } from '../../lib/reportExport'

// 운영자 종료 리포트 — 프로그램이 끝난 뒤 "최종 성적표" 한 장.
//   본인 결정 (2026-06-27): 운영자 경험 먼저. A1(리포트 먼저, 복제는 후속) + B(고정 3구간) + C(종료 진입 시).
//   새 쿼리 없이 fetchProgramStats 데이터를 "종료" 맥락으로 재구성. 가독성 우선.
// 라우트: /programs/:id/report

const DAY_MS = 86_400_000

// 금연 프로그램 판정 — 특수 카드홈 테마(QUIT_SMOKING) + 카테고리 금연(NO_SMOKING).
//   리포트 용어를 금연 맥락(도전자·금연 성공률·금연 성공 비율)으로 바꾸는 데 사용.
const isQuitProgram = (program) => program?.theme === PROGRAM_THEME.QUIT_SMOKING || (program?.categories || []).includes('NO_SMOKING')

// 완주 3구간 (결정 B 고정 기준):
//   완주  — 활동일 ≥ 프로그램 기간의 50%
//   참여  — 활동일 ≥ 1 (완주 미만)
//   휴면  — 활동일 0 (참여만 하고 인증 없음)
// ─── 핵심 진단 — 퍼널의 '가장 큰 이탈' 구간을 병목으로 보고 1문장 진단 + 처방. ───
//   작은 표본이라 단정 금지: '경향 + 실험 제안' 톤. **…** 는 굵게 표시 마커.
function buildDiagnosis({ funnel, bottleneck, totalParticipants, isQuit = false }) {
  const N = totalParticipants
  const P = isQuit ? '도전자' : '참여자'       // 참여자 → 금연은 도전자
  const DONE = isQuit ? '금연 성공' : '완주'    // 완주 → 금연은 금연 성공
  if (N === 0) return { tone: 'neutral', text: `아직 ${P}가 없어요. ${P}를 초대하면 여정 분석이 시작돼요.` }
  const c = (k) => funnel.find(f => f.key === k)?.count ?? 0
  const first = c('first'), ret = c('return'), done = c('done')
  if (!bottleneck) {
    return { tone: 'positive', text: `${P} 대부분이 큰 이탈 없이 여정을 이어갔어요. 이번 구성을 다음 기수에도 유지해보세요.` }
  }
  if (bottleneck.toKey === 'first') {
    return {
      tone: 'warn',
      text: `**${N}명**이 참여했지만 **${bottleneck.lost}명**은 첫 인증까지 오지 않았어요. 시작 자체가 병목이었어요.`,
      fix: '첫 미션을 더 쉽게 만들거나, 시작 안내·리마인드를 보내보세요.',
    }
  }
  if (bottleneck.toKey === 'return') {
    return {
      tone: 'warn',
      text: `**${first}명**이 첫 인증까지 왔지만, 다시 돌아온 사람은 **${ret}명**이에요. 시작은 됐고 재참여가 병목이었어요.`,
      fix: '다음 날 리마인드 알림이나 미션 난이도 조정을 시험해보세요.',
    }
  }
  // done
  return {
    tone: 'warn',
    text: `**${ret}명**이 다시 참여했지만 ${DONE}까지는 **${done}명**이 이어졌어요. 중반 이후가 병목이었어요.`,
    fix: '기간을 조금 줄이거나, 중반에 응원·보상을 넣어보세요.',
  }
}

function computeReport(stats, program) {
  if (!stats || !program) return null
  const isQuit = isQuitProgram(program)   // 금연: 참여자→도전자, 완주→금연 성공
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

  // ─── 미션 성과 — 미션별 참여자 수(raw 의 mission_id×user_id distinct) + 참여율. 참여율 내림차순(0건은 뒤). ───
  const missionUsers = {}
  for (const r of raw) {
    if (!r.mission_id) continue
    ;(missionUsers[r.mission_id] ||= new Set()).add(r.user_id)
  }
  const missionPerf = allMissions.map(m => {
    const users = missionUsers[m.mission_id]?.size || 0
    return { mission_id: m.mission_id, title: m.title, count: m.count, users, rate: totalParticipants > 0 ? Math.round((users / totalParticipants) * 100) : 0 }
  }).sort((a, b) => (b.rate - a.rate) || (b.count - a.count))

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

  // ─── 참여 여정 퍼널 — 기존 activeDays 로 계산(새 쿼리 없음). ───
  //   가입은 분모(항상 100%) — 의미는 단계 사이 '이탈'에 있음.
  //   완주 단계는 threshold≥2 일 때만(threshold=1 이면 첫인증과 같아져 단조감소가 깨짐).
  const activated = userStats.filter(u => (u.activeDays || 0) >= 1).length   // 첫 인증까지 옴
  const returned = userStats.filter(u => (u.activeDays || 0) >= 2).length    // 다시 돌아옴(재참여)
  const funnel = [
    { key: 'join', label: '프로그램 가입', count: totalParticipants, base: true },
    { key: 'first', label: '첫 인증 완료', count: activated },
    { key: 'return', label: '이틀 이상 인증', count: returned },
  ]
  if (threshold && threshold >= 2) funnel.push({ key: 'done', label: `${isQuit ? '금연 성공' : '완주'} (${threshold}일+)`, count: completedUsers.length })
  // 평균 유지일 — 전체 참여자의 활동일 평균(하단 요약용)
  const avgActiveDays = totalParticipants > 0
    ? userStats.reduce((s, u) => s + (u.activeDays || 0), 0) / totalParticipants
    : 0
  // 단계 사이 이탈 + 가장 큰 이탈(병목) — 절대 이탈수 최대, 동률이면 이탈률 높은 쪽
  const steps = []
  for (let i = 1; i < funnel.length; i++) {
    const from = funnel[i - 1], to = funnel[i]
    steps.push({ toKey: to.key, lost: from.count - to.count, fromCount: from.count })
  }
  const bottleneck = steps.filter(s => s.lost > 0)
    .sort((a, b) => (b.lost - a.lost) || ((b.lost / (b.fromCount || 1)) - (a.lost / (a.fromCount || 1))))[0] || null
  const diagnosis = buildDiagnosis({ funnel, bottleneck, totalParticipants, isQuit })

  return {
    programDays, threshold,
    totalParticipants,
    totalVerifications: stats.totalVerifications || 0,
    completedUsers, participatedUsers, dormantUsers, completionRate,
    topMissions, maxMissionCount, zeroMissions,
    topUsers,
    trend, trendMax, peakDay,
    funnel, steps, bottleneck, diagnosis, avgActiveDays,
    missionPerf,
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

  const { data: opLoad } = useQuery({
    queryKey: ['program', id, 'operatorLoad'],
    queryFn: () => fetchProgramOperatorLoad(id, program.owner_id),
    enabled: !!session && !!id && isOwner && !!program?.owner_id,
  })

  // 퀴즈 성과 — 퀴즈가 있는 프로그램만 (퀴즈 미활성이면 빈 배열 → 채널 숨김)
  const { data: quizStats = [] } = useQuery({
    queryKey: queryKeys.programQuizStats(id),
    queryFn: () => fetchProgramQuizStats(id),
    enabled: !!session && !!id && isOwner,
  })

  // 커뮤니티 성과 — 커뮤니티(feed) 활성 프로그램만
  const { data: community } = useQuery({
    queryKey: ['program', id, 'communityStats'],
    queryFn: () => fetchProgramCommunityStats(id, program.owner_id),
    enabled: !!session && !!id && isOwner && !!program?.feed_enabled && !!program?.owner_id,
  })

  // 신고 · 제재 — 대상별 신고 그룹(숨김/삭제 상태 포함). 신고 관리 패널과 캐시 공유(['reports', id]).
  const { data: reportGroups = [] } = useQuery({
    queryKey: ['reports', id],
    queryFn: () => fetchProgramReports(id),
    enabled: !!session && !!id && isOwner,
  })

  // 참여자 개인별 딥 데이터(퀴즈·커뮤니티) — 시상 보드 + 엑셀 내보내기 공용.
  const { data: perUser } = useQuery({
    queryKey: ['program', id, 'perUserDeep'],
    queryFn: () => fetchEndReportPerUser(id),
    enabled: !!session && !!id && isOwner,
  })

  // 달리기 프로그램 — 참여자별 누적 거리(km) → 거리왕·거리 랭킹
  const isRunning = program?.theme === PROGRAM_THEME.RUNNING
  const { data: distanceByUser } = useQuery({
    queryKey: ['program', id, 'distanceByUser'],
    queryFn: () => fetchProgramDistanceByUser(id),
    enabled: !!session && !!id && isOwner && isRunning,
  })

  // 금연 프로그램 — 시상에서 인증왕/개근왕 제외 + 용어(도전자·금연 성공률 등) 변경
  const isQuit = isQuitProgram(program)

  // 클래스 결과 — 클래스(강사 세션) 기능 활성 프로그램만
  const { data: classStats } = useQuery({
    queryKey: ['program', id, 'classStats'],
    queryFn: () => fetchProgramClassStats(id),
    enabled: !!session && !!id && isOwner && !!program?.class_feature_enabled,
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
          <Reveal index={0}>
          <div className="rounded-card-lg bg-white border border-[#e6e9e6] p-6 flex flex-col items-center gap-3">
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
          </div>
          </Reveal>

          {/* ─── 핵심 진단 — 왜 이렇게 됐나 + 처방 (퍼널 파생) ─── */}
          <Reveal index={1}><DiagnosisCard diagnosis={report.diagnosis} /></Reveal>

          {/* ─── 핵심 3지표 ─── */}
          <Reveal index={2}>
          <div className="grid grid-cols-3 gap-3">
            {/* 참여자 → 참여자 명단 / 누적 인증 → 미션별 인증 현황(유저 내역 포함). 금연은 '도전자'·'금연 성공률' */}
            <StatTile src="/icons/report/participants.png" emoji="👥" label={isQuit ? '도전자' : '참여자'} value={report.totalParticipants} unit="명"
              onClick={() => navigate(`/programs/${id}/stats/users`)} />
            <StatTile src="/icons/report/verifications.png" emoji="📋" label="누적 인증" value={report.totalVerifications} unit="건"
              onClick={() => navigate(`/programs/${id}/stats/missions`)} />
            <StatTile src="/icons/report/completion.png" emoji="🏆" label={isQuit ? '금연 성공률' : '완주율'} value={report.completionRate ?? 0} unit={report.completionRate == null ? '' : '%'} dim={report.completionRate == null} />
          </div>
          </Reveal>

          {/* ─── 참여 여정 (퍼널) — 어디서 빠졌나 ─── */}
          <Reveal index={3}><JourneyCard report={report} /></Reveal>

          {/* ─── 영역별 평가 (미션·퀴즈·커뮤니티 — 활성 채널만) · 참여 여정 다음.
               미션 채널 상세 안에 완주 분포·전체 기간 인증 추이 포함(모두 미션 인증 기준) ─── */}
          <Reveal index={4}><ChannelEvaluation report={report} quizStats={quizStats} community={community} program={program} /></Reveal>

          {/* ─── 신고 · 제재 (영역별 평가 다음) ─── */}
          {classStats?.sessionCount > 0 && <Reveal index={5}><ClassResultsCard stats={classStats} /></Reveal>}

          <Reveal index={6}><ModerationCard groups={reportGroups} programDays={report.programDays} programId={id} program={program} /></Reveal>

          {/* ─── 시상 · 랭킹 (부문별 + 무결성 검증) ─── */}
          <Reveal index={7}><AwardsCard report={report} perUser={perUser} raw={stats?._raw || []} reportGroups={reportGroups} hasQuiz={quizStats.length > 0} hasCommunity={!!program.feed_enabled} distanceByUser={isRunning ? distanceByUser : null} isQuit={isQuit} /></Reveal>

          {/* ─── 운영 부하 (있는 데이터만 · 정산은 보류) ─── */}
          <Reveal index={8}><OperatorLoadCard load={opLoad} /></Reveal>

          {/* ─── 다음 액션 ─── */}
          <Reveal index={9}><NextActionsCard programId={id} feedEnabled={!!program.feed_enabled} navigate={navigate} onClone={() => setCloneOpen(true)}
            onThanks={() => navigate(`/programs/${id}?tab=community`, { state: { composeThanks: buildThanksDraft(program, report) } })}
            onExport={async (includeDetail) => {
              const [pu, scoreBreakdown, teamRanking, distance, metricsByUser, scoreLedger, classRoster] = await Promise.all([
                perUser || fetchEndReportPerUser(id),
                fetchProgramScoreBreakdown(id),
                fetchProgramTeamRanking(id).catch(() => []),   // 팀 미사용/오류 시 빈 배열
                isRunning ? (distanceByUser || fetchProgramDistanceByUser(id)) : null,
                fetchProgramMetricsByUser(id).catch(() => null),   // 주요 기록 지표 전량(거리·시간·칼로리·달성 등)
                fetchProgramScoreLedger(id),
                program?.class_feature_enabled ? fetchProgramClassRoster(id).catch(() => []) : [],
              ])
              // 「상세 포함」 체크 시에만 무거운 댓글·퀴즈 답변 상세를 추가로 조회
              let commentsDetail = null, quizAnswersDetail = null
              if (includeDetail) {
                ;[commentsDetail, quizAnswersDetail] = await Promise.all([
                  fetchProgramCommentsDetail(id).catch(() => null),
                  fetchProgramQuizAnswersDetail(id).catch(() => null),
                ])
              }
              await exportEndReportXlsx({ program, report, quizStats, community, perUser: pu, raw: stats?._raw || [], scoreBreakdown, teamRanking, distanceByUser: distance, metricsByUser, reportGroups, scoreLedger, classRoster, commentsDetail, quizAnswersDetail })
            }} /></Reveal>
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
      className={`w-full bg-white border border-[#e6e9e6] rounded-card-lg p-4 flex flex-col items-center gap-1.5 text-center${
        onClick ? ' hover:border-emerald-300 active:scale-[0.98] transition' : ''
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

// **…** 마커를 굵게 렌더 (진단 문구의 핵심 수치 강조)
function RichText({ text }) {
  return text.split('**').map((seg, i) => (i % 2 ? <b key={i} style={{ color: '#23282b', fontWeight: 800 }}>{seg}</b> : <span key={i}>{seg}</span>))
}

// ─── 핵심 진단 — 통계 하이라이트와 같은 결의 상단 callout(왜 이렇게 됐나 + 처방) ───
function DiagnosisCard({ diagnosis }) {
  if (!diagnosis) return null
  const warn = diagnosis.tone === 'warn'
  return (
    <div className="bg-white border border-[#e6e9e6] rounded-card-lg p-5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0"
          style={{ background: warn ? '#fef3c7' : '#e7f4ec', color: warn ? '#b45309' : '#0f7a52', fontSize: 12, fontWeight: 800 }}>
          {warn ? '!' : '✓'}
        </span>
        <h3 className="text-base font-bold text-gray-900">핵심 진단</h3>
      </div>
      <p className="text-[13.5px] leading-relaxed" style={{ color: '#4b544f' }}><RichText text={diagnosis.text} /></p>
      {diagnosis.fix && (
        <div className="mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: '#f1f6f3' }}>
          <span className="flex-shrink-0" style={{ fontSize: 13, lineHeight: 1.5 }}>💡</span>
          <p className="text-[13px] leading-relaxed" style={{ color: '#0f5c3f' }}><b>이렇게 해보세요</b> — {diagnosis.fix}</p>
        </div>
      )}
    </div>
  )
}

// ─── 참여 여정 (퍼널) — 라벨+인원·%(우) / 풀폭 막대 / 막대 사이 가운데 ▼이탈 / 하단 요약 3지표 ───
function JourneyCard({ report }) {
  const { funnel, steps, bottleneck, avgActiveDays } = report
  const base = funnel[0]?.count || 1
  const notStarted = steps[0]?.lost ?? 0                          // 가입→첫인증 이탈 = 시작 안 함
  const bnLabel = { first: '시작', return: '2일차', done: '중반' }[bottleneck?.toKey] || '없음'
  const summary = [
    ['최대 이탈 구간', bnLabel],
    ['평균 유지', `${avgActiveDays.toFixed(1)}일`],
    ['시작 안 함', `${notStarted}명`],
  ]
  return (
    <div>
      {/* 제목은 카드 밖 섹션 헤더로 */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <h3 className="text-base font-bold text-gray-900">참여 여정</h3>
        <span className="text-[11px] text-gray-400 ml-auto">어디서 멈췄나</span>
      </div>
      <div className="bg-white border border-[#e6e9e6] rounded-card-lg p-5">
      <div className="flex flex-col gap-3.5">
        {funnel.map((f, i) => {
          const w = base > 0 ? (f.count / base) * 100 : 0
          const pct = Math.round(w)
          const out = i < funnel.length - 1 ? steps[i] : null      // 이 단계 → 다음 단계 이탈
          const isBn = bottleneck && out && bottleneck.toKey === funnel[i + 1]?.key
          return (
            <div key={f.key} className="flex items-stretch gap-2.5">
              {/* 메인: 라벨 + 인원(우) / 막대 — 막대 끝이 '명' 아래까지 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: '#23282b' }}>{f.label}</span>
                  <b style={{ fontSize: 15, fontWeight: 800, color: '#23282b' }}>{f.count}명</b>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: '#eef0ef', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 999, width: `${Math.max(w, f.count > 0 ? 4 : 0)}%`, background: '#10b981', transition: 'width .5s cubic-bezier(.2,.75,.25,1)' }} />
                </div>
              </div>
              {/* 우측 열 — %(위, 인원 라인) + ▼이탈(아래, 막대 라인 · %와 세로 정렬) */}
              <div className="flex flex-col items-end justify-between flex-shrink-0" style={{ width: 42 }}>
                <span className="tabular-nums" style={{ fontSize: 11.5, color: '#9aa39d', lineHeight: 1 }}>{pct}%</span>
                <span className="tabular-nums" style={{ fontSize: 11, fontWeight: isBn ? 700 : 600, lineHeight: 1, color: out ? (out.lost > 0 ? (isBn ? '#b45309' : '#8a8079') : '#c3cac5') : 'transparent' }}>
                  {out ? (out.lost > 0 ? `▼ ${out.lost}명` : '—') : ''}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* 하단 요약 3지표 — 가운데 정렬 + 세로 구분선 */}
      <div className="grid grid-cols-3 mt-4 pt-4" style={{ borderTop: '1px solid #eef0ef' }}>
        {summary.map(([l, v], idx) => (
          <div key={l} className="flex flex-col items-center gap-1 text-center" style={{ borderLeft: idx > 0 ? '1px solid #eef0ef' : 'none' }}>
            <span style={{ fontSize: 10.5, color: '#8a8079' }}>{l}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#23282b' }}>{v}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}

// ─── 미션 완주 분포(본문) — 도넛(통계 「참여자 상태」와 통일) + 범례 탭 → 실제 명단. 카드 없이 미션 상세 안 서브섹션으로. ───
function CompletionBody({ report, isQuit = false }) {
  const { completedUsers, participatedUsers, dormantUsers, totalParticipants, threshold } = report
  const [open, setOpen] = useState(completedUsers.length > 0 ? 'c' : null)
  const total = totalParticipants || 0
  const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0)
  // 참여도 emerald 그라데이션 — 참여자 상태 위젯과 동일 (완주=진한 / 참여=연한 / 휴면=그레이). 금연은 완주→금연 성공.
  const segs = [
    { key: 'c', label: isQuit ? '금연 성공' : '완주', users: completedUsers, hex: '#10b981', desc: threshold ? `${threshold}일+ 활동` : '기준 활동' },
    { key: 'p', label: '참여', users: participatedUsers, hex: '#6ee7b7', desc: '1일+ 인증' },
    { key: 'd', label: '휴면', users: dormantUsers, hex: '#c3cac5', desc: '인증 없음' },
  ]
  const donutSegs = segs.map(s => ({ key: s.key, name: s.label, count: s.users.length, hex: s.hex }))
  const openSeg = segs.find(s => s.key === open && s.users.length > 0)
  const toggle = (k) => { const seg = segs.find(s => s.key === k); if (seg && seg.users.length > 0) setOpen(p => (p === k ? null : k)) }
  return (
    <>
      {/* 도넛(좌) + 범례(우, 탭하면 명단 펼침) — 통계 참여자 상태와 같은 도넛 재사용 */}
      <div className="flex items-center" style={{ gap: 20 }}>
        <StatusDonut segments={donutSegs} total={total || 1} selectedKey={open} onSelect={toggle} size={112} />
        <div className="flex-1 min-w-0 flex flex-col">
          {segs.map(s => {
            const count = s.users.length
            const isOpen = open === s.key
            const disabled = count === 0
            return (
              <button key={s.key} type="button" disabled={disabled} onClick={() => toggle(s.key)}
                className="flex items-center text-left"
                style={{ gap: 8, padding: '8px 8px', borderRadius: 10, background: isOpen ? '#f1f3f2' : 'transparent', opacity: disabled ? 0.5 : 1, transition: 'background .2s' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.hex, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#4b544f' }}>{s.label}</span>
                <b className="tabular-nums" style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, color: '#23282b' }}>{count}명</b>
                <span className="tabular-nums" style={{ fontSize: 11, color: '#9aa39d', width: 30, textAlign: 'right' }}>{pct(count)}%</span>
                {!disabled && <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#c3cac5', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* 선택한 버킷의 실제 명단 */}
      <AnimatePresence initial={false}>
        {openSeg && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid #eef0ef' }}>
              <p className="text-[11px] text-gray-400 mb-2">
                <span style={{ color: '#4b544f', fontWeight: 700 }}>{openSeg.label}</span> · {openSeg.desc} · {openSeg.users.length}명
              </p>
              <ul className="max-h-56 overflow-y-auto space-y-1">
                {openSeg.users.map((u, i) => (
                  <li key={u.user_id} className="flex items-center gap-2 text-xs">
                    <span className="w-5 text-right text-gray-400 flex-shrink-0">{i + 1}</span>
                    <span className="flex-1 min-w-0 truncate text-gray-800 font-medium">{u.nickname}</span>
                    <span className="text-gray-500 flex-shrink-0">활동 <b className="text-gray-700">{u.activeDays}</b>일</span>
                    <span className="text-gray-400 flex-shrink-0">· 인증 {u.totalCount}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// 등급 배지 — 채널 도달률(0~100)로. 우수/보통/미흡/없음.
function gradeInfo(rate) {
  if (rate >= 70) return { label: '우수', bg: '#dcefe4', fg: '#0f7a52' }
  if (rate >= 40) return { label: '보통', bg: '#e7f4ec', fg: '#2f8f66' }
  if (rate > 0) return { label: '미흡', bg: '#efece7', fg: '#8a8079' }
  return { label: '없음', bg: '#efece7', fg: '#a39a8f' }
}

// 진단 노트 — "진단" 태그 + 현상 기술(판단 없이 팩트만). 각 채널 상세 하단.
function DiagnosisNote({ text }) {
  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: '#faf6f0' }}>
      <span className="flex-shrink-0" style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#efe6da', color: '#a1795a' }}>진단</span>
      <p className="text-[12.5px] leading-relaxed" style={{ color: '#6a5f52' }}>{text}</p>
    </div>
  )
}

// ─── 미션 상세 — 미션별 참여율 막대 + 유지/삭제 후보 배지. 기본 3개, 나머지는 펼치기. ───
function MissionsCard({ report, diagnosis, isQuit = false }) {
  const { missionPerf, totalParticipants, trend, peakDay } = report
  const [showAll, setShowAll] = useState(false)
  const LIMIT = 3
  const moreCount = missionPerf.length - LIMIT
  const trendAvg = trend.length ? (trend.reduce((s, t) => s + t.count, 0) / trend.length).toFixed(1) : '0'
  // 상단 통계 — 전체 인증 / 인증한 사람 / 1인당 인증
  const totalV = report.totalVerifications
  const missionReach = report.funnel.find(f => f.key === 'first')?.count || 0     // 인증한 사람(≥1일 인증)
  const reachRate = totalParticipants ? Math.round((missionReach / totalParticipants) * 100) : 0
  const dayAvg = report.programDays ? Math.round(totalV / report.programDays) : null
  const perUser = missionReach > 0 ? (totalV / missionReach).toFixed(1) : '0'
  const statBoxes = [
    { l: '전체 인증', v: totalV.toLocaleString(), u: '건', s: dayAvg != null ? `하루 평균 ${dayAvg}건` : `미션 ${missionPerf.length}개` },
    { l: '인증한 사람', v: `${missionReach}`, u: '명', s: `${totalParticipants}명 중 ${reachRate}%` },
    { l: '1인당 인증', v: perUser, u: '건', s: '인증자 기준' },
  ]
  // 가장 많이 인증된 미션(건수 최다)
  const topMission = missionPerf.reduce((best, m) => (m.count > (best?.count ?? 0) ? m : best), null)

  const renderMission = (m) => {
    const keep = m.count > 0
    return (
      <div key={m.mission_id}>
        {/* 제목 + 유지/삭제 후보 배지 */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="min-w-0 truncate" style={{ fontSize: 13.5, fontWeight: 700, color: '#23282b' }}>{m.title}</span>
          <span className="flex-shrink-0" style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: keep ? '#e7f4ec' : '#efece7', color: keep ? '#0f7a52' : '#8a8079' }}>
            {keep ? '유지' : '삭제 후보'}
          </span>
        </div>
        {/* 건수 · 참여 인원 */}
        <p style={{ fontSize: 11.5, color: '#9aa39d', marginBottom: 8 }}>
          {m.count}건 · {m.count > 0 ? `참여 ${m.users}/${totalParticipants}명` : '아무도 인증하지 않음'}
        </p>
        {/* 참여율 막대 + % */}
        <div className="flex items-center gap-3">
          <div className="flex-1" style={{ height: 8, borderRadius: 999, background: '#eef0ef', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, width: `${m.rate}%`, background: '#10b981', transition: 'width .5s cubic-bezier(.2,.75,.25,1)' }} />
          </div>
          <span className="tabular-nums flex-shrink-0" style={{ fontSize: 13, fontWeight: 800, color: m.count > 0 ? '#23282b' : '#c3cac5', width: 34, textAlign: 'right' }}>{m.rate}%</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#e6e9e6] rounded-card-lg p-5">
      <div className="flex items-baseline gap-2 mb-4">
        <h3 className="text-base font-bold text-gray-900">미션 <b className="font-extrabold">{missionPerf.length}</b>개</h3>
        <span className="text-[11px] text-gray-400 ml-auto">{report.programDays ? `${report.programDays}일` : ''}</span>
      </div>

      {/* 상단 통계 3칸 — 세로 구분선 */}
      <div className="grid grid-cols-3 mb-5 pb-5" style={{ borderBottom: '1px solid #eef0ef' }}>
        {statBoxes.map((b, i) => (
          <div key={b.l} style={{ paddingLeft: i > 0 ? 14 : 0, borderLeft: i > 0 ? '1px solid #eef0ef' : 'none' }}>
            <div style={{ fontSize: 10.5, color: '#8a8079', marginBottom: 6 }}>{b.l}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#23282b', lineHeight: 1 }}>
              {b.v}<span style={{ fontSize: 11, color: '#9aa39d', fontWeight: 700 }}>{b.u}</span>
            </div>
            <div style={{ fontSize: 10, color: '#9aa39d', marginTop: 6 }}>{b.s}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {missionPerf.slice(0, LIMIT).map(renderMission)}
      </div>
      {/* 나머지 미션 — grid-rows 0fr↔1fr 로 부드럽게 펼침 */}
      {moreCount > 0 && (
        <div className="grid" style={{ gridTemplateRows: showAll ? '1fr' : '0fr', transition: 'grid-template-rows .35s cubic-bezier(.2,.75,.25,1)' }}>
          <div className="overflow-hidden">
            <div className="flex flex-col gap-4 pt-4">
              {missionPerf.slice(LIMIT).map(renderMission)}
            </div>
          </div>
        </div>
      )}

      {/* 가장 많이 인증된 미션 — 미션 목록 바로 아래(접기 버튼 앞). 3D 미션 아이콘(축소) */}
      {topMission && topMission.count > 0 && (
        <div className="mt-4 pt-4 flex items-center gap-3" style={{ borderTop: '1px solid #eef0ef' }}>
          <Icon3D src="/icons/feature/mission.png" emoji="📋" className="w-11 h-11 flex-shrink-0" />
          <div className="min-w-0">
            <p style={{ fontSize: 11, color: '#8a8079' }}>가장 많이 인증된 미션</p>
            <p className="truncate" style={{ fontSize: 15, fontWeight: 800, color: '#23282b', margin: '1px 0' }}>{topMission.title}</p>
            <p style={{ fontSize: 11.5, color: '#9aa39d' }}>{topMission.count.toLocaleString()}건 · {topMission.users}명</p>
          </div>
        </div>
      )}

      {moreCount > 0 && (
        <button type="button" onClick={() => setShowAll(v => !v)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-[13px] font-bold text-gray-500 hover:text-gray-700 py-1 transition">
          {showAll ? '접기' : `+${moreCount}개 더 보기`}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
        </button>
      )}

      {/* 완주 분포 — 미션 인증 기준(activeDays). 금연은 '금연 성공 비율'. 미션 영역 안 서브섹션 */}
      <div className="mt-5 pt-4" style={{ borderTop: '1px solid #eef0ef' }}>
        <div className="flex items-center gap-2 mb-3">
          <h4 style={{ fontSize: 13.5, fontWeight: 700, color: '#23282b' }}>{isQuit ? '금연 성공 비율' : '완주 분포'}</h4>
          <span className="text-[11px] text-gray-400 ml-auto">총 {totalParticipants}명 · 탭해서 명단</span>
        </div>
        <CompletionBody report={report} isQuit={isQuit} />
      </div>

      {/* 전체 기간 인증 추이 — 미션(인증) 활동이므로 미션 상세 안에 */}
      {trend.length > 1 && (
        <div className="mt-5 pt-4" style={{ borderTop: '1px solid #eef0ef' }}>
          <div className="flex items-center gap-2 mb-1">
            <h4 style={{ fontSize: 13.5, fontWeight: 700, color: '#23282b' }}>전체 기간 인증 추이</h4>
            <span className="text-[11px] text-gray-400 ml-auto">하루 평균 {trendAvg}건</span>
          </div>
          {peakDay && peakDay.count > 0 && (
            <p className="text-xs text-gray-600 mb-3">
              <span className="font-semibold text-emerald-700">{formatKoreanDate(peakDay.date)}</span> 에 가장 활발했어요 ({peakDay.count}건)
            </p>
          )}
          <ParticipationTrendChart data={trend} field="count" unit="건" maxCap={Infinity} interaction="tap" />
        </div>
      )}

      {diagnosis && <DiagnosisNote text={diagnosis} />}
    </div>
  )
}

// ─── 시상 · 랭킹 — 부문별 1~3위 + 완주자(참가상) + 무결성 검증(⚠️ 신고·인증 몰림) ───
const MEDALS = ['🥇', '🥈', '🥉']
function AwardsCard({ report, perUser, raw = [], reportGroups = [], hasQuiz, hasCommunity, distanceByUser = null, isQuit = false }) {
  const roster = [
    ...report.completedUsers.map(u => ({ ...u })),
    ...report.participatedUsers.map(u => ({ ...u })),
    ...report.dormantUsers.map(u => ({ ...u })),
  ]

  // ── 무결성: 신고당한 작성자 + 인증 몰림(한 날 70%+ · 총 5건+) ──
  const reportedIds = new Set()
  for (const g of reportGroups) {
    const aid = g.targetType === 'post' ? g.target?.author?.id : g.target?.user?.id
    if (aid) reportedIds.add(aid)
  }
  const dayByUser = {}
  for (const r of raw) {
    if (!r.user_id) continue
    const d = formatKstDate(new Date(r.submitted_at))
    const u = (dayByUser[r.user_id] ||= { total: 0, max: 0, days: {} })
    u.total += 1
    u.days[d] = (u.days[d] || 0) + 1
    if (u.days[d] > u.max) u.max = u.days[d]
  }
  const flagsFor = (uid) => {
    const f = []
    if (reportedIds.has(uid)) f.push('신고')
    const d = dayByUser[uid]
    if (d && d.total >= 5 && d.max / d.total >= 0.7) f.push('몰아서 인증')
    return f
  }

  const q = (uid) => perUser?.quizByUser?.[uid]
  const cm = (uid) => perUser?.communityByUser?.[uid]
  const dist = (uid) => distanceByUser?.[uid] || 0
  const cats = []
  // 달리기: 누적 거리왕을 맨 앞에
  if (distanceByUser) cats.push({ key: 'dist', icon: '🏃', title: '거리왕', crit: '누적 거리', pool: roster.filter(u => dist(u.user_id) > 0), metric: u => dist(u.user_id), label: u => `${dist(u.user_id).toFixed(1)}km`, tie: (a, b) => b.totalCount - a.totalCount })
  // 금연 테마는 인증왕/개근왕(인증 횟수·출석 = 금연 목표와 무관)을 시상에서 제외.
  //   지표 방향(절약↑ vs 흡연↑)이 프로그램마다 달라 자동 「지표왕」은 넣지 않음(오시상 방지).
  if (!isQuit) {
    cats.push(
      { key: 'verif', icon: '🔥', title: '인증왕', crit: '총 인증 수', pool: roster.filter(u => u.totalCount > 0), metric: u => u.totalCount, label: u => `${u.totalCount}건`, tie: (a, b) => b.activeDays - a.activeDays },
      { key: 'streak', icon: '📅', title: '개근왕', crit: '활동한 일수', pool: roster.filter(u => u.activeDays > 0), metric: u => u.activeDays, label: u => `${u.activeDays}일`, tie: (a, b) => b.totalCount - a.totalCount },
    )
  }
  if (hasQuiz) cats.push({ key: 'quiz', icon: '🧠', title: '퀴즈왕', crit: '퀴즈 정답률', pool: roster.filter(u => q(u.user_id)?.correctRate != null), metric: u => q(u.user_id).correctRate, label: u => `${q(u.user_id).correctRate}% · ${q(u.user_id).quizCount}개`, tie: (a, b) => q(b.user_id).quizCount - q(a.user_id).quizCount })
  if (hasCommunity) cats.push({ key: 'comm', icon: '💬', title: '커뮤니티 MVP', crit: '글 + 댓글', pool: roster.filter(u => { const x = cm(u.user_id); return x && (x.posts + x.comments) > 0 }), metric: u => { const x = cm(u.user_id); return x.posts + x.comments }, label: u => { const x = cm(u.user_id); return `글 ${x.posts} · 댓글 ${x.comments}` }, tie: (a, b) => cm(b.user_id).posts - cm(a.user_id).posts })

  const topOf = (cat) => [...cat.pool].sort((a, b) => cat.metric(b) - cat.metric(a) || cat.tie(a, b) || (a.nickname || '').localeCompare(b.nickname || '')).slice(0, 3)
  const anyFlag = cats.some(cat => topOf(cat).some(u => flagsFor(u.user_id).length > 0))

  return (
    <div className="bg-white border border-[#e6e9e6] rounded-card-lg p-5">
      <div className="flex items-center gap-2 mb-1">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h3 className="text-base font-bold text-gray-900">시상 · 랭킹</h3>
        <span className="text-[11px] text-gray-400 ml-auto">상품 지급 기준</span>
      </div>
      <p className="text-[11.5px] text-gray-500 mb-4">부문별 1~3위와 {isQuit ? '금연 성공자' : '완주자'}예요. 동점은 괄호 기준으로 갈랐어요.</p>

      {/* 완주자(참가상) */}
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 mb-4" style={{ background: '#f1f6f3' }}>
        <span style={{ fontSize: 17 }}>🎗️</span>
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0f5c3f' }}>{isQuit ? '금연 성공자' : '완주자'} {report.completedUsers.length}명 · 참가상 대상</p>
          <p style={{ fontSize: 11, color: '#4b7a63' }}>{report.threshold ? `${report.threshold}일 이상 활동` : '기준 활동'} 달성</p>
        </div>
      </div>

      {/* 부문별 랭킹 */}
      <div className="flex flex-col">
        {cats.map((cat, ci) => {
          const top = topOf(cat)
          return (
            <div key={cat.key} className={ci > 0 ? 'mt-4 pt-4' : ''} style={ci > 0 ? { borderTop: '1px solid #eef0ef' } : undefined}>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span style={{ fontSize: 14 }}>{cat.icon}</span>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: '#23282b' }}>{cat.title}</span>
                <span className="ml-auto" style={{ fontSize: 10.5, color: '#9aa39d' }}>{cat.crit}</span>
              </div>
              {top.length === 0 ? (
                <p style={{ fontSize: 12, color: '#c3cac5', paddingLeft: 2 }}>아직 없음</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {top.map((u, i) => {
                    const flags = flagsFor(u.user_id)
                    return (
                      <div key={u.user_id} className="flex items-center gap-2.5">
                        <span className="flex-shrink-0 text-center" style={{ width: 22, fontSize: 14 }}>{MEDALS[i]}</span>
                        <span className="min-w-0 truncate" style={{ fontSize: 13.5, fontWeight: 600, color: '#23282b' }}>{u.nickname}</span>
                        {flags.length > 0 && (
                          <span className="flex-shrink-0" style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: '#fef3c7', color: '#b45309' }}>⚠️ {flags.join('·')}</span>
                        )}
                        <span className="tabular-nums ml-auto flex-shrink-0" style={{ fontSize: 12, fontWeight: 700, color: '#4b544f' }}>{cat.label(u)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 무결성 안내 */}
      {anyFlag && (
        <div className="mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: '#fff7ed' }}>
          <span className="flex-shrink-0" style={{ fontSize: 12 }}>⚠️</span>
          <p className="text-[11.5px] leading-relaxed" style={{ color: '#9a6a2f' }}>
            <b>표시된 참여자는 상 지급 전에 확인해보세요.</b> 신고 이력이 있거나 인증이 특정일에 몰려 있어요 — 부정이 아닐 수도 있으니 내역을 한 번 살펴보시길 권해요.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── 퀴즈 상세 — 상단 통계 3칸 + 퀴즈별 참여율/정답률(양호·하락) + 가장 많이 틀린 문항. ───
function QuizPerformanceCard({ quizzes, total, diagnosis }) {
  const [showAll, setShowAll] = useState(false)
  const LIMIT = 3
  const sorted = [...quizzes].sort((a, b) => (b.participationRate - a.participationRate) || (b.submissionCount - a.submissionCount))
  const moreCount = sorted.length - LIMIT

  // 상단 집계
  const quizCount = quizzes.length
  const totalQuestions = quizzes.reduce((s, q) => s + (q.questionCount || 0), 0)
  const totalSubs = quizzes.reduce((s, q) => s + q.submissionCount, 0)
  const possible = quizCount * (total || 0)
  const avgSubmitRate = possible > 0 ? Math.round((totalSubs / possible) * 100) : 0
  const totalGraded = quizzes.reduce((s, q) => s + (q.gradedCount || 0), 0)
  const totalCorrect = quizzes.reduce((s, q) => s + (q.correctCount || 0), 0)
  const overallCorrect = totalGraded > 0 ? Math.round((totalCorrect / totalGraded) * 100) : null
  const avgScore = totalSubs > 0 ? Math.round(quizzes.reduce((s, q) => s + q.avgScore * q.submissionCount, 0) / totalSubs) : 0
  const avgMax = totalSubs > 0 ? Math.round(quizzes.reduce((s, q) => s + q.totalPoints * q.submissionCount, 0) / totalSubs) : 0
  const statBoxes = [
    { l: '평균 제출률', v: `${avgSubmitRate}`, u: '%', s: `${totalSubs} / ${possible} 응답` },
    { l: '전체 정답률', v: overallCorrect != null ? `${overallCorrect}` : '-', u: overallCorrect != null ? '%' : '', s: `${totalCorrect}문항 정답` },
    { l: '평균 점수', v: `${avgScore}`, u: '점', s: `${avgMax}점 만점` },
  ]
  // 가장 많이 틀린 문항 (정답률 최저, 응답 있는 문항 중)
  const hardest = quizzes.flatMap(q => q.questionStats || [])
    .filter(q => q.total > 0 && q.correctRate != null)
    .sort((a, b) => (a.correctRate - b.correctRate) || (b.total - a.total))[0] || null

  const renderQuiz = (q) => {
    const good = q.submissionCount > 0 && q.participationRate >= 50
    const badge = q.submissionCount === 0 ? '없음' : q.participationRate >= 50 ? '양호' : '하락'
    return (
      <div key={q.id}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="min-w-0 truncate" style={{ fontSize: 13.5, fontWeight: 700, color: '#23282b' }}>{q.title}</span>
          <span className="flex-shrink-0" style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: good ? '#e7f4ec' : '#efece7', color: good ? '#0f7a52' : '#8a8079' }}>{badge}</span>
        </div>
        <p style={{ fontSize: 11.5, color: '#9aa39d', marginBottom: 8 }}>
          {q.submissionCount > 0
            ? `제출 ${q.submissionCount}/${total}명 · 정답률 ${q.correctRate == null ? '채점 전' : `${q.correctRate}%`}`
            : '아무도 풀지 않음'}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1" style={{ height: 8, borderRadius: 999, background: '#eef0ef', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, width: `${q.participationRate}%`, background: '#10b981', transition: 'width .5s cubic-bezier(.2,.75,.25,1)' }} />
          </div>
          <span className="tabular-nums flex-shrink-0" style={{ fontSize: 13, fontWeight: 800, color: q.submissionCount > 0 ? '#23282b' : '#c3cac5', width: 34, textAlign: 'right' }}>{q.participationRate}%</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#e6e9e6] rounded-card-lg p-5">
      <div className="flex items-baseline gap-2 mb-4">
        <h3 className="text-base font-bold text-gray-900">퀴즈 <b className="font-extrabold">{quizCount}</b>개 · {totalQuestions}문항</h3>
        <span className="text-[11px] text-gray-400 ml-auto">제출 {totalSubs}건{overallCorrect != null ? ` · 정답률 ${overallCorrect}%` : ''}</span>
      </div>

      {/* 상단 통계 3칸 — 세로 구분선 */}
      <div className="grid grid-cols-3 mb-5 pb-5" style={{ borderBottom: '1px solid #eef0ef' }}>
        {statBoxes.map((b, i) => (
          <div key={b.l} style={{ paddingLeft: i > 0 ? 14 : 0, borderLeft: i > 0 ? '1px solid #eef0ef' : 'none' }}>
            <div style={{ fontSize: 10.5, color: '#8a8079', marginBottom: 6 }}>{b.l}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#23282b', lineHeight: 1 }}>{b.v}<span style={{ fontSize: 11, color: '#9aa39d', fontWeight: 700 }}>{b.u}</span></div>
            <div style={{ fontSize: 10, color: '#9aa39d', marginTop: 6 }}>{b.s}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {sorted.slice(0, LIMIT).map(renderQuiz)}
      </div>
      {moreCount > 0 && (
        <div className="grid" style={{ gridTemplateRows: showAll ? '1fr' : '0fr', transition: 'grid-template-rows .35s cubic-bezier(.2,.75,.25,1)' }}>
          <div className="overflow-hidden">
            <div className="flex flex-col gap-4 pt-4">
              {sorted.slice(LIMIT).map(renderQuiz)}
            </div>
          </div>
        </div>
      )}

      {/* 가장 많이 틀린 문항 — 퀴즈 3D 아이콘(축소) */}
      {hardest && (
        <div className="mt-4 pt-4 flex items-center gap-3" style={{ borderTop: '1px solid #eef0ef' }}>
          <Icon3D src="/icons/feature/quiz.png" emoji="❓" className="w-11 h-11 flex-shrink-0" />
          <div className="min-w-0">
            <p style={{ fontSize: 11, color: '#8a8079' }}>가장 많이 틀린 문항</p>
            <p className="truncate" style={{ fontSize: 15, fontWeight: 800, color: '#23282b', margin: '1px 0' }}>{hardest.text}</p>
            <p style={{ fontSize: 11.5, color: '#9aa39d' }}>정답 {hardest.correctRate}% · {hardest.total}명 응답</p>
          </div>
        </div>
      )}

      {moreCount > 0 && (
        <button type="button" onClick={() => setShowAll(v => !v)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-[13px] font-bold text-gray-500 hover:text-gray-700 py-1 transition">
          {showAll ? '접기' : `+${moreCount}개 더 보기`}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
        </button>
      )}
      {diagnosis && <DiagnosisNote text={diagnosis} />}
    </div>
  )
}

// ─── 커뮤니티 상세 — 상단 통계 3칸(글·댓글·신고) + 활동별 참여자(글/댓글/좋아요/미참여) + 반응 최다 글. ───
function CommunityCard({ community, total, neverCount, programDays, diagnosis }) {
  const c = community || { participantPosts: 0, operatorPosts: 0, totalComments: 0, totalLikes: 0, posterCount: 0, commenterCount: 0, likerCount: 0, reportCount: 0, reportResolved: 0, topPost: null }
  const rate = (n) => (total > 0 ? Math.round((n / total) * 100) : 0)
  const dayAvg = programDays ? (c.participantPosts / programDays).toFixed(1) : null
  const perPoster = c.posterCount > 0 ? (c.participantPosts / c.posterCount).toFixed(1) : '0'
  const perPost = c.participantPosts > 0 ? (c.totalComments / c.participantPosts).toFixed(1) : '0'

  const statBoxes = [
    { l: '참여자 글', v: c.participantPosts.toLocaleString(), u: '건', s: '운영자 공지 별도' },
    { l: '댓글', v: c.totalComments.toLocaleString(), u: '개', s: `글당 ${perPost}개` },
    { l: '신고', v: `${c.reportCount}`, u: '건', s: c.reportCount === 0 ? '없음' : c.reportResolved >= c.reportCount ? '전건 처리 완료' : `${c.reportCount - c.reportResolved}건 미처리` },
  ]

  // 활동별 참여자 — 마지막 '미참여'는 역방향(이탈)
  const engGrade = (r) => (r >= 80 ? { t: '높음', on: true } : r >= 50 ? { t: '양호', on: true } : { t: '낮음', on: false })
  const rows = [
    { key: 'posters', label: '글을 쓴 사람', sub: `${c.posterCount}명 · 1인당 평균 ${perPoster}건`, r: rate(c.posterCount), badge: engGrade(rate(c.posterCount)) },
    { key: 'commenters', label: '댓글을 단 사람', sub: `${c.commenterCount}명 · 댓글 ${c.totalComments}개`, r: rate(c.commenterCount), badge: engGrade(rate(c.commenterCount)) },
    { key: 'likers', label: '좋아요를 누른 사람', sub: `${c.likerCount}명 · 좋아요 ${c.totalLikes}회`, r: rate(c.likerCount), badge: engGrade(rate(c.likerCount)) },
    { key: 'never', label: '한 번도 들어오지 않은 사람', sub: `${neverCount}명 · 첫 인증도 없음`, r: rate(neverCount), badge: { t: '이탈', on: false }, warn: true },
  ]

  return (
    <div className="bg-white border border-[#e6e9e6] rounded-card-lg p-5">
      <div className="flex items-baseline gap-2 mb-4">
        <h3 className="text-base font-bold text-gray-900">커뮤니티 활동</h3>
        <span className="text-[11px] text-gray-400 ml-auto">{programDays ? `${programDays}일` : ''}{dayAvg != null ? ` · 하루 평균 ${dayAvg}건` : ''}</span>
      </div>

      {/* 상단 통계 3칸 — 세로 구분선 */}
      <div className="grid grid-cols-3 mb-5 pb-5" style={{ borderBottom: '1px solid #eef0ef' }}>
        {statBoxes.map((b, i) => (
          <div key={b.l} style={{ paddingLeft: i > 0 ? 14 : 0, borderLeft: i > 0 ? '1px solid #eef0ef' : 'none' }}>
            <div style={{ fontSize: 10.5, color: '#8a8079', marginBottom: 6 }}>{b.l}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#23282b', lineHeight: 1 }}>{b.v}<span style={{ fontSize: 11, color: '#9aa39d', fontWeight: 700 }}>{b.u}</span></div>
            <div style={{ fontSize: 10, color: '#9aa39d', marginTop: 6 }}>{b.s}</div>
          </div>
        ))}
      </div>

      {/* 활동별 참여자 */}
      <div className="flex flex-col gap-4">
        {rows.map(r => (
          <div key={r.key}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <span style={{ fontSize: 13.5, fontWeight: 700, color: '#23282b' }}>{r.label}</span>
              <span className="flex-shrink-0" style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: r.badge.on ? '#e7f4ec' : '#efece7', color: r.badge.on ? '#0f7a52' : '#8a8079' }}>{r.badge.t}</span>
            </div>
            <p style={{ fontSize: 11.5, color: '#9aa39d', marginBottom: 8 }}>{r.sub}</p>
            <div className="flex items-center gap-3">
              <div className="flex-1" style={{ height: 8, borderRadius: 999, background: '#eef0ef', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, width: `${r.r}%`, background: r.warn ? '#c3cac5' : '#10b981', transition: 'width .5s cubic-bezier(.2,.75,.25,1)' }} />
              </div>
              <span className="tabular-nums flex-shrink-0" style={{ fontSize: 13, fontWeight: 800, color: '#23282b', width: 40, textAlign: 'right' }}>{r.r}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* 반응이 가장 많았던 글 — 커뮤니티 3D 아이콘(축소) */}
      {c.topPost && (
        <div className="mt-4 pt-4 flex items-center gap-3" style={{ borderTop: '1px solid #eef0ef' }}>
          <Icon3D src="/icons/feature/community.png" emoji="💬" className="w-11 h-11 flex-shrink-0" />
          <div className="min-w-0">
            <p style={{ fontSize: 11, color: '#8a8079' }}>반응이 가장 많았던 글</p>
            <p className="truncate" style={{ fontSize: 15, fontWeight: 800, color: '#23282b', margin: '1px 0' }}>{c.topPost.title}</p>
            <p style={{ fontSize: 11.5, color: '#9aa39d' }}>좋아요 {c.topPost.likes} · 댓글 {c.topPost.comments}</p>
          </div>
        </div>
      )}

      {diagnosis && <DiagnosisNote text={diagnosis} />}
    </div>
  )
}

// ─── 영역별 평가 — 미션·퀴즈·커뮤니티(활성화된 채널만) 스코어카드 + 선택 채널 상세 ───
function ChannelEvaluation({ report, quizStats, community, program }) {
  const isQuit = isQuitProgram(program)
  const total = report.totalParticipants || 0
  // 미션 도달 = 인증 1건 이상 참여자(= 퍼널 첫인증)
  const missionReach = report.funnel.find(f => f.key === 'first')?.count || 0
  const missionRate = total ? Math.round((missionReach / total) * 100) : 0
  const activeMissions = report.missionPerf.filter(m => m.count > 0).length
  // 퀴즈 도달 = 응답한 고유 참여자
  const quizSubmitters = new Set(quizStats.flatMap(q => q.submitterIds || []))
  const quizReach = quizSubmitters.size
  const quizRate = total ? Math.round((quizReach / total) * 100) : 0
  const quizGraded = quizStats.reduce((s, q) => s + (q.gradedCount || 0), 0)
  const quizCorrect = quizStats.reduce((s, q) => s + (q.correctCount || 0), 0)
  const quizCorrectRate = quizGraded > 0 ? Math.round((quizCorrect / quizGraded) * 100) : null
  // 커뮤니티 도달 = 글·댓글·좋아요 중 하나라도 한 고유 참여자
  const commReach = community?.activeCount || 0
  const commRate = total ? Math.round((commReach / total) * 100) : 0
  // 한 번도 안 들어온 사람 = 인증도 없고(휴면) 커뮤니티 활동도 없는 참여자
  const commActiveSet = new Set(community?.activeUserIds || [])
  const neverCount = (report.dormantUsers || []).filter(u => !commActiveSet.has(u.user_id)).length

  const channels = []
  if (report.missionPerf.length > 0) channels.push({ key: 'mission', label: '미션', head: report.totalVerifications.toLocaleString(), headUnit: '건', sub: `참여 ${missionRate}%`, rate: missionRate })
  if (quizStats.length > 0) channels.push({ key: 'quiz', label: '퀴즈', head: `${quizRate}%`, sub: '참여율', rate: quizRate })
  if (program.feed_enabled) channels.push({ key: 'community', label: '커뮤니티', head: `${community?.participantPosts ?? 0}`, headUnit: '건', sub: '전체 글', rate: commRate })

  const [sel, setSel] = useState(channels[0]?.key)
  if (channels.length === 0) return null

  // 팩트 진단 — 판단 없이 현상만. 금연은 '참여자'→'도전자'
  const P = isQuit ? '도전자' : '참여자'
  const factMission = `미션 ${report.missionPerf.length}개 중 ${activeMissions}개에 인증이 있었고, ${P} ${total}명 중 ${missionReach}명이 인증했어요.`
  const factQuiz = quizReach === 0
    ? `${P} ${total}명 중 아무도 퀴즈에 응답하지 않았어요.`
    : `${P} ${total}명 중 ${quizReach}명이 응답했고, 채점된 답안 ${quizGraded}개 중 ${quizCorrect}개가 정답이었어요${quizCorrectRate != null ? ` (정답률 ${quizCorrectRate}%)` : ''}.`
  const factComm = `${P} ${total}명 중 ${commReach}명이 글·댓글·좋아요로 참여했어요. 글 ${community?.participantPosts ?? 0}개, 댓글 ${community?.totalComments ?? 0}개, 좋아요 ${community?.totalLikes ?? 0}회가 올라왔어요.`

  return (
    <div className="space-y-3">
      {/* 스코어카드 — 제목은 카드 밖 섹션 헤더, 채널 탭만 카드로 */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <h3 className="text-base font-bold text-gray-900">영역별 평가</h3>
          <span className="text-[11px] text-gray-400 ml-auto">무엇이 작동했나</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: `repeat(${channels.length}, minmax(0,1fr))`, gap: 10 }}>
          {channels.map(ch => {
            const g = gradeInfo(ch.rate)
            const on = sel === ch.key
            return (
              <button key={ch.key} type="button" onClick={() => setSel(ch.key)}
                className="flex flex-col items-start text-left rounded-xl"
                style={{ padding: '12px 11px', border: on ? '2px solid #10b981' : '1px solid #e6e9e6', background: on ? '#f6fbf8' : '#fff', transition: 'border-color .15s, background .15s' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: on ? '#10b981' : '#c3cac5' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: on ? '#23282b' : '#6a736d' }}>{ch.label}</span>
                </div>
                <div style={{ lineHeight: 1 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: ch.rate > 0 ? '#23282b' : '#b6bdb8' }}>{ch.head}</span>
                  {ch.headUnit && <span style={{ fontSize: 12, fontWeight: 700, color: '#9aa39d' }}>{ch.headUnit}</span>}
                </div>
                <span style={{ fontSize: 10.5, color: '#9aa39d', marginTop: 4 }}>{ch.sub}</span>
                <span style={{ marginTop: 8, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: g.bg, color: g.fg }}>{g.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 선택 채널 상세 */}
      {sel === 'mission' && <MissionsCard report={report} diagnosis={factMission} isQuit={isQuit} />}
      {sel === 'quiz' && <QuizPerformanceCard quizzes={quizStats} total={total} diagnosis={factQuiz} />}
      {sel === 'community' && <CommunityCard community={community} total={total} neverCount={neverCount} programDays={report.programDays} diagnosis={factComm} />}
    </div>
  )
}

// ─── 신고 · 제재 — 접수/제재/미처리 + 사유별 분류(기본 프리셋 3종 + 기타). ───
//   프리셋과 일치하는 신고를 사유별로 묶음. 액션은 시스템 추적값(숨김/삭제/처리)만.
// ─── 클래스 결과 — 강사 세션 출석 집계 (클래스 기능 프로그램만, 신고·제재 바로 위) ───
function ClassResultsCard({ stats }) {
  const [expanded, setExpanded] = useState(false)
  const { sessionCount, totalConfirmed, totalRegistered, uniqueAttendees, pointsGranted, attendanceRate, instructorCount, sessions } = stats
  const statBoxes = [
    { l: '클래스', v: `${sessionCount}`, u: '개', s: instructorCount ? `강사 ${instructorCount}명` : '세션' },
    { l: '출석', v: `${totalConfirmed}`, u: '건', s: `${uniqueAttendees}명 참여` },
    { l: '출석률', v: attendanceRate != null ? `${attendanceRate}` : '-', u: attendanceRate != null ? '%' : '', s: totalRegistered ? `신청 ${totalRegistered}건` : '자유 참여' },
  ]
  const dLabel = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}` }
  const shown = expanded ? sessions : sessions.slice(0, 4)
  const rest = sessions.length - shown.length

  return (
    <div className="bg-white border border-[#e6e9e6] rounded-card-lg p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <Icon3D src="/icons/feature/attendance.png" emoji="🧘" className="w-8 h-8" />
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900 leading-tight">클래스 결과</h3>
          <p style={{ fontSize: 11, color: '#9aa39d', marginTop: 2 }}>{sessionCount}개 클래스 · 출석 {totalConfirmed}건</p>
        </div>
        {pointsGranted > 0 && (
          <span className="ml-auto flex-shrink-0" style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#e7f4ec', color: '#0f7a52' }}>+{pointsGranted.toLocaleString()}P 지급</span>
        )}
      </div>

      {/* 3칸 통계 */}
      <div className="grid grid-cols-3 mb-5 pb-5" style={{ borderBottom: '1px solid #eef0ef' }}>
        {statBoxes.map((b, i) => (
          <div key={b.l} style={{ paddingLeft: i > 0 ? 14 : 0, borderLeft: i > 0 ? '1px solid #eef0ef' : 'none' }}>
            <div style={{ fontSize: 10.5, color: '#8a8079', marginBottom: 6 }}>{b.l}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#23282b', lineHeight: 1 }}>{b.v}<span style={{ fontSize: 11, color: '#9aa39d', fontWeight: 700 }}>{b.u}</span></div>
            <div style={{ fontSize: 10, color: '#9aa39d', marginTop: 6 }}>{b.s}</div>
          </div>
        ))}
      </div>

      {/* 세션별 출석 */}
      <div className="flex flex-col gap-3.5">
        {shown.map(s => {
          const c = catOf(s.category)
          const rate = s.registered > 0 ? Math.round(s.confirmed / s.registered * 100) : null
          return (
            <div key={s.id} className="flex items-center gap-3">
              {c.icon
                ? <Icon3D src={c.icon} emoji={c.emoji} className="w-[26px] h-[26px]" />
                : <span className="flex-shrink-0 inline-flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 9, background: '#f1f3f2', fontSize: 13 }}>{c.emoji || '📘'}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: '#23282b' }}>{s.title}</p>
                <p className="truncate" style={{ fontSize: 11.5, color: '#9aa39d' }}>{dLabel(s.starts_at)} · {s.signup_mode === 'rsvp' ? `신청 ${s.registered} · ` : '자유참여 · '}출석 {s.confirmed}{s.instructor ? ` · ${s.instructor} 강사` : ''}</p>
              </div>
              <span className="flex-shrink-0" style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: '#eef0ef', color: '#6a736d' }}>{rate != null ? `${rate}%` : `${s.confirmed}명`}</span>
            </div>
          )
        })}
      </div>

      {sessions.length > 4 && (
        <button type="button" onClick={() => setExpanded(v => !v)}
          className="mt-4 pt-4 w-full flex items-center justify-center gap-1 text-[12.5px] font-semibold text-gray-500 hover:text-gray-700 transition" style={{ borderTop: '1px solid #eef0ef' }}>
          {expanded ? '접기' : `클래스 ${rest}개 더 보기`} <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}

function ModerationCard({ groups, programDays, programId, program }) {
  // 「전체 보기」는 라우트 이동 없이 종료 리포트 위에 신고·숨김 관리 모달을 띄운다
  //   (예전엔 ?opmenu=reports 로 프로그램 페이지로 이동 → 배경/뒤로가기 꼬임. 이제 이 페이지 위 모달).
  const [reportsOpen, setReportsOpen] = useState(false)
  const reporters = groups.flatMap(g => g.reporters)
  const total = reporters.length
  const unresolvedReports = reporters.filter(r => !r.resolved).length
  const acted = groups.filter(g => g.hidden || g.deleted).length
  let sum = 0, n = 0
  for (const r of reporters) {
    if (r.resolved && r.resolved_at) {
      const dt = (new Date(r.resolved_at) - new Date(r.created_at)) / 3_600_000
      if (dt >= 0) { sum += dt; n += 1 }
    }
  }
  const avgH = n > 0 ? sum / n : null
  const fmtH = (h) => (h == null ? '-' : h < 1 ? `${Math.max(1, Math.round(h * 60))}분` : `${Math.round(h)}시간`)

  const Flag = () => (
    <img src="/icons/operator/report-flag.png" alt="" aria-hidden="true" className="flex-shrink-0 object-contain" style={{ width: 26, height: 26 }} />
  )

  // 빈 상태 — 깨끗하게 운영됨(긍정)
  if (total === 0) {
    return (
      <div className="bg-white border border-[#e6e9e6] rounded-card-lg p-5 flex items-center gap-3">
        <Flag />
        <div>
          <h3 className="text-base font-bold text-gray-900 leading-tight">신고 · 제재</h3>
          <p style={{ fontSize: 12, color: '#6a736d', marginTop: 3 }}>접수된 신고가 없어요. 깨끗하게 운영됐어요.</p>
        </div>
      </div>
    )
  }

  const statBoxes = [
    { l: '접수', v: `${total}`, u: '건', s: '전체 신고' },
    { l: '제재', v: `${acted}`, u: '건', s: '숨김·삭제' },
    { l: '미처리', v: `${unresolvedReports}`, u: '건', s: unresolvedReports === 0 ? '없음' : '처리 대기' },
  ]
  // 사유별 분류 — 프리셋 3종 항상 표시(+ 기타는 있을 때). 대표 대상·미처리 집계.
  const groupByKey = new Map(groups.map(g => [`${g.targetType}:${g.targetId}`, g]))
  const OTHER = '기타'
  const catAgg = {}
  const ensureCat = (k) => (catAgg[k] ||= { count: 0, unresolved: 0, targetReports: {} })
  for (const g of groups) {
    const tkey = `${g.targetType}:${g.targetId}`
    for (const r of g.reporters) {
      const cat = REPORT_REASON_PRESETS.includes(r.reason) ? r.reason : OTHER
      const c = ensureCat(cat)
      c.count += 1
      if (!r.resolved) c.unresolved += 1
      c.targetReports[tkey] = (c.targetReports[tkey] || 0) + 1
    }
  }
  const desc = (g) => (g.targetType === 'verification'
    ? `미션 「${g.target?.missions?.title || '삭제된 미션'}」 인증`
    : `커뮤니티 글${g.target?.title ? ` 「${g.target.title}」` : ''}`)
  const catList = [...REPORT_REASON_PRESETS, ...(catAgg[OTHER] ? [OTHER] : [])].map(cat => {
    const c = catAgg[cat] || { count: 0, unresolved: 0, targetReports: {} }
    const tkeys = Object.keys(c.targetReports).sort((a, b) => c.targetReports[b] - c.targetReports[a])
    return { cat, count: c.count, unresolved: c.unresolved, targetCount: tkeys.length, rep: tkeys[0] ? groupByKey.get(tkeys[0]) : null }
  })
  const renderCat = ({ cat, count, unresolved, targetCount, rep }) => {
    const badge = count === 0 ? { t: '해당 없음', warn: false }
      : unresolved > 0 ? { t: '미처리', warn: true }
      : { t: '처리 완료', warn: false }
    return (
      <div key={cat} className="flex items-center gap-3">
        <span className="flex-shrink-0 inline-flex items-center justify-center" style={{ width: 22, height: 22, borderRadius: '50%', background: count > 0 ? '#f1f3f2' : '#f6f7f6', fontSize: 11, fontWeight: 800, color: count > 0 ? '#6a736d' : '#c3cac5' }}>{count}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: count > 0 ? '#23282b' : '#9aa39d' }}>{cat}</p>
          <p className="truncate" style={{ fontSize: 11.5, color: '#9aa39d' }}>
            {count > 0 ? `${desc(rep)}${targetCount > 1 ? ` 외 ${targetCount - 1}건` : ''} · ${count}명 신고` : '접수 없음'}
          </p>
        </div>
        <span className="flex-shrink-0" style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: badge.warn ? '#fef3c7' : '#eef0ef', color: badge.warn ? '#b45309' : (count > 0 ? '#6a736d' : '#a39a8f') }}>{badge.t}</span>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#e6e9e6] rounded-card-lg p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <Flag />
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900 leading-tight">신고 · 제재</h3>
          <p style={{ fontSize: 11, color: '#9aa39d', marginTop: 2 }}>{programDays ? `${programDays}일간 ` : ''}접수 {total}건{avgH != null ? ` · 평균 처리 ${fmtH(avgH)}` : ''}</p>
        </div>
        <span className="ml-auto flex-shrink-0" style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: unresolvedReports === 0 ? '#e7f4ec' : '#fef3c7', color: unresolvedReports === 0 ? '#0f7a52' : '#b45309' }}>
          {unresolvedReports === 0 ? '전건 처리' : `${unresolvedReports}건 미처리`}
        </span>
      </div>

      {/* 3칸 통계 */}
      <div className="grid grid-cols-3 mb-5 pb-5" style={{ borderBottom: '1px solid #eef0ef' }}>
        {statBoxes.map((b, i) => (
          <div key={b.l} style={{ paddingLeft: i > 0 ? 14 : 0, borderLeft: i > 0 ? '1px solid #eef0ef' : 'none' }}>
            <div style={{ fontSize: 10.5, color: '#8a8079', marginBottom: 6 }}>{b.l}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: '#23282b', lineHeight: 1 }}>{b.v}<span style={{ fontSize: 11, color: '#9aa39d', fontWeight: 700 }}>{b.u}</span></div>
            <div style={{ fontSize: 10, color: '#9aa39d', marginTop: 6 }}>{b.s}</div>
          </div>
        ))}
      </div>

      {/* 사유별 분류 (기본 프리셋 3종 + 기타) */}
      <div className="flex flex-col gap-4">
        {catList.map(renderCat)}
      </div>

      {/* 전체 보기 → 신고·숨김 관리 (이 페이지 위 모달) */}
      <button type="button" onClick={() => setReportsOpen(true)}
        className="mt-4 pt-4 w-full flex items-center justify-center gap-1 text-[12.5px] font-semibold text-gray-500 hover:text-gray-700 transition" style={{ borderTop: '1px solid #eef0ef' }}>
        신고 · 숨김 관리에서 전체 보기 <ChevronRight className="w-4 h-4" />
      </button>

      {/* 신고·숨김 관리 모달 — 종료 리포트 위에서 바로 관리. 닫으면(뒤로/배경 탭) 종료 리포트로 복귀. */}
      <Modal isOpen={reportsOpen} onClose={() => setReportsOpen(false)}>
        <div className="p-5">
          <div className="flex items-center gap-1.5 mb-4">
            <button type="button" onClick={() => setReportsOpen(false)} className="p-1 -ml-1 text-gray-500 hover:text-gray-800" aria-label="뒤로">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-1.5">
              <img src="/icons/operator/report-flag.png" alt="" aria-hidden="true" className="w-6 h-6 object-contain" />신고 · 숨김 관리
            </h2>
          </div>
          <ReportsManageSection programId={programId} onNavigate={() => setReportsOpen(false)} returnTo={`/programs/${programId}/report`} />
          {program?.feed_enabled && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <HiddenPostsSection programId={programId} feedEnabled={!!program.feed_enabled} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

// ─── 운영 부하 — 운영자가 들인 수작업(심사·응답·글·댓글). "다음 기수엔 줄일 것" 판단용(있는 데이터만). ───
function OperatorLoadCard({ load }) {
  const fmtHours = (h) => (h == null ? ['-', ''] : h < 1 ? [String(Math.max(1, Math.round(h * 60))), '분'] : [String(Math.round(h)), '시간'])
  const [rv, ru] = fmtHours(load?.avgResponseHours)
  const rows = [
    { label: '심사 처리', value: load ? String(load.reviewCount) : '-', unit: load ? '건' : '' },
    { label: '평균 응답', value: load ? rv : '-', unit: load ? ru : '' },
    { label: '커뮤니티 글', value: load ? String(load.postCount) : '-', unit: load ? '개' : '' },
    { label: '응원 댓글', value: load ? String(load.commentCount) : '-', unit: load ? '개' : '' },
  ]
  return (
    <div className="bg-white border border-[#e6e9e6] rounded-card-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-base font-bold text-gray-900">운영 부하</h3>
        <span className="text-[11px] text-gray-400 ml-auto">다음 기수엔 줄일 것</span>
      </div>
      <div className="flex flex-col gap-3">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between">
            <span style={{ fontSize: 13, color: '#6a736d' }}>{r.label}</span>
            <span style={{ fontSize: 11, color: '#9aa39d' }}>
              <b style={{ fontSize: 16, fontWeight: 800, color: '#23282b' }}>{r.value}</b>{r.unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// 감사 인사 초안 — 커뮤니티 글쓰기에 미리 채울 마무리 공지 (운영자가 다듬어 게시).
function buildThanksDraft(program, report) {
  const done = report.completedUsers.length
  const days = report.programDays
  const body = [
    `${program.name}가 오늘로 마무리됐어요.`,
    '',
    `${days ? `${days}일 동안 ` : ''}함께해주신 ${report.totalParticipants}명, 끝까지 완주하신 ${done}명 모두 정말 고생 많으셨어요! 👏`,
    `함께 쌓은 누적 인증만 ${report.totalVerifications}건이었어요.`,
    '',
    '작은 실천이 모여 큰 변화가 됐습니다. 함께해주셔서 진심으로 감사합니다 🙏',
  ].join('\n')
  return { title: `${program.name} 마무리 인사 🎉`, body }
}

// ─── 다음 액션 ───
function NextActionsCard({ programId, feedEnabled, navigate, onClone, onExport, onThanks }) {
  const [exporting, setExporting] = useState(false)
  const [includeDetail, setIncludeDetail] = useState(false)
  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try { await onExport(includeDetail) } catch (e) { console.error('[리포트 내보내기 실패]', e); alert('리포트 내보내기에 실패했어요. 잠시 후 다시 시도해주세요.') } finally { setExporting(false) }
  }
  return (
    <div className="bg-white border border-[#e6e9e6] rounded-card-lg p-5">
      <h3 className="text-base font-bold text-gray-900 mb-1">수고하셨어요! 다음은?</h3>
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
            onClick={onThanks}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100/70 transition text-left"
          >
            <span className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-800">감사 인사 남기기</p>
              <p className="text-[11px] text-gray-500">마무리 공지 초안을 채워 글쓰기로 바로 이동해요</p>
            </div>
          </button>
        )}
        {/* 리포트 내보내기 — 다중 시트 엑셀(.xlsx) 다운로드 */}
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition text-left disabled:opacity-60"
        >
          <span className="w-9 h-9 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800">{exporting ? '내보내는 중…' : '리포트 내보내기 (엑셀)'}</p>
            <p className="text-[11px] text-gray-500">요약·참여자(개인별)·미션·퀴즈 시트로 저장해요</p>
          </div>
        </button>
        {/* 상세 포함 옵션 — 켜면 참여자별 댓글·퀴즈 답변 시트 2장 추가(파일이 커질 수 있음) */}
        <label className="flex items-start gap-2.5 px-3 py-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeDetail}
            onChange={(e) => setIncludeDetail(e.target.checked)}
            disabled={exporting}
            className="mt-0.5 w-4 h-4 rounded accent-emerald-500 flex-shrink-0"
          />
          <span className="flex-1 min-w-0">
            <span className="block text-[12px] font-medium text-gray-700">댓글·퀴즈 답변 상세 포함</span>
            <span className="block text-[11px] text-gray-400 leading-snug">참여자가 쓴 댓글과 문항별 답을 시트로 추가해요. 활동이 많으면 파일이 커져요.</span>
          </span>
        </label>
      </div>
    </div>
  )
}

export default ProgramEndReportPage
