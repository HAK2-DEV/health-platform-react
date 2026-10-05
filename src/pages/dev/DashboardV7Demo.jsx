/**
 * 🔧 dev 전용 — 대시보드 ⑦ 캐릭터·퀵메뉴 홈 (시안 → 실데이터)
 *
 * 목적: 시안(아티팩트 ⑦)을 «실제 데이터»로 돌려보고 지금 대시보드와 비교한다.
 *   - 라우트 /dev/dashboard 는 import.meta.env.DEV 에서만 등록 → 프로덕션 번들·PWA 사용자에 영향 없음.
 *   - 기존 DashboardPage 는 손대지 않는다. 쿼리(queryKeys)는 그대로 재사용해 캐시를 공유.
 *
 * 구조: 헤더 → 모드(참여중/운영중) → 내 정보 → 배너 캐러셀(미션 → 퀴즈) → 퀵메뉴 6 → 프로그램 카드
 */
import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, ChevronRight, Lock } from 'lucide-react'
import { motion, useInView } from 'framer-motion'
import CountUp from '../../components/common/CountUp'
import FitText from '../../components/common/FitText'
import RankTrophyAnim from '../../components/common/RankTrophyAnim'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import ProgramCover from '../../components/common/ProgramCover'
import { programCoverPath, calcProgress, isEndedBeyondGrace } from '../../lib/programVisuals'
import {
  queryKeys,
  fetchMyPrograms,
  fetchActivePrograms,
  fetchActiveParticipantCounts,
  fetchMyParticipantStats,
  fetchUnreadNotificationsCount,
  fetchTodayMissions,
  fetchTodayCounts,
  fetchParticipantQuizzes,
  fetchProgramOperatorToday,
  fetchMyTodayActivityForProgram,
  fetchMyRankChange,
  fetchProgramsContentTimes,
} from '../../lib/queries'
import { countNew } from '../../lib/newContent'

const ICON = {
  sprout: '/icons/growth/sprout.png',
  seed: '/icons/growth/seed.png',
  point: '/icons/feature/point.png',
  streak: '/icons/feature/streak.png',
  mission: '/icons/feature/mission.png',
  missionCheck: '/icons/feature/mission-check.png',
  quiz: '/icons/feature/quiz.png',
  community: '/icons/feature/community.png',
  attendance: '/icons/feature/attendance.png',
  notice: '/icons/feature/notice.png',
  complete: '/icons/action/complete.png',
  celebrate: '/icons/celebrate/mission.png',
  letter: '/icons/cheer/letter.png',
  report: '/icons/reward/report.png',
  trophy: '/icons/reward/trophy1.png',
  programs: '/icons/profile/programs.png',
  people: '/icons/cheer/people.png',
  review: '/icons/operator/review.png',
  approve: '/icons/operator/approve.png',
  rate: '/icons/operator/rate.png',
  stats: '/icons/feature/stats.png',
  posts: '/icons/mypage/posts.png',
  comments: '/icons/mypage/comments.png',
  browse: '/icons/cta/browse.png',
  create: '/icons/cta/create.png',
}

// 아이콘 경로가 비면 조용히 숨김 (에셋 정리에 따라 경로가 바뀔 수 있음)
const Ico = ({ src, className }) => (
  <img
    src={src}
    alt=""
    aria-hidden="true"
    className={className}
    onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
  />
)

