import { useState, useMemo, Fragment } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronRight, ArrowLeft, Check, ClipboardList, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { checkMissionToday, formatKoreanDate } from '../lib/formatters'
import { CATEGORY } from '../lib/constants'
import { CATEGORY_HEX, calcProgress } from '../lib/programVisuals'
import { queryKeys, fetchActivePrograms, fetchTodayMissions, fetchTodayCounts, fetchMyTodayActivity, fetchMyParticipantStats, fetchProgramLastActivity } from '../lib/queries'
import MissionCard from '../components/program/MissionCard'
import ProgramCover from '../components/common/ProgramCover'
import NotificationBell from '../components/common/NotificationBell'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'
import Confetti from '../components/common/Confetti'

// 인증 가능 여부 — 지원 형식 있음 + 활성 + 일일 한도 미달
function isRecordable(m, todayCounts) {
  const supported = m.requires_image || m.requires_numeric || m.requires_note
  if (!supported) return false
  const now = new Date()
  if (m.active_from && now < new Date(m.active_from)) return false
  if (m.active_until && now > new Date(m.active_until)) return false
  if (!checkMissionToday(m).active) return false
  const cnt = todayCounts[m.id]?.total || 0
  if (m.daily_limit != null && cnt >= m.daily_limit) return false
  return true
}

function oneLineDesc(program) {
  const raw = (program.description || '').trim()
  if (!raw) return ''
  const lines = raw.split('\n')
  if (lines[0].trim() === (program.name || '').trim()) return (lines[1] || '').trim()
  return lines[0].trim()
}

const STEPS = ['프로그램 선택', '미션 선택', '기록·인증']

