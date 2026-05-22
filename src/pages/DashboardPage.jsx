import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import { Plus, Activity, Trash2, ChevronRight, ClipboardList, Target, Clock, Trophy, Bell } from 'lucide-react'
import { formatKoreanDate, getTodayKST } from '../lib/formatters'
import { PROGRAM_STATUS, CATEGORY } from '../lib/constants'
import ProgramDetailModal from '../components/program/ProgramDetailModal'

// Stagger fade-in 애니메이션 — 카드들이 차례로 등장
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
}
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

// 카테고리별 파스텔 색상 매핑 (Tailwind JIT 안전 — 명시적 클래스명)
const CATEGORY_COLORS = {
  WALKING:    { bg: 'bg-emerald-50', border: 'border-emerald-100', accent: 'bg-emerald-400' },
  DIET:       { bg: 'bg-green-50',   border: 'border-green-100',   accent: 'bg-green-400' },
  EMPATHY:    { bg: 'bg-pink-50',    border: 'border-pink-100',    accent: 'bg-pink-400' },
  MINDCARE:   { bg: 'bg-orange-50',  border: 'border-orange-100',  accent: 'bg-orange-400' },
  SLEEP:      { bg: 'bg-purple-50',  border: 'border-purple-100',  accent: 'bg-purple-400' },
  NO_SMOKING: { bg: 'bg-yellow-50',  border: 'border-yellow-100',  accent: 'bg-yellow-400' },
  ETC:        { bg: 'bg-gray-50',    border: 'border-gray-100',    accent: 'bg-gray-400' },
}

