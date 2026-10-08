/**
 * 🔧 dev 전용 — 프로그램 상세 «표준 카드홈» 시안 캔버스 (2026-10-06)
 *
 * 목적: 실제 상세 화면(ProgramDetailPage → ProgramHome)의 구조를 «그대로» 한 화면에 펼쳐 놓고 손보기 위함.
 *   - 카드홈은 사본(ProgramHomeDev)을 쓴다 → 여기서 고쳐도 실제 화면은 그대로.
 *   - 히어로(표지·이름·상태·여정·참여자·운영자)는 실제 프로그램 데이터. ?id= 로 고르고, 없으면 내가 참여 중인 카드홈 프로그램.
 *   - 칸은 전부 보이게 예시 값을 채운다(실제 화면에선 데이터가 없으면 그 칸이 숨는다). 조건부 배너도 함께 펼친다.
 *   - 회색 작은 글씨(⤷)는 «언제 보이는지» 표시. ?clean=1 이면 표시와 조건부 배너를 빼고 참여자가 보는 모습만.
 *   - 메뉴 칸·오늘의 미션을 누르면 실제 프로그램 화면의 그 탭으로 간다.
 *   - 라우트 /dev/program 은 import.meta.env.DEV 에서만 등록 → 프로덕션 번들에 없다.
 *
 * 실제 화면: 「오늘 할 일」 부품·데이터는 components/program/TodayTodoCard · lib/todayTodo 로 옮겼다(2026-10-08).
 *   상세 화면(ProgramDetailPage)에선 로컬 dev 서버에서만 ?todo=full 로 켜 본다 — 배포 기본은 «다시 인증» 카드만.
 * 실제로 켤 때(배포 결정 뒤) 같이 할 일 — 메모리 project_program_detail_cardhome_redesign 참고
 *   ① 운영자 설정의 「진행 현황 보이기」 토글(overview_progress_enabled) 감추기 — 칸이 없어지면 할 일이 없다(본인: 나중에)
 *   ② 개요 편집 목록(HOME_BOX_ORDER·LABELS·SIZES)에서 todayMissions·progress·recent 빼기 — 저장된 순서에 남아 있어도 없는 칸은 건너뛴다
 *   ③ 「오늘 N명이 인증했어요」 정확한 집계는 서버 함수(마이그) — 지금은 참여자가 볼 수 있는 인증 범위로 셈
 */
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import ProgramHomeDev from './ProgramHomeDev'
import TodayTodoCard from '../../components/program/TodayTodoCard'
import { useTodayTodo, TODO_DEMO } from '../../lib/todayTodo'
import ActivityTrendCard from '../../components/program/ActivityTrendCard'
import ClassOverviewCard from '../../components/program/ClassOverviewCard'
import OperatorTodoBanner from '../../components/program/OperatorTodoBanner'
import OperatorAtRiskBanner from '../../components/program/OperatorAtRiskBanner'
import OperatorMilestoneCard from '../../components/program/OperatorMilestoneCard'
import DoorIcon from '../../components/common/DoorIcon'
import { calcProgress, progressUrgency } from '../../lib/programVisuals'
import { isUpcomingByStartDate } from '../../lib/formatters'
import { queryKeys, fetchActivePrograms, fetchActiveParticipantCounts } from '../../lib/queries'

// 칸을 전부 보이게 채우는 예시 값 — 실제 화면에선 각각 공지·인증 기록·미션 데이터가 들어간다
const SAMPLE = {
  notice: '이번 주 토요일 오전 9시, 한강공원에서 단체 걷기가 있어요',
  metrics: [
    { emoji: '👣', label: '걸음', value: '52,340', unit: '보' },
    { emoji: '⏱️', label: '운동 시간', value: '6:30', unit: '' },
    { emoji: '🏃', label: '달성', value: '12', unit: '회' },
  ],
  streak: { count: 3, days: ['월', '화', '수', '목', '금', '토', '일'].map((label, i) => ({ label, done: i < 3, today: i === 2 })) },
}

// 히어로 여정 문구 — 실제 상세 화면과 같은 계산(「D+18 · 90일 여정」). 시계는 여기서만 읽는다.
function journeyOf(start, end) {
  if (!start) return ''
  const s = new Date(start)
  const dplus = Math.max(0, Math.floor((Date.now() - s.getTime()) / 86400000))
  const tot = end ? Math.max(1, Math.round((new Date(end).getTime() - s.getTime()) / 86400000)) : null
  return tot ? `D+${dplus} · ${tot}일 여정` : `D+${dplus}`
}

// «언제 보이는지» 표시 — ?clean=1 이면 감춘다(렌더 밖에 둬서 매번 새 부품이 되지 않게)
const Cond = ({ clean, children }) => (clean ? null : (
  <p className="px-1 -mb-1 text-[11px] font-semibold text-gray-400">⤷ {children}</p>
))