// 기록하기 — 3단계 위저드 (프로그램 선택 → 미션 선택 → 기록·인증)
//   단계는 URL ?program=id 로 구동 → 인증 후 복귀 시 그 프로그램 Step2 로 자연스럽게 이어짐.
//   오늘 인증 가능한 미션이 딱 1개면 위저드 건너뛰고 바로 인증.
//   전부 완료하면 완료 축하 화면(홈/랭킹 선택).
function RecordPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id

  const [searchParams, setSearchParams] = useSearchParams()
  const programParam = searchParams.get('program')

  const { data: activePrograms = [], isLoading: isProgLoading } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  const programIds = activePrograms.map(p => p.id)
  const { data: missions = [], isLoading: isMissionLoading } = useQuery({
    queryKey: queryKeys.todayMissions(userId),
    queryFn: () => fetchTodayMissions(programIds),
    enabled: !!userId && programIds.length > 0,
  })

  const { data: todayCounts = {} } = useQuery({
    queryKey: queryKeys.todayCounts(userId),
    queryFn: () => fetchTodayCounts(userId),
    enabled: !!userId,
  })

  // 완료 화면 요약용 — 오늘 활동(점수) + 연속 인증일
  const { data: todayActivity } = useQuery({
    queryKey: queryKeys.myTodayActivity(userId),
    queryFn: () => fetchMyTodayActivity(userId),
    enabled: !!userId,
  })
  const { data: pStats } = useQuery({
    queryKey: queryKeys.myParticipantStats(userId),
    queryFn: () => fetchMyParticipantStats(userId),
    enabled: !!userId,
  })

  const loading = isProgLoading || (programIds.length > 0 && isMissionLoading)

  const allRecordable = missions.filter(m => isRecordable(m, todayCounts))
  const todayDoneCount = Object.values(todayCounts).reduce((s, v) => s + (v?.total || 0), 0)

  // 프로그램별 마지막 인증 시각 (정렬용)
  const { data: lastActivity = {} } = useQuery({
    queryKey: ['my-program-last-activity', userId],
    queryFn: () => fetchProgramLastActivity(userId),
    enabled: !!userId,
  })

  // 오늘 미션이 있는 프로그램 그룹 — 미션 남은 프로그램 우선 + 최근 인증순
  const groups = useMemo(() => {
    return activePrograms
      .map(p => {
        const ms = missions.filter(m => m.program_id === p.id)
        return {
          program: p,
          missions: ms,
          recordableCount: ms.filter(m => isRecordable(m, todayCounts)).length,
          lastTime: lastActivity[p.id] ? new Date(lastActivity[p.id]).getTime() : 0,
        }
      })
      .filter(g => g.missions.length > 0)
      .sort((a, b) => {
        const ar = a.recordableCount > 0 ? 1 : 0
        const br = b.recordableCount > 0 ? 1 : 0
        if (ar !== br) return br - ar        // 인증할 미션이 남은 프로그램이 위로
        return b.lastTime - a.lastTime        // 그 안에서 최근 인증한 프로그램이 더 위로
      })
  }, [activePrograms, missions, todayCounts, lastActivity])

  // Step2 대상 그룹 (URL ?program) + 그 그룹에 인증 가능 미션이 남았는지
  const selectedGroup = programParam ? groups.find(g => g.program.id === programParam) : null
  const selectedRecordable = selectedGroup
    ? selectedGroup.missions.filter(m => isRecordable(m, todayCounts))
    : []
  const showStep2 = !!selectedGroup && selectedRecordable.length > 0

  // 최근 참여(가입) 프로그램 1개 — 인증할 미션이 남은 것 중 가입일 최신
  const recentGroup = useMemo(() => {
    const recordable = groups.filter(g => g.recordableCount > 0)
    if (recordable.length === 0) return null
    return [...recordable].sort((a, b) => {
      const ja = a.program._joinedAt ? new Date(a.program._joinedAt).getTime() : 0
      const jb = b.program._joinedAt ? new Date(b.program._joinedAt).getTime() : 0
      return jb - ja
    })[0]
  }, [groups])

  const [pickerOpen, setPickerOpen] = useState(false)

  const goMissionStep = (programId) => {
    setSearchParams({ program: programId }, { replace: true })
    window.scrollTo({ top: 0 })
  }
  const backToProgramStep = () => {
    setSearchParams({}, { replace: true })
    window.scrollTo({ top: 0 })
  }

  const currentStep = showStep2 ? 2 : (allRecordable.length === 0 && groups.length > 0 ? 3 : 1)
  const showIndicator = !loading && activePrograms.length > 0 && (groups.length > 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 — 뒤로 + 기록하기 + 알림 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-md mx-auto h-[46px] px-4 flex items-center justify-center relative">
          <button
            type="button"
            onClick={() => (showStep2 ? backToProgramStep() : navigate('/dashboard'))}
            className="absolute left-3 p-1.5 -ml-1.5 text-gray-500 hover:text-gray-800"
            aria-label="뒤로"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-[17px] font-bold text-gray-800">기록하기</span>
          <div className="absolute right-3"><NotificationBell bare /></div>
        </div>
      </header>

      <div className="w-full max-w-md mx-auto px-4 pt-3 pb-10 space-y-[11px]">
        {showIndicator && <StepIndicator step={currentStep} />}

        {loading ? (
          <LoadingState variant="page" />
        ) : activePrograms.length === 0 ? (
          <EmptyState
            icon="🎯"
            title="참여 중인 프로그램이 없어요"
            description="프로그램에 참여하면 여기서 바로 기록할 수 있어요"
            action={{ label: '프로그램 둘러보기', onClick: () => navigate('/programs') }}
            variant="mint" size="lg"
          />
        ) : allRecordable.length === 0 ? (
          groups.length > 0 || todayDoneCount > 0 ? (
            <CompletionView
              count={todayDoneCount}
              points={todayActivity?.points ?? 0}
              streak={pStats?.streak ?? 0}
              onHome={() => navigate('/dashboard')}
              onRanking={() => navigate('/rankings')}
            />
          ) : (
            <EmptyState
              icon="✅"
              title="오늘 기록할 미션이 없어요"
              description="오늘 활성화된 미션이 없어요"
              variant="mint" size="lg"
            />
          )
        ) : showStep2 ? (
          <MissionSelectStep group={selectedGroup} todayCounts={todayCounts} onBack={backToProgramStep} />
        ) : (
          <ProgramSelectStep
            recentGroup={recentGroup}
            onSelect={goMissionStep}
            onOpenPicker={() => setPickerOpen(true)}
          />
        )}
      </div>

      {/* 프로그램 선택 모달 */}
      <ProgramPickerModal
        open={pickerOpen}
        groups={groups}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => { setPickerOpen(false); goMissionStep(id) }}
      />
    </div>
  )
}

