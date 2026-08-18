import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { Bell, ChevronRight } from 'lucide-react'
import { supabase } from '../supabaseClient'
import ProgramDetailModal from '../components/program/ProgramDetailModal'
import ProgramBrowseModal from '../components/program/ProgramBrowseModal'
import WelcomeOperatorModal from '../components/program/WelcomeOperatorModal'
import ProgramCover from '../components/common/ProgramCover'
import { countNew } from '../lib/newContent'
import { Reveal } from '../components/program/statsAnim'
import CountUp from '../components/common/CountUp'
import FitText from '../components/common/FitText'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'
import InviteHintCard from '../components/common/InviteHintCard'
import RankTrophyAnim from '../components/common/RankTrophyAnim'
import { calcProgress, progressUrgency } from '../lib/programVisuals'
import {
  queryKeys,
  fetchMyPrograms,
  fetchActivePrograms,
  fetchActiveParticipantCounts,
  fetchPublicPrograms,
  fetchUnreadNotificationsCount,
  fetchMyParticipantStats,
  fetchMyTodayActivityForProgram,
  fetchProgramsContentTimes,
  fetchMyRankChange,
  fetchProgramOverview,
  fetchProgramOperatorToday,
} from '../lib/queries'

// 채워진(solid) 통계 아이콘 — fill=currentColor 라 text-* 로 색 (heroicons solid, MIT)
const UsersSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z" />
  </svg>
)
const CalendarSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Z" />
  </svg>
)

