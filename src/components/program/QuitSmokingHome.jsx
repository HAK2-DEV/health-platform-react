import { Fragment } from 'react'
import { motion } from 'framer-motion'
import { ChevronRight, Calendar, Activity, Award, Flame } from 'lucide-react'
import QuitSmokingHero from './QuitSmokingHero'
import ProgramHomeHero from './ProgramHomeHero'
import WeeklyStreak from './WeeklyStreak'
import FlameIcon from '../common/FlameIcon'
import CountUp from '../common/CountUp'
import { NavCard, GoalCard } from './ProgramHome'
import { progressUrgency } from '../../lib/programVisuals'

// 금연 테마 전용 카드형 홈 (탭 바 없이 카드 네비) — 달리기 RunningHome 방식.
//   고정: QuitSmokingHero(지표 히어로). 커스터마이즈 박스(순서·숨김 편집): 아래 QUIT_BOX_ORDER.
//   카드 메뉴: 미션·퀴즈·응원·내 변화(랭킹 대체). 금연 전용 요소(기분체크/팁/응원배너)는 slot 주입.
//   variant: 'basic'(지표 히어로만) | 'extras'(편집 히어로+목표+스트릭) | 'goal'(목표+스트릭). 실사용=goal.
// 금연 개요 박스 순서·집합(본인 지정 2026-07-10): 기분체크 → 공지 → 목표·스트릭 → 메뉴 → 금연 팁 → 응원 배너.
//   진행 현황(progress)은 금연에선 제외(QuitSmokingHero 가 이미 지표 표시).
export const QUIT_BOX_ORDER = ['mood', 'notice', 'summary', 'menu', 'tip', 'classes', 'banner']
export const QUIT_BOX_LABELS = {
  mood: '기분 체크', notice: '공지사항', menu: '메뉴', summary: '목표·주간 스트릭',
  tip: '금연 팁', banner: '응원 배너', classes: '클래스 일정',
}