// KST 기준 'YYYY-MM-DD' 문자열 (Intl 이 timezone 안전)
const formatKstDate = (date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

// 시간 기반 진행률 (KST)
const calcProgress = (startDate, endDate) => {
  if (!startDate || !endDate) return 0
  const now = new Date()
  const start = new Date(`${startDate}T00:00:00+09:00`)
  const end = new Date(`${endDate}T23:59:59+09:00`)
  if (now < start) return 0
  if (now > end) return 100
  const total = end - start
  const passed = now - start
  return Math.round((passed / total) * 100)
}


function DashboardPage() {
  const { session, nickname } = useAuth()
  const [myPrograms, setMyPrograms] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const [selectedProgram, setSelectedProgram] = useState(null)   // ⭐ 추가

  // 공개 프로그램 둘러보기
  const [publicPrograms, setPublicPrograms] = useState([])
  const [isLoadingPublic, setIsLoadingPublic] = useState(true)

  // 참여 중인 프로그램
  const [activePrograms, setActivePrograms] = useState([])
  const [isLoadingActive, setIsLoadingActive] = useState(true)

  // 통계 — 본인의 누적 포인트 (모든 프로그램 합산)
  const [totalPoints, setTotalPoints] = useState(0)

  // 오늘의 미션 통합 — 본인 ACTIVE 참여 모든 프로그램의 오늘 활성 미션
  const [todayMissions, setTodayMissions] = useState([])
  // 본인 KST 오늘 미션별 인증 횟수 (mission_id → count)
  const [todayCounts, setTodayCounts] = useState({})

  // 인증 제출 모달 (오늘의 미션에서 직접 인증)

  // 누적 포인트 fetch — useEffect 안에서도, 인증 후 재호출에서도 사용
  const fetchTotalPoints = async () => {
    if (!session) return
    const { data, error } = await supabase
      .from('score_ledgers')
      .select('point')
      .eq('user_id', session.user.id)

    if (error) {
      console.error('누적 포인트 조회 실패:', error)
    } else {
      const total = (data || []).reduce((sum, row) => sum + row.point, 0)
      setTotalPoints(total)
    }
  }

  // 오늘의 미션 fetch — activePrograms 변경에 의존
  const fetchTodayMissions = async (programIds) => {
    if (!session || programIds.length === 0) {
      setTodayMissions([])
      return
    }
    const nowISO = new Date().toISOString()
    const { data, error } = await supabase
      .from('missions')
      .select('*, programs!inner(id, name, categories)')
      .in('program_id', programIds)
      .lte('active_from', nowISO)
      .gte('active_until', nowISO)
      .order('point', { ascending: false })

    if (error) {
      console.error('오늘의 미션 조회 실패:', error)
    } else {
      setTodayMissions(data || [])
    }
  }


  // 로그아웃 시 /login 으로                              // ⭐ 추가
  useEffect(() => {
    if (session === null) {
      navigate('/login')
    }
  }, [session, navigate])

  // 본인이 만든 프로그램 가져오기
  useEffect(() => {
    if (!session) return

    const fetchMyPrograms = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('프로그램 조회 실패:', error)
      } else {
        setMyPrograms(data || [])
      }
      setIsLoading(false)
    }

    fetchMyPrograms()
  }, [session])

  // 공개 프로그램 둘러보기 (PUBLISHED + is_public + 본인 것 제외)
  useEffect(() => {
    if (!session) return

    const fetchPublicPrograms = async () => {
      setIsLoadingPublic(true)
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('status', 'PUBLISHED')
        .eq('is_public', true)
        .neq('owner_id', session.user.id)
        .order('published_at', { ascending: false })

      if (error) {
        console.error('공개 프로그램 조회 실패:', error)
      } else {
        setPublicPrograms(data || [])
      }
      setIsLoadingPublic(false)
    }

    fetchPublicPrograms()
  }, [session])

  // 참여 중인 프로그램 (ACTIVE 상태만)
  useEffect(() => {
    if (!session) return

    const fetchActivePrograms = async () => {
      setIsLoadingActive(true)
      const { data, error } = await supabase
        .from('program_participants')
        .select('joined_at, programs(*)')
        .eq('user_id', session.user.id)
        .eq('status', 'ACTIVE')
        .order('joined_at', { ascending: false })

      if (error) {
        console.error('참여 프로그램 조회 실패:', error)
      } else {
        // 중첩된 programs 객체만 추출
        const programs = (data || [])
          .map(row => row.programs)
          .filter(Boolean)
        setActivePrograms(programs)
      }
      setIsLoadingActive(false)
    }

    fetchActivePrograms()
  }, [session])

  // 누적 포인트
  useEffect(() => {
    fetchTotalPoints()
  }, [session])

  // 오늘의 미션 — activePrograms 변경 시 자동 갱신
  useEffect(() => {
    if (!session) return
    const ids = activePrograms.map(p => p.id)
    fetchTodayMissions(ids)
  }, [session, activePrograms])

  // 본인의 KST 오늘 미션별 인증 횟수 (daily_limit 연동)
  //   PENDING_REVIEW 도 카운트 — 운영자 심사 대기도 제출 횟수에 포함
  const fetchTodayCounts = async () => {
    if (!session) return
    const { data, error } = await supabase
      .from('verifications')
      .select('mission_id, submitted_at')
      .eq('user_id', session.user.id)
      .in('status', ['APPROVED', 'PENDING_REVIEW'])

    if (error) {
      console.error('인증 횟수 조회 실패:', error)
      return
    }
    const todayKst = formatKstDate(new Date())
    const counts = {}
    ;(data || []).forEach(v => {
      const vKst = formatKstDate(new Date(v.submitted_at))
      if (vKst === todayKst) {
        counts[v.mission_id] = (counts[v.mission_id] || 0) + 1
      }
    })
    setTodayCounts(counts)
  }

  // todayMissions 가 갱신되면 카운트도 함께
  useEffect(() => {
    if (!session) return
    fetchTodayCounts()
  }, [session, todayMissions])

  // 인증 성공 시 호출 — 누적 포인트 + 오늘의 미션 + 카운트 다시 가져옴
  const handleVerificationSuccess = () => {
    fetchTotalPoints()
    fetchTodayMissions(activePrograms.map(p => p.id))
    fetchTodayCounts()
  }

  // 참여 예정 (ACTIVE 참여지만 프로그램 시작 전)
  const upcomingPrograms = activePrograms.filter(p => {
    if (!p.start_date) return false
    return new Date(`${p.start_date}T00:00:00+09:00`) > new Date()
  })
  // 실제 운영 중 = 참여 중 - 시작 전
  const runningCount = activePrograms.length - upcomingPrograms.length

  // 임시저장(DRAFT) 삭제
  const handleDelete = async (programId, programName) => {
    // 본인이 실수 방지 - 확인
    if (!window.confirm(`"${programName}" 임시저장을 삭제할까요?`)) {
      return
    }
    
    const { error } = await supabase
      .from('programs')
      .delete()
      .eq('id', programId)
      .eq('status', 'DRAFT')          // ⭐ DRAFT 만 (안전장치)
    
    if (error) {
      console.error('삭제 실패:', error)
      alert('삭제에 실패했습니다')
      return
    }
    
    // 목록에서 제거 (화면 갱신)
    setMyPrograms(myPrograms.filter(p => p.id !== programId))
  }

  return (
    <div className="min-h-screen">
      {/* 상단 풀 너비 그라데이션 풍경 영역 (컴팩트) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative bg-gradient-to-b from-emerald-100 via-emerald-50/80 to-teal-50/50 pt-5 pb-28 overflow-hidden"
      >
        <div className="max-w-4xl mx-auto px-4 relative">
          {/* 인사말 한 줄 (App.jsx 헤더 숨김 상태이므로 여기에 표시) */}
          <div className="flex items-start justify-between mb-6">
            <p className="text-sm text-gray-700 pr-4 leading-relaxed pt-1">
              안녕하세요, 오늘도 건강한 하루 되세요! 🌿
            </p>
            <button
              type="button"
              className="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-sm flex-shrink-0 hover:shadow-md transition"
              title="알림"
              onClick={() => navigate('/notifications')}
            >
              <Bell className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Health-Platform 로고만 (컴팩트) */}
          <div className="flex items-center gap-1.5">
            <span className="text-lg">🌿</span>
            <span className="font-bold text-emerald-600">Health-Platform</span>
          </div>
        </div>

        {/* 마스코트 일러스트 — 작게, 우측 */}
        <div className="absolute top-6 right-0 left-0 pointer-events-none select-none">
          <div className="max-w-4xl mx-auto px-4 relative">
            <div className="absolute right-4 top-0 w-24 h-24 sm:w-28 sm:h-28">
              <span className="absolute inset-0 flex items-center justify-center text-5xl opacity-25">
                🌱
              </span>
              <img
                src="/illustrations/mascot.png"
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* 흰색 컨텐츠 카드 — overlap (본인 레퍼런스 비율) */}
      <div className="max-w-4xl mx-auto px-4 -mt-16 relative">
        <div className="bg-white rounded-3xl shadow-xl p-4 sm:p-6 mb-4">

      {/* CTA — 프로그램 생성하기 (컴팩트 + 단색) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Link
          to="/programs/new"
          className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 rounded-2xl shadow-md shadow-emerald-200/40 mb-5 transition"
        >
          <Plus className="w-5 h-5" />
          프로그램 생성하기
        </Link>
      </motion.div>

      {/* 통계 4개 카드 — 가로 한 줄 (모바일 4열) + 컴팩트 */}
      <motion.section
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-4 gap-2 mb-6"
      >
        <motion.div
          variants={itemVariants}
          className="bg-white border border-gray-100 rounded-2xl p-2.5 min-w-0 shadow-sm flex flex-col items-center text-center"
        >
          <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center mb-2">
            <ClipboardList className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-[10px] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis w-full">
            내 프로그램
          </p>
          <p className="text-xl font-bold text-gray-800 leading-tight">
            {myPrograms.length}
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white border border-gray-100 rounded-2xl p-2.5 min-w-0 shadow-sm flex flex-col items-center text-center"
        >
          <div className="w-8 h-8 bg-sky-100 rounded-xl flex items-center justify-center mb-2">
            <Target className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-[10px] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis w-full">
            참여 중
          </p>
          <p className="text-xl font-bold text-gray-800 leading-tight">
            {runningCount}
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white border border-gray-100 rounded-2xl p-2.5 min-w-0 shadow-sm flex flex-col items-center text-center"
        >
          <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center mb-2">
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-[10px] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis w-full">
            참여 예정
          </p>
          <p className="text-xl font-bold text-gray-800 leading-tight">
            {upcomingPrograms.length}
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white border border-gray-100 rounded-2xl p-2.5 min-w-0 shadow-sm flex flex-col items-center text-center"
        >
          <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center mb-2">
            <Trophy className="w-4 h-4 text-violet-600" />
          </div>
          <p className="text-[10px] text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis w-full">
            랭킹
          </p>
          <p className="text-xl font-bold text-gray-800 leading-tight whitespace-nowrap overflow-hidden text-ellipsis w-full">
            {totalPoints}<span className="text-xs text-gray-600">P</span>
          </p>
        </motion.div>
      </motion.section>
      
      {/* 오늘의 미션 — 참여 중 프로그램들의 현재 활성 미션 통합 */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-xl text-gray-800 mb-4">
          ✨ 오늘의 미션
        </h2>

        {todayMissions.length === 0 ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">
            오늘 인증할 미션이 없어요
            <br />
            <span className="text-xs text-gray-400">참여 중인 프로그램이 시작되면 여기에 표시돼요</span>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid gap-2"
          >
            {todayMissions.map(mission => {
              // 인증 유형 메타로 분기 (운영자 추가 미션 + 자동 생성 둘 다 처리)
              const types = []
              if (mission.requires_image) types.push('업로드')
              if (mission.requires_numeric) types.push('기록')
              if (mission.requires_note) types.push('소감')
              const isSupported = types.length > 0
              const buttonLabel = types.length === 1 ? types[0] : (isSupported ? '인증' : null)

              // daily_limit 연동
              const todayCount = todayCounts[mission.id] || 0
              const limit = mission.daily_limit
              const reachedLimit = limit != null && todayCount >= limit

              // 카테고리 색상 매핑 (참여 중 카드와 통일)
              const catKey = mission.programs?.categories?.[0] || 'ETC'
              const cat = CATEGORY[catKey] || CATEGORY.ETC
              const colors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.ETC

              return (
                <motion.div
                  key={mission.id}
                  variants={itemVariants}
                  className={`${colors.bg} ${colors.border} border rounded-2xl p-3 flex items-center gap-3`}
                >
                  {/* 좌측 일러스트/이모지 박스 */}
                  <div className="w-12 h-12 flex-shrink-0 bg-white/70 rounded-xl relative overflow-hidden">
                    <span className="absolute inset-0 flex items-center justify-center text-2xl">
                      {cat.emoji}
                    </span>
                    <img
                      src={`/illustrations/categories/${cat.key}.png`}
                      alt=""
                      className="absolute inset-0 w-full h-full object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  </div>

                  {/* 가운데 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-gray-500 truncate">
                      {mission.programs?.name}
                    </p>
                    <h3 className="font-medium text-gray-800 truncate text-sm">
                      {mission.title}
                    </h3>
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-white/80 text-emerald-700 text-[10px] rounded font-medium">
                      +{mission.point}P
                    </span>
                  </div>

                  {/* 우측 액션 — 3가지 상태: 미지원 / 오늘 완료 / 활성 */}
                  {!isSupported ? (
                    <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                      준비 중
                    </span>
                  ) : reachedLimit ? (
                    mission.verification_type === 'MANUAL' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 text-xs rounded-full font-medium whitespace-nowrap flex-shrink-0">
                        ⏳ 심사 대기
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-600 text-xs rounded-full font-medium whitespace-nowrap flex-shrink-0">
                        ✓ 완료
                      </span>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate(`/programs/${mission.program_id}/missions/${mission.id}`)}
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-full transition whitespace-nowrap flex-shrink-0 font-medium"
                    >
                      {buttonLabel}
                    </button>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </section>

      {/* 내가 만든 프로그램 — 최대 3개 요약 (전체는 /programs) */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-xl text-gray-800">
            <Activity className="w-5 h-5 text-green-500" />
            내 프로그램
          </h2>
          <div className="flex items-center gap-2">
            {myPrograms.length > 3 && (
              <Link
                to="/programs"
                className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
              >
                전체보기 <ChevronRight className="w-3 h-3" />
              </Link>
            )}
            <Link
              to="/programs/new"
              className="flex items-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md transition"
            >
              <Plus className="w-4 h-4" />
              새 프로그램
            </Link>
          </div>
        </div>
        
        {isLoading ? (
          <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500">
            불러오는 중...
          </div>
        ) : myPrograms.length === 0 ? (
          <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500">
            아직 만든 프로그램이 없어요
            <br />
            <span className="text-sm">위의 "새 프로그램" 버튼으로 시작해보세요</span>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid gap-3"
          >
            {myPrograms.slice(0, 3).map(program => (
              <motion.div
  key={program.id}
  variants={itemVariants}
  onClick={() => setSelectedProgram(program)}
  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
>
                <div className="flex items-start justify-between mb-2">
  <h3 className="font-medium text-gray-800">{program.name}</h3>
  <div className="flex items-center gap-2">
    <span className={`
      px-2 py-0.5 rounded text-xs
      ${program.status === 'PUBLISHED' 
        ? 'bg-green-100 text-green-700' 
        : 'bg-gray-100 text-gray-600'}
    `}>
      {program.status === 'PUBLISHED' ? '진행중' : '임시저장'}
    </span>
    {/* DRAFT 만 삭제 버튼 */}
    {program.status === 'DRAFT' && (
      <button
  onClick={(e) => {
    e.stopPropagation()                          // ⭐ 추가 (모달 안 열림)
    handleDelete(program.id, program.name)
  }}
  className="p-1 text-gray-400 hover:text-red-500 transition"
  title="삭제"
>
  <Trash2 className="w-4 h-4" />
</button>
    )}
  </div>
</div>
                {program.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {program.description}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* 참여 중인 프로그램 — 최대 3개 요약 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-xl text-gray-800">
            🎯 참여 중인 프로그램
          </h2>
          {activePrograms.length > 3 && (
            <Link
              to="/programs"
              className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
            >
              전체보기 <ChevronRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {isLoadingActive ? (
          <div className="bg-gray-50/60 p-8 rounded-2xl text-center text-gray-500 text-sm">
            불러오는 중...
          </div>
        ) : activePrograms.length === 0 ? (
          <div className="bg-emerald-50/40 p-8 rounded-2xl text-center">
            {/* 빈 상태 일러스트 자리 — public/illustrations/empty-box.png 있으면 자동 표시 */}
            <div className="w-32 h-32 mx-auto mb-4 relative">
              <span className="absolute inset-0 flex items-center justify-center text-6xl opacity-60">
                📦
              </span>
              <img
                src="/illustrations/empty-box.png"
                alt=""
                className="absolute inset-0 w-full h-full object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none' }}
              />
            </div>
            <p className="font-medium text-gray-800 mb-1">참여 중인 프로그램이 없어요</p>
            <p className="text-sm text-gray-500 mb-5">새로운 건강 프로그램에 참여해보세요</p>
            <button
              type="button"
              onClick={() => navigate('/programs')}
              className="inline-flex items-center gap-1 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-sm font-medium transition shadow-sm"
            >
              프로그램 둘러보기
            </button>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid gap-3"
          >
            {activePrograms.slice(0, 3).map(program => {
              const catKey = program.categories?.[0] || 'ETC'
              const cat = CATEGORY[catKey] || CATEGORY.ETC
              const colors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.ETC
              const progress = calcProgress(program.start_date, program.end_date)

              return (
                <motion.div
                  key={program.id}
                  variants={itemVariants}
                  onClick={() => navigate(`/programs/${program.id}`)}
                  className={`${colors.bg} ${colors.border} border rounded-2xl p-3 hover:shadow-md transition cursor-pointer flex items-center gap-3`}
                >
                  {/* 일러스트 박스 — 본인의 public/illustrations/categories/{key}.png 있으면 자동 표시 */}
                  <div className="w-16 h-16 flex-shrink-0 bg-white/70 rounded-2xl relative overflow-hidden">
                    <span className="absolute inset-0 flex items-center justify-center text-3xl">
                      {cat.emoji}
                    </span>
                    <img
                      src={`/illustrations/categories/${cat.key}.png`}
                      alt=""
                      className="absolute inset-0 w-full h-full object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-800 truncate">{program.name}</h3>
                    {program.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{program.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 bg-white/80 rounded-full overflow-hidden">
                        <div
                          className={`${colors.accent} h-full rounded-full transition-all`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 font-medium flex-shrink-0">{progress}%</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </section>

      {/* 공개 둘러보기 섹션은 BottomTabBar 📋 프로그램 탭에 통합 — 중복 제거 */}

        </div>
        {/* 흰색 컨텐츠 카드 끝 */}

        {/* 프로그램 상세 모달 */}
        <ProgramDetailModal
          program={selectedProgram}
          isOpen={selectedProgram !== null}
          onClose={() => setSelectedProgram(null)}
        />

      </div>
      {/* 흰색 컨텐츠 카드 wrapper 끝 */}
    </div>
  )
}

export default DashboardPage