/** 가로 스냅 캐러셀 — 옆 장이 살짝 걸쳐 보이게(넘길 게 있다는 신호) */
// onIndex — 보고 있는 장이 바뀌면 알려 준다(아래 「오늘의 활동 요약/운영 현황」·랭킹이 그 프로그램을 따라가게).
function Carousel({ children, bleed = true, onIndex }) {
  const [idx, setIdx] = useState(0)
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean)
  const single = items.length === 1
  const onScroll = (e) => {
    const el = e.currentTarget
    const first = el.firstElementChild
    if (!first) return
    const i = Math.round(el.scrollLeft / (first.offsetWidth + 10))
    if (i !== idx) { setIdx(i); onIndex?.(i) }
  }
  if (single) return <div className="w-full">{items[0]}</div>

  return (
    <div>
      <div
        onScroll={onScroll}
        className={`flex gap-3 overflow-x-auto pb-0.5 snap-x snap-mandatory ${bleed ? '-mx-3 px-3' : ''}`}
      >
        {items}
      </div>
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {items.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-emerald-500' : 'w-1.5 bg-gray-300'}`} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 화면 상단 배경 — 대시보드의 «인사 배너»와 같은 그림을 쓴다.
 *   users.home_banner_path(본인이 고른 사진) → 없으면 기본 일러스트 /home-header.jpg.
 *   프로그램 표지를 깔던 방식은 접었다(본인 결정 2026-09-23): 홈의 주인은 프로그램이 아니라 «나».
 *   아래로 흰 바탕에 녹아들도록 페이드 + 곡선을 덮는다.
 *   헤더(46px) «아래»에서 시작한다 — 그림이 로고·알림 종 뒤로 들어가 반쯤 겹치던 것을 헤더 띠로 분리(본인 2026-10-05).
 */
const SHOW_SCENERY = false
const Scenery = ({ src, photo }) => (
  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[46px] h-[320px] overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-b from-[#e4f6ec] to-[#f8fbf9]" />
    {src && (
      <img
        src={src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: '70% 38%' }}
      />
    )}
    {/* 본인이 올린 «사진»은 어떤 색이 올지 모르니 흰 베일을 덮어 글자를 지킨다. 기본 일러스트는 이미 밝아 불필요. */}
    {photo && <div className="absolute inset-0 bg-white/45" />}
    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#f8fbf9]/45 to-[#f8fbf9]" />
    {/* 위쪽 흰 페이드 — 헤더의 흰색이 첫 줄(새싹·칭호·모드, 이 상자 기준 12~58px)까지 그대로 이어지고
        그림은 이름 줄부터 드러난다. 그림 윗부분(잎)이 새싹 아이콘 뒤로 겹치던 것(본인 2026-10-05).
        상자를 첫 줄 아래로 내리면 인물 얼굴이 프로그램 카드(≈212px)에 가려져서, 내리는 대신 덮는다. */}
    <div className="absolute inset-x-0 top-0 h-[100px]" style={{ background: 'linear-gradient(to bottom, #fff 0, #fff 58px, rgba(255,255,255,0) 100%)' }} />
    <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 w-full h-[104px]">
      <path d="M0 74 C 90 44, 160 96, 240 72 C 305 53, 350 84, 400 70 L400 120 L0 120 Z" fill="#f8fbf9" />
    </svg>
  </div>
)

/**
 * 콜드스타트 — 참여도 운영도 없는 첫 화면.
 *
 *  설계 판단:
 *   1. 감싸는 흰 카드를 없앴다. 선택지 카드가 «카드 안 카드»가 되어 층이 하나 더 생기던 문제.
 *   2. 위계를 뒤집었다 — 주인공은 이름이 아니라 «여기서 시작해요». 이름은 작은 인사로 내림.
 *   3. 새싹을 헤드라인 옆에 크게 걸쳐 배치. 가운데 정렬 포스터 구도를 피하고 글을 먼저 읽게 한다.
 *   4. 두 갈래는 형태를 같게(대등) 하되 «그림을 다르게» — 아이콘이 같으면 고를 수가 없다.
 */
const ColdStart = ({ nickname, onBrowse, onCreate, onJoinCode }) => {
  const paths = [
    { key: 'browse', icon: ICON.browse, tint: 'bg-emerald-50', title: '프로그램 참여하기', body: '관심 있는 프로그램을 찾아 함께해요' },
    { key: 'create', icon: ICON.create, tint: 'bg-amber-50', title: '프로그램 만들기', body: '직접 만들어 사람들과 운영해요' },
  ]
  const onClickOf = { browse: onBrowse, create: onCreate }
  return (
    <>
      <section className="relative pt-2 pb-1">
        <p className="text-[13.5px] font-semibold text-gray-500">{nickname} 님, 반가워요</p>
        <h1 className="mt-1.5 text-[27px] font-black leading-[1.25] text-gray-900 break-keep">
          건강 습관,<br />여기서 시작해요
        </h1>
        <p className="mt-2.5 text-[14px] leading-relaxed text-gray-600 break-keep max-w-[64%]">
          참여할 수도 있고, 직접 만들어 운영할 수도 있어요.
        </p>
        <Ico
          src={ICON.sprout}
          className="pointer-events-none absolute -right-2 -top-4 w-[132px] h-[132px] object-contain drop-shadow-[0_12px_20px_rgba(16,58,42,0.18)]"
        />
      </section>

      <div className="flex flex-col gap-3">
        {paths.map(p => (
          <button
            key={p.key}
            type="button"
            onClick={onClickOf[p.key]}
            className="w-full flex items-center gap-3.5 rounded-[22px] bg-white p-4 text-left active:scale-[0.99] transition shadow-[0_2px_4px_rgba(16,58,42,0.04),0_14px_28px_-14px_rgba(16,58,42,0.22)]"
          >
            <span className={`shrink-0 w-14 h-14 rounded-2xl ${p.tint} grid place-items-center`}>
              <Ico src={p.icon} className="w-9 h-9 object-contain" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-extrabold text-gray-900">{p.title}</span>
              <span className="block text-[13px] text-gray-500 leading-snug mt-0.5 break-keep">{p.body}</span>
            </span>
            <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onJoinCode}
        className="self-center text-[13.5px] font-semibold text-emerald-700 underline underline-offset-4 decoration-emerald-200 py-1"
      >
        초대 코드로 참여하기
      </button>
    </>
  )
}

// KST 오늘 기준 프로그램 상태 — 시작 전 / 진행중 / 종료.
//   운영 모드에선 임시저장(DRAFT)도 구분한다. 정렬도 이 순서(진행중 → 예정 → 종료)로.
const todayKst = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

const STATUS = {
  draft: { label: '임시저장', cls: 'bg-gray-100 text-gray-500', rank: 3 },
  upcoming: { label: '참여 예정', cls: 'bg-sky-50 text-sky-700', rank: 1 },
  ended: { label: '종료', cls: 'bg-gray-100 text-gray-500', rank: 2 },
  running: { label: '진행중', cls: 'bg-emerald-50 text-emerald-700', rank: 0 },
}

function statusOf(program) {
  if (program?.status === 'DRAFT') return STATUS.draft
  const today = todayKst()
  if (program?.start_date && program.start_date > today) return STATUS.upcoming
  if (program?.end_date && program.end_date < today) return STATUS.ended
  return STATUS.running
}

// 남은 기간 한 줄 — 「D-18」 / 「10월 2일 시작」 / 「9월 1일 종료됨」
function periodLabel(program) {
  const st = statusOf(program)
  const md = (d) => { const p = String(d).split('-'); return `${Number(p[1])}월 ${Number(p[2])}일` }
  if (st === STATUS.upcoming) return `${md(program.start_date)} 시작`
  if (st === STATUS.ended) return program.end_date ? `${md(program.end_date)} 종료됨` : '종료됨'
  if (program?.end_date) {
    const left = Math.max(0, Math.ceil((new Date(`${program.end_date}T23:59:59+09:00`) - new Date()) / 86400000))
    return `${left}일 남음`
  }
  return null
}

// 예정 미션까지 남은 시간 —
//   오늘 시작하면 「2시간 14분 후」(분 단위 카운트다운), 그 뒤면 「D-4」.
//   KST 달력 날짜 기준으로 며칠 뒤인지를 세므로 「내일 오전 9시」는 시각과 무관하게 D-1 이다.
function kstDayIndex(d) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d).split('-')
  return Math.floor(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2])) / 86400000)
}