function QuitSmokingHome({
  programId, programName = '', categories = ['NO_SMOKING'], coverImagePath = null,
  streak = 0, savedAmount = null, smokedToday = false, statusLabel = '진행중',
  progressData = null, progress = 0, notice = '',
  streakData = null,
  moodSlot = null, tipSlot = null, bannerSlot = null, classSlot = null,
  variant = 'basic',
  homeHero = null, onHeroChange = null, homeGoal = null, onGoalChange = null, ownerId = null, editable = false,
  streakRef = null,
  // 레이아웃 편집(운영자)
  boxOrder = null, hiddenBoxes = [], onEditLayout = () => {},
  quizEnabled = true, communityEnabled = true, changeEnabled = true,
  onRecord = () => {}, onOpenTab = () => {}, onNotice = null,
}) {
  const showEditHero = variant === 'extras'
  const showGoal = variant === 'extras' || variant === 'goal'
  const showStreak = variant === 'extras' || variant === 'goal'

  const cards = [
    { key: 'mission', iconSrc: '/icons/feature/mission.png', iconEmoji: '📋', title: '미션', desc: '금연 미션 인증', actionLabel: '기록하기', onClick: onRecord },
    quizEnabled && { key: 'quiz', iconSrc: '/icons/feature/quiz.png', iconEmoji: '❓', title: '퀴즈', desc: '금연 지식을 배워요', actionLabel: '풀어보기', onClick: () => onOpenTab('quizzes') },
    communityEnabled && { key: 'community', iconSrc: '/icons/feature/community.png', iconEmoji: '💬', title: '응원', desc: '서로 응원해요', actionLabel: '바로가기', onClick: () => onOpenTab('community') },
    changeEnabled && { key: 'change', iconSrc: '/icons/reward/trend.png', iconEmoji: '📈', title: '내 변화', desc: '나의 금연 변화', actionLabel: '확인하기', onClick: () => onOpenTab('change') },
  ].filter(Boolean)

  const goal = {
    emoji: homeGoal?.emoji ?? '🚭',
    title: homeGoal?.title ?? '금연 목표',
    value: homeGoal?.value ?? '0',
    unit: homeGoal?.unit ?? '개비',
    hint: homeGoal?.hint ?? '오늘도 깨끗하게',
  }

  // 커스터마이즈 박스 렌더 레지스트리
  const BOXES = {
    mood: () => moodSlot || null,
    notice: () => (
      <button type="button" onClick={onNotice || (() => onOpenTab('community'))}
        className="w-full flex items-center gap-3 rounded-2xl p-3.5 bg-white border border-gray-100 shadow-soft text-left hover:bg-gray-50 transition">
        <span className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 text-[15px]">📢</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-800">공지사항</p>
          <p className="text-[12px] text-gray-500 truncate">{notice || '등록된 공지가 없어요'}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
      </button>
    ),
    menu: () => (
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0,1fr))` }}>
        {cards.map((c) => (
          <NavCard key={c.key} iconSrc={c.iconSrc} iconEmoji={c.iconEmoji} title={c.title} desc={c.desc} actionLabel={c.actionLabel} onClick={c.onClick} />
        ))}
      </div>
    ),
    summary: () => {
      if (!showGoal) return null
      if (showStreak) {
        return (
          <div className="grid grid-cols-2 gap-3">
            <GoalCard emoji={goal.emoji} title={goal.title} value={goal.value} unit={goal.unit} hint={goal.hint} editable={editable} onSave={onGoalChange} />
            <WeeklyStreak ref={streakRef} count={streakData?.count || 0} days={streakData?.days || []} icon={<FlameIcon />} />
          </div>
        )
      }
      return <GoalCard emoji={goal.emoji} title={goal.title} value={goal.value} unit={goal.unit} hint={goal.hint} editable={editable} onSave={onGoalChange} />
    },
    tip: () => tipSlot || null,
    classes: () => classSlot || null,
    progress: () => !progressData ? null : (
      <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
        <h3 className="text-[13px] font-bold text-emerald-600 mb-3">나의 진행 현황</h3>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { Icon: Calendar, ic: 'text-emerald-500', lbl: '전체 진행', v: progressData.activeDays, prefix: '', u: `/${progressData.totalDays || '-'}일` },
            { Icon: Activity, ic: 'text-emerald-500', lbl: '참여율', v: progressData.participationRate, prefix: '', u: '%' },
            { Icon: Award, ic: 'text-amber-500', lbl: '획득 포인트', v: progressData.points, prefix: '+', u: 'P', c: 'text-emerald-700' },
            { Icon: Flame, ic: 'text-orange-500', lbl: '연속', v: progressData.streak, prefix: '', u: '일', c: 'text-orange-600' },
          ].map((s) => (
            <div key={s.lbl}>
              <div className="flex items-center gap-0.5 mb-1">
                <s.Icon className={`w-3 h-3 flex-shrink-0 ${s.ic}`} />
                <span className="text-[11px] font-semibold text-gray-600 whitespace-nowrap">{s.lbl}</span>
              </div>
              <p className={`text-lg font-semibold leading-tight ${s.c || 'text-gray-800'}`}>{s.prefix}<CountUp value={s.v} duration={900} /><span className="text-xs text-gray-500">{s.u}</span></p>
            </div>
          ))}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div className={`h-full rounded-full ${progressUrgency(progress).barCls || 'bg-emerald-400'}`}
            initial={{ width: 0 }} whileInView={{ width: `${progress}%` }}
            viewport={{ once: true, margin: '0px 0px -12% 0px' }} transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }} />
        </div>
      </div>
    ),
    banner: () => bannerSlot || null,
  }

  // 순서·숨김 적용 (메뉴는 숨김 불가)
  const base = (boxOrder && boxOrder.length ? boxOrder : QUIT_BOX_ORDER).filter((k) => QUIT_BOX_ORDER.includes(k))
  QUIT_BOX_ORDER.forEach((k) => { if (!base.includes(k)) base.push(k) })
  const hidden = new Set((hiddenBoxes || []).filter((k) => k !== 'menu'))
  const visibleKeys = base.filter((k) => !hidden.has(k) && (k !== 'classes' || classSlot))
  // 응원 배너는 항상 최하단
  const orderedKeys = visibleKeys.includes('banner')
    ? [...visibleKeys.filter((k) => k !== 'banner'), 'banner']
    : visibleKeys

  return (
    <div className="-mx-[11px] px-4 pb-6 space-y-[9px]">
      {/* [변형] 편집형 히어로 — extras 만 */}
      {showEditHero && (
        <ProgramHomeHero hero={homeHero} editable={editable} coverImagePath={coverImagePath}
          categories={categories} programName={programName} ownerId={ownerId} onHeroChange={onHeroChange} />
      )}

      {/* [고정] 금연 지표 히어로 — 진행중 배지는 페이지 헤더에 이미 있어 제외(제목과 겹침 방지) */}
      <QuitSmokingHero programId={programId} streak={streak} savedAmount={savedAmount}
        smokedToday={smokedToday} onAction={onRecord} />

      {/* [커스터마이즈] 운영자 순서·숨김 반영 (클래스 일정 포함) */}
      {orderedKeys.map((k) => <Fragment key={k}>{BOXES[k]()}</Fragment>)}

      {/* [운영자] 개요 화면 편집 */}
      {editable && (
        <div className="flex justify-center pt-1">
          <button type="button" onClick={onEditLayout}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-gray-100 text-gray-500 text-[13px] font-semibold hover:bg-gray-200 transition">
            ✏️ 개요 화면 편집
          </button>
        </div>
      )}
    </div>
  )
}

export default QuitSmokingHome
