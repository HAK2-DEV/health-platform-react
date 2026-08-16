import { useState } from 'react'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import { motion } from 'framer-motion'
import { ChevronRight, Calendar, Activity, Award, Flame, Pencil } from 'lucide-react'
import WeeklyStreak from './WeeklyStreak'
import ProgramHomeHero from './ProgramHomeHero'
import FlameIcon from '../common/FlameIcon'
import CountUp from '../common/CountUp'
import { progressUrgency } from '../../lib/programVisuals'
import { Reveal } from './statsAnim'

// 프로그램 홈 (카드형) — 표준 프로그램 상세를 달리기(RunningHome)처럼 카드 네비로.
//   고정 박스: 표지 히어로(최상단) + 메뉴 카드(바로 아래). 이동·숨김 불가.
//   커스터마이즈 박스: 운영자가 순서 변경 + 숨김/복원(home_layout, 마이그 154). 크기는 코드 고정(Rule 1).
//   달리기의 「코스 지도」 자리를 표지 히어로로 대체(본인 결정 2026-07-07).
//
// props:
//   programName, startDate('YYYY.MM.DD'), endDate, progress(0~100), statusLabel
//   coverImagePath, categories  — ProgramCover 폴백용
//   participantCount, myRank(null 가능), notice
//   metrics: [{ img?, emoji?, label, value, unit }]  — 주요 기록 요약(운영자 지표 합산)
//   quizEnabled, communityEnabled, rankingEnabled — 마법사 토글
//   boxOrder: string[] | null  — 커스터마이즈 박스 순서(null=기본). hiddenBoxes: string[] — 숨긴 박스 키.
//   onOpenTab(key), onRecord(), onNotice()

// 커스터마이즈 가능한 박스 — 기본 순서 + 라벨(편집 화면·Phase 2 에서 재사용). 고정(hero/menu) 제외.
export const HOME_BOX_ORDER = ['notice', 'summary', 'menu', 'classes', 'progress', 'metrics', 'todayMissions', 'recent', 'banner']
export const HOME_BOX_LABELS = {
  notice: '공지사항',
  summary: '요약 지표',
  menu: '메뉴',
  progress: '진행 현황',
  metrics: '주요 기록 요약',
  todayMissions: '오늘의 미션',
  recent: '최근 인증',
  banner: '격려 배너',
  classes: '클래스 일정',
}
// 박스 크기(고정, Rule 1) — 편집 화면에서 실제 크기감으로 표시. Long(큰) / Wide(중)
export const HOME_BOX_SIZES = {
  notice: 'Wide',
  summary: 'Wide',
  progress: 'Wide',
  metrics: 'Wide',
  todayMissions: 'Long',
  recent: 'Long',
  banner: 'Wide',
  classes: 'Wide',
}

// 카테고리별 추천/목표 (요약 지표 박스 좌측) — 제목·내용이 카테고리에 맞게 바뀜.
//   달리기는 운영자 설정 페이스(pace) 사용, 그 외는 카테고리 기본 목표.
const CATEGORY_GOAL = {
  RUNNING: { title: '추천 페이스', emoji: '⏱️', unit: '/km', hint: '편안하게 유지해요!' },
  WALKING: { title: '목표 걸음', emoji: '👣', value: '8,000', unit: '보', hint: '오늘도 활기차게!' },
  DIET: { title: '목표 칼로리', emoji: '🍱', value: '1,800', unit: 'kcal', hint: '균형 잡힌 한 끼' },
  SLEEP: { title: '목표 수면', emoji: '🌙', value: '7', unit: '시간', hint: '규칙적인 수면 습관' },
  MINDCARE: { title: '명상 목표', emoji: '🧘', value: '10', unit: '분', hint: '마음을 돌보는 시간' },
  EMPATHY: { title: '감사 한 줄', emoji: '🤝', value: '1', unit: '개', hint: '고마움을 나눠요' },
  NO_SMOKING: { title: '금연 목표', emoji: '🚭', value: '0', unit: '개비', hint: '오늘도 깨끗하게' },
  ETC: { title: '오늘의 목표', emoji: '🎯', value: '-', unit: '', hint: '한 걸음씩 함께해요' },
}