function ProgramDetailDemo() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const userId = session?.user?.id
  const params = new URLSearchParams(location.search)
  const clean = params.has('clean')

  // 어느 프로그램을 그릴지 — ?id= 우선, 없으면 내가 참여 중인 «표준 카드홈» 프로그램
  const { data: activePrograms = [] } = useQuery({
    queryKey: queryKeys.activePrograms(userId), queryFn: () => fetchActivePrograms(userId), enabled: !!userId,
  })
  const isStdCardHome = (p) => p.card_home === true && p.theme !== 'RUNNING' && p.theme !== 'QUIT_SMOKING' && p.categories?.[0] !== 'DIET'
  const pickId = params.get('id') || activePrograms.find(isStdCardHome)?.id || activePrograms[0]?.id || null

  const { data: program, isLoading } = useQuery({
    queryKey: ['dev-program-home', pickId],
    queryFn: async () => {
      const { data, error } = await supabase.from('programs').select('*').eq('id', pickId).maybeSingle()
      if (error) throw error
      if (!data) return null
      const { data: owner } = await supabase.from('users').select('nickname').eq('id', data.owner_id).maybeSingle()
      return { ...data, owner_nickname: owner?.nickname || null }
    },
    enabled: !!pickId,
  })
  const { data: counts = {} } = useQuery({
    queryKey: queryKeys.activeParticipantCounts(pickId ? [pickId] : []),
    queryFn: () => fetchActiveParticipantCounts([pickId]),
    enabled: !!pickId,
  })

  // 「오늘 할 일」 실데이터 — 훅이라 아래 조기 반환보다 먼저(실제 상세 화면과 같은 훅)
  const todo = useTodayTodo({ programId: program?.id, userId, ownerName: program?.owner_nickname || null, quizEnabled: program?.quiz_enabled !== false })

  if (!pickId || isLoading || !program) {
    return (
      <div className="px-4 pt-10 text-center text-sm text-gray-500">
        {pickId && isLoading ? '불러오는 중…' : '그릴 프로그램이 없어요. 주소에 ?id=프로그램ID 를 붙여 주세요.'}
      </div>
    )
  }

  const go = (q) => navigate(`/programs/${program.id}${q}`)
  // 실제 상세 화면과 같은 계산 — 상태 라벨·여정 문구
  const ended = progressUrgency(calcProgress(program.start_date, program.end_date)).urgency === 'ended'
  const statusLabel = program.status === 'DRAFT' ? '임시저장'
    : ended ? '종료'
      : (program.status === 'PUBLISHED' && isUpcomingByStartDate(program.start_date)) ? '예정'
        : '진행중'
  const journeyText = journeyOf(program.start_date, program.end_date)
  const yy = (d) => (d || '').replace(/-/g, '.')

  const viewerSlot = clean ? null : (
    <>
      <Cond clean={clean}>조건부 · 둘러보는 중(비참여자)일 때만 — 승인 대기면 노란 「승인 대기 중」, 운영자 임시저장이면 「완료하기」로 바뀜</Cond>
      <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
        <span className="text-xl flex-shrink-0">👀</span>
        <p className="flex-1 min-w-0 text-xs text-emerald-800 leading-snug">
          <span className="font-bold">둘러보는 중이에요.</span> 참여하면 인증·작성·랭킹 참여가 가능해요.
        </p>
        <span className="flex-shrink-0 px-3 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-xs font-semibold rounded-full">
          참여 신청하기
        </span>
      </div>
    </>
  )
  const activationSlot = clean ? null : (
    <>
      <Cond clean={clean}>조건부 · 운영자에게만 — 성취(마일스톤) · 할 일 · 이탈 위험</Cond>
      <OperatorMilestoneCard programId={program.id} participantCount={10} verificationCount={50} onClick={() => {}} />
      <OperatorTodoBanner approve={1} review={2} onApprove={() => {}} onReview={() => {}} />
      <OperatorAtRiskBanner count={3} thresholdDays={3} onRemind={() => {}} onList={() => {}} />
    </>
  )
  // 오늘 할 일(본인 레퍼런스 2장, 2026-10-06) — 실제 데이터(내 미션 · 심사 중 인증 · 퀴즈).
  //   할 일이 없거나 ?todo=demo 면 레퍼런스대로 예시. ?clean=1(참여자 모습)에선 예시로 채우지 않는다 — 없으면 칸이 안 보인다.
  const forceDemo = params.get('todo') === 'demo'
  const useDemo = forceDemo || (!clean && todo.items.length === 0)
  const todayActionSlot = (clean && !forceDemo && todo.items.length === 0) ? null : (
    <div className="flex flex-col gap-1">
      <Cond clean={clean}>{useDemo
        ? (forceDemo ? '예시(?todo=demo) — 레퍼런스 3건 + 반려(다시 확인) 1건' : '예시 — 이 계정은 오늘 할 일이 없어 예시로 채움')
        : '실제 데이터 — 다시 확인(반려 24시간) · 내 미션 · 심사 중인 인증 · 퀴즈'}</Cond>
      <TodayTodoCard
        items={useDemo ? TODO_DEMO.items : todo.items}
        verifierCount={useDemo ? TODO_DEMO.verifierCount : todo.verifierCount}
        onGo={(path) => { if (path === 'feed') go('?tab=community'); else if (path) navigate(path) }}
      />
    </div>
  )
  const activitySlot = (
    <div className="flex flex-col gap-1">
      <Cond clean={clean}>참여 중인 참여자에게만(운영자·둘러보기·시작 전엔 없음)</Cond>
      <ActivityTrendCard
        programId={program.id}
        userId={userId}
        todayState="open"
        ended={ended}
        onCertify={() => go('?tab=missions')}
        quizEnabled={program.quiz_enabled !== false}
        communityEnabled={program.community_enabled !== false && program.feed_enabled !== false}
      />
    </div>
  )
  const classSlot = (
    <div className="flex flex-col gap-1">
      <Cond clean={clean}>조건부 · 클래스 기능을 켠 프로그램만</Cond>
      <ClassOverviewCard programId={program.id} onOpenAll={() => go('?tab=classes')} />
    </div>
  )

  return (
    <div className="px-[11px] pt-2 pb-6 max-w-4xl mx-auto">
      <ProgramHomeDev
        programName={program.name}
        startDate={yy(program.start_date)}
        endDate={yy(program.end_date)}
        progress={calcProgress(program.start_date, program.end_date)}
        statusLabel={statusLabel}
        coverImagePath={program.cover_image_path}
        categories={program.categories}
        participantCount={counts[program.id] ?? null}
        journeyText={journeyText}
        ownerName={program.owner_nickname}
        notice={SAMPLE.notice}
        metrics={SAMPLE.metrics}
        boxOrder={null}
        hiddenBoxes={[]}
        streakData={SAMPLE.streak}
        // 나의 진행 현황 칸은 뺐다 — 활동 일수·포인트는 「내 활동」, 진행 막대는 히어로 「D+N · M일 여정」이 이미 보여 주고,
        //   남는 참여율 %는 새 참여자에겐 0%, 쉰 사람에겐 끊김을 들추는 숫자(본인 2026-10-06)
        activitySlot={activitySlot}
        todayActionSlot={todayActionSlot}
        viewerSlot={viewerSlot}
        activationSlot={activationSlot}
        classSlot={classSlot}
        // 오늘의 미션 칸은 뺐다 — 「오늘 할 일」이 같은 미션(인증·완료)에 심사 중·퀴즈까지 다 보여 준다(본인 2026-10-06)
        // 최근 인증 기록 칸은 뺐다 — 눌러도 아무 일이 없고, 심사 중·오늘 승인은 「오늘 할 일」, 지난 기록은 마이페이지 「내 기록」에 있다(본인 2026-10-06)
        homeHero={program.home_hero}
        homeGoal={program.home_goal}
        ownerId={program.owner_id}
        editable={false}
        onBack={() => navigate(-1)}
        quizEnabled
        communityEnabled
        rankingEnabled
        onOpenTab={(key) => go(`?tab=${key}`)}
        onRecord={() => go('?tab=missions')}
        onNotice={() => go('?tab=community')}
      />

      {/* 맨 아래 — 실제 상세 화면은 카드홈 «밖»(페이지)에 둔다 */}
      <div className="text-center mt-4 mb-6">
        <Cond clean={clean}>조건부 · 자유 참여 프로그램의 참여자만</Cond>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 mt-2">
          <DoorIcon className="w-6 h-6 text-red-500" />
          <span className="underline underline-offset-2">이 프로그램에서 나가기</span>
        </span>
      </div>

      <p className="text-[11px] text-gray-400 leading-relaxed px-1">
        🔧 dev 전용 시안 — 실제 상세 화면(표준 카드홈) 구조를 그대로 펼친 것. 공지·주간 스트릭·주요 기록은 예시 값(오늘의 미션·나의 진행 현황·최근 인증 기록 칸은 뺌).
        ?id=프로그램ID 로 다른 프로그램 · ?clean=1 표시·조건부 배너 숨김. 프로덕션 빌드에 포함되지 않습니다.
      </p>
    </div>
  )
}

export default ProgramDetailDemo
