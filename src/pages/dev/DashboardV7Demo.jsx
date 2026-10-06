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
import { Bell, ChevronRight, Lock, CalendarDays, Users } from 'lucide-react'
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
const ColdStart = ({ nickname, onBrowse, onCreate, onJoinCode, dark = false, scale4 = false }) => {
  const paths = [
    { key: 'browse', icon: ICON.browse, tint: dark ? 'bg-emerald-400/10' : 'bg-emerald-50', title: '프로그램 참여하기', body: '관심 있는 프로그램을 찾아 함께해요' },
    { key: 'create', icon: ICON.create, tint: dark ? 'bg-amber-400/10' : 'bg-amber-50', title: '프로그램 만들기', body: '직접 만들어 사람들과 운영해요' },
  ]
  const onClickOf = { browse: onBrowse, create: onCreate }
  // ⑧(다크)에서도 쓰도록 색만 갈라 둔다 — 구조·문구는 같다
  const c = dark
    ? { hello: 'text-white/60', h1: 'text-white', body: 'text-white/70', card: 'bg-white/[0.07] border border-white/10', title: 'text-white', desc: 'text-white/60', chev: 'text-white/40', link: 'text-emerald-300 decoration-emerald-300/40' }
    : { hello: 'text-gray-500', h1: 'text-gray-900', body: 'text-gray-600', card: 'bg-white shadow-[0_2px_4px_rgba(16,58,42,0.04),0_14px_28px_-14px_rgba(16,58,42,0.22)]', title: 'text-gray-900', desc: 'text-gray-500', chev: 'text-gray-300', link: 'text-emerald-700 decoration-emerald-200' }
  // ⑧ 글자 4단계(24/18/15/12.5)일 때의 크기 — ⑦은 예전 크기 그대로
  const z = scale4
    ? { hello: 'text-[15px]', h1: 'text-[24px]', body: 'text-[15px]', title: 'text-[18px]', desc: 'text-[15px]', link: 'text-[15px]' }
    : { hello: 'text-[13.5px]', h1: 'text-[27px]', body: 'text-[14px]', title: 'text-[16px]', desc: 'text-[13px]', link: 'text-[13.5px]' }
  return (
    <>
      <section className="relative pt-2 pb-1">
        <p className={`${z.hello} font-semibold ${c.hello}`}>{nickname} 님, 반가워요</p>
        <h1 className={`mt-1.5 ${z.h1} font-black leading-[1.25] break-keep ${c.h1}`}>
          건강 습관,<br />여기서 시작해요
        </h1>
        <p className={`mt-2.5 ${z.body} leading-relaxed break-keep max-w-[64%] ${c.body}`}>
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
            className={`w-full flex items-center gap-3.5 rounded-[22px] p-4 text-left active:scale-[0.99] transition ${c.card}`}
          >
            <span className={`shrink-0 w-14 h-14 rounded-2xl ${p.tint} grid place-items-center`}>
              <Ico src={p.icon} className="w-9 h-9 object-contain" />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block ${z.title} font-extrabold ${c.title}`}>{p.title}</span>
              <span className={`block ${z.desc} leading-snug mt-0.5 break-keep ${c.desc}`}>{p.body}</span>
            </span>
            <ChevronRight className={`w-5 h-5 shrink-0 ${c.chev}`} />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onJoinCode}
        className={`self-center ${z.link} font-semibold underline underline-offset-4 py-1 ${c.link}`}
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
function RankRing({ rank, total, dark = false, scale4 = false }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' })
  const R = 30
  const C = 2 * Math.PI * R
  const pct = (rank && total) ? Math.max(0.04, Math.min(1, (total - rank + 1) / total)) : 0
  return (
    <div ref={ref} className={`relative ${scale4 ? 'w-[100px] h-[100px]' : 'w-[84px] h-[84px]'}`}>
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={R} fill="none" stroke={dark ? 'rgba(255,255,255,0.12)' : '#e5e7eb'} strokeWidth="7" />
        <motion.circle cx="40" cy="40" r={R} fill="none" stroke={dark ? '#34d399' : '#10b981'} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: inView ? C * (1 - pct) : C }}
          transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[2px]">
        <span className={`${scale4 ? 'text-[12.5px]' : 'text-[9px]'} font-semibold leading-none whitespace-nowrap ${dark ? 'text-emerald-300' : 'text-emerald-600'}`}>내 랭킹</span>
        <span className={`${scale4 ? 'text-[18px]' : 'text-[15px]'} font-extrabold leading-none whitespace-nowrap ${dark ? 'text-white' : 'text-gray-900'}`}>{rank ? `${rank}등` : '-'}</span>
        <span className={`${scale4 ? 'text-[12.5px]' : 'text-[9px]'} leading-none whitespace-nowrap ${dark ? 'text-white/50' : (scale4 ? 'text-gray-500' : 'text-gray-400')}`}>/ {total || '-'}명</span>
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

// ─── ⑧ 레퍼런스(팝업스토어 앱) 스타일 시안 — 본인 2026-10-05 「이런식으로 한번 만들어 보자」 ─────────────
//   큰 인사 헤드라인(이름 강조) + 모드 토글 → 표지 카드(태그·기간·인원 + 사진 아래 «오늘 할 일» 유리 띠) + 초록 점
//   → 활동 요약/운영 현황 → 점수·랭킹. (캐릭터·3칸 패널·진행 막대 「1/3」은 해 보고 뺐다)
//   /dev/dashboard 기본 = ⑧ 흰색. ?theme=mint 옅은 초록 · ?theme=green 짙은 초록 · ?theme=dark 검정 · ?v=7 이전 시안 ⑦.
const V8_THEME = {
  dark: {
    dark: true,
    page: 'bg-[#0e1311] text-white',
    header: 'bg-[#0e1311]/95',
    headerText: 'text-white',
    icon: 'text-white/80',
    iconBtn: 'hover:bg-white/10',
    ring: 'ring-[#0e1311]',
    strong: 'text-white',
    sub: 'text-white/60',
    faint: 'text-white/50',
    mint: 'text-emerald-300',
    surface: 'bg-[#18201d] border border-white/[0.06]',
    divider: 'bg-white/10',
    track: 'bg-white/15',
    fill: 'bg-white/80',
    titlePill: 'border-amber-200/25 bg-amber-300/10 text-amber-200',
    toggleWrap: 'bg-white/[0.04] border border-white/10',
    toggleOn: 'border-emerald-300 text-emerald-300 font-bold',
    toggleOff: 'border-transparent text-white/55',
    tileBg: { 'bg-emerald-50': 'bg-emerald-400/10', 'bg-sky-50': 'bg-sky-400/10', 'bg-amber-50': 'bg-amber-400/10', 'bg-violet-50': 'bg-violet-400/10' },
    accent: { 'text-emerald-600': 'text-emerald-300', 'text-sky-600': 'text-sky-300', 'text-amber-500': 'text-amber-300' },
  },
  // 짙은 초록 — 검정의 무게 대신 브랜드 초록을 아주 깊게. 위가 조금 밝고 아래로 가라앉는다.
  //   카드·칸은 반투명 흰 유리(어떤 초록 위에서도 같은 깊이로 뜬다). 타일은 색 틴트 대신 같은 유리 — 초록 위 하늘·보라 틴트는 탁해진다.
  green: {
    dark: true,
    page: 'bg-gradient-to-b from-[#0f4436] via-[#0d3a2f] to-[#0b3129] text-white',
    header: 'bg-[#0f4436]/95',
    headerText: 'text-white',
    icon: 'text-white/85',
    iconBtn: 'hover:bg-white/10',
    ring: 'ring-[#0f4436]',
    strong: 'text-white',
    sub: 'text-white/65',
    faint: 'text-white/55',
    mint: 'text-emerald-300',
    surface: 'bg-white/[0.07] border border-white/10',
    divider: 'bg-white/15',
    track: 'bg-white/20',
    fill: 'bg-white/85',
    titlePill: 'border-amber-200/30 bg-amber-300/15 text-amber-200',
    toggleWrap: 'bg-black/15 border border-white/10',
    toggleOn: 'border-emerald-300 text-emerald-300 font-bold',
    toggleOff: 'border-transparent text-white/65',
    tileBg: { 'bg-emerald-50': 'bg-white/[0.07]', 'bg-sky-50': 'bg-white/[0.07]', 'bg-amber-50': 'bg-white/[0.07]', 'bg-violet-50': 'bg-white/[0.07]' },
    accent: { 'text-emerald-600': 'text-emerald-300', 'text-sky-600': 'text-sky-300', 'text-amber-500': 'text-amber-300' },
  },
  // 옅은 초록(기본) — 밝은 바탕이라 글자는 어둡게. 흰 카드·칸이 초록 위에 또렷이 뜬다.
  //   강조색은 emerald-700: 옅은 초록 위 작은 글씨도 명암비 4.5:1 을 넘기게(600 은 모자람). 보조 글씨도 gray-600.
  //   활동 요약 타일은 흰색으로 통일 — 초록 바탕 위 emerald-50 타일은 바탕에 묻힌다.
  mint: {
    dark: false,
    page: 'bg-[#e2f3e8] text-gray-900',
    header: 'bg-[#e2f3e8]/95',
    headerText: 'text-gray-800',
    icon: 'text-gray-600',
    iconBtn: 'hover:bg-black/5',
    ring: 'ring-[#e2f3e8]',
    strong: 'text-gray-900',
    sub: 'text-gray-600',
    faint: 'text-gray-500',
    mint: 'text-emerald-700',
    surface: 'bg-white shadow-soft',
    divider: 'bg-gray-200',
    track: 'bg-black/10',
    fill: 'bg-gray-800',
    titlePill: 'border-amber-200 bg-amber-50 text-amber-700',
    toggleWrap: 'bg-white/60 border border-white',
    toggleOn: 'border-emerald-600 bg-white text-emerald-700 font-bold',
    toggleOff: 'border-transparent text-gray-600',
    tileBg: { 'bg-emerald-50': 'bg-white shadow-soft', 'bg-sky-50': 'bg-white shadow-soft', 'bg-amber-50': 'bg-white shadow-soft', 'bg-violet-50': 'bg-white shadow-soft' },
    accent: { 'text-emerald-600': 'text-emerald-700', 'text-sky-600': 'text-sky-700', 'text-amber-500': 'text-amber-600' },
  },
  light: {
    dark: false,
    page: 'bg-white text-gray-900',
    header: 'bg-white/95',
    headerText: 'text-gray-800',
    icon: 'text-gray-600',
    iconBtn: 'hover:bg-gray-100',
    ring: 'ring-white',
    strong: 'text-gray-900',
    sub: 'text-gray-500',
    faint: 'text-gray-400',
    mint: 'text-emerald-600',
    surface: 'bg-white shadow-elevated',
    divider: 'bg-gray-200',
    track: 'bg-gray-200',
    fill: 'bg-gray-700',
    titlePill: 'border-amber-200 bg-amber-50 text-amber-700',
    toggleWrap: 'bg-white border border-gray-200',
    toggleOn: 'border-emerald-500 text-emerald-700 font-bold',
    toggleOff: 'border-transparent text-gray-500',
    tileBg: { 'bg-emerald-50': 'bg-emerald-50 shadow-soft', 'bg-sky-50': 'bg-sky-50 shadow-soft', 'bg-amber-50': 'bg-amber-50 shadow-soft', 'bg-violet-50': 'bg-violet-50 shadow-soft' },
    accent: {},
  },
}

// 2026-09-15 → 26.9.15 (레퍼런스의 날짜 표기)
const yymd = (d) => { const p = String(d).split('-'); return `${p[0].slice(2)}.${Number(p[1])}.${Number(p[2])}` }

// 패널 칸이 좁아(약 100px) 예정 시각은 짧게 — 「D-1」 / 「3시간 후」 / 「20분 후」
function nextShort(iso) {
  if (!iso) return '-'
  const target = new Date(iso)
  const days = kstDayIndex(target) - kstDayIndex(new Date())
  if (days > 0) return `D-${days}`
  const ms = target - new Date()
  if (ms <= 0) return '곧'
  const h = Math.floor(ms / 3600000)
  return h > 0 ? `${h}시간 후` : `${Math.max(1, Math.floor(ms / 60000))}분 후`
}

// 퀴즈 나누기 — 지금 풀 수 있고 아직 안 낸 것(open) / 시작 전(upcoming, 가까운 순) / 퀴즈가 하나라도 있는 프로그램(has)
function splitQuizzes(quizzes, userId) {
  const now = new Date()
  const open = []
  const upcoming = []
  const has = new Set()
  for (const q of quizzes || []) {
    has.add(q.program_id)
    if (q.start_at && new Date(q.start_at) > now) { upcoming.push(q); continue }
    const mine = (q.quiz_submissions || []).some(s => s.user_id === userId)
    if (!mine && (!q.due_at || new Date(q.due_at) >= now)) open.push(q)
  }
  upcoming.sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
  return { open, upcoming, has }
}

// 클래스는 «몇 시»가 중요하다 — 오늘이면 「19:00」, 내일이면 「내일 19:00」, 그 뒤면 「D-n」
const kstHm = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }).format(d)
function classWhen(iso) {
  const d = new Date(iso)
  const days = kstDayIndex(d) - kstDayIndex(new Date())
  if (days <= 0) return kstHm(d)
  if (days === 1) return `내일 ${kstHm(d)}`
  return `D-${days}`
}

// 다음 일정 — 후보(미션·퀴즈·클래스) 중 시작이 가장 이른 것
const pickNext = (cands) => cands.filter(Boolean).sort((a, b) => new Date(a.at) - new Date(b.at))[0] || null

/** ⑧ 인사 영역 배경 — 잎사귀 민트 일러스트(본인 2026-10-06 제공 → public/illustrations/home-backdrop-leaves.jpg,
 *  흰 테두리·둥근 모서리 바깥은 잘라 냄). 가로로 긴 그림(1.72:1)이고 잎이 네 귀퉁이에 있어서 폭에 «맞춰» 비율 그대로 깐다 —
 *  높이에 맞춰 덮으면(cover) 양옆 잎이 잘려 빈 가운데만 남는다. 헤더 아래에서 시작, 내용 폭(max-w-md) 안에만.
 *  그림 자체가 옅어서 따로 흐리게 하지 않는다. 위는 흰 헤더와 맞닿는 선이 안 보이게, 아래는 흰 바탕으로 녹인다. */
function V8Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[46px]">
      <div className="relative max-w-md mx-auto">
        <img src="/illustrations/home-backdrop-leaves.jpg" alt="" className="block w-full h-auto" />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, #fff 0%, rgba(255,255,255,0) 10%, rgba(255,255,255,0) 60%, #fff 100%)' }}
        />
      </div>
    </div>
  )
}

/** ⑧ 카드 줄 — 한 장씩 꽉 차게 넘기고, 아래 초록 점으로 위치 표시 */
function V8Carousel({ children, t, onIndex }) {
  const [idx, setIdx] = useState(0)
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean)
  const n = items.length
  const onScroll = (e) => {
    const el = e.currentTarget
    const w = el.firstElementChild?.offsetWidth
    if (!w) return
    const i = Math.max(0, Math.min(n - 1, Math.round(el.scrollLeft / (w + 12))))
    if (i !== idx) { setIdx(i); onIndex?.(i) }
  }
  return (
    <div>
      <div onScroll={onScroll} className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide">
        {items}
      </div>
      {/* 위치 표시 — 초록 점(⑦·실제 대시보드와 같은 모양). 진행 막대 + 「1/3」은 해 보고 되돌렸다(본인 2026-10-05). */}
      {n > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5">
          {items.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-4 bg-emerald-500' : `w-1.5 ${t.dark ? 'bg-white/25' : 'bg-gray-300'}`}`} />
          ))}
        </div>
      )}
    </div>
  )
}

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
        .limit(30)   // ⑧ 카드마다 «그 프로그램의» 다음 미션을 찾으려면 가까운 3건으론 모자란다
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
  // ⑧ 띠 「퀴즈」·「다음 일정」 — 참여 중인 프로그램 중 퀴즈를 켠 곳의 퀴즈 «전부»를 한 번에 받아 화면에서 나눈다.
  //   퀴즈 칸 = 지금 풀 수 있고 아직 안 낸 것. 칸 자체는 그 프로그램에 퀴즈가 하나라도 있어야 보인다(본인 2026-10-05).
  //   시작 전 퀴즈는 «다음 일정» 후보.
  const quizProgramIds = useMemo(() => activePrograms.filter(p => p.quiz_enabled === true).map(p => p.id), [activePrograms])
  const { data: allQuizzes = [] } = useQuery({
    queryKey: ['dev-v8-quizzes', userId, quizProgramIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quizzes')
        .select('id, title, program_id, start_at, due_at, quiz_submissions(user_id)')
        .in('program_id', quizProgramIds)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!userId && !showOperator && quizProgramIds.length > 0,
  })
  // ⑧ «다음 일정» 후보 — 클래스를 켠 프로그램의 시작 전 수업(가까운 순)
  const classProgramIds = useMemo(() => activePrograms.filter(p => p.class_feature_enabled === true).map(p => p.id), [activePrograms])
  const { data: upcomingClasses = [] } = useQuery({
    queryKey: ['dev-v8-upcoming-classes', classProgramIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, title, program_id, starts_at')
        .in('program_id', classProgramIds)
        .gt('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(30)
      if (error) throw error
      return data || []
    },
    enabled: !showOperator && classProgramIds.length > 0,
  })
  // 시안 고르기 — 기본 ⑧ 흰색(본인 2026-10-05 「초록 빼고 흰색」). ?theme=mint 옅은 초록 · ?theme=green 짙은 초록 · ?theme=dark 검정 · ?v=7 이전 시안
  const viewParams = new URLSearchParams(location.search)
  const useV7 = viewParams.get('v') === '7'
  const themeKey = viewParams.get('theme')
  const t8 = V8_THEME[['mint', 'green', 'dark'].includes(themeKey) ? themeKey : 'light']
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


  // ─── ⑧ 레퍼런스 스타일(기본 화면). ?v=7 이면 아래 ⑦ 을 그린다 — 훅은 위에서 모두 불렀으므로 여기서 갈라도 안전.
  if (!useV7) {
    const t = t8
    // 사진 아래쪽 유리 띠 — 그 프로그램의 «오늘 할 일»(본인 2026-10-05 「프로그램 사진 안에 녹여낼 수 없을까」).
    //   [오늘 미션] [퀴즈 — 그 프로그램에 퀴즈가 하나라도 있을 때만] [다음 일정 — 미션·퀴즈·클래스 중 가장 가까운 것]
    //   칸을 누르면 그 일로 바로 간다(클래스는 그 수업 상세). 참여중에서만 — 운영자는 「처리할 일」 + 운영 현황.
    //   ?todo=mission|quiz|class — 첫 카드에 값이 있는 상태 미리보기(dev 전용, 그냥 ?todo=1 은 클래스).
    const previewTodo = viewParams.has('todo')
    const quizSplit = splitQuizzes(allQuizzes, userId)
    const stripFor = (p, i) => {
      if (showOperator) return []
      if (previewTodo && i === 0) {
        const kind = viewParams.get('todo')
        const demo = kind === 'mission' ? { label: '다음 미션', value: 'D-1', tab: 'missions' }
          : kind === 'quiz' ? { label: '다음 퀴즈', value: '3시간 후', tab: 'quizzes' }
            : { label: '다음 클래스', value: '19:00', tab: 'classes' }
        return [
          { k: 'mission', label: '오늘 미션', value: '2개', hot: true, onClick: () => navigate(`/programs/${p.id}?tab=missions`) },
          { k: 'quiz', label: '퀴즈', value: '1개', hot: true, onClick: () => navigate(`/programs/${p.id}?tab=quizzes`) },
          { k: 'next', label: demo.label, value: demo.value, onClick: () => navigate(`/programs/${p.id}?tab=${demo.tab}`) },
        ]
      }
      // 끝난 프로그램엔 «오늘 할 일»이 없다 — 「없음」만 늘어선 띠를 세우지 않는다(7일 접힘 전까지 카드는 남는다)
      if (statusOf(p) === STATUS.ended) return []
      const open = visibleMissions.filter(m => m.program_id === p.id)
      const openedToday = todayMissions.some(m => m.program_id === p.id)
      const done = previewState === 'done' || (!previewState && openedToday && open.length === 0)
      const quizzesHere = quizSplit.open.filter(q => q.program_id === p.id)
      const nm = nextOf(p)
      const nq = p.quiz_enabled === true ? quizSplit.upcoming.find(q => q.program_id === p.id) : null
      const nc = p.class_feature_enabled === true ? upcomingClasses.find(s => s.program_id === p.id) : null
      const next = pickNext([
        nm && { at: nm.active_from, label: '다음 미션', value: nextShort(nm.active_from), go: `/programs/${p.id}?tab=missions` },
        nq && { at: nq.start_at, label: '다음 퀴즈', value: nextShort(nq.start_at), go: `/programs/${p.id}?tab=quizzes` },
        nc && { at: nc.starts_at, label: '다음 클래스', value: classWhen(nc.starts_at), go: `/programs/${p.id}?tab=classes&class=${nc.id}` },
      ])
      return [
        {
          k: 'mission', label: '오늘 미션', value: open.length > 0 ? `${open.length}개` : (done ? '완료' : '없음'), hot: open.length > 0,
          onClick: open[0] ? () => navigate(`/programs/${p.id}/missions/${open[0].id}`) : null,
        },
        ...(p.quiz_enabled === true && quizSplit.has.has(p.id) ? [{
          k: 'quiz', label: '퀴즈', value: quizzesHere.length > 0 ? `${quizzesHere.length}개` : '없음', hot: quizzesHere.length > 0,
          onClick: quizzesHere[0] ? () => navigate(`/programs/${p.id}/quiz/${quizzesHere[0].id}`) : null,
        }] : []),
        next
          ? { k: 'next', label: next.label, value: next.value, onClick: () => navigate(next.go) }
          : { k: 'next', label: '다음 일정', value: '없음', onClick: null },
      ]
    }

    return (
      <div className={`relative min-h-screen ${t.page}`}>
        {/* 인사 영역 배경 그림(잎사귀 민트) — 밝은 테마에서만. 첫 화면(콜드스타트)은 자기 새싹 그림이 있어 뺀다 */}
        {!t.dark && !isColdStart && <V8Backdrop />}
        <header className={`sticky top-0 z-30 backdrop-blur-sm ${t.header}`}>
          <div className="max-w-md mx-auto h-[46px] px-4 flex items-center justify-center relative">
            <span className="absolute left-3 text-[12.5px] font-bold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">dev ⑧</span>
            <div className="flex items-center gap-1.5">
              <img src="/app-icon.png" onError={(e) => { e.currentTarget.style.display = 'none' }} alt="" className="w-5 h-5 rounded-md" />
              <span className={`text-[18px] font-bold ${t.headerText}`}>건강증진 플랫폼</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className={`absolute right-3 w-9 h-9 flex items-center justify-center rounded-full transition ${t.iconBtn}`}
              title="알림"
            >
              <Bell className={`w-5 h-5 ${t.icon}`} />
              {unread > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 bg-red-500 text-white text-[12.5px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ${t.ring}`}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          </div>
        </header>

        <div className="relative z-10 w-full max-w-md mx-auto px-4 pt-3 pb-10 flex flex-col gap-5">
          {isColdStart ? (
            <ColdStart
              dark={t.dark}
              scale4
              nickname={nickname}
              onBrowse={() => navigate('/programs')}
              onCreate={() => navigate('/programs/new')}
              onJoinCode={() => navigate('/join')}
            />
          ) : (<>

          {/* 인사 헤드라인 — 이름만 강조색(레퍼런스). 위 줄은 칭호 + 참여중/운영중 전환. 캐릭터(새싹)는 뺐다(본인 2026-10-05). */}
          <section className="relative pt-1">
            {/* 첫 줄 — 칭호(왼쪽) + 참여중/운영중(오른쪽). 전환은 ⑦의 회색 알약 모양·자리로 되돌렸다(본인 2026-10-05). */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border pl-1.5 pr-2.5 py-0.5 text-[12.5px] font-bold ${t.titlePill}`}>
                <Ico src={showOperator ? ICON.trophy : ICON.seed} className="w-4 h-4 object-contain" />
                {title}
              </span>
              {canToggle && (
                <div className={`ml-auto flex rounded-full p-[3px] gap-0.5 shrink-0 ${t.dark ? 'bg-white/10' : 'bg-gray-100'}`}>
                  {[['participant', '참여중'], ['operator', '운영중']].map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => { setMode(k); setSlide(0) }}
                      aria-pressed={effMode === k}
                      className={`px-3 py-1 rounded-full text-[12.5px] transition ${effMode === k ? 'bg-white font-extrabold text-emerald-600 shadow-sm' : (t.dark ? 'text-white/65' : 'text-gray-500')}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <h1 className={`mt-2 text-[24px] font-black leading-[1.3] tracking-[-0.02em] break-keep ${t.strong}`}>
              <span className={t.mint}>{nickname}</span>님이 {showOperator ? '운영하는' : '함께하는'}<br />건강 프로그램
            </h1>
          </section>

          {/* 표지 카드 — 한 장씩. 왼쪽 위 상태 + 누를 수 있는 빨간 알림, 아래 이름 · 기간 · 인원
              (참여 = 새 미션·퀴즈·클래스 / 운영 = 처리할 일). 그 프로그램의 오늘 할 일은 사진 아래쪽 유리 띠에 녹였다(참여중). */}
          {!isActiveLoading && !isMyLoading && visibleList.length === 0 && (
            <p className={`text-[15px] ${t.sub}`}>{showOperator ? '운영 중인 프로그램이 없어요.' : '진행 중인 프로그램이 없어요.'}</p>
          )}
          {visibleList.length > 0 && (
            <V8Carousel key={effMode} t={t} onIndex={setSlide}>
              {visibleList.map((p, i) => {
                const st = statusOf(p)
                const cover = programCoverPath(p)
                const coverUrl = cover ? supabase.storage.from('program-covers').getPublicUrl(cover).data?.publicUrl : null
                const opWait = showOperator ? (opCountsBy[p.id] || 0) : 0
                const badges = showOperator
                  ? (opWait > 0 ? [{ k: 'work', text: `처리할 일 ${opWait}`, onClick: () => navigate(`/programs/${p.id}/operator-today`) }] : [])
                  : newItemsFor(p, i).map(n => ({ k: n.k, text: `새 ${n.label} ${n.n}`, onClick: () => navigate(`/programs/${p.id}?tab=${n.tab}`) }))
                const strip = stripFor(p, i)
                return (
                  <div key={p.id} className="shrink-0 w-full snap-center relative rounded-[24px] overflow-hidden aspect-[6/5] max-h-[300px] bg-[#1d2622]">
                    {coverUrl
                      ? <img src={coverUrl} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
                      : <ProgramCover imagePath={null} categories={p.categories} name={p.name} variant="tile" className="absolute inset-0 w-full h-full" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                    <button
                      type="button"
                      onClick={() => navigate(`/programs/${p.id}`)}
                      className="absolute inset-0 w-full h-full"
                      aria-label={`${p.name || '프로그램'} 열기`}
                    />
                    {/* 왼쪽 위 — 상태(⑦ 원래 모양) + 누를 수 있는 빨간 알림(참여 = 새 미션·퀴즈·클래스 / 운영 = 처리할 일).
                        상태를 사진 아래 태그(D-n)로 옮겨 봤다가 되돌렸다(본인 2026-10-05). */}
                    <div className="absolute left-4 right-4 top-4 flex flex-wrap items-center gap-1.5 pointer-events-none">
                      <span className={`text-[12.5px] font-bold rounded-full px-2.5 py-1 ${st.cls}`}>{st.label}</span>
                      {badges.map(b => (
                        <button
                          key={b.k}
                          type="button"
                          onClick={b.onClick}
                          className="pointer-events-auto rounded-full bg-red-500 px-2.5 py-1 text-[12.5px] font-extrabold text-white shadow-sm"
                        >
                          {b.text}
                        </button>
                      ))}
                    </div>
                    <div className={`absolute inset-x-4 pointer-events-none ${strip.length > 0 ? 'bottom-[78px]' : 'bottom-4'}`}>
                      <p className="text-white text-[18px] font-black leading-tight break-keep line-clamp-2 drop-shadow-sm">{p.name || '이름 없는 프로그램'}</p>
                      <div className="mt-1.5 flex items-center gap-3 text-[12.5px] text-white/80">
                        {p.start_date && p.end_date && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />{yymd(p.start_date)} - {yymd(p.end_date)}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" aria-hidden="true" />{counts[p.id] != null ? `${counts[p.id]}명` : '-'}
                        </span>
                      </div>
                    </div>
                    {/* 유리 띠 — 칸을 누르면 그 일로. 빈 칸은 눌러도 카드(프로그램 열기)로 통과한다. */}
                    {strip.length > 0 && (
                      <div className={`absolute inset-x-3 bottom-3 grid ${strip.length === 3 ? 'grid-cols-3' : strip.length === 2 ? 'grid-cols-2' : 'grid-cols-1'} rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/20 pointer-events-none`}>
                        {strip.map((c, ci) => {
                          const inner = (
                            <>
                              {ci > 0 && <span aria-hidden="true" className="absolute left-0 top-2.5 bottom-2.5 w-px bg-white/25" />}
                              <span className="block text-[12.5px] font-semibold leading-none text-white/75">{c.label}</span>
                              <span className={`block mt-1.5 text-[15px] font-extrabold leading-none tabular-nums ${c.hot ? 'text-emerald-500' : 'text-white'}`}>{c.value}</span>
                            </>
                          )
                          const cls = 'relative min-w-0 px-1 py-2.5 text-center'
                          return c.onClick
                            ? <button key={c.k} type="button" onClick={c.onClick} className={`${cls} pointer-events-auto rounded-2xl active:bg-white/10 transition`}>{inner}</button>
                            : <div key={c.k} className={cls}>{inner}</div>
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </V8Carousel>
          )}

          {/* 접힌 줄 — 종료 뒤 7일 지난 프로그램 */}
          {compressedCount > 0 && (
            <button
              type="button"
              onClick={() => navigate(showOperator ? '/programs?tab=mine' : '/profile/activity')}
              className={`w-full flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left transition active:scale-[0.99] ${t.surface}`}
            >
              <span className={`flex-1 min-w-0 text-[15px] font-bold ${t.strong}`}>종료된 프로그램 {compressedCount}개</span>
              <ChevronRight className={`w-4 h-4 shrink-0 ${t.sub}`} />
            </button>
          )}

          {/* 오늘의 활동 요약 / 운영 현황 — ⑦과 같은 4칸(색만 테마) */}
          {featured && (
            <section>
              <h2 className={`text-lg font-bold mb-3 ${t.strong}`}>{showOperator ? '오늘의 운영 현황' : '오늘의 활동 요약'}</h2>
              <div className="grid grid-cols-4 gap-2.5">
                {summaryMetrics.map((m) => {
                  const highlight = m.inbox && m.value > 0
                  return (
                    <button
                      key={m.label}
                      type="button"
                      onClick={m.onClick}
                      className={`rounded-2xl p-3 flex flex-col items-center text-center transition active:scale-[0.97] ${t.tileBg[m.bg] || m.bg}`}
                    >
                      <img
                        src={m.img}
                        alt=""
                        aria-hidden="true"
                        onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
                        style={m.scale ? { transform: `scale(${m.scale})` } : undefined}
                        className="w-10 h-10 object-contain"
                      />
                      <p className={`mt-2 min-h-[2.5em] flex items-center justify-center text-[12.5px] font-semibold leading-tight text-center break-keep ${t.sub}`}>{m.label}</p>
                      <p className="text-[15px] font-extrabold leading-tight mt-0.5 max-w-full truncate tabular-nums">
                        <span className={highlight ? (t.accent[m.accent] || m.accent) : t.strong}><CountUp value={m.value} duration={1100} /></span>
                        <span className={`text-[12.5px] font-bold ml-0.5 ${t.sub}`}>{m.unit}</span>
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {!showOperator && featured && (
            <section>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className={`text-lg font-bold ${t.strong}`}>내 점수{rankingOn ? ' 및 랭킹' : ''}</h2>
                {rankingOn && (
                  <button type="button" onClick={() => navigate('/rankings')} className={`flex items-center gap-0.5 text-[12.5px] ${t.sub}`}>
                    전체 랭킹<ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className={`rounded-2xl p-4 ${t.surface}`}>
                <div className="flex items-center gap-3">
                  <RankTrophyAnim className="flex-shrink-0 -my-3 -ml-[5px]" />
                  <div className="flex-1 flex items-center justify-around gap-3">
                    <div className="text-center">
                      <p className={`text-[12.5px] font-semibold mb-0.5 ${t.mint}`}>총 점수</p>
                      <p className={`text-[24px] font-extrabold leading-tight ${t.strong}`}>
                        <CountUp value={stats?.totalPoints ?? 0} duration={1100} /><span className={`text-[15px] font-bold ${t.sub}`}> P</span>
                      </p>
                      {stats?.weekPoints > 0 && (
                        <p className={`text-[12.5px] font-semibold mt-0.5 ${t.mint}`}>이번주 ↑{stats.weekPoints}P</p>
                      )}
                    </div>
                    {rankingOn && <RankRing rank={myRank?.current_rank} total={counts[featured.id] ?? null} dark={t.dark} scale4 />}
                  </div>
                </div>
              </div>
            </section>
          )}

          {list.length > 1 && (
            <button
              type="button"
              onClick={() => navigate(showOperator ? '/programs?tab=mine' : '/programs')}
              className={`self-center inline-flex items-center gap-1 text-[15px] font-semibold py-1 ${t.sub}`}
            >
              프로그램 전체 보기 ({list.length})<ChevronRight className="w-4 h-4" />
            </button>
          )}

          </>)}

          <p className={`text-[12.5px] leading-relaxed ${t.faint}`}>
            🔧 dev 전용 시안 ⑧(레퍼런스 스타일). ?todo=mission·quiz·class 할 일 미리보기 · ?theme=mint / green / dark 배경 비교 · ?v=7 이전 시안. 프로덕션 빌드에 포함되지 않습니다.
          </p>
        </div>
      </div>
    )
  }
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
          {/* 숫자 줄 — 운영중만. 참여중의 「29P · 0일 연속」은 뺐다(본인 2026-10-05):
              연속 0 은 끊김을 들추고(퍼소나 4-6) 주 단위 불꽃과 기준이 어긋나며, 29P 는 모든 프로그램을 합친
              «어느 무대의 것도 아닌» 숫자라. 점수는 프로그램 맥락(내 점수 및 랭킹·활동 요약) 안에만 둔다. */}
          {showOperator && (
            <div className="flex gap-3">
              <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-gray-800">
                <Ico src={ICON.programs} className="w-[22px] h-[22px] object-contain" />운영 {myPrograms.length}개
              </span>
              <span className="w-px h-4 bg-gray-300/70 self-center" />
              <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-gray-800">
                <Ico src={ICON.people} className="w-[22px] h-[22px] object-contain" />참여자 {myParticipants}명
              </span>
            </div>
          )}
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