// ─── 단계 인디케이터 ──────────────────────────────────────
function StepIndicator({ step }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-soft px-4 py-3">
      <div className="flex items-start">
        {STEPS.map((label, i) => {
          const n = i + 1
          const done = n < step
          const active = n === step
          return (
            <Fragment key={label}>
              {i > 0 && (
                <div className={`flex-1 h-0.5 mt-[14px] mx-1 rounded-full ${n <= step ? 'bg-emerald-500' : 'bg-gray-200'}`} />
              )}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold ${
                  done || active ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {done ? <Check className="w-4 h-4" /> : n}
                </div>
                <span className={`mt-1 text-[11px] font-medium whitespace-nowrap ${active ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {label}
                </span>
              </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ─── Step 1 — 도입 배너(부제+버튼) + 최근 참여 프로그램 1개 + 혜택 ──
function ProgramSelectStep({ recentGroup, onSelect, onOpenPicker }) {
  return (
    <>
      {/* 도입 배너 — 일러스트 + 부제 + 프로그램 선택하기 버튼 */}
      <div className="relative overflow-hidden rounded-2xl bg-[#eaf6ee] px-5 pt-5 pb-[30px]">
        <img
          src="/illustrations/record-banner.jpg"
          alt="" aria-hidden="true"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ transform: 'translateX(-10px) translateY(-20px) scale(0.93)', transformOrigin: 'top right', objectPosition: 'right center' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, #eaf6ee 0%, #eaf6ee 30%, rgba(234,246,238,0) 50%)' }}
        />
        <div className="relative">
          <div className="max-w-[60%]">
            <p className="text-[12px] font-medium text-gray-600">건강한 습관, 오늘도 함께해요! 💚</p>
            <h2 className="mt-1 text-[18px] font-extrabold text-gray-900 leading-snug">
              프로그램을 선택하고<br />미션을 기록해보세요!
            </h2>
            <p className="text-[11px] text-gray-500 leading-snug" style={{ marginTop: '10px' }}>
              내가 참여중인 프로그램의<br />
              미션을 완료하고 기록하면<br />
              건강한 습관이 더 단단해져요.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenPicker}
            style={{ transform: 'translateY(10px)' }}
            className="mt-4 w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center justify-between px-3.5 shadow-sm transition"
          >
            <span className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-emerald-500" />
              </span>
              프로그램 선택하기
            </span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 최근 참여 프로그램 (1개) — 카드 */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[16px] font-bold text-gray-800">최근 참여 프로그램</h3>
          <button type="button" onClick={onOpenPicker} className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700">
            전체 보기<ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {recentGroup ? (
          <FeaturedProgram program={recentGroup.program} onClick={() => onSelect(recentGroup.program.id)} />
        ) : (
          <p className="text-sm text-gray-400 py-4 text-center">기록할 수 있는 프로그램이 없어요.</p>
        )}
      </div>

      {/* 혜택 — 카드 */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <h3 className="text-[16px] font-bold text-gray-800 mb-3">기록하면 이런 점이 좋아요!</h3>
        <div className="grid grid-cols-3 gap-2.5">
          <BenefitCard img="/icons/record/habit.png" title="습관 형성" desc="기록을 통해 건강한 습관을 만들 수 있어요." />
          <BenefitCard img="/icons/record/change.png" title="변화 확인" desc="나의 변화를 눈으로 확인할 수 있어요." />
          <BenefitCard img="/icons/record/reward.png" title="보상 획득" desc="기록하고 포인트를 모아 보상을 받아요." />
        </div>
      </div>
    </>
  )
}

// 최근 참여 프로그램 카드 (표지 + 이름 + 진행중 + 기간 + 진행률)
function FeaturedProgram({ program, onClick }) {
  const progress = calcProgress(program.start_date, program.end_date)
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 text-left"
    >
      <ProgramCover
        imagePath={program.cover_image_path}
        categories={program.categories}
        name={program.name}
        variant="thumb"
        className="w-[92px] h-[68px] aspect-auto rounded-xl flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className="text-[15px] font-bold text-gray-800 truncate">{program.name}</h4>
          <span className="inline-flex items-center px-1.5 h-[18px] rounded-[5px] text-[10px] font-bold bg-emerald-100 text-emerald-700 flex-shrink-0">진행중</span>
        </div>
        {program.start_date && program.end_date && (
          <p className="text-[11px] text-gray-500 mt-1 truncate">
            기간 {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[11px] text-gray-500 flex-shrink-0">진행률</span>
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[11px] font-bold text-emerald-600 flex-shrink-0">{progress}%</span>
        </div>
      </div>
    </button>
  )
}

// 프로그램 선택 모달 — 인증 가능 프로그램 리스트 (완료 프로그램은 비활성)
function ProgramPickerModal({ open, groups, onClose, onSelect }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl max-h-[80vh] overflow-y-auto p-4 sm:m-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[16px] font-bold text-gray-800">기록할 프로그램 선택</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-2.5">
          {groups.map(({ program, recordableCount }) => (
            <ProgramPickerCard key={program.id} program={program} recordableCount={recordableCount} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  )
}

// 모달 내 프로그램 카드 — 인증 가능: 클릭 / 완료: 비활성 + 완료 표시
function ProgramPickerCard({ program, recordableCount, onSelect }) {
  const catKey = program.categories?.[0] || 'ETC'
  const color = CATEGORY_HEX[catKey] || CATEGORY_HEX.ETC
  const catLabel = CATEGORY[catKey]?.label || '기타'
  const desc = oneLineDesc(program)
  const done = recordableCount === 0

  if (done) {
    return (
      <div className="w-full flex items-center gap-3 rounded-2xl p-3 bg-gray-50 border border-gray-100">
        <ProgramCover imagePath={program.cover_image_path} categories={program.categories} name={program.name} variant="thumb" className="w-[80px] h-[60px] aspect-auto rounded-xl flex-shrink-0 opacity-90" />
        <div className="flex-1 min-w-0">
          <span className="inline-flex items-center justify-center px-2 h-[18px] rounded-[5px] text-[10px] font-bold opacity-70" style={{ backgroundColor: `${color}22`, color }}>{catLabel}</span>
          <h4 className="text-[15px] font-bold text-gray-500 truncate mt-1">{program.name}</h4>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1"><Check className="w-3 h-3" /> 오늘 기록을 완료했어요!</p>
        </div>
        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3 text-white" /></div>
      </div>
    )
  }

  return (
    <button type="button" onClick={() => onSelect(program.id)} className="w-full flex items-center gap-3 rounded-2xl p-3 text-left bg-white border border-gray-100 shadow-soft hover:shadow-elevated transition">
      <ProgramCover imagePath={program.cover_image_path} categories={program.categories} name={program.name} variant="thumb" className="w-[80px] h-[60px] aspect-auto rounded-xl flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="inline-flex items-center justify-center px-2 h-[18px] rounded-[5px] text-[10px] font-bold" style={{ backgroundColor: `${color}22`, color }}>{catLabel}</span>
        <h4 className="text-[15px] font-bold text-gray-800 truncate mt-1">{program.name}</h4>
        {desc && <p className="text-[11px] text-gray-500 truncate mt-0.5">{desc}</p>}
      </div>
      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
    </button>
  )
}

function BenefitCard({ img, title, desc }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-3 flex flex-col items-center text-center">
      <img
        src={img}
        alt=""
        aria-hidden="true"
        onError={(e) => { e.currentTarget.style.display = 'none' }}
        className="w-12 h-12 object-contain mb-2"
      />
      <p className="text-[13px] font-bold text-gray-800">{title}</p>
      <p className="text-[10px] text-gray-500 mt-1 leading-snug break-keep">{desc}</p>
    </div>
  )
}

// ─── Step 2 — 선택 프로그램의 오늘 미션 (기존 MissionCard 재사용) ──
//   인증 후 복귀가 같은 프로그램 Step2 로 이어지도록 returnPath 에 ?program 포함.
function MissionSelectStep({ group, todayCounts, onBack }) {
  return (
    <div>
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
        <ArrowLeft className="w-4 h-4" /> 프로그램 다시 선택
      </button>
      <h3 className="text-[16px] font-bold text-gray-800">{group.program.name}</h3>
      <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
        기록할 미션을 선택하세요 <ChevronRight className="w-3 h-3" />
      </p>
      <div className="grid grid-cols-1 gap-3">
        {group.missions.map(m => (
          <MissionCard
            key={m.id}
            mission={m}
            todayCounts={todayCounts}
            isOwner={false}
            programId={m.program_id}
            navigateState={{ returnPath: `/record?program=${group.program.id}` }}
            navigateSearch="?from=record"
          />
        ))}
      </div>
    </div>
  )
}

// ─── 완료 축하 화면 (오늘 요약 통계 포함) ──────────────────
function CompletionView({ count, points, streak, onHome, onRanking }) {
  return (
    <div className="relative overflow-hidden bg-white border border-gray-100 rounded-2xl shadow-soft py-10 px-6 flex flex-col items-center text-center">
      <Confetti />
      <motion.div
        className="text-6xl mb-3 select-none relative"
        initial={{ scale: 0, rotate: -25 }}
        animate={{ scale: [0, 1.35, 0.92, 1.08, 1], rotate: [-25, 12, -6, 0] }}
        transition={{ duration: 0.9, times: [0, 0.4, 0.65, 0.85, 1], ease: 'easeOut' }}
      >
        🎉
      </motion.div>
      <h2 className="text-xl font-extrabold text-gray-900 relative">오늘의 기록을 모두 마쳤어요!</h2>
      <p className="text-sm text-gray-500 mt-2 leading-relaxed relative">꾸준함이 건강을 만듭니다 💚</p>

      {/* 오늘 요약 */}
      <div className="relative grid grid-cols-3 gap-2 w-full mt-6">
        <SummaryTile tone="emerald" icon="/icons/activity/complete.png" value={`${count}개`} label="완료 미션" />
        <SummaryTile tone="amber" icon="/icons/activity/point.png" value={`${points}P`} label="획득 점수" iconScale={1.08} />
        <SummaryTile tone="violet" icon="/icons/activity/streak.png" value={`${streak}일`} label="연속 인증" />
      </div>

      <div className="relative flex gap-2 mt-6 w-full">
        <button type="button" onClick={onHome} className="flex-1 h-11 rounded-xl bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 transition">
          홈으로
        </button>
        <button type="button" onClick={onRanking} className="flex-1 h-11 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-600 transition">
          랭킹 보기
        </button>
      </div>
    </div>
  )
}

const SUMMARY_TONE = {
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
  rose: 'bg-rose-50 text-rose-500',
}
function SummaryTile({ tone, value, label, icon, iconScale = 1 }) {
  return (
    <div className={`rounded-xl py-3 ${SUMMARY_TONE[tone]}`}>
      {icon && <img src={icon} alt="" style={iconScale !== 1 ? { transform: `scale(${iconScale})` } : undefined} className="w-7 h-7 mx-auto mb-1 object-contain" />}
      <p className="text-lg font-extrabold leading-none">{value}</p>
      <p className="text-[11px] text-gray-500 mt-1">{label}</p>
    </div>
  )
}

export default RecordPage