// 대시보드 프로그램 캐러셀 카드 (2026-07-16 목업).
//   표지가 우측에서 흘러나오고 좌측은 흰 그라데이션으로 덮어 글자 가독성 확보.
//   상태별 변형 — 진행중: 진행률 막대 / 준비중(시작 전): 진행률 0% 는 무의미하므로 기간 날짜.
//   지표는 참여자·남은 기간 2개만 (오늘 참여율·누적 인증은 프로그램 통계에서).
export function ProgramSlideCard({ program, participants, onClick, active = false, newMission = 0, newQuiz = 0, newClass = 0 }) {
  const newTotal = newMission + newQuiz + newClass
  const progress = calcProgress(program.start_date, program.end_date)
  const urg = progressUrgency(progress)
  const todayKst = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const notStarted = !!program.start_date && program.start_date > todayKst
  const daysLeft = program.end_date
    ? Math.max(0, Math.ceil((new Date(`${program.end_date}T23:59:59+09:00`) - new Date()) / 86400000))
    : null
  const status = program.status === 'DRAFT'
    ? { label: '임시저장', cls: 'bg-gray-100 text-gray-500' }
    : notStarted
      ? { label: '준비중', cls: 'bg-sky-100 text-sky-700' }
      : urg.urgency === 'ended'
        ? { label: '종료', cls: 'bg-gray-200 text-gray-600' }
        : { label: '진행중', cls: 'bg-emerald-100 text-emerald-700' }
  const md = (d) => { const p = d.split('-'); return `${Number(p[1])}/${Number(p[2])}` }
  // 기간이 없는 상시 프로그램은 진행률이 늘 0% 라 막대가 거짓 정보 → 아예 표시하지 않음
  const hasPeriod = !!(program.start_date && program.end_date)
  const ended = hasPeriod && urg.urgency === 'ended'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full h-[144px] rounded-2xl overflow-hidden bg-white border-2 shadow-elevated text-left transition-colors ${
        active ? 'border-emerald-200' : 'border-gray-100'
      }`}
    >
      {/* 표지 — 우측에서 흘러나옴.
          ⚠️ ProgramCover 는 루트에 position:relative 를 하드코딩해서, className 으로 absolute 를
          줘도 Tailwind 의 position 유틸 생성 순서상 relative 가 이긴다(= 표지가 흐름에 남아
          본문을 밀어냄). 그래서 위치는 래퍼가 잡고 ProgramCover 는 안을 채우기만 한다.
          variant='tile' 사용 — thumb 의 rounded-xl·aspect-square·objectPosition 간섭을 피함.
          w-full+h-full 로 두 축이 확정되면 variant 의 aspect 는 무시된다. */}
      {/* 표지 왼쪽 끝을 마스크로 투명 처리 → 흰 카드 배경으로 '녹아들게' 한다.
          흰색을 위에 덮던 기존 방식은 어두운 사진에서 안개처럼 뿌옇게 떠서 경계가 도드라졌음.
          마스크는 사진 밝기와 무관하게 경계선 없이 매끄럽게 이어진다(목업과 동일한 느낌).
          래퍼 폭을 52%로 넓혀(본문 폭과 겹침) 사진이 카드 중앙까지 서서히 스며들 공간 확보. */}
      <div
        className="absolute inset-y-0 right-0 w-[52%] overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to right, transparent 0%, #000 42%)',
          WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 42%)',
        }}
      >
        <ProgramCover
          imagePath={program.cover_image_path}
          categories={program.categories}
          name={program.name}
          variant="tile"
          className="w-full h-full"
        />
      </div>

      {/* 본문 폭 + 표지 폭이 100% 를 넘으면 진행률 바가 표지를 침범한다 → 52% + 48% 로 분리 */}
      <div className="relative h-full w-[52%] p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center px-2 h-[20px] rounded-md text-[10px] font-bold whitespace-nowrap flex-shrink-0 ${status.cls}`}>
              {status.label}
            </span>
            {newTotal > 0 && (
              <span className="inline-flex items-center px-1.5 h-[20px] rounded-md bg-red-500 text-white text-[10px] font-extrabold flex-shrink-0">NEW {newTotal}</span>
            )}
          </div>
          <h3 className="text-[17px] font-extrabold text-gray-900 truncate leading-tight mt-1.5">{program.name}</h3>
          {newTotal > 0 && (
            <p className="text-[10px] font-bold text-red-500 mt-0.5 truncate">
              {[newMission > 0 && `새 미션 ${newMission}`, newQuiz > 0 && `새 퀴즈 ${newQuiz}`, newClass > 0 && `새 클래스 ${newClass}`].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>

        {program.status === 'DRAFT' ? (
          <p className="text-[13px] font-semibold text-gray-500">{hasPeriod ? `${md(program.start_date)}~${md(program.end_date)}` : '작성 미완성'}</p>
        ) : !hasPeriod ? (
          <p className="text-[13px] font-semibold text-gray-500">상시 운영</p>
        ) : notStarted ? (
          <p className="text-[13px] font-semibold text-gray-500">{`${md(program.start_date)}~${md(program.end_date)}`}</p>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${urg.barCls || 'bg-emerald-400'}`}
                initial={{ width: 0 }}
                whileInView={{ width: `${progress}%` }}
                viewport={{ once: true, margin: '0px 0px -12% 0px' }}
                transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
              />
            </div>
            <span className={`text-[15px] font-extrabold flex-shrink-0 ${urg.textCls || 'text-emerald-600'}`}>{progress}%</span>
          </div>
        )}

        {/* 캐러셀(86% 폭)에선 본문이 좁아 줄바꿈되므로 nowrap + 11px 로 한 줄 유지 */}
        <div className="flex items-center gap-1.5 text-[11px] text-gray-600 font-semibold">
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <UsersSolid className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {participants != null ? `${participants}명 참여` : '-'}
          </span>
          <span className="w-px h-3 bg-gray-200 flex-shrink-0" />
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <CalendarSolid className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {program.status === 'DRAFT' ? '작성 중' : ended ? '종료됨' : daysLeft != null ? `${daysLeft}일 남음` : '상시'}
          </span>
        </div>
      </div>
    </button>
  )
}

// 섹션 카드 — 모서리 10px, 제목 + 우측 액션. 진입 시 아래에서 살짝 떠오름(stagger).
// 카드는 항상 보임(페이드인 없음) — 깜빡임 방지. 모션은 내부 숫자·바·링만 (마이페이지와 동일).
function SectionCard({ title, action, children, className = '' }) {
  return (
    <section
      className={`bg-white rounded-[10px] shadow-elevated p-4 ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title && <h2 className="flex items-center gap-1.5 text-lg font-bold text-gray-800">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// 운영중/참여중 콘텐츠를 좌우로만 밀어내는 캐러셀 — 카드 프레임은 그대로, 안쪽만 슬라이드.
//   하단 CTA처럼 "새 내용이 옆에서 미끄러져 들어와 멈춤". 이전 내용은 슬라이드로 나가지 않고 바로 교체.
//   AnimatePresence 없이 key 만 바꿔 새 motion.div 가 initial→animate 로 들어옴.
//   dir===0(첫 로드, 토글 전)일 땐 슬라이드 없이 그대로(섹션 등장 모션만).
function ModeSlide({ mode, dir, children }) {
  return (
    <div className="overflow-hidden">
      <motion.div
        key={mode}
        initial={{ x: dir === 0 ? 0 : (dir > 0 ? '55%' : '-55%') }}
        animate={{ x: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </div>
  )
}

// 내 랭킹 도넛 링 — 화면에 들어오면 원이 그려짐 (마이페이지 카운트업처럼 매번 재생)
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] text-emerald-600 font-semibold leading-none">내 랭킹</span>
        <span className="text-lg font-extrabold text-gray-900 leading-tight">{rank ? `${rank}등` : '-'}</span>
        <span className="text-[10px] text-gray-400 leading-none">/ {total || '-'}명</span>
      </div>
    </div>
  )
}

// 신규 사용자 콜드스타트 가이드 — 운영·참여 프로그램이 0개일 때 대표/활동/랭킹 3섹션을 대체.
// 죽은 0/0/0 카드 대신 둘러보기→참여→인증 「시작 3단계」 동선을 안내한다 (참여자 온보딩 A).
function ColdStartGuide({ onBrowse, onCreate }) {
  // 참여 / 운영 — 대등한 두 갈래(북극성: 누구나 참여도 운영도)
  const paths = [
    { emoji: '🔍', title: '프로그램 참여하기', body: '관심 있는 건강 프로그램을 찾아 참여해요.', onClick: onBrowse },
    { emoji: '✨', title: '프로그램 만들기', body: '직접 만들어 사람들과 함께 운영해요.', onClick: onCreate },
  ]
  return (
    <SectionCard>
      <div className="text-center mb-5">
        <img src="/icons/growth/sprout.png" alt="" aria-hidden="true" className="w-32 h-32 object-contain mx-auto -mt-12 mb-1" />
        <h2 className="text-lg font-extrabold text-gray-900 leading-tight">건강 습관, 여기서 시작해요!</h2>
        <p className="text-[13.5px] font-semibold text-gray-600 mt-2.5">참여할 수도, 직접 운영할 수도 있어요.</p>
      </div>
      <div className="space-y-3">
        {paths.map((p, i) => (
          <motion.button
            key={p.title}
            type="button"
            onClick={p.onClick}
            className="w-full flex items-center gap-3.5 p-4 rounded-2xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40 active:scale-[0.99] transition text-left"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.1 }}
          >
            <span className="flex-shrink-0 w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-[22px]">{p.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-gray-800">{p.title}</p>
              <p className="text-[12.5px] text-gray-500 leading-snug mt-0.5 break-keep">{p.body}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
          </motion.button>
        ))}
      </div>
    </SectionCard>
  )
}

function DashboardPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const reduceMotion = useReducedMotion()
  const userId = session?.user?.id

  const [selectedPublicId, setSelectedPublicId] = useState(null)
  const [browseOpen, setBrowseOpen] = useState(false)
  // 둘러보기 상세에서 뒤로 복귀 — 직전에 열려 있던 공개 프로그램 모달 재오픈(마운트당 1회).
  //   인페이지 back = location.state.reopenPreview / 하드웨어 back = ?preview 쿼리
  const reopenedRef = useRef(false)
  useEffect(() => {
    if (reopenedRef.current) return
    reopenedRef.current = true
    const rid = location.state?.reopenPreview || new URLSearchParams(location.search).get('preview')
    if (rid) {
      setSelectedPublicId(rid)
      navigate(location.pathname, { replace: true, state: null })   // 상태·쿼리 정리(새로고침·재진입 시 재오픈 방지)
    }
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps
  const [showWelcome, setShowWelcome] = useState(false)
  const [welcomeProgramId, setWelcomeProgramId] = useState(null)
  // 대표 카드 모드 토글 (운영중 ⇄ 참여중) — 둘 다 있을 때 스와이프로 전환
  const [viewMode, setViewMode] = useState(() => {
    // 마지막으로 보던 모드(운영중/참여중) 복원 — 뒤로 왔을 때 그 모드로
    try { return sessionStorage.getItem('dash-viewmode') === 'participant' ? 'participant' : 'operator' } catch { return 'operator' }
  })
  const [modeDir, setModeDir] = useState(0)
  // 프로그램 캐러셀 — 좌우 스와이프는 「현재 모드의 프로그램 넘기기」(본인 결정 2026-07-16).
  //   기존의 「스와이프로 운영중↔참여중 전환」은 제스처가 겹쳐 폐기 → 모드 전환은 토글 버튼 전담.
  const trackRef = useRef(null)
  const [slide, setSlide] = useState(0)
  const restoredRef = useRef(false)   // 뒤로 복귀 시 선택 프로그램 복원 — 마운트당 1회

  useEffect(() => {
    if (session === null) navigate('/login')
  }, [session, navigate])

  // 첫 운영자 환영 투어 — sessionStorage 플래그로 진입. StrictMode(dev) 이중마운트에도 안전하도록
  //   여기선 '읽기+표시'만, 소비(플래그 제거 + seen 저장)는 닫을 때(closeWelcome)에서. (플래그를 효과에서
  //   즉시 지우면 dev 첫 마운트가 버려질 때 소비돼 투어가 안 뜨던 문제 방지)
  useEffect(() => {
    if (sessionStorage.getItem('show_operator_welcome') === '1') {
      setWelcomeProgramId(sessionStorage.getItem('operator_welcome_program') || null)
      setShowWelcome(true)
    }
  }, [])
  const closeWelcome = () => {
    setShowWelcome(false)
    sessionStorage.removeItem('show_operator_welcome')
    sessionStorage.removeItem('operator_welcome_program')
    if (userId) localStorage.setItem(`operator_welcome_seen_${userId}`, '1')  // 계정별 1회
  }

  // ─── 데이터 ───────────
  const { data: nickname } = useQuery({
    queryKey: ['user-nickname', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('users').select('nickname').eq('id', userId).maybeSingle()
      if (error) throw error
      return data?.nickname || ''
    },
    enabled: !!userId,
  })

  const { data: myPrograms = [], isLoading: isMyLoading } = useQuery({
    queryKey: queryKeys.myPrograms(userId),
    queryFn: () => fetchMyPrograms(userId),
    enabled: !!userId,
  })

  const { data: activePrograms = [], isLoading: isActiveLoading } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  // 참여자 수 — 참여 프로그램 + 운영 프로그램(대표 카드가 운영중일 때 참여자 수 표시) 모두 집계
  const activeProgramIds = [...new Set([...activePrograms.map(p => p.id), ...myPrograms.map(p => p.id)])]
  const { data: activeCounts = {} } = useQuery({
    queryKey: queryKeys.activeParticipantCounts(activeProgramIds),
    queryFn: () => fetchActiveParticipantCounts(activeProgramIds),
    enabled: activeProgramIds.length > 0,
    // 참여자 수 변동은 Realtime(program_participants) + 참여/탈퇴 무효화가 갱신 → 매 진입 재요청(always) 제거
  })

  const { data: publicPrograms = [], isFetching: isPublicFetching } = useQuery({
    queryKey: queryKeys.publicPrograms(userId),
    queryFn: () => fetchPublicPrograms(userId),
    // 공개 프로그램 전량 fetch — 둘러보기 모달 전용이라 대시보드 진입마다 받을 필요 없음.
    // 둘러보기를 열거나(공개 프로그램 선택 상태 포함) 할 때만 fetch → 진입 부하 제거.
    enabled: !!userId && (browseOpen || selectedPublicId != null),
  })

  const { data: unreadNotifCount = 0 } = useQuery({
    queryKey: queryKeys.notificationsUnread(userId),
    queryFn: fetchUnreadNotificationsCount,
    enabled: !!userId,
  })

  const { data: pStats } = useQuery({
    queryKey: queryKeys.myParticipantStats(userId),
    queryFn: () => fetchMyParticipantStats(userId),
    enabled: !!userId,
  })

  // 운영자(소유 프로그램 보유)면 대표 카드에 운영중 프로그램을, 아니면 참여중 프로그램을 노출.
  //   운영중·참여중 둘 다 있으면 스와이프/토글로 전환(effectiveMode).
  const isOperator = myPrograms.length > 0
  // 신규 사용자 콜드스타트 — 운영·참여 프로그램이 하나도 없고 로딩도 끝난 상태.
  // 죽은 0/0/0 대시보드 대신 「시작 3단계」 가이드로 전환 (참여자 온보딩).
  const isColdStart = !isMyLoading && !isActiveLoading && myPrograms.length === 0 && activePrograms.length === 0
  const canToggleMode = myPrograms.length > 0 && activePrograms.length > 0
  const effectiveMode = canToggleMode ? viewMode : (isOperator ? 'operator' : 'participant')
  const showOperator = effectiveMode === 'operator'
  // 캐러셀에 깔 목록 = 현재 모드의 프로그램 전부.
  const slideList = showOperator ? myPrograms : activePrograms
  // featured = 캐러셀에서 지금 보고 있는 슬라이드(넛지·랭킹·참여자수 등이 선택 프로그램을 따라감).
  //   slide 가 목록 범위를 벗어나면(모드전환 직후 등) 첫 장으로 폴백.
  const featured = slideList[slide] || slideList[0] || null
  // 캐러셀에서 현재 보고 있는 프로그램(슬라이드 인덱스) — 운영 현황 지표가 이걸 따라감
  const selectedOperatorProgram = showOperator ? (slideList[slide] || null) : null
  const { data: opToday } = useQuery({
    queryKey: queryKeys.programOperatorToday(selectedOperatorProgram?.id),
    queryFn: () => fetchProgramOperatorToday(selectedOperatorProgram.id),
    enabled: showOperator && !!selectedOperatorProgram?.id,
    // 심사·승인·신고 처리 후 home-stats 무효화로 갱신 → 'always' 불필요(랙 방지)
  })
  // 「새 미션/퀴즈」 배지 — 캐러셀 프로그램들의 미션·퀴즈 생성시각(2쿼리) → localStorage lastSeen 비교로 new 개수.
  const slideIds = useMemo(() => slideList.map(p => p.id), [slideList])
  const { data: contentTimes } = useQuery({
    queryKey: [...queryKeys.programsContentTimes(slideIds), userId],
    queryFn: () => fetchProgramsContentTimes(slideIds, userId),
    enabled: !!userId && slideIds.length > 0,
  })
  const newCountsFor = (pid) => {
    const t = contentTimes?.[pid]
    if (!t) return { mission: 0, quiz: 0, class: 0 }
    // 기준: localStorage lastSeen(탭 열면 갱신) 없으면 참여시각 → 참여 후 추가분이 new
    return {
      mission: countNew(t.missions, pid, 'missions', t.joinedAt),
      quiz: countNew(t.quizzes, pid, 'quizzes', t.joinedAt),
      class: countNew(t.classes, pid, 'classes', t.joinedAt),
    }
  }

  // 참여중 모드 — 캐러셀에서 보고 있는 참여 프로그램(운영 현황과 대칭). 오늘의 활동을 이 프로그램 기준으로.
  const selectedParticipantProgram = !showOperator ? (slideList[slide] || null) : null
  const { data: todayProgram } = useQuery({
    queryKey: queryKeys.myTodayActivityForProgram(userId, selectedParticipantProgram?.id),
    queryFn: () => fetchMyTodayActivityForProgram(userId, selectedParticipantProgram.id),
    enabled: !showOperator && !!userId && !!selectedParticipantProgram?.id,
  })
  // 모드 전환 (방향 기록 → 슬라이드 페이드). 토글 버튼 전담.
  const switchMode = (m) => {
    if (!canToggleMode || m === effectiveMode) return
    setModeDir(m === 'participant' ? 1 : -1)
    setViewMode(m)
    try { sessionStorage.setItem('dash-viewmode', m) } catch { /* 미지원 */ }
  }
  // 모드가 바뀌면 목록이 통째로 바뀌므로 캐러셀을 첫 장으로 되감음
  useEffect(() => {
    setSlide(0)
    if (trackRef.current) trackRef.current.scrollLeft = 0
  }, [effectiveMode])

  // 뒤로 복귀 시 — 직전에 클릭했던 프로그램을 다시 메인(캐러셀 현재 장)으로 복원.
  //   카드 클릭 때 sessionStorage 에 저장한 id 를 찾아 그 인덱스로 스크롤. 마운트당 1회만(스크롤 방해 X).
  useEffect(() => {
    if (restoredRef.current || slideList.length === 0) return
    let savedId = null
    try { savedId = sessionStorage.getItem(`dash-sel-${effectiveMode}`) } catch { /* 미지원 */ }
    restoredRef.current = true
    if (!savedId) return
    const idx = slideList.findIndex(p => p.id === savedId)
    if (idx > 0) {
      setSlide(idx)
      // 더블 rAF — 첫 마운트엔 레이아웃(카드 폭)이 덜 정착돼 위치를 잘못 재던 문제(썸네일 어긋남).
      //   두 프레임 뒤 실제 카드의 offsetLeft 로 스크롤 → 폭·gap 계산 오차 없이 정확히 스냅.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = trackRef.current
        const child = el?.children?.[idx]
        if (child) el.scrollLeft = child.offsetLeft
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideList, effectiveMode])
  // 스크롤 위치 → 현재 페이지 인덱스 (도트 표시용)
  const onTrackScroll = (e) => {
    const el = e.currentTarget
    const first = el.firstElementChild
    if (!first) return
    const step = first.offsetWidth + 12   // 카드 폭 + gap-3
    setSlide(Math.max(0, Math.min(slideList.length - 1, Math.round(el.scrollLeft / step))))
  }
  const { data: featuredRank } = useQuery({
    queryKey: queryKeys.myRankChange(featured?.id, userId),
    queryFn: () => fetchMyRankChange(featured.id),
    enabled: !!featured?.id && !!userId,
  })
  const { data: featuredOverview } = useQuery({
    queryKey: queryKeys.programOverview(featured?.id, userId),
    queryFn: () => fetchProgramOverview(featured.id, userId),
    enabled: !!featured?.id && !!userId,
  })
  // ─── 파생 ─────────
  //   카드 지표를 「참여자 · 남은 기간」 2개로 줄이면서(본인 결정 2026-07-16 — 오늘 참여율·누적
  //   인증은 프로그램 통계에서 보면 되고, 대시보드에 있다고 운영이 쉬워지진 않음) 프로그램마다
  //   따로 받던 opPulse 쿼리가 필요 없어짐 → 캐러셀로 N장을 깔아도 추가 요청이 0.
  //   진행률·남은 기간은 날짜로 클라 계산, 참여자 수는 activeCounts 에 이미 전량 있음.

  const featuredParticipants = featured ? (activeCounts[featured.id] ?? null) : null
  const rankingOn = featured?.ranking_enabled !== false   // 랭킹 OFF 프로그램이면 대시보드에서도 랭킹 숨김

  // 첫 인증 넛지 — 참여자(운영 모드 아님)인데 대표 프로그램에 승인된 인증이 0건(활성화 전).
  //   featuredOverview 로딩 중엔 undefined → 조건 false 라 깜빡임 없음.
  //   종료된 프로그램에선 "첫 인증하라"는 넛지가 무의미(이미 끝남) → ended 제외.
  const firstVerifyNudge = !isColdStart && !showOperator && !!featured && featuredOverview?.totalCount === 0
    && progressUrgency(calcProgress(featured.start_date, featured.end_date)).urgency !== 'ended'

  // 오늘의 활동 (값 / 소프트 캡 → 막대 비율)
  // 오늘의 활동 요약 — 파스텔 타일(2026-07-19 목업) + 원 없는 2D 아이콘(본인 제공).
  //   activity/{mission,record,comment}.png 를 배경 원 없는 투명 버전으로 교체 → 클립·확대 불필요.
  //   scale 은 PNG별 여백 차이로 인한 시각 크기만 미세 보정.
  const pid = selectedParticipantProgram?.id
  const goActivity = (tab) => navigate(`/profile/activity/today?tab=${tab}${pid ? `&program=${pid}` : ''}`)
  const participantMetrics = [
    { label: '미션 완료', value: todayProgram?.missionCount ?? 0, unit: '개', img: '/icons/activity/mission.png', bg: 'bg-emerald-50', scale: 1.25, onClick: () => goActivity('missions') },
    { label: '게시물 작성', value: todayProgram?.postCount ?? 0, unit: '개', img: '/icons/activity/record.png', bg: 'bg-sky-50', scale: 1.85, onClick: () => goActivity('posts') },
    { label: '댓글 활동', value: todayProgram?.commentCount ?? 0, unit: '개', img: '/icons/activity/comment.png', bg: 'bg-amber-50', scale: 1.45, onClick: () => goActivity('comments') },
    { label: '획득 점수', value: todayProgram?.points ?? 0, unit: 'P', img: '/icons/activity/point.png', bg: 'bg-violet-50', scale: 0.84, onClick: () => goActivity('points') },
  ]
  // 운영중 「오늘의 운영 현황」 — 선택 프로그램 기준. 앞 3개는 할 일 인박스(값>0 강조), 4번째는 참여율 pulse.
  //   타일 → 「오늘의 운영」 상세(/programs/:id/operator-today?tab=…) 단일 4탭 페이지.
  const opId = selectedOperatorProgram?.id
  const goOpToday = (t) => opId && navigate(`/programs/${opId}/operator-today?tab=${t}`)
  const operatorMetrics = [
    { label: '인증 심사', value: opToday?.review ?? 0, unit: '개', img: '/icons/operator/review.png', bg: 'bg-emerald-50', accent: 'text-emerald-600', inbox: true, onClick: () => goOpToday('review') },
    { label: '참여 승인', value: opToday?.join ?? 0, unit: '개', img: '/icons/operator/approve.png', bg: 'bg-sky-50', accent: 'text-sky-600', inbox: true, onClick: () => goOpToday('join') },
    { label: '신고 처리', value: opToday?.report ?? 0, unit: '개', img: '/icons/operator/report.png', bg: 'bg-amber-50', accent: 'text-amber-500', inbox: true, onClick: () => goOpToday('report') },
    { label: '오늘 참여율', value: opToday?.todayRate ?? 0, unit: '%', img: '/icons/operator/rate.png', bg: 'bg-violet-50', onClick: () => goOpToday('rate') },
  ]
  const summaryMetrics = showOperator ? operatorMetrics : participantMetrics

  return (
    <div className="min-h-screen bg-white">
      {/* ─── 상단 헤더 (도담 + 알림) — 모서리 0, 최상단 고정 톤 ─── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto h-[46px] px-4 flex items-center justify-center relative">
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
            {unreadNotifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 콘텐츠 — 섹션 간격 16px(히어로·프로그램·활동요약·점수 균일, 제목이 위 박스에 붙지 않게) */}
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 pt-[9px] pb-6 space-y-4">

        {/* ─── 초대받은 프로그램 카드 — 힌트 있을 때만(참여/닫기 전) ─── */}
        <InviteHintCard />

        {/* ─── 인사말 헤더 (이미지 카드, 모서리 10) — 페이드 없이 항상 보임 ─── */}
        <div className="relative overflow-hidden rounded-[10px] bg-[#eef7f1] h-[120px]">
          {/* 일러스트 — object-cover + 상단 기준(머리 안 잘리게) → 인물 크게 (사진2처럼) */}
          <img
            src="/home-header.jpg"
            alt=""
            aria-hidden="true"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: 'center 56%' }}
          />
          {/* 좌측은 배경색으로 덮고(텍스트 또렷·이음새 가림), 우측 인물로 갈수록 투명 */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, #eef7f1 0%, #eef7f1 50%, rgba(238,247,241,0) 72%)' }}
          />
          {/* 텍스트 — 세로 균등 간격(gap-[8px] 한 곳에서 조절) */}
          <div className="relative h-full px-4 flex flex-col justify-center gap-[8px]">
            <p className="text-[13px] font-medium text-gray-700 leading-tight drop-shadow-sm">
              오늘도 건강한 하루 되세요! 👋
            </p>
            <p className="text-2xl font-extrabold text-gray-900 leading-tight drop-shadow-sm">
              {nickname ? `${nickname}님` : '반가워요'}
            </p>
            <div className="flex items-center gap-1.5">
              {isOperator && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">
                  운영자
                </span>
              )}
              <span className="text-[12px] font-medium text-gray-700">{isColdStart ? '환영해요! 첫 건강 습관을 시작해볼까요? ✨' : '건강한 습관이 쌓이고 있어요!'}</span>
            </div>
          </div>
        </div>

        {/* 첫 인증 넛지 — 참여했지만 아직 한 번도 인증 안 한 사용자를 미션 탭으로 (활성화) */}
        {firstVerifyNudge && (
          <motion.button
            type="button"
            onClick={() => navigate(`/programs/${featured.id}?tab=missions`)}
            initial={{ opacity: 0, y: 10 }}
            animate={reduceMotion
              ? { opacity: 1, y: 0 }
              : { opacity: 1, y: 0, boxShadow: ['0 6px 16px -6px rgba(16,185,129,0.45)', '0 10px 26px -4px rgba(16,185,129,0.75)', '0 6px 16px -6px rgba(16,185,129,0.45)'] }}
            transition={{ opacity: { duration: 0.4 }, y: { duration: 0.4 }, boxShadow: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } }}
            whileTap={{ scale: 0.98 }}
            className="relative overflow-hidden w-full flex items-center gap-3 p-3.5 rounded-[10px] bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-left"
          >
            {/* 샤인 스윕 — 주기적으로 빛줄기가 대각선으로 훑고 지나감 */}
            {!reduceMotion && (
              <motion.span aria-hidden
                className="pointer-events-none absolute top-0 -left-1/3 h-full w-1/3 skew-x-[-20deg]"
                style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.38) 50%, rgba(255,255,255,0) 100%)' }}
                animate={{ x: ['0%', '450%'] }}
                transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity, repeatDelay: 2.6 }}
              />
            )}
            {/* 아이콘 — 레이더 핑 링 + 은은한 스케일 펄스 */}
            <span className="relative flex-shrink-0 w-10 h-10 flex items-center justify-center">
              {!reduceMotion && (
                <motion.span aria-hidden
                  className="absolute inset-0 rounded-full border-2 border-white/60"
                  animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
                  transition={{ duration: 1.6, ease: 'easeOut', repeat: Infinity, repeatDelay: 0.4 }}
                />
              )}
              <motion.span
                className="relative w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl"
                animate={reduceMotion ? {} : { scale: [1, 1.12, 1] }}
                transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity }}
              >🎯</motion.span>
            </span>
            <div className="relative flex-1 min-w-0">
              <p className="text-sm font-bold leading-tight">아직 첫 인증 전이에요!</p>
              <p className="text-[12px] text-white/85 leading-snug mt-0.5 truncate">{featured.name}에서 첫 미션을 인증하고 습관을 시작해보세요</p>
            </div>
            <motion.span className="relative flex-shrink-0"
              animate={reduceMotion ? {} : { x: [0, 4, 0] }}
              transition={{ duration: 1.2, ease: 'easeInOut', repeat: Infinity }}
            >
              <ChevronRight className="w-5 h-5 text-white/90" />
            </motion.span>
          </motion.button>
        )}

        {/* 신규 사용자 — 죽은 0/0/0 섹션 대신 시작 가이드 히어로 */}
        {isColdStart ? (
        <ColdStartGuide onBrowse={() => setBrowseOpen(true)} onCreate={() => navigate('/programs/new')} />
        ) : (<>
        {/* ─── 운영중/참여중 전환 3개 섹션 — 섹션 간격 16px(위 콘텐츠와 균일) ─── */}
        <div className="space-y-4">
        {/* ─── 프로그램 — 토글 + 카드 캐러셀 (2026-07-16 목업).
             좌우 스와이프 = 현재 모드의 프로그램 넘기기(본인 결정). 모드 전환은 토글 전담.
             흰 SectionCard 로 감싸면 카드 속 카드가 되어, 헤더만 두고 카드는 배경 위에 띄움. ─── */}
        <Reveal index={0}><section>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="text-lg font-bold text-gray-800 flex-shrink-0">프로그램</h2>
              {canToggleMode && (
                <span className="inline-flex items-center gap-0.5 bg-gray-100 rounded-full p-0.5">
                  <button type="button" onClick={() => switchMode('operator')} className={`px-2.5 py-1 rounded-full text-[12px] font-bold whitespace-nowrap transition ${showOperator ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>운영중</button>
                  <button type="button" onClick={() => switchMode('participant')} className={`px-2.5 py-1 rounded-full text-[12px] font-bold whitespace-nowrap transition ${!showOperator ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>참여중</button>
                </span>
              )}
            </div>
            {slideList.length > 0 && (
              <button type="button" onClick={() => navigate(showOperator ? '/programs?tab=mine' : '/programs')} className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700 flex-shrink-0">
                전체 보기 {slideList.length > 1 && `(${slideList.length})`}<ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          <ModeSlide mode={effectiveMode} dir={modeDir}>
          {(isActiveLoading || isMyLoading) ? (   // 둘 다 로드돼야 effectiveMode(운영/참여)가 확정됨 — 하나만 기다리면 빈 상태가 잘못된 모드로 깜빡임
            <LoadingState size="sm" />
          ) : slideList.length === 0 ? (
            <EmptyState
              icon="🎯"
              title={showOperator ? '운영 중인 프로그램이 없어요' : '참여 중인 프로그램이 없어요'}
              description={showOperator ? '새 프로그램을 만들어보세요' : '새로운 건강 프로그램에 참여해보세요'}
              action={{ label: '프로그램 둘러보기', onClick: () => setBrowseOpen(true) }}
              variant="mint"
              size="lg"
            />
          ) : (
            <>
              {/* 가로 스크롤 스냅 캐러셀. 엣지 블리드(-mx) 금지 — 이 캐러셀은 ModeSlide 의
                  overflow-hidden 안에 있어, 음수 마진으로 삐져나가면 첫 카드 왼쪽 테두리가 잘린다.
                  카드 86% + 우측 overflow 만으로 다음 장이 살짝 보임. px-0.5 는 테두리 여백. */}
              <div
                ref={trackRef}
                onScroll={onTrackScroll}
                className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide px-0.5 pb-1"
              >
                {slideList.map((p, i) => (
                  <div key={p.id} className={`snap-start flex-shrink-0 ${slideList.length > 1 ? 'w-[86%]' : 'w-full'}`}>
                    <ProgramSlideCard
                      program={p}
                      participants={activeCounts[p.id] ?? null}
                      active={i === slide}
                      onClick={() => {
                        try { sessionStorage.setItem(`dash-sel-${effectiveMode}`, p.id) } catch { /* 미지원 */ }
                        navigate(`/programs/${p.id}`)
                      }}
                      newMission={newCountsFor(p.id).mission}
                      newQuiz={newCountsFor(p.id).quiz}
                      newClass={newCountsFor(p.id).class}
                    />
                  </div>
                ))}
              </div>
              {slideList.length > 1 && (
                <div className="flex justify-center items-center gap-1.5 mt-2.5">
                  {slideList.map((p, i) => (
                    <span key={p.id} className={`h-1.5 rounded-full transition-all ${i === slide ? 'w-4 bg-emerald-500' : 'w-1.5 bg-gray-300'}`} />
                  ))}
                </div>
              )}
            </>
          )}
          </ModeSlide>
        </section></Reveal>

        {/* ─── 오늘의 활동 요약 / 운영 현황 — 모드별 4타일. 흰 카드 없이 페이지에 직접. ─── */}
        <Reveal index={1}><section>
          <h2 className="text-lg font-bold text-gray-800 mb-3">{showOperator ? '오늘의 운영 현황' : '오늘의 활동 요약'}</h2>
          <ModeSlide mode={effectiveMode} dir={modeDir}>
          <div className="grid grid-cols-4 gap-2.5">
            {summaryMetrics.map((m) => {
              const highlight = m.inbox && m.value > 0   // 할 일 인박스: 값>0 이면 색으로 강조
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
                  {/* 라벨 — 기기 폭 안에서 한 줄 유지하며 최대 14px 까지 키움(FitText 자동 축소) */}
                  <FitText max={14} min={8} className="text-gray-500 font-semibold mt-2 leading-tight text-center" title={m.label}>{m.label}</FitText>
                  <p className="text-[18px] font-extrabold leading-tight mt-0.5 max-w-full truncate tabular-nums">
                    <span className={highlight ? m.accent : 'text-gray-900'}><CountUp value={m.value} duration={1100} /></span>
                    <span className="text-[11px] text-gray-500 font-bold ml-0.5">{m.unit}</span>
                  </p>
                </button>
              )
            })}
          </div>
          </ModeSlide>
        </section></Reveal>

        {/* ─── 내 점수 및 랭킹 — 제목 카드 밖으로(프로그램·활동요약과 통일). 박스 안: 트로피(좌) + 점수·랭킹(우).
             pt-1(4px): 본인 요청으로 이 섹션만 살짝 더 내림(space-y 마진과 충돌 없게 padding 사용) ─── */}
        <Reveal index={2}><section className="pt-1">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-lg font-bold text-gray-800">내 점수{rankingOn ? ' 및 랭킹' : ''}</h2>
            {rankingOn && (
              <button type="button" onClick={() => navigate('/rankings')} className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700">
                전체 랭킹<ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="bg-white rounded-[10px] shadow-elevated p-4">
            <ModeSlide mode={effectiveMode} dir={modeDir}>
            <div className="flex items-center gap-3">
              {/* 트로피 3D 아이콘(본인 제공 2026-07-19) — 좌측 */}
              {/* 박스 높이는 고정, 트로피만 시각적으로 크게 — 아이콘 여백을 넘겨 살짝 오버플로우 */}
              <RankTrophyAnim className="flex-shrink-0 -my-3 -ml-[5px]" />
              {/* 점수·랭킹 — 아이콘이 좌측을 차지하므로 우측으로 이동 */}
              <div className="flex-1 flex items-center justify-around gap-3">
                <div className="text-center">
                  <p className="text-[11px] text-emerald-600 font-semibold mb-0.5">총 점수</p>
                  <p className="text-xl font-extrabold text-gray-900 leading-tight">
                    <CountUp value={pStats?.totalPoints ?? 0} duration={1100} /><span className="text-sm text-gray-500 font-bold"> P</span>
                  </p>
                  {pStats?.weekPoints > 0 && (
                    <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">이번주 ↑{pStats.weekPoints}P</p>
                  )}
                </div>
                {rankingOn && <RankRing rank={featuredRank?.current_rank} total={featuredParticipants} />}
              </div>
            </div>
            </ModeSlide>
          </div>
        </section></Reveal>
        </div>
        </>)}

        {/* 모달 — 둘러보기 + 공개 프로그램 상세 */}
        <ProgramBrowseModal
          isOpen={browseOpen}
          onClose={() => setBrowseOpen(false)}
          programs={publicPrograms}
          isLoading={isPublicFetching && publicPrograms.length === 0}
          onSelect={(id) => { setBrowseOpen(false); setSelectedPublicId(id) }}
        />
        {(() => {
          const idx = selectedPublicId ? publicPrograms.findIndex(p => p.id === selectedPublicId) : -1
          const current = idx >= 0 ? publicPrograms[idx] : null
          const goTo = (i) => setSelectedPublicId(publicPrograms[i].id)
          return (
            <ProgramDetailModal
              program={current}
              isOpen={current !== null}
              onClose={() => setSelectedPublicId(null)}
              onPrev={idx > 0 ? () => goTo(idx - 1) : undefined}
              onNext={idx >= 0 && idx < publicPrograms.length - 1 ? () => goTo(idx + 1) : undefined}
            />
          )
        })()}

        <WelcomeOperatorModal isOpen={showWelcome} programId={welcomeProgramId} onClose={closeWelcome} />
      </div>
    </div>
  )
}

export default DashboardPage