function startLabel(iso) {
  if (!iso) return '시작 예정'
  const now = new Date()
  const target = new Date(iso)
  const days = kstDayIndex(target) - kstDayIndex(now)
  if (days > 0) return `D-${days}`
  const ms = target - now
  if (ms <= 0) return '곧 시작'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}시간 ${m}분 후` : `${Math.max(1, m)}분 후`
}

// ?state=upcoming 미리보기용 예시 데이터. 시각은 문구로 고정(렌더 중 시계를 읽지 않기 위해).
// ?state=today 미리보기용 — 오늘 활동이 있는 상태
const DEMO_TODAY = { missionCount: 1, postCount: 0, commentCount: 2, points: 15 }

const DEMO_UPCOMING = [{
  id: 'demo-upcoming',
  title: '저녁 스트레칭 10분',
  point: 10,
  icon_path: 'stretching.png',
  active_from: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),   // 모듈 로드 시 1회 — 렌더 중 시계를 읽지 않는다
  program_id: null,
  programs: { name: '탄탄 챌린지' },
}]

// 「새 미션·퀴즈·클래스」 종류 — src = fetchProgramsContentTimes 의 키이자 lib/newContent 의 kind,
//   tab = 그 목록이 열리는 프로그램 탭(열면 markSeen → 배지가 사라진다). 꺼진 기능은 탭이 없으니 세지 않는다.
const NEW_KINDS = [
  { k: 'mission', label: '미션', src: 'missions', tab: 'missions', on: () => true },
  { k: 'quiz', label: '퀴즈', src: 'quizzes', tab: 'quizzes', on: (p) => p.quiz_enabled === true },
  { k: 'class', label: '클래스', src: 'classes', tab: 'classes', on: (p) => p.class_feature_enabled === true },
]

// 내 랭킹 링 — 실제 대시보드(DashboardPage)의 RankRing 을 그대로 옮김.
function RankRing({ rank, total }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' })
  const R = 30
  const C = 2 * Math.PI * R
  const pct = (rank && total) ? Math.max(0.04, Math.min(1, (total - rank + 1) / total)) : 0
  return (
    <div ref={ref} className="relative w-[84px] h-[84px]">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={R} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <motion.circle cx="40" cy="40" r={R} fill="none" stroke="#10b981" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: inView ? C * (1 - pct) : C }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2px]">
        <span className="text-[9px] text-emerald-600 font-semibold leading-none whitespace-nowrap">내 랭킹</span>
        <span className="text-[15px] font-extrabold text-gray-900 leading-none whitespace-nowrap">{rank ? `${rank}등` : '-'}</span>
        <span className="text-[9px] text-gray-400 leading-none whitespace-nowrap">/ {total || '-'}명</span>
      </div>
    </div>
  )
}

const QuickItem = ({ icon, label, tint, onClick, badge = 0 }) => (
  <button type="button" onClick={onClick} className="w-[62px] shrink-0 text-center">
    <span className={`relative w-14 h-14 rounded-[20px] ${tint} grid place-items-center mx-auto mb-1.5`}>
      <Ico src={icon} className="w-8 h-8 object-contain" />
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full grid place-items-center ring-2 ring-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </span>
    <span className="block text-xs font-semibold text-gray-600 leading-tight break-keep">{label}</span>
  </button>
)

function DashboardV7Demo() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()
  const userId = session?.user?.id
  const [mode, setMode] = useState('participant')
  const [slide, setSlide] = useState(0)   // 캐러셀에서 보고 있는 장 — 실제 대시보드처럼 아래 섹션이 이 프로그램을 따른다
  const [picker, setPicker] = useState(null)   // { tab, label } — 퀵메뉴 프로그램 선택 시트
  // 예정 미션 카운트다운 — 1분마다 다시 그린다(값 자체는 렌더 때 계산).
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 60000)
    return () => clearInterval(t)
  }, [])

  const { data: profile } = useQuery({
    queryKey: ['dev-v7-profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('nickname, home_banner_path').eq('id', userId).maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!userId,
  })
  const { data: activePrograms = [], isLoading: isActiveLoading } = useQuery({
    queryKey: queryKeys.activePrograms(userId), queryFn: () => fetchActivePrograms(userId), enabled: !!userId,
  })
  const { data: myPrograms = [], isLoading: isMyLoading } = useQuery({
    queryKey: queryKeys.myPrograms(userId), queryFn: () => fetchMyPrograms(userId), enabled: !!userId,
  })
  const { data: stats } = useQuery({
    queryKey: queryKeys.myParticipantStats(userId), queryFn: () => fetchMyParticipantStats(userId), enabled: !!userId,
  })
  const { data: unread = 0 } = useQuery({
    queryKey: queryKeys.notificationsUnread(userId), queryFn: fetchUnreadNotificationsCount, enabled: !!userId,
  })

  // 콜드스타트 — 참여도 운영도 하나도 없는 상태. 로딩이 끝난 뒤에만 판정(«없어요» 깜빡임 방지)
  //   ?cold=1 로 강제 미리보기 (프로그램이 있어도 콜드스타트 화면을 볼 수 있게 — dev 전용)
  const forceCold = new URLSearchParams(location.search).has('cold')
  const isColdStart = forceCold || (!isMyLoading && !isActiveLoading && myPrograms.length === 0 && activePrograms.length === 0)
  const isOperator = myPrograms.length > 0
  const canToggle = isOperator && activePrograms.length > 0
  const effMode = canToggle ? mode : (isOperator ? 'operator' : 'participant')
  const showOperator = effMode === 'operator'
  const list = useMemo(() => {
    const base = showOperator ? myPrograms : activePrograms
    return [...base].sort((a, b) => statusOf(a).rank - statusOf(b).rank)
  }, [showOperator, myPrograms, activePrograms])
  // 종료 뒤 ENDED_GRACE_DAYS(7일)가 지난 프로그램은 카드 자리를 비우고 한 줄로 접는다 — 실제 대시보드와 같은 규칙.
  //   대표(featured)도 «보이는» 카드에서 고른다. ?ended=N 은 접힌 줄 미리보기(실제로 접힌 게 없을 때 확인용, dev 전용).
  const visibleList = useMemo(() => list.filter(p => !isEndedBeyondGrace(p)), [list])
  const compressedCount = (list.length - visibleList.length) + (Number(new URLSearchParams(location.search).get('ended')) || 0)
  const featured = visibleList[slide] || visibleList[0] || null

  // 「새 미션·퀴즈·클래스」 — 실제 대시보드와 같은 데이터·규칙(fetchProgramsContentTimes + lib/newContent):
  //   그 탭을 마지막으로 본 시각(없으면 참여 시각) 이후 생긴 개수. 그 탭을 열면 사라진다.
  //   참여중에서만 — 운영자에겐 자기가 만든 것이라 «새 소식»이 아니다.
  //   ?new=1 — 첫 카드에 셋 다 1개씩 미리보기(꺼진 기능도 강제로, dev 전용).
  const visibleIds = useMemo(() => visibleList.map(p => p.id), [visibleList])
  const { data: contentTimes } = useQuery({
    queryKey: [...queryKeys.programsContentTimes(visibleIds), userId],
    queryFn: () => fetchProgramsContentTimes(visibleIds, userId),
    enabled: !!userId && !showOperator && visibleIds.length > 0,
  })
  const previewNew = new URLSearchParams(location.search).has('new')
  const newItemsFor = (p, i) => {
    if (showOperator) return []
    if (previewNew && i === 0) return NEW_KINDS.map(k => ({ ...k, n: 1 }))
    const t = contentTimes?.[p.id]
    if (!t) return []
    return NEW_KINDS
      .filter(k => k.on(p))
      .map(k => ({ ...k, n: countNew(t[k.src], p.id, k.src, t.joinedAt) }))
      .filter(k => k.n > 0)
  }

  const ids = useMemo(
    () => [...new Set([...activePrograms.map(p => p.id), ...myPrograms.map(p => p.id)])],
    [activePrograms, myPrograms],
  )
  const { data: counts = {} } = useQuery({
    queryKey: queryKeys.activeParticipantCounts(ids), queryFn: () => fetchActiveParticipantCounts(ids), enabled: ids.length > 0,
  })

  // 오늘의 미션 — 활성 창이 열린 미션 중 오늘 아직 안 한 것
  // 참여 중인 프로그램의 오늘 미션만. (ids 는 운영 프로그램까지 포함하므로 여기 쓰면 안 됨)
  const joinedIds = useMemo(() => activePrograms.map(p => p.id), [activePrograms])
  const { data: todayMissions = [] } = useQuery({
    queryKey: [...queryKeys.todayMissions(userId), joinedIds],
    queryFn: () => fetchTodayMissions(joinedIds),
    enabled: !showOperator && joinedIds.length > 0,
  })
  const { data: todayCounts = {} } = useQuery({
    queryKey: queryKeys.todayCounts(userId), queryFn: () => fetchTodayCounts(userId), enabled: !!userId && !showOperator,
  })
  const openMissions = useMemo(
    () => todayMissions.filter(m => !(todayCounts[m.id]?.total > 0)),
    [todayMissions, todayCounts],
  )
  // 아직 시작 전인 미션(운영자가 미리 만들어 둔 것) — 시작이 가까운 순으로 최대 3건.
  const { data: upcomingMissions = [] } = useQuery({
    queryKey: ['dev-v7-upcoming-missions', joinedIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('missions')
        .select('id, title, point, icon_path, active_from, program_id, programs!inner(name)')
        .in('program_id', joinedIds)
        .gt('active_from', new Date().toISOString())
        .order('active_from', { ascending: true })
        .limit(3)
      if (error) throw error
      return data || []
    },
    enabled: !showOperator && joinedIds.length > 0,
  })

  // 「오늘 열린 미션이 없다」와 「열렸는데 다 했다」는 다른 상황 — 문구가 달라야 한다.
  //   (운영자가 특정 요일만 미션 창을 여는 프로그램이 실제로 있음)
  //   ?state=none  → 「오늘 열린 미션 없음」 / ?state=done → 「전부 완료」 를 강제로 미리보기(dev 전용)
  const previewState = new URLSearchParams(location.search).get('state')
  // ?state=upcoming — 예정 미션 카드를 예시 데이터로 미리보기(실제 예정 미션이 없을 때 확인용)
  const demoUpcoming = previewState === 'upcoming' ? DEMO_UPCOMING : null
  const noMissionToday = previewState === 'none' || previewState === 'upcoming'
    || previewState === 'none' || (previewState !== 'done' && todayMissions.length === 0)
  const allMissionsDone = previewState === 'done' || (previewState !== 'none' && !noMissionToday && openMissions.length === 0)
  const visibleMissions = previewState ? [] : openMissions

  // 퀴즈 — 대표 프로그램에서 아직 제출하지 않은 것(기간 안)
  const { data: quizzes = [] } = useQuery({
    queryKey: queryKeys.participantQuizzes(featured?.id, userId),
    queryFn: () => fetchParticipantQuizzes(featured.id),
    enabled: !showOperator && !!featured?.id,
  })
  const openQuiz = useMemo(() => {
    const now = new Date()
    return quizzes.find(q => !q.mySubmission
      && (!q.start_at || new Date(q.start_at) <= now)
      && (!q.due_at || new Date(q.due_at) >= now)) || null
  }, [quizzes])

  // 배너 장 수 — 1장이면 폭을 꽉 채우고(좌우 여백 = 본문과 동일), 2장 이상일 때만 옆 장을 살짝 보인다.
  const slideCount = Math.min(visibleMissions.length, 3)
    + (visibleMissions.length === 0 ? 1 : 0)
    + (demoUpcoming || upcomingMissions).length
    + (openQuiz ? 1 : 0)
  const slideCls = slideCount > 1 ? 'basis-[calc(100%-40px)]' : 'w-full'

  // 카드마다 「처리할 일 N건」을 보여주려면 프로그램별 집계가 필요하다(심사 대기 + 참여 승인 대기).
  const myIds = useMemo(() => myPrograms.map(p => p.id), [myPrograms])
  const { data: opCountsBy = {} } = useQuery({
    queryKey: ['dev-v7-op-counts', myIds],
    queryFn: async () => {
      const [rev, join] = await Promise.all([
        supabase.from('verifications').select('id, missions!inner(program_id)')
          .in('missions.program_id', myIds).eq('status', 'PENDING_REVIEW'),
        supabase.from('program_participants').select('program_id')
          .in('program_id', myIds).eq('status', 'PENDING'),
      ])
      const out = {}
      for (const r of rev.data || []) { const pid = r.missions?.program_id; if (pid) out[pid] = (out[pid] || 0) + 1 }
      for (const r of join.data || []) out[r.program_id] = (out[r.program_id] || 0) + 1
      return out
    },
    enabled: showOperator && myIds.length > 0,
  })

  // 오늘의 활동 요약 / 내 랭킹 — 대표 프로그램 기준
  const { data: todayAct } = useQuery({
    queryKey: queryKeys.myTodayActivityForProgram(userId, featured?.id),
    queryFn: () => fetchMyTodayActivityForProgram(userId, featured.id),
    enabled: !showOperator && !!userId && !!featured?.id,
  })
  const { data: myRank } = useQuery({
    queryKey: queryKeys.myRankChange(featured?.id, userId),
    queryFn: () => fetchMyRankChange(featured.id),
    enabled: !showOperator && !!featured?.id,
  })

  const { data: opToday } = useQuery({
    queryKey: queryKeys.programOperatorToday(featured?.id),
    queryFn: () => fetchProgramOperatorToday(featured.id),
    enabled: showOperator && !!featured?.id,
  })

  const nickname = profile?.nickname || '반가워요'
  // 인사 배너 사진 — 대시보드와 같은 규칙(본인이 고른 사진 → 기본 일러스트)
  const bannerPath = profile?.home_banner_path || null
  const bannerUrl = bannerPath
    ? supabase.storage.from('profile-avatars').getPublicUrl(bannerPath).data?.publicUrl
    : '/home-header.jpg'
  const streak = stats?.streak || 0
  const points = stats?.totalPoints || 0
  const title = showOperator
    ? `${myPrograms.length}개 운영자`
    : streak >= 30 ? '단단한 러너' : streak >= 7 ? '자라는 러너' : '새싹 러너'
  const myParticipants = Object.entries(counts)
    .filter(([id]) => myPrograms.some(p => p.id === id))
    .reduce((s, [, c]) => s + (c || 0), 0)

  // 퀵메뉴는 «프로그램 하나»를 전제한다. 여러 개면 어디로 갈지 알 수 없으므로,
  //   1개면 바로 이동하고 2개 이상일 때만 선택 시트를 띄운다(선택을 필요한 사람에게만 시킨다).
  const pathFor = (p, tab) => (tab === '__operator'
    ? `/programs/${p.id}/operator-today`
    : `/programs/${p.id}${tab ? `?tab=${tab}` : ''}`)
  // 그 프로그램에서 가장 먼저 열릴 예정 미션 (없으면 null)
  // 오늘의 활동 요약 / 운영 현황 — 실제 대시보드와 같은 타일 정의(이미지·파스텔 배경·시각 보정 scale).
  const goActivity = (tab) => navigate(`/profile/activity/today?tab=${tab}${featured?.id ? `&program=${featured.id}` : ''}`)
  const goOpToday = (t) => featured?.id && navigate(`/programs/${featured.id}/operator-today?tab=${t}`)
  //   ?state=today — 오늘 한 게 있는 상태를 예시로 보기(실제로 0일 때 확인용)
  const actShown = previewState === 'today' ? DEMO_TODAY : todayAct
  const summaryMetrics = showOperator ? [
    { label: '인증 심사', value: opToday?.review ?? 0, unit: '개', img: '/icons/operator/review.png', bg: 'bg-emerald-50', accent: 'text-emerald-600', inbox: true, onClick: () => goOpToday('review') },
    { label: '참여 승인', value: opToday?.join ?? 0, unit: '개', img: '/icons/operator/approve.png', bg: 'bg-sky-50', accent: 'text-sky-600', inbox: true, onClick: () => goOpToday('join') },
    { label: '신고 처리', value: opToday?.report ?? 0, unit: '개', img: '/icons/operator/report.png', bg: 'bg-amber-50', accent: 'text-amber-500', inbox: true, onClick: () => goOpToday('report') },
    { label: '오늘 참여율', value: opToday?.todayRate ?? 0, unit: '%', img: '/icons/operator/rate.png', bg: 'bg-violet-50', onClick: () => goOpToday('rate') },
  ] : [
    { label: '미션 완료', value: actShown?.missionCount ?? 0, unit: '개', img: '/icons/activity/mission.png', bg: 'bg-emerald-50', scale: 1.25, onClick: () => goActivity('missions') },
    { label: '게시물 작성', value: actShown?.postCount ?? 0, unit: '개', img: '/icons/activity/record.png', bg: 'bg-sky-50', scale: 1.85, onClick: () => goActivity('posts') },
    { label: '댓글 활동', value: actShown?.commentCount ?? 0, unit: '개', img: '/icons/activity/comment.png', bg: 'bg-amber-50', scale: 1.45, onClick: () => goActivity('comments') },
    { label: '획득 점수', value: actShown?.points ?? 0, unit: 'P', img: '/icons/activity/point.png', bg: 'bg-violet-50', scale: 0.84, onClick: () => goActivity('points') },
  ]
  const rankingOn = featured?.ranking_enabled !== false

  const nextOf = (p) => (demoUpcoming || upcomingMissions).find(m => m.program_id === p.id || m.program_id === null) || null

  const goProgram = (tab, label) => {
    const l = showOperator ? myPrograms : activePrograms
    if (l.length === 0) { navigate('/programs'); return }
    if (l.length === 1) { navigate(pathFor(l[0], tab)); return }
    setPicker({ tab, label })
  }

  // 참여/운영 중인 프로그램 중 «하나라도 켠» 기능만 퀵메뉴에 띄운다.
  //   (여러 프로그램이면 선택 시트가 그 기능을 켠 프로그램만 보여준다)
  // 퀵메뉴 — 참여자에겐 두지 않는다.
  //   미션 인증은 탭바 +버튼, 퀴즈·커뮤니티·클래스·랭킹은 프로그램 카드 안 바로가기, 내 기록은 마이페이지가 이미 한다.
  //   운영자에게만 남긴다. 단 «심사·승인»은 아래 「오늘의 운영 현황」 타일과 완전히 겹치므로 빼고,
  //   프로그램 안으로 들어가야 하는 «관리 도구»만 둔다.
  const quickItems = useMemo(() => {
    if (!showOperator) return []
    const has = (flag) => list.some(p => p[flag] === true)
    return [
      { key: 'missions', icon: ICON.mission, label: '미션 관리', onClick: () => goProgram('missions', '미션 관리') },
      ...(has('quiz_enabled') ? [{ key: 'quiz', icon: ICON.quiz, label: '퀴즈 관리', onClick: () => goProgram('quiz', '퀴즈 관리') }] : []),
      ...(has('community_enabled') ? [{ key: 'notice', icon: ICON.notice, label: '공지 쓰기', onClick: () => goProgram('community', '공지 쓰기') }] : []),
      { key: 'cheer', icon: ICON.letter, label: '단체 응원', onClick: () => goProgram('cheer', '단체 응원') },
      { key: 'stats', icon: ICON.stats, label: '통계·리포트', onClick: () => goProgram('stats', '통계·리포트') },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, showOperator])


  return (
    <div className="relative min-h-screen bg-[#f8fbf9]">
      {/* 배경 그림 — 본인 2026-10-05 「영 별론데… 뒤에 배경 사진 없애보자」 → 끔. 되돌리려면 true. */}
      {SHOW_SCENERY && <Scenery src={bannerUrl} photo={!!bannerPath} />}
      {/* 상단 헤더 — 실제 대시보드(DashboardPage)와 같은 형태: 가운데 아이콘+「건강증진 플랫폼」, 오른쪽 알림(본인 2026-10-05).
          왼쪽 작은 dev 배지만 다르다(실제 화면과 구분용). */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm">
        <div className="max-w-md mx-auto h-[46px] px-4 flex items-center justify-center relative">
          <span className="absolute left-3 text-[11px] font-bold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">dev ⑦</span>
          <div className="flex items-center gap-1.5">
            <img src="/app-icon.png" onError={(e) => { e.currentTarget.style.display = 'none' }} alt="" className="w-5 h-5 rounded-md" />
            <span className="text-[17px] font-bold text-gray-800">건강증진 플랫폼</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            className="absolute right-3 w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
            title="알림"
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="relative z-10 w-full max-w-md mx-auto px-3 pt-3 pb-10 flex flex-col gap-4">

        {/* 내 정보 — 콜드스타트에선 ColdStart 의 히어로가 대신한다 */}
        {!isColdStart && (
        <div className="flex flex-col gap-2.5">
          {/* 첫 줄 — 참여중/운영중 전환만(둘 다 있을 때만 그린다). 아이콘은 뺐고 칭호는 인사말 앞으로 옮겼다(본인 2026-10-05). */}
          {canToggle && (
            <div className="flex items-center">
              <div className="ml-auto flex bg-gray-100 rounded-full p-[3px] gap-0.5 shrink-0">
                {[['participant', '참여중'], ['operator', '운영중']].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { setMode(k); setSlide(0) }}
                    aria-pressed={effMode === k}
                    className={`px-3 py-1 rounded-full text-[12.5px] transition ${effMode === k ? 'bg-white font-extrabold text-gray-800 shadow-sm' : 'text-gray-500'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-[22px] font-black leading-tight">{nickname} 님</p>
            {/* 칭호 + 인사말 한 줄 — 칭호는 인사말 글자 줄에 맞춰 한 단계 작게.
                좁은 폰·큰 글씨에선 인사말이 칭호 아래로 통째로 내려간다(말줄임 대신). */}
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="inline-flex items-center gap-1 shrink-0 bg-amber-50 text-amber-700 border border-amber-200 rounded-full pl-1 pr-2 py-px text-[12px] font-bold">
                <Ico src={showOperator ? ICON.trophy : ICON.seed} className="w-4 h-4 object-contain" />
                {title}
              </span>
              <p className="text-sm text-gray-500 break-keep">
                {showOperator ? '오늘 처리할 일부터 볼까요?' : '오늘의 활동을 시작할까요?'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            {showOperator ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-gray-800">
                  <Ico src={ICON.programs} className="w-[22px] h-[22px] object-contain" />운영 {myPrograms.length}개
                </span>
                <span className="w-px h-4 bg-gray-300/70 self-center" />
                <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-gray-800">
                  <Ico src={ICON.people} className="w-[22px] h-[22px] object-contain" />참여자 {myParticipants}명
                </span>
              </>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-gray-800">
                  <Ico src={ICON.point} className="w-[22px] h-[22px] object-contain" />{points.toLocaleString()}P
                </span>
                <span className="w-px h-4 bg-gray-300/70 self-center" />
                <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-gray-800">
                  <Ico src={ICON.streak} className="w-[22px] h-[22px] object-contain" />{streak}일 연속
                </span>
              </>
            )}
          </div>
        </div>
        )}

        {isColdStart ? (
          <ColdStart
            nickname={nickname}
            onBrowse={() => navigate('/programs')}
            onCreate={() => navigate('/programs/new')}
            onJoinCode={() => navigate('/join')}
          />
        ) : (<>

        {/* 프로그램 카드 — 표지가 카드를 채우고, 그 위에 «오늘 할 일»을 얹는다.
            표지만 보여주면 예쁘기만 하고 행동이 안 생기고, 미션만 보여주면 어느 프로그램인지 흐려진다. */}
        {/* 전부 접혔을 때(보일 카드 0) — 빈 그림 대신 한 줄. 로딩 중엔 판정하지 않는다(«없어요» 깜빡임 방지). */}
        {!isActiveLoading && !isMyLoading && visibleList.length === 0 && (
          <p className="text-sm text-gray-500">{showOperator ? '운영 중인 프로그램이 없어요.' : '진행 중인 프로그램이 없어요.'}</p>
        )}
        {visibleList.length > 0 && (
        <Carousel key={effMode} bleed={visibleList.length > 1} onIndex={setSlide}>
          {visibleList.map((p, i) => {
            const st = statusOf(p)
            const mine = showOperator
              ? null
              : visibleMissions.filter(m => m.program_id === p.id)
            const cover = programCoverPath(p)
            const coverUrl = cover
              ? supabase.storage.from('program-covers').getPublicUrl(cover).data?.publicUrl
              : null
            const progress = calcProgress(p.start_date, p.end_date)
            const opWait = showOperator ? (opCountsBy[p.id] || 0) : 0
            const newItems = newItemsFor(p, i)
            return (
              <div
                key={p.id}
                className={`shrink-0 ${slideCls} snap-center rounded-[26px] overflow-hidden relative aspect-[4/3] max-h-[250px] bg-gray-100 shadow-[0_2px_4px_rgba(16,58,42,0.04),0_14px_28px_-12px_rgba(16,58,42,0.18)]`}
              >
                {coverUrl
                  ? <img src={coverUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
                  : (
                    <ProgramCover
                      imagePath={null}
                      categories={p.categories}
                      name={p.name}
                      variant="tile"
                      className="absolute inset-0 w-full h-full"
                    />
                  )}
                {/* 글자를 지키는 어둠 — 아래로 갈수록 짙게 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/25 to-black/10" />

                <button
                  type="button"
                  onClick={() => navigate(`/programs/${p.id}`)}
                  className="absolute inset-0 w-full h-full text-left"
                  aria-label={`${p.name} 열기`}
                />

                {/* 왼쪽 위 — 상태 + 「새 미션 N」 등(빨강 = 앱 전체의 NEW 색). 누르면 그 탭으로 바로 가고, 탭을 열면 사라진다. */}
                <div className="absolute left-4 right-4 top-4 flex flex-wrap items-center gap-1.5 pointer-events-none">
                  <span className={`text-[11px] font-bold rounded-full px-2.5 py-1 ${st.cls}`}>
                    {st.label}
                  </span>
                  {newItems.map(n => (
                    <button
                      key={n.k}
                      type="button"
                      onClick={() => navigate(`/programs/${p.id}?tab=${n.tab}`)}
                      className="pointer-events-auto inline-flex items-center rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm"
                    >
                      새 {n.label} {n.n}
                    </button>
                  ))}
                </div>

                <div className="absolute inset-x-4 bottom-4 pointer-events-none">
                  <p className="text-white text-[21px] font-black leading-tight break-keep drop-shadow-sm line-clamp-2">{p.name}</p>
                  <div className="mt-1 flex items-end gap-2">
                    <p className="text-white/85 text-[12.5px] min-w-0 flex-1">
                      {counts[p.id] != null ? `${counts[p.id]}명 참여` : '참여자 집계 중'}
                      {periodLabel(p) ? ` · ${periodLabel(p)}` : ''}
                    </p>
                  {/* 오늘 할 일 — 메타 줄 «오른쪽 끝», 진행률 바 위. */}
                  <div className="pointer-events-auto shrink-0 max-w-[62%] text-right">
                    {showOperator ? (
                      opWait > 0 ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/programs/${p.id}/operator-today`)}
                          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-extrabold text-gray-900"
                        >
                          처리할 일 {opWait}건
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1.5 text-[12.5px] font-bold text-white/90">
                          오늘 처리할 일 없음
                        </span>
                      )
                    ) : mine.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/programs/${p.id}/missions/${mine[0].id}`)}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-extrabold text-gray-900"
                      >
                        <span className="truncate max-w-[150px]">{mine[0].title}</span>
                        <span className="text-emerald-600">인증</span>
                        {mine.length > 1 && (
                          <span className="text-[12px] font-bold text-gray-400">+{mine.length - 1}</span>
                        )}
                      </button>
                    ) : (p.id === featured?.id && openQuiz) ? (
                      <button
                        type="button"
                        onClick={() => navigate(`/programs/${p.id}/quiz/${openQuiz.id}`)}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-extrabold text-gray-900"
                      >
                        <span className="truncate max-w-[150px]">{openQuiz.title}</span>
                        <span className="text-blue-600">풀기</span>
                      </button>
                    ) : nextOf(p) ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-[12.5px] font-bold text-white/90">
                        <Lock className="w-3.5 h-3.5" />
                        다음 미션 {startLabel(nextOf(p).active_from)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1.5 text-[12.5px] font-bold text-white/90">
                        {allMissionsDone ? '오늘 인증 완료' : '오늘 인증할 미션 없음'}
                      </span>
                    )}
                  </div>
                  </div>

                  {p.start_date && p.end_date && (
                    <div className="mt-2.5 h-1.5 rounded-full bg-white/30 overflow-hidden">
                      <span className="block h-full bg-emerald-300 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  )}
                </div>

                {/* 카드 오른쪽 위 바로가기(퀴즈·커뮤니티·클래스·랭킹 동그라미)는 뺐다 — 본인 2026-10-05 「퀵 메뉴도 빼줘」.
                    표지 위에 버튼이 쌓여 그림을 가리고, 같은 곳은 카드를 눌러 들어간 프로그램 탭이 이미 한다. */}
              </div>
            )
          })}
        </Carousel>
        )}

        {/* 접힌 줄 — 종료 뒤 7일이 지난 프로그램. 라벨만(설명은 종료 팝업·리포트가 맡는다, 본인 2026-10-05).
            누르면 기록이 남아 있는 곳으로: 운영자 = 전체 보기(운영중 탭) / 참여자 = 내 기록. */}
        {compressedCount > 0 && (
          <button
            type="button"
            onClick={() => navigate(showOperator ? '/programs?tab=mine' : '/profile/activity')}
            className="w-full flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 shadow-soft text-left active:scale-[0.99] transition"
          >
            <span className="flex-1 min-w-0 text-[13.5px] font-bold text-gray-700">종료된 프로그램 {compressedCount}개</span>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          </button>
        )}

        {/* 퀵메뉴 — 운영자 전용(관리 도구). 참여자에겐 없다. */}
        {quickItems.length > 0 && (
        <div className="flex gap-2.5 overflow-x-auto -mx-3 px-3 pt-2 pb-0.5">
          {quickItems.map(q => (
            <QuickItem
              key={q.key}
              icon={q.icon}
              label={q.label}
              tint="bg-emerald-50"
              badge={q.badge || 0}
              onClick={q.onClick}
            />
          ))}
        </div>
        )}

        {/* 오늘의 활동 요약 / 운영 현황 — 실제 대시보드와 같은 모드별 4칸(본인 2026-10-05 「기존꺼 그대로」).
            보고 있는 카드의 프로그램 기준. 참여중의 한 줄 요약(「오늘 인증 1 · 댓글 2」)은 이 4칸과 겹쳐서 뺐다. */}
        {featured && (
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">{showOperator ? '오늘의 운영 현황' : '오늘의 활동 요약'}</h2>
            <div className="grid grid-cols-4 gap-2.5">
              {summaryMetrics.map((m) => {
                const highlight = m.inbox && m.value > 0
                return (
                  <button
                    key={m.label}
                    type="button"
                    onClick={m.onClick}
                    className={`rounded-2xl p-3 flex flex-col items-center text-center ${m.bg} shadow-soft transition active:scale-[0.97]`}
                  >
                    <img
                      src={m.img}
                      alt=""
                      aria-hidden="true"
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                      style={m.scale ? { transform: `scale(${m.scale})` } : undefined}
                      className="w-10 h-10 object-contain"
                    />
                    <FitText max={14} min={8} className="text-gray-500 font-semibold mt-2 leading-tight text-center" title={m.label}>{m.label}</FitText>
                    <p className="text-[15px] font-extrabold leading-tight mt-0.5 max-w-full truncate tabular-nums">
                      <span className={highlight ? m.accent : 'text-gray-900'}><CountUp value={m.value} duration={1100} /></span>
                      <span className="text-[10px] text-gray-500 font-bold ml-0.5">{m.unit}</span>
                    </p>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {!showOperator && featured && (
          <section className="pt-1">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-lg font-bold text-gray-800">내 점수{rankingOn ? ' 및 랭킹' : ''}</h2>
              {rankingOn && (
                <button type="button" onClick={() => navigate('/rankings')} className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700">
                  전체 랭킹<ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="bg-white rounded-[10px] shadow-elevated p-4">
              <div className="flex items-center gap-3">
                <RankTrophyAnim className="flex-shrink-0 -my-3 -ml-[5px]" />
                <div className="flex-1 flex items-center justify-around gap-3">
                  <div className="text-center">
                    <p className="text-[11px] text-emerald-600 font-semibold mb-0.5">총 점수</p>
                    <p className="text-xl font-extrabold text-gray-900 leading-tight">
                      <CountUp value={stats?.totalPoints ?? 0} duration={1100} /><span className="text-sm text-gray-500 font-bold"> P</span>
                    </p>
                    {stats?.weekPoints > 0 && (
                      <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">이번주 ↑{stats.weekPoints}P</p>
                    )}
                  </div>
                  {rankingOn && <RankRing rank={myRank?.current_rank} total={counts[featured.id] ?? null} />}
                </div>
              </div>
            </div>
          </section>
        )}

        {list.length > 1 && (
          <button
            type="button"
            onClick={() => navigate(showOperator ? '/programs?tab=mine' : '/programs')}
            className="self-center inline-flex items-center gap-1 text-[13px] font-semibold text-gray-500 py-1"
          >
            프로그램 전체 보기 ({list.length})<ChevronRight className="w-4 h-4" />
          </button>
        )}

        </>)}

        {picker && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
            <button type="button" aria-label="닫기" onClick={() => setPicker(null)} className="absolute inset-0 bg-black/35" />
            <div className="relative w-full max-w-md bg-white rounded-t-[26px] p-4 pb-6">
              <p className="text-[15px] font-extrabold text-gray-900">
                {picker.label} — 어느 프로그램인가요?
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {(showOperator ? myPrograms : activePrograms).map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setPicker(null); navigate(pathFor(p, picker.tab)) }}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 text-left"
                  >
                    <span className="w-11 h-11 rounded-xl overflow-hidden shrink-0">
                      <ProgramCover imagePath={programCoverPath(p)} categories={p.categories} name={p.name} variant="thumb" className="w-11 h-11" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-bold truncate">{p.name}</span>
                      <span className="block text-[12.5px] text-gray-500 mt-0.5">{statusOf(p).label}{periodLabel(p) ? ` · ${periodLabel(p)}` : ''}</span>
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="text-[11px] text-gray-400 leading-relaxed">
          🔧 dev 전용 화면입니다. 실제 대시보드(/dashboard)는 그대로이며, 이 라우트는 프로덕션 빌드에 포함되지 않습니다.
        </p>
      </div>
    </div>
  )
}

export default DashboardV7Demo