// 3D 아이콘 + 폴백(이모지) — public/icons/<group>/<name>.png
// export: 완주 축하 모달 등 다른 화면에서도 동일 폴백 규칙으로 재사용
export function Icon3D({ src, emoji, className = 'w-[22px] h-[22px]' }) {
  const [err, setErr] = useState(false)
  if (err) return <span className={`${className} inline-flex items-center justify-center leading-none flex-shrink-0`}>{emoji}</span>
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      onError={() => setErr(true)}
      className={`${className} object-contain flex-shrink-0`}
    />
  )
}

// 가로 배치 메뉴 카드 — 아이콘 상단 중앙 + 제목 + 설명 + 버튼 (레퍼런스: 달리기 홈 하단 카드).
export function NavCard({ iconSrc, iconEmoji, title, desc, actionLabel, onClick, newCount = 0, compact = false }) {
  // 컴팩트 — 메뉴가 5개 이상일 때 1줄 유지용. 아이콘+라벨만, 카드 전체가 탭.
  if (compact) {
    return (
      <button type="button" onClick={onClick}
        className="relative rounded-2xl px-1 py-2.5 bg-white border border-gray-100 shadow-soft flex flex-col items-center text-center gap-1 active:scale-95 transition">
        {newCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 shadow-sm" />}
        <Icon3D src={iconSrc} emoji={iconEmoji} className="w-8 h-8" />
        <span className="text-[11px] font-bold text-gray-800 leading-tight">{title}</span>
      </button>
    )
  }
  return (
    <div className="relative rounded-2xl p-2 pt-3 bg-white border border-gray-100 shadow-soft flex flex-col items-center text-center gap-1">
      {newCount > 0 && (
        <span className="absolute top-1.5 right-1.5 px-1.5 py-[1px] rounded-full bg-red-500 text-white text-[8px] font-extrabold tracking-wide shadow-sm">NEW</span>
      )}
      <Icon3D src={iconSrc} emoji={iconEmoji} className="w-9 h-9" />
      <p className="text-[12px] font-bold text-gray-800 leading-tight">{title}</p>
      <p className="text-[9.5px] text-gray-500 leading-tight break-keep mb-1">{desc}</p>
      <button
        type="button"
        onClick={onClick}
        className="w-full h-7 mt-auto rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center whitespace-nowrap transition"
      >
        {actionLabel}
      </button>
    </div>
  )
}

// 목표 카드 아이콘 팔레트 — 운영자가 고르는 이모지 후보(건강·목표 계열)
const GOAL_EMOJIS = ['🎯', '⏱️', '👣', '🏃', '🚶', '🍱', '🥗', '💪', '🔥', '🌙', '😴', '🧘', '🧠', '❤️', '🩺', '🚭', '💧', '⭐', '🏆', '📈']

// 목표 카드 편집 입력 필드 (모듈 레벨 — 내부 정의 시 리마운트로 포커스 빠짐 방지)
function GoalField({ label, value, onChange, placeholder, cls = '' }) {
  return (
    <label className={`block ${cls}`}>
      <span className="text-[12px] font-bold text-gray-600">{label}</span>
      <input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full h-9 px-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-emerald-400" />
    </label>
  )
}

// 요약 지표 좌측 「목표 카드」 — 운영자가 제목·내용·단위·힌트 편집 (달리기 추천 페이스 카드 구조).
export function GoalCard({ emoji, title, value, unit, hint, editable = false, onSave = null }) {
  const [editing, setEditing] = useState(false)
  useBodyScrollLock(editing)  // 목표 카드 편집 오버레이 — iOS 배경 스크롤 방지
  useBackButtonClose(editing, () => setEditing(false))  // 하드웨어 뒤로가기 = 닫기
  const kbInset = useKeyboardInset()   // iOS 키보드 높이 — 목표 편집 입력 시 카드 위로
  const [draft, setDraft] = useState({ emoji, title, value, unit, hint })
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))
  const open = () => { setDraft({ emoji, title, value, unit, hint }); setEditing(true) }
  const save = () => {
    onSave?.({ emoji: draft.emoji || emoji, title: (draft.title || '').trim(), value: (draft.value || '').trim(), unit: (draft.unit || '').trim(), hint: (draft.hint || '').trim() })
    setEditing(false)
  }
  // 현재 아이콘이 팔레트에 없으면 앞에 붙여 항상 선택 상태로 보이게
  const palette = draft.emoji && !GOAL_EMOJIS.includes(draft.emoji) ? [draft.emoji, ...GOAL_EMOJIS] : GOAL_EMOJIS
  return (
    <div className="relative rounded-2xl p-3.5 bg-white border border-gray-100 shadow-soft">
      {editable && (
        <button type="button" onClick={open} className="absolute top-2.5 right-2.5 text-gray-300 hover:text-emerald-500 transition" aria-label="목표 카드 편집">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      <div className="flex items-start gap-2.5">
        <span className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 text-lg">{emoji}</span>
        <div className="min-w-0 flex-1">
          <span className="text-[13px] font-bold text-gray-800">{title}</span>
          {/* 값 글씨를 기기 폭에 맞춰 축소(clamp) + 단위 줄바꿈 방지 → SE 등 좁은 화면에서 단위 밀림 방지 */}
          <p className="font-extrabold text-emerald-600 leading-none whitespace-nowrap" style={{ marginTop: '15px', fontSize: 'clamp(14px, 4.6vw, 20px)' }}>{value}<span className="text-[11px] font-bold text-gray-400 ml-1">{unit}</span></p>
          <p className="text-[10px] text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis" style={{ marginTop: '6px' }}>{hint}</p>
        </div>
      </div>
      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-5" style={{ background: 'rgba(15,23,42,0.45)', paddingBottom: kbInset ? kbInset + 20 : undefined, transition: 'padding-bottom .2s ease' }} onClick={() => setEditing(false)}>
          <div className="w-full max-w-[320px] rounded-2xl bg-white p-5 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-gray-800">목표 카드 편집</h3>
            <div>
              <span className="text-[12px] font-bold text-gray-600">아이콘</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {palette.map((e) => (
                  <button key={e} type="button" onClick={() => set('emoji', e)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition ${draft.emoji === e ? 'bg-emerald-100 ring-2 ring-emerald-400' : 'bg-gray-50 hover:bg-gray-100'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <GoalField label="제목" value={draft.title} onChange={(v) => set('title', v)} placeholder="예: 목표 걸음" />
            <div className="flex gap-2">
              <GoalField label="내용" value={draft.value} onChange={(v) => set('value', v)} placeholder="예: 8,000" cls="flex-[1.5]" />
              <GoalField label="단위" value={draft.unit} onChange={(v) => set('unit', v)} placeholder="예: 보" cls="flex-1" />
            </div>
            <GoalField label="힌트" value={draft.hint} onChange={(v) => set('hint', v)} placeholder="예: 오늘도 활기차게!" />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setEditing(false)} className="flex-1 h-10 rounded-lg border border-gray-200 text-gray-500 text-[14px] font-bold">취소</button>
              <button type="button" onClick={save} className="flex-[1.4] h-10 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProgramHome({
  programName = '',
  startDate = '',
  endDate = '',
  progress = 0,
  statusLabel = '진행중',
  coverImagePath = null,
  categories = [],
  participantCount = null,
  journeyText = '',            // 히어로 여정 문구 "D+N · M일 여정"
  ownerName = null,            // 히어로 메타 "운영 X"
  onParticipantsClick = null,  // 「참여자 N명」 클릭 → 명단 모달
  myRank = null,
  notice = '',
  metrics = [],
  quizEnabled = true,
  communityEnabled = true,
  rankingEnabled = true,
  boxOrder = null,
  hiddenBoxes = [],
  streakData = null,          // { count, days:[{label,done,today}] } — 주간 스트릭
  progressData = null,        // { activeDays, totalDays, participationRate, points, streak } — 진행 현황
  todayMissions = [],         // [{ id, title, thumb, done, pt }] — 오늘의 미션
  recentItems = [],           // [{ id, title, point, time }] — 최근 인증
  pace = null,                // 달리기 추천 페이스 (요약 지표 좌측)
  homeHero = null,            // 편집형 히어로 config (home_hero)
  onHeroChange = null,        // 히어로 저장
  homeGoal = null,            // 요약 지표 목표 카드 config (home_goal)
  onGoalChange = null,        // 목표 카드 저장
  ownerId = null,             // 히어로 배경 업로드 storage path (owner uid)
  streakRef = null,           // 주간 스트릭 ref — 첫 인증 후 개요 진입 시 도장 재생용
  editable = false,           // 운영자 — 「개요 화면 편집」 박스 노출
  onEditLayout = () => {},    // 편집 화면 열기(Phase 2)
  onBack = null,              // immersive 히어로 — 뒤로가기
  onSettings = null,          // immersive 히어로 — 운영자 설정
  pendingCount = 0,
  reviewSlot = null,          // immersive — 인증 심사 대기 배너(시트 상단)
  endReportSlot = null,       // immersive — 종료 리포트 배너(시트 최상단)
  activationSlot = null,      // immersive — 활성화 넛지(시트 최상단)
  viewerSlot = null,          // 둘러보기(비참여자) 참여 신청 배너 — 히어로 아래 시트 최상단
  weeklySlot = null,          // immersive — 주간 하이라이트 카드(운영자)
  classSlot = null,           // 강사 클래스 개요 진입 카드 (기능 ON 시 주입)
  onOpenTab = () => {},
  onRecord = () => {},
  onNotice = null,
  noticeUnread = false,       // 새 공지 미열람 → 공지 아이콘에 빨간 점(콩닥)
  newMissionCount = 0,        // 새 미션 개수 (NEW 배지)
  newQuizCount = 0,           // 새 퀴즈 개수
}) {
  const cards = [
    { key: 'mission', iconSrc: '/icons/feature/mission.png', iconEmoji: '📋', title: '미션', desc: '목표를 달성해요', actionLabel: '기록하기', onClick: onRecord, newCount: newMissionCount },
    quizEnabled && { key: 'quiz', iconSrc: '/icons/feature/quiz.png', iconEmoji: '❓', title: '퀴즈', desc: '건강 지식을 배워요', actionLabel: '풀어보기', onClick: () => onOpenTab('quizzes'), newCount: newQuizCount },
    communityEnabled && { key: 'community', iconSrc: '/icons/feature/community.png', iconEmoji: '💬', title: '커뮤니티', desc: '함께 응원해요', actionLabel: '바로가기', onClick: () => onOpenTab('community') },
    rankingEnabled && { key: 'ranking', iconSrc: '/icons/reward/ranking.png', iconEmoji: '🏆', title: '랭킹', desc: '순위를 확인해요', actionLabel: '확인하기', onClick: () => onOpenTab('ranking') },
  ].filter(Boolean)

  // ── 커스터마이즈 박스 렌더 레지스트리 (크기 고정) ──
  const BOXES = {
    // 공지사항 (Wide)
    notice: () => (
      <button
        type="button"
        onClick={onNotice || (() => onOpenTab('community'))}
        className="w-full flex items-center gap-3 rounded-2xl p-3.5 bg-white border border-gray-100 shadow-soft text-left hover:bg-gray-50 transition"
      >
        <span className="relative inline-flex flex-shrink-0">
          <Icon3D src="/icons/feature/notice.png" emoji="📢" className="w-8 h-8" />
          {noticeUnread && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white notice-dot-pulse" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-800">공지사항</p>
          <p className="text-[12px] text-gray-500 truncate">{notice || '등록된 공지가 없어요'}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
      </button>
    ),
    // 주요 기록 요약 (Wide) — 지표 없으면 미표시
    metrics: () => metrics.length === 0 ? null : (
      <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
        <h3 className="text-[13px] font-bold text-gray-800 mb-3">주요 기록 요약</h3>
        <div className="flex">
          {metrics.map((c, i) => (
            <div key={c.label + i} className={`flex-1 min-w-0 flex flex-col items-center text-center px-1 ${i !== 0 ? 'border-l border-gray-100' : ''}`}>
              <div className="flex items-center gap-0.5 mb-1 min-w-0">
                {c.img ? <Icon3D src={c.img} emoji={c.emoji} className="w-[18px] h-[18px] flex-shrink-0" /> : <span className="text-[15px] leading-none flex-shrink-0">{c.emoji}</span>}
                <span className="text-[10px] text-gray-400 truncate min-w-0">{c.label}</span>
              </div>
              <span className="block w-full truncate tabular-nums text-[15px] font-extrabold text-gray-900 leading-tight">{c.value}<span className="text-[10px] font-medium text-gray-400 ml-0.5">{c.unit}</span></span>
            </div>
          ))}
        </div>
      </div>
    ),
    // 요약 지표 (Wide) — [카테고리 추천/목표] + [주간 스트릭] 묶음.
    //   달리기 홈의 「추천 페이스 카드 + WeeklyStreak」 레이아웃을 그대로 복사(구조·간격·들여쓰기·불꽃 동일).
    summary: () => {
      const g = CATEGORY_GOAL[(categories && categories[0]) || 'ETC'] || CATEGORY_GOAL.ETC
      const defValue = g.value != null ? g.value : (pace || "6'20")   // 달리기는 운영자 페이스
      // 운영자가 저장한 값(home_goal) 우선, 없으면 카테고리 기본값
      const goal = {
        emoji: homeGoal?.emoji ?? g.emoji,
        title: homeGoal?.title ?? g.title,
        value: homeGoal?.value ?? defValue,
        unit: homeGoal?.unit ?? g.unit,
        hint: homeGoal?.hint ?? g.hint,
      }
      return (
        <div className="grid grid-cols-2 gap-3">
          {/* 카테고리 추천/목표 — 운영자 편집 가능(제목·내용·단위·힌트) */}
          <GoalCard
            emoji={goal.emoji} title={goal.title} value={goal.value} unit={goal.unit} hint={goal.hint}
            editable={editable} onSave={onGoalChange}
          />
          {/* 주간 스트릭 — 달리기와 동일 컴포넌트 재사용(불꽃 아이콘 포함) */}
          <WeeklyStreak
            ref={streakRef}
            count={streakData?.count || 0}
            days={streakData?.days || []}
            icon={<FlameIcon />}
          />
        </div>
      )
    },
    // 진행 현황 (Wide)
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
                <span className="text-[10px] font-semibold text-gray-600 whitespace-nowrap">{s.lbl}</span>
              </div>
              <p className={`text-lg font-semibold leading-tight truncate tabular-nums ${s.c || 'text-gray-800'}`}>{s.prefix}<CountUp value={s.v} duration={900} /><span className="text-xs text-gray-500">{s.u}</span></p>
            </div>
          ))}
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${progressUrgency(progress).barCls || 'bg-emerald-400'}`}
            initial={{ width: 0 }}
            whileInView={{ width: `${progress}%` }}
            viewport={{ once: true, margin: '0px 0px -12% 0px' }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
          />
        </div>
      </div>
    ),
    // 오늘의 미션 (Long) — 최대 3개 미리보기
    todayMissions: () => !(todayMissions?.length) ? null : (
      <div>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <p className="text-[13px] font-bold text-gray-700">오늘의 미션</p>
          <button type="button" onClick={onRecord} className="text-[11px] text-gray-400">전체 보기 ›</button>
        </div>
        <div className="space-y-2">
          {todayMissions.slice(0, 3).map((m) => (
            <div key={m.id} className="bg-white rounded-2xl shadow-soft border border-gray-100 p-3 flex items-center gap-3">
              {m.thumb ? <img src={m.thumb} alt="" className="w-11 h-11 rounded-xl object-contain bg-gray-50 flex-shrink-0" /> : <span className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-xl flex-shrink-0">📋</span>}
              <div className="flex-1 min-w-0"><p className="text-[13px] font-bold text-gray-800 truncate">{m.title}</p><p className="text-[10px] text-emerald-600 font-bold mt-0.5">+{m.pt}P</p></div>
              {m.done
                ? <span className="text-[11px] font-bold text-emerald-600 flex-shrink-0">✓ 완료</span>
                : <button type="button" onClick={onRecord} className="text-[11px] font-bold text-white bg-emerald-500 rounded px-3 py-1.5 flex-shrink-0">인증</button>}
            </div>
          ))}
        </div>
      </div>
    ),
    // 최근 인증 (Long) — 최대 3개
    recent: () => !(recentItems?.length) ? null : (
      <div>
        <p className="text-[13px] font-bold text-gray-700 mb-1.5 px-0.5">최근 인증 기록</p>
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 divide-y divide-gray-50">
          {recentItems.slice(0, 3).map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-base flex-shrink-0">✅</span>
              <div className="flex-1 min-w-0"><p className="text-[12px] font-bold text-gray-700 truncate">{r.title}</p><p className="text-[10px] text-gray-400">{r.time}</p></div>
              <span className="text-[11px] font-bold text-emerald-600 flex-shrink-0">+{r.point}P</span>
            </div>
          ))}
        </div>
      </div>
    ),
    // 메뉴 카드 (미션/퀴즈/커뮤니티/랭킹) — 활성 개수만큼 가로 균등 배치. 한 단위로 이동/숨김.
    menu: () => (
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))` }}>
        {cards.map((b) => (
          <NavCard key={b.key} iconSrc={b.iconSrc} iconEmoji={b.iconEmoji} title={b.title} desc={b.desc} actionLabel={b.actionLabel} onClick={b.onClick} newCount={b.newCount} />
        ))}
      </div>
    ),
    // 격려 배너 (Wide) — 하단 CTA. 위치 편집 가능(커스터마이즈 박스). 후속: 운영자 문구 편집
    banner: () => (
      <div className="relative overflow-hidden rounded-2xl border border-gray-100 shadow-soft bg-gradient-to-r from-sky-50 to-emerald-50 h-[78px] flex items-center gap-3 p-4">
        <span className="w-11 h-11 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0">
          <Icon3D src="/icons/growth/sprout.png" emoji="🌱" className="w-9 h-9" />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-extrabold text-gray-800 truncate">오늘도 한 걸음 더, 함께해요</p>
          <p className="text-[11px] text-gray-500 mt-0.5 truncate">작은 습관이 큰 변화를 만들어요!</p>
        </div>
      </div>
    ),
    // 강사 클래스 — 개요 진입 카드 (기능 ON 시 주입). 위치·숨김 편집 가능.
    classes: () => classSlot || null,
  }
  // 저장된 순서 우선 + 신규 박스(예: classes)는 뒤에 append(구 레이아웃 대응).
  //   'classes' 박스는 강사 클래스 기능 ON(classSlot 주입) 일 때만 존재.
  const savedOrder = (boxOrder && boxOrder.length ? boxOrder : HOME_BOX_ORDER).filter((k) => BOXES[k])
  HOME_BOX_ORDER.forEach((k) => { if (BOXES[k] && !savedOrder.includes(k)) savedOrder.push(k) })
  const order = savedOrder.filter((k) => k !== 'classes' || classSlot)
  const hidden = new Set(hiddenBoxes)
  const visibleKeys = order.filter((k) => !hidden.has(k))
  // 응원 배너는 항상 최하단 (레이아웃 편집·신규 박스와 무관하게 고정)
  const orderedKeys = visibleKeys.includes('banner')
    ? [...visibleKeys.filter((k) => k !== 'banner'), 'banner']
    : visibleKeys

  return (
    <div className="-mx-[11px]" style={{ marginTop: 'calc(-0.5rem - max(env(safe-area-inset-top, 0px), 0.75rem))' }}>
      {/* [고정] 커버 히어로 — 전체폭 252px + 상태바 밑까지 (immersive). 커버+스크림+밝은 페이드+타이틀 */}
      <ProgramHomeHero
        hero={homeHero}
        editable={editable}
        coverImagePath={coverImagePath}
        categories={categories}
        programName={programName}
        statusLabel={statusLabel}
        participantCount={participantCount}
        journeyText={journeyText}
        ownerName={ownerName}
        ownerId={ownerId}
        onHeroChange={onHeroChange}
        onBack={onBack}
        onSettings={onSettings}
        onParticipantsClick={onParticipantsClick}
        pendingCount={pendingCount}
      />

      {/* 콘텐츠 시트 — 히어로 위로 -22px 겹치며 26px 라운드로 시작 */}
      <div className="relative -mt-[22px] rounded-t-[26px] px-4 pt-5 pb-6 space-y-[9px]" style={{ background: '#fdfbf7' }}>
        {/* 둘러보기(비참여자) 참여 신청 배너 — 히어로와 겹치지 않게 시트 최상단 */}
        {viewerSlot}
        {/* 활성화 넛지 / 종료 리포트 / 인증 심사 배너 (운영자) — immersive 에선 히어로 아래 시트 최상단 */}
        {activationSlot}
        {endReportSlot}
        {reviewSlot}
        {weeklySlot}
        {/* [커스터마이즈] 운영자 순서·숨김 반영 — 진입 시 순차 페이드업 */}
        {orderedKeys.map((k, i) => {
          const content = BOXES[k]()
          return content ? <Reveal key={k} index={Math.min(i, 5)}>{content}</Reveal> : null
        })}

        {/* [운영자] 개요 화면 편집 — 가장 아래·중앙·옅은 회색 */}
        {editable && (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={onEditLayout}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-gray-100 text-gray-500 text-[13px] font-semibold hover:bg-gray-200 transition"
            >
              ✏️ 개요 화면 편집
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProgramHome
