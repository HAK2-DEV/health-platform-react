import { useState } from 'react'

// 3D 아이콘을 "실제 화면과 유사한" 목업 안에 배치해 미리보는 페이지 — /icon-mockups.
//   실제 앱은 아직 건드리지 않음. 여기서 맥락 속 모습을 보고 괜찮으면 실제 화면으로 옮긴다.
//   아이콘 경로: public/icons/<group>/<key>.png · 로드 실패 시 이모지 폴백.

function I({ group, name, emoji, size = 24, className = '' }) {
  const [err, setErr] = useState(false)
  if (err) return <span style={{ fontSize: size * 0.82, lineHeight: 1 }} className={className}>{emoji}</span>
  return (
    <img
      src={`/icons/${group}/${name}.png`}
      alt=""
      aria-hidden="true"
      onError={() => setErr(true)}
      style={{ width: size, height: size }}
      className={`object-contain ${className}`}
    />
  )
}

// 폰 프레임 — 화면 하나를 감싸는 목업 틀.
function Phone({ title, children }) {
  return (
    <div className="shrink-0">
      <p className="text-[12px] font-bold text-gray-500 mb-2 px-1">{title}</p>
      <div className="w-[340px] rounded-[26px] border-[6px] border-gray-900 bg-[#f6faf8] overflow-hidden shadow-xl">
        <div className="h-[640px] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

// ─── 실제 앱 하단 탭바(BottomTabBar)의 정적 복제 ──────────────
//   5칸: 대시보드 / 프로그램 / 가운데 기록하기(+) / 랭킹 / 마이페이지. 라벨 + solid heroicons(MIT).
const HomeSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 11-1.06 1.06l-.69-.69v6.81a1.5 1.5 0 01-1.5 1.5h-3a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75h-3a1.5 1.5 0 01-1.5-1.5v-6.81l-.69.69a.75.75 0 01-1.06-1.06l8.69-8.69z" />
  </svg>
)
const FlagSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.77l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3A.75.75 0 013 2.25z" />
  </svg>
)
const ChartSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.75 3.75a.75.75 0 00-.75.75v15c0 .414.336.75.75.75h.75a.75.75 0 00.75-.75v-15a.75.75 0 00-.75-.75h-.75zM11.625 7.5a.75.75 0 00-.75.75v11.25c0 .414.336.75.75.75h.75a.75.75 0 00.75-.75V8.25a.75.75 0 00-.75-.75h-.75zM4.5 11.25a.75.75 0 00-.75.75v7.5c0 .414.336.75.75.75h.75a.75.75 0 00.75-.75V12a.75.75 0 00-.75-.75H4.5z" />
  </svg>
)
const UserSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" />
  </svg>
)
const PlusIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={className} aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)
// 성장 탭 아이콘 — 2D 새싹 (나머지 탭과 크기·무게감 통일 · solid fill)
//   잎을 도톰하게 + 줄기를 두껍게 해 heroicons solid 와 시각적 무게 맞춤.
const SproutSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M10.9 11h2.2v10h-2.2z" />
    <path d="M12 12.6C12 7.5 8.6 4.4 3.2 4.8c-.4 5.1 3 8.2 8.8 7.8Z" />
    <path d="M12 12.6C12 7.5 15.4 4.4 20.8 4.8c.4 5.1-3 8.2-8.8 7.8Z" />
  </svg>
)

function TabBar({ active }) {
  const tabs = [
    { key: 'dashboard', label: '대시보드', Icon: HomeSolid },
    { key: 'programs', label: '프로그램', Icon: FlagSolid },
    { key: 'growth', label: '성장', Icon: SproutSolid },
    { key: 'profile', label: '마이페이지', Icon: UserSolid },
  ]
  const Tab = ({ t }) => {
    const on = active === t.key
    return (
      <div className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 ${on ? 'text-emerald-600' : 'text-gray-400'}`}>
        <t.Icon className="w-6 h-6" />
        <span className="text-[11px] font-medium">{t.label}</span>
      </div>
    )
  }
  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-100">
      <div className="flex items-stretch">
        <Tab t={tabs[0]} />
        <Tab t={tabs[1]} />
        {/* 가운데 기록하기 — 떠 있는 + 버튼 */}
        <div className="flex-1 flex items-center justify-center">
          <span className="-translate-y-[18px]">
            <span className="flex w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white items-center justify-center shadow-lg shadow-emerald-500/40">
              <PlusIcon className="w-6 h-6" />
            </span>
          </span>
        </div>
        <Tab t={tabs[2]} />
        <Tab t={tabs[3]} />
      </div>
    </div>
  )
}

function Header({ title }) {
  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur h-[44px] px-3 flex items-center justify-between border-b border-gray-100">
      <span className="text-[15px] font-extrabold text-gray-800">{title}</span>
      <div className="relative">
        <I group="feature" name="bell" emoji="🔔" size={22} />
        <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white">3</span>
      </div>
    </div>
  )
}

// ─── 1. 홈 대시보드 (실제 DashboardPage 재현) ────────────────
// 대시보드 4지표용 solid heroicons (실제 화면과 동일 · MIT)
const UsersSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z" /></svg>
)
const CalendarSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Z" /></svg>
)
const ClipboardSolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0 1 18 9.375v9.375a3 3 0 0 0 3-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 0 0-.673-.05A3 3 0 0 0 15 1.5h-1.5a3 3 0 0 0-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6ZM13.5 3A1.5 1.5 0 0 0 12 4.5h4.5A1.5 1.5 0 0 0 15 3h-1.5Z" clipRule="evenodd" /><path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 0 1 3 20.625V9.375ZM6 12a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H6.75a.75.75 0 0 1-.75-.75V12Zm2.25 0a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75ZM6 15a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H6.75a.75.75 0 0 1-.75-.75V15Zm2.25 0a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75ZM6 18a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H6.75a.75.75 0 0 1-.75-.75V18Zm2.25 0a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5H9a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" /></svg>
)
const BellOutline = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" /></svg>
)
const CalOutline = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
)
const ChevR = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
)
const ChevL = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d="m15 5-7 7 7 7" /></svg>
)
const TrophySolid = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M5.166 2.621v.858c-1.035.148-2.059.33-3.071.543a.75.75 0 0 0-.584.859 6.753 6.753 0 0 0 6.138 5.6 6.73 6.73 0 0 0 2.743 1.347A6.707 6.707 0 0 1 9.279 15H8.54c-1.036 0-1.875.84-1.875 1.875V19.5h-.75a2.25 2.25 0 0 0-2.25 2.25c0 .414.336.75.75.75h15a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-2.25-2.25h-.75v-2.625c0-1.036-.84-1.875-1.875-1.875h-.739a6.706 6.706 0 0 1-1.112-3.173 6.73 6.73 0 0 0 2.743-1.347 6.753 6.753 0 0 0 6.139-5.6.75.75 0 0 0-.585-.858 47.077 47.077 0 0 0-3.07-.543V2.62a.75.75 0 0 0-.658-.744 49.22 49.22 0 0 0-6.093-.377c-2.063 0-4.096.128-6.093.377a.75.75 0 0 0-.657.744ZM5.166 5.25c0 1.196.312 2.32.857 3.294A5.266 5.266 0 0 1 3.16 5.337a45.6 45.6 0 0 1 2.006-.343V5.25Zm13.5 0v-.256c.674.1 1.343.214 2.006.343a5.265 5.265 0 0 1-2.863 3.207 6.72 6.72 0 0 0 .857-3.294Z" /></svg>
)

// 내 랭킹 도넛 링 (정적)
function RankRing({ rank, total }) {
  const R = 30, C = 2 * Math.PI * R
  const pct = Math.max(0.04, Math.min(1, (total - rank + 1) / total))
  return (
    <div className="relative w-[84px] h-[84px]">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r={R} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <circle cx="40" cy="40" r={R} fill="none" stroke="#10b981" strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] text-emerald-600 font-semibold leading-none">내 랭킹</span>
        <span className="text-lg font-extrabold text-gray-900 leading-tight">{rank}등</span>
        <span className="text-[10px] text-gray-400 leading-none">/ {total}명</span>
      </div>
    </div>
  )
}

// 대시보드 섹션 카드
function SectionCard({ title, action, children }) {
  return (
    <section className="bg-white rounded-[10px] shadow-elevated p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
function CardAction({ children }) {
  return <span className="flex items-center gap-0.5 text-xs text-gray-500">{children}<ChevR className="w-3 h-3" /></span>
}

function HomeMock() {
  // 운영자 관점 — 운영 중인 프로그램(참여자/오늘 참여율/남은 기간/누적 인증). 지표 아이콘은 원래대로 2D solid.
  const stats = [
    { Icon: UsersSolid, label: '참여자', num: '128', unit: '명', color: 'text-emerald-600' },
    { Icon: FlagSolid, label: '오늘 참여율', num: '84', unit: '%', color: 'text-emerald-600' },
    { Icon: CalendarSolid, label: '남은 기간', num: '12', unit: '일', color: 'text-gray-900' },
    { Icon: ClipboardSolid, label: '누적 인증', num: '342', unit: '건', color: 'text-gray-900' },
  ]
  const today = [
    { img: '/icons/activity/mission.png', label: '미션 완료', v: 5, fill: 62, bar: 'bg-emerald-500' },
    { img: '/icons/activity/record.png', label: '기록 작성', v: 3, fill: 60, bar: 'bg-blue-500', scale: 1.7 },
    { img: '/icons/activity/comment.png', label: '댓글 활동', v: 8, fill: 80, bar: 'bg-amber-500' },
    { glyph: 'P', label: '획득 점수', v: 120, fill: 40, bar: 'bg-amber-500', circleBg: 'bg-amber-100', glyphCls: 'text-amber-500' },
  ]
  return (
    <>
      {/* 헤더 — 앱 아이콘 + 이름 + 알림 */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm h-[46px] px-4 flex items-center justify-center relative">
        <div className="flex items-center gap-1.5">
          <img src="/app-icon.png" alt="" aria-hidden="true" onError={(e) => { e.currentTarget.style.display = 'none' }} className="w-5 h-5 rounded-md" />
          <span className="text-[16px] font-bold text-gray-800">건강증진 플랫폼</span>
        </div>
        <div className="absolute right-3">
          <button type="button" className="relative w-9 h-9 flex items-center justify-center rounded-full">
            <BellOutline className="w-5 h-5 text-gray-600" />
            <span className="absolute top-0.5 right-0.5 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white">3</span>
          </button>
        </div>
      </div>

      <div className="px-4 pt-[9px] pb-4 space-y-[9px]">
        {/* 인사말 헤더 (이미지 카드) */}
        <div className="relative overflow-hidden rounded-[10px] bg-[#eef7f1] h-[120px]">
          <img src="/home-header.jpg" alt="" aria-hidden="true" onError={(e) => { e.currentTarget.style.display = 'none' }} className="absolute inset-0 w-full h-full object-cover" style={{ objectPosition: 'center 56%' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #eef7f1 0%, #eef7f1 50%, rgba(238,247,241,0) 72%)' }} />
          <div className="relative h-full px-4 flex flex-col justify-center gap-[8px]">
            <p className="text-[13px] font-medium text-gray-700 leading-tight">오늘도 건강한 하루 되세요! 👋</p>
            <p className="text-2xl font-extrabold text-gray-900 leading-tight">종학님</p>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">운영자</span>
              <span className="text-[12px] font-medium text-gray-700">건강한 습관이 쌓이고 있어요!</span>
            </div>
          </div>
        </div>

        {/* 운영 중인 프로그램 */}
        <SectionCard title="운영 중인 프로그램" action={<CardAction>전체 보기</CardAction>}>
          <div className="flex gap-3">
            <div className="w-[134px] h-[89px] rounded-xl flex-shrink-0 overflow-hidden bg-emerald-50">
              <img src="/illustrations/program-covers/running.jpg" alt="" aria-hidden="true" onError={(e) => { e.currentTarget.style.display = 'none' }} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-[15px]">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-800 truncate leading-tight text-[14px]">3km 달리기 챌린지</h3>
                <span className="inline-flex items-center justify-center w-[33px] h-[16px] rounded-[3px] text-[9px] font-bold flex-shrink-0 bg-emerald-100 text-emerald-700">진행중</span>
              </div>
              <p className="text-xs text-gray-500 leading-tight flex items-center gap-1">
                <CalOutline className="w-3 h-3 flex-shrink-0 text-gray-400" /> 기간 07.01 ~ 07.28
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 flex-shrink-0">진행률</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: '38%' }} />
                </div>
                <span className="text-sm font-bold flex-shrink-0 text-emerald-600">38%</span>
              </div>
            </div>
          </div>
          <div className="h-px w-full bg-gray-100 mt-3" />
          <div className="flex mt-[6px]">
            {stats.map((s, i) => (
              <div key={s.label} className={`flex-1 text-center px-1 ${i > 0 ? 'border-l border-gray-200' : ''}`}>
                <div className="flex items-center justify-center gap-1 text-[11px] text-gray-500">
                  <s.Icon className="w-3 h-3 text-gray-400" /><span className="break-keep">{s.label}</span>
                </div>
                <p className="font-bold leading-tight mt-[-2px]">
                  <span className={`text-[12px] ${s.color}`}>{s.num}</span><span className="text-[10px] text-gray-500">{s.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 오늘의 활동 요약 */}
        <SectionCard title="오늘의 활동 요약" action={<CardAction>자세히 보기</CardAction>}>
          <div className="flex">
            {today.map((m, i) => (
              <div key={m.label} className={`flex-1 flex flex-col items-center text-center px-2 ${i > 0 ? 'border-l border-gray-200' : ''}`}>
                <div className={`w-9 h-9 mb-1.5 rounded-full overflow-hidden flex items-center justify-center ${m.circleBg || ''}`}>
                  {m.glyph ? (
                    <span className={`text-[17px] font-extrabold leading-none ${m.glyphCls}`}>{m.glyph}</span>
                  ) : (
                    <img src={m.img} alt="" aria-hidden="true" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} style={{ transform: `scale(${m.scale ?? 1.4})` }} className="w-full h-full object-cover" />
                  )}
                </div>
                <p className="text-lg font-extrabold text-gray-900 leading-tight">{m.v}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 mb-1.5 break-keep">{m.label}</p>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${m.fill}%` }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 내 점수 및 랭킹 */}
        <SectionCard title="내 점수 및 랭킹" action={<CardAction>전체 랭킹</CardAction>}>
          <div className="flex items-center justify-around gap-3">
            <div className="text-center">
              <p className="text-[11px] text-emerald-600 font-semibold mb-0.5">총 점수</p>
              <p className="text-xl font-extrabold text-gray-900 leading-tight">1,240<span className="text-sm text-gray-500 font-bold"> P</span></p>
              <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">이번주 ↑120P</p>
            </div>
            <RankRing rank={7} total={128} />
          </div>
        </SectionCard>
      </div>
      <TabBar active="dashboard" />
    </>
  )
}

// ─── 2. 둘러보기 (프로그램 목록) ─────────────────────────
const BROWSE_CATS = [
  { key: 'running', label: '달리기', e: '🏃' },
  { key: 'walking', label: '운동', e: '💪' },
  { key: 'diet', label: '식단', e: '🍱' },
  { key: 'no_smoking', label: '금연', e: '🚭' },
  { key: 'sleep', label: '수면', e: '🌙' },
  { key: 'mindcare', label: '마음관리', e: '🧘' },
]
const BROWSE_PROGS = [
  { cat: 'running', e: '🏃', name: '3km 달리기 챌린지', people: 128, tag: '달리기' },
  { cat: 'diet', e: '🍱', name: '건강 식단 30일', people: 86, tag: '식단' },
  { cat: 'no_smoking', e: '🚭', name: '금연 6개월 도전', people: 54, tag: '금연' },
  { cat: 'mindcare', e: '🧘', name: '매일 명상 습관', people: 41, tag: '마음관리' },
]
function BrowseMock() {
  return (
    <>
      <Header title="둘러보기" />
      <div className="p-3 space-y-3 pb-4">
        <div className="h-9 rounded-full bg-gray-100 px-3.5 flex items-center text-[12px] text-gray-400">🔍 관심 있는 프로그램 검색</div>
        {/* 카테고리 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {BROWSE_CATS.map((c, i) => (
            <div key={c.key} className={`flex-shrink-0 flex flex-col items-center gap-1 px-2.5 py-2 rounded-2xl border ${i === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-gray-100 bg-white'}`}>
              <I group="category" name={c.key} emoji={c.e} size={34} />
              <span className={`text-[10px] font-bold ${i === 0 ? 'text-emerald-600' : 'text-gray-500'}`}>{c.label}</span>
            </div>
          ))}
        </div>
        {/* 프로그램 카드 */}
        <div className="space-y-2.5">
          {BROWSE_PROGS.map((p) => (
            <div key={p.name} className="bg-white rounded-[12px] shadow-sm p-3 flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <I group="category" name={p.cat} emoji={p.e} size={38} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-block text-[9px] font-bold text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5 mb-1">{p.tag}</span>
                <p className="text-[13px] font-bold text-gray-800 truncate">{p.name}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">참여자 {p.people}명 · 모집중</p>
              </div>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-3 py-1.5 flex-shrink-0">참여</span>
            </div>
          ))}
        </div>
      </div>
      <TabBar active="programs" />
    </>
  )
}

// ─── 3. 프로그램 상세 · 미션 (실제 ProgramDetailPage 표준 재현) ──────
//   표준 프로그램 = 텍스트 전용 탭바(개요/미션/퀴즈/커뮤니티/성장). 하단 탭바 없음(딥드릴 화면).
//   3D 아이콘은 미션 카드 썸네일에 등장.
const PROG_TABS = ['개요', '미션', '퀴즈', '커뮤니티', '성장']
const DETAIL_MISSIONS = [
  { g: 'mission', n: 'stretching', name: '아침 스트레칭', sub: '운영자 심사 · 하루 1회', pt: 10, state: 'verify', btn: '인증' },
  { g: 'action', n: 'water', name: '물 2L 마시기', sub: '자동 승인 · 무제한', pt: 5, state: 'verify', btn: '기록' },
  { g: 'mission', n: 'meal', name: '건강한 한 끼 인증', sub: '운영자 심사 · 하루 1회', pt: 15, state: 'done' },
  { g: 'mission', n: 'sleep', name: '11시 전 취침', sub: '자동 승인 · 무제한', pt: 10, state: 'pending' },
]

// 프로그램 상세 공통 셸 — 헤더 + 프로필 카드 + 텍스트 전용 탭바 (실제 ProgramDetailPage 재현).
//   active: 현재 탭 라벨. 하단 탭바 없음(딥드릴 화면).
function ProgramShell({ active, children }) {
  return (
    <>
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm h-[44px] px-2 flex items-center justify-center relative border-b border-gray-50">
        <button type="button" className="absolute left-2 p-1.5 text-gray-600"><ChevL className="w-5 h-5" /></button>
        <div className="flex items-center gap-1.5 max-w-[68%]">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white flex-shrink-0">진행중</span>
          <span className="text-[15px] font-bold text-gray-800 truncate">매일 걷기 30일</span>
        </div>
        <div className="absolute right-2 flex items-center gap-1.5">
          <BellOutline className="w-5 h-5 text-gray-500" />
          <div className="w-7 h-7 rounded-full bg-gray-200" />
        </div>
      </div>
      <div className="px-3 pt-2 pb-4">
        {/* 프로그램 프로필 카드 — 표지 좌측 38% + 우측 페이드 */}
        <div className="relative bg-white rounded-[10px] shadow-elevated overflow-hidden min-h-[108px]">
          <div className="absolute inset-y-0 left-0 w-[38%]">
            <img src="/illustrations/program-covers/walking.jpg" alt="" aria-hidden="true" onError={(e) => { e.currentTarget.style.display = 'none' }} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-white" />
          </div>
          <div className="relative z-10 pl-[calc(34%+15px)] pr-4 py-2.5 min-h-[108px] flex flex-col justify-center">
            <h1 className="text-lg font-bold text-gray-800 mb-1 leading-tight truncate">매일 걷기 30일</h1>
            <p className="text-xs text-gray-600 mb-1.5 truncate"><span className="text-gray-400">기간 </span>26.07.01 ~ 26.07.30 <span className="text-gray-500">(30일)</span></p>
            <div className="mb-1.5 flex items-center gap-2">
              <div className="flex-1 h-2 bg-white/70 rounded-full overflow-hidden border border-gray-100">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: '45%' }} />
              </div>
              <span className="text-sm font-semibold text-emerald-600 flex-shrink-0">45% ⏳</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <span className="inline-flex items-center gap-1"><UsersSolid className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-500">참여자</span><span className="text-gray-800 font-semibold">42명</span></span>
              <span className="inline-flex items-center gap-1"><TrophySolid className="w-3.5 h-3.5 text-amber-400" /><span className="text-gray-500">내 순위</span><span className="text-gray-800 font-semibold">5등</span></span>
            </div>
          </div>
        </div>
        {/* 텍스트 전용 탭바 */}
        <div className="-mx-3 mt-1.5 mb-2 border-b border-gray-100">
          <div className="flex">
            {PROG_TABS.map((t) => {
              const on = active === t
              return (
                <button key={t} type="button" className={`relative flex-1 h-[40px] text-[14px] ${on ? 'text-emerald-600 font-bold' : 'text-gray-400 font-semibold'}`}>
                  {t}
                  {on && <span className="absolute left-0 right-0 -bottom-px h-[2.5px] bg-emerald-500 rounded-full" />}
                </button>
              )
            })}
          </div>
        </div>
        {children}
      </div>
    </>
  )
}

// 미션 탭 — 실제 MissionCard 레이아웃 · 썸네일=3D
function DetailMock() {
  return (
    <ProgramShell active="미션">
      <div className="space-y-2.5">
        {DETAIL_MISSIONS.map((m) => (
          <div key={m.name} className="bg-white rounded-2xl shadow-elevated p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="w-14 h-14 flex-shrink-0 rounded-xl bg-gray-50 flex items-center justify-center">
                <I group={m.g} name={m.n} size={46} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-800 mb-1 text-[14px] truncate">{m.name}</h3>
                <p className="text-xs text-gray-500">{m.sub}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-sm rounded font-medium whitespace-nowrap">{m.pt}P</span>
                {m.state === 'done' ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs rounded font-medium whitespace-nowrap">✓ 오늘 인증 완료</span>
                ) : m.state === 'pending' ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs rounded font-medium whitespace-nowrap">⏳ 심사 대기</span>
                ) : (
                  <span className="px-3 py-1.5 bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-sm rounded whitespace-nowrap">{m.btn}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ProgramShell>
  )
}

// 프로그램 홈 (카드형) — 달리기 홈처럼 탭바 없이 카드로. 개편 1단계.
//   표지 히어로(코스맵 자리 대체) + 공지 + 주요 기록 요약 + 메뉴 카드 4종(3D) + 배너.
const HOME_METRICS = [
  { e: '📏', l: '누적 거리', v: '42.5', u: 'km' },
  { e: '⏱️', l: '걷기 시간', v: '7.2', u: '시간' },
  { e: '👣', l: '누적 걸음', v: '58,200', u: '' },
  { e: '🔥', l: '연속 인증', v: '6', u: '일' },
]
const HOME_CARDS = [
  { g: 'feature', n: 'mission', t: '미션', d: '오늘의 미션 기록', a: '기록하기' },
  { g: 'feature', n: 'quiz', t: '퀴즈', d: '건강 퀴즈 풀기', a: '풀어보기' },
  { g: 'feature', n: 'community', t: '커뮤니티', d: '응원·소식 나누기', a: '바로가기' },
  { g: 'reward', n: 'ranking', t: '랭킹', d: '순위·성장 확인', a: '바로가기' },
]
function ProgramHomeMock() {
  return (
    <>
      {/* 헤더 — 뒤로 + 이름 + 알림/프로필 */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm h-[44px] px-2 flex items-center justify-center relative border-b border-gray-50">
        <button type="button" className="absolute left-2 p-1.5 text-gray-600"><ChevL className="w-5 h-5" /></button>
        <span className="text-[15px] font-bold text-gray-800 truncate max-w-[60%]">매일 걷기 30일</span>
        <div className="absolute right-2 flex items-center gap-1.5">
          <BellOutline className="w-5 h-5 text-gray-500" />
          <div className="w-7 h-7 rounded-full bg-gray-200" />
        </div>
      </div>

      <div className="px-3 pt-2 pb-4 space-y-[9px]">
        {/* 1) 표지 히어로 (코스맵 자리 대체) — 표지 사진 + 진행률 오버레이 */}
        <div className="relative rounded-2xl overflow-hidden h-[152px] shadow-soft">
          <img src="/illustrations/program-covers/walking.jpg" alt="" aria-hidden="true" onError={(e) => { e.currentTarget.style.display = 'none' }} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 mb-1.5">진행중</span>
            <h1 className="text-xl font-extrabold leading-tight drop-shadow-sm">매일 걷기 30일</h1>
            <p className="text-[11px] text-white/85 mt-0.5">기간 26.07.01 ~ 26.07.30 · 참여자 42명 · 내 순위 5등</p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden"><div className="h-full bg-emerald-400 rounded-full" style={{ width: '45%' }} /></div>
              <span className="text-[12px] font-bold drop-shadow-sm">45%</span>
            </div>
          </div>
        </div>

        {/* 2) 공지사항 */}
        <button type="button" className="w-full flex items-center gap-3 rounded-2xl p-3.5 bg-white border border-gray-100 shadow-soft text-left">
          <span className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 text-[15px]">📢</span>
          <div className="flex-1 min-w-0"><p className="text-[13px] font-bold text-gray-800">공지사항</p><p className="text-[12px] text-gray-500 truncate">이번 주 목표는 하루 6천 보예요! 함께 걸어요 👟</p></div>
          <ChevR className="w-4 h-4 text-gray-300 flex-shrink-0" />
        </button>

        {/* 3) 주요 기록 요약 */}
        <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
          <h3 className="text-[13px] font-bold text-gray-800 mb-3">주요 기록 요약</h3>
          <div className="flex">
            {HOME_METRICS.map((c, i) => (
              <div key={c.l} className={`flex-1 flex flex-col items-center text-center px-1 ${i ? 'border-l border-gray-100' : ''}`}>
                <div className="flex items-center gap-0.5 mb-1"><span className="text-[15px] leading-none">{c.e}</span><span className="text-[11px] text-gray-400 whitespace-nowrap">{c.l}</span></div>
                <span className="text-[15px] font-extrabold text-gray-900 leading-tight">{c.v}<span className="text-[10px] font-medium text-gray-400 ml-0.5">{c.u}</span></span>
              </div>
            ))}
          </div>
        </div>

        {/* 4) 메뉴 카드 4종 (탭바 대신) — 아이콘 3D */}
        <div className="grid grid-cols-2 gap-3">
          {HOME_CARDS.map((b) => (
            <div key={b.n} className="rounded-2xl p-3 bg-white border border-gray-100 shadow-soft flex flex-col justify-between min-h-[126px]">
              <div className="flex items-start gap-1.5">
                <I group={b.g} name={b.n} size={28} />
                <p className="text-[13px] font-bold text-gray-800 leading-tight mt-1">{b.t}</p>
              </div>
              <p className="text-[11.5px] text-gray-500 leading-snug text-center">{b.d}</p>
              <button type="button" className="h-8 rounded-lg bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-0.5">{b.a} <ChevR className="w-3 h-3" /></button>
            </div>
          ))}
        </div>

        {/* 5) 하단 격려 배너 */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 shadow-soft bg-gradient-to-r from-sky-50 to-emerald-50 h-[78px] flex items-center gap-3 p-4">
          <span className="w-11 h-11 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0"><I group="growth" name="sprout" emoji="🌱" size={34} /></span>
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-gray-800 truncate">오늘도 한 걸음 더, 가볍게 걸어봐요</p>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">작은 습관이 큰 변화를 만들어요!</p>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── 4. 랭킹 ─────────────────────────────────────────
function RankMock() {
  const podium = [
    { place: 2, name: '민수', score: 780, medal: 'medal-2', e: '🥈', h: 'h-20' },
    { place: 1, name: '지영', score: 920, medal: 'medal-1', e: '🥇', h: 'h-28' },
    { place: 3, name: '현우', score: 640, medal: 'medal-3', e: '🥉', h: 'h-16' },
  ]
  const rows = [
    { rank: 4, name: '수진', score: 590 },
    { rank: 5, name: '종학', score: 540, me: true },
    { rank: 6, name: '태호', score: 510 },
    { rank: 7, name: '예린', score: 480 },
  ]
  return (
    <>
      <Header title="랭킹" />
      <div className="p-3 space-y-2.5 pb-4">
        {/* 리브즈 잔액 */}
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-[12px] p-3 flex items-center gap-3">
          <I group="reward" name="leaves" emoji="🌿" size={38} />
          <div className="flex-1">
            <p className="text-[11px] text-gray-500">내 리브즈</p>
            <p className="text-[17px] font-extrabold text-emerald-700 leading-tight">1,240 <span className="text-[11px] font-bold text-gray-400">개</span></p>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
            <I group="reward" name="trend" emoji="📈" size={18} /> +32
          </div>
        </div>
        {/* 포디움 */}
        <div className="bg-white rounded-[12px] shadow-md p-3">
          <div className="flex items-end justify-center gap-2">
            {podium.map((p) => (
              <div key={p.place} className="flex-1 flex flex-col items-center">
                <I group="reward" name={p.medal} emoji={p.e} size={p.place === 1 ? 40 : 32} />
                <p className="text-[12px] font-bold text-gray-800 mt-1">{p.name}</p>
                <p className="text-[11px] font-bold text-emerald-600">{p.score}P</p>
                <div className={`w-full ${p.h} mt-1.5 rounded-t-lg bg-gradient-to-b ${p.place === 1 ? 'from-amber-200 to-amber-50' : p.place === 2 ? 'from-gray-200 to-gray-50' : 'from-orange-200 to-orange-50'} flex items-start justify-center pt-1.5`}>
                  <span className="text-[13px] font-extrabold text-gray-500">{p.place}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* 순위 목록 */}
        <div className="bg-white rounded-[12px] shadow-sm divide-y divide-gray-50">
          {rows.map((r) => (
            <div key={r.rank} className={`flex items-center gap-3 px-3 py-2.5 ${r.me ? 'bg-emerald-50/60' : ''}`}>
              <span className={`w-6 text-center text-[13px] font-extrabold ${r.me ? 'text-emerald-600' : 'text-gray-400'}`}>{r.rank}</span>
              <div className="w-8 h-8 rounded-full bg-gray-100" />
              <span className={`flex-1 text-[13px] font-bold ${r.me ? 'text-emerald-700' : 'text-gray-700'}`}>{r.name}{r.me && ' (나)'}</span>
              <span className="text-[13px] font-bold text-gray-800">{r.score}P</span>
            </div>
          ))}
        </div>
      </div>
      <TabBar active="rankings" />
    </>
  )
}

// ─── 5. 응원 게시판 ──────────────────────────────────
// 응원 콜라주 체크무늬 배경 (실제 CheerBoard 와 동일)
const CHECK_BG = {
  backgroundColor: '#eaf5ec',
  backgroundImage: 'linear-gradient(#d6ecdb 1px, transparent 1px), linear-gradient(90deg, #d6ecdb 1px, transparent 1px)',
  backgroundSize: '13px 13px',
}
const CI = (name) => `/icons/cheer/${name}.png`
// 응원 탭 — 실제 CheerBoard 콜라주 재현. 카드 속 아이콘을 3D cheer 아이콘으로.
function CheerMock() {
  return (
    <ProgramShell active="커뮤니티">
      <div className="relative rounded-2xl overflow-hidden bg-[#f3f2ec] border border-black/5">
        <div className="relative w-full aspect-[355/497]">
          {/* 장식 잎 + 하트 */}
          <img src={CI('leaf')} alt="" className="pointer-events-none absolute rotate-[20deg] opacity-90" style={{ right: '-1%', top: '24%', width: '13%' }} />
          <img src={CI('leaf')} alt="" className="pointer-events-none absolute -rotate-[100deg] opacity-90" style={{ left: '18%', top: '54%', width: '10%' }} />
          <img src={CI('heart-red')} alt="" className="pointer-events-none absolute z-10 -rotate-12" style={{ left: '3%', top: '46%', width: '13%' }} />

          {/* 운영자 한마디 (좌상, 흰 노트) */}
          <div className="absolute bg-white rounded-2xl p-3 shadow-md border border-black/5 overflow-hidden -rotate-2" style={{ left: '4%', top: '8.5%', width: '42%', height: '40%' }}>
            <span className="absolute left-1/2 -translate-x-1/2 top-1.5 w-12 h-3.5 rounded-sm bg-emerald-200/70 -rotate-2" />
            <div className="relative flex items-center gap-1 mb-1 mt-2">
              <img src={CI('people')} alt="" className="w-5 h-5 object-contain" />
              <span className="text-[12px] font-extrabold text-[#2E5D3B]">운영자 한마디</span>
            </div>
            <p className="text-[13px] font-bold text-gray-800 leading-snug">당신의 응원이<br />누군가의 내일이 돼요 💚</p>
            <img src={CI('sprout')} alt="" className="pointer-events-none absolute bottom-2 right-2 w-12 object-contain opacity-90" />
          </div>

          {/* 베스트 응원 (우상, 크림 + 트로피) */}
          <div className="absolute bg-[#fdf6e9] rounded-2xl p-2.5 shadow-md border border-amber-100/70 -rotate-3" style={{ left: '52%', top: '9.5%', width: '40%', height: '22%' }}>
            <img src={CI('trophy')} alt="" className="absolute -top-6 -right-2 w-11 h-11 object-contain rotate-6" />
            <div className="flex items-center gap-1 mb-1"><img src={CI('star')} alt="" className="w-4 h-4 object-contain" /><span className="text-[11.5px] font-extrabold text-[#7B5C44]">베스트 응원</span></div>
            <p className="text-[13px] font-bold text-gray-800 leading-snug line-clamp-2">함께라서 완주했어요. 다들 고마워요!</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="w-4 h-4 rounded-full bg-emerald-200 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-gray-600">지영</span>
              <span className="ml-auto flex items-center gap-0.5 text-[12px] font-bold text-rose-500">❤️ 24</span>
            </div>
          </div>

          {/* 응원 말풍선 (우중, 체크무늬) */}
          <div className="absolute rounded-2xl border border-emerald-100 px-3 py-2.5 shadow-sm -rotate-3 overflow-hidden" style={{ left: '52%', top: '39%', width: '41%', height: '21%', ...CHECK_BG }}>
            <p className="text-[13px] font-bold text-emerald-800 leading-snug">오늘도<br />한 걸음 더 🌿</p>
            <p className="text-[11px] text-emerald-500 mt-0.5">— 도담</p>
            <img src={CI('heart')} alt="" className="absolute bottom-2 right-2 w-6 h-6 object-contain" />
          </div>

          {/* 최근 응원글 (좌하) */}
          <div className="absolute bg-white rounded-2xl p-3 shadow-sm border border-black/5 overflow-hidden" style={{ left: '4%', top: '60.5%', width: '52%', height: '37%' }}>
            <div className="flex items-center gap-1 mb-1.5"><img src={CI('people')} alt="" className="w-4 h-4 object-contain" /><span className="text-[12px] font-extrabold text-gray-700">최근 응원글</span></div>
            <ul className="space-y-1.5">
              {[{ n: '민수', t: '2시간 전', c: '다들 화이팅이에요!' }, { n: '수진', t: '어제', c: '꾸준함이 답이네요 👍' }, { n: '태호', t: '어제', c: '오늘도 인증 완료!' }].map((r) => (
                <li key={r.n} className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 min-w-0"><div className="flex items-center gap-1"><span className="text-[11px] font-bold text-gray-700">{r.n}</span><span className="text-[9px] text-gray-400">{r.t}</span></div><p className="text-[11px] text-gray-500 truncate">{r.c}</p></div>
                  <span className="text-[10px] font-bold text-rose-500 flex-shrink-0">❤️ 3</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 오늘의 응원 레터 (우하, 초록 + 봉투) */}
          <div className="absolute bg-gradient-to-b from-emerald-50 to-white rounded-2xl p-3 shadow-sm border border-emerald-100 overflow-hidden" style={{ left: '60%', top: '68.5%', width: '36%', height: '29%' }}>
            <div className="flex items-center gap-1 mb-1"><img src={CI('letter')} alt="" className="w-4 h-4 object-contain" /><span className="text-[10.5px] font-extrabold text-gray-700">오늘의 응원 레터</span></div>
            <p className="text-[13px] font-extrabold text-emerald-800 leading-snug">작은 습관이<br />큰 변화로</p>
            <p className="text-[10px] text-gray-500 mt-1 leading-snug line-clamp-2">오늘 하루도 한 걸음 나아간 당신을 응원해요.</p>
            <img src={CI('letter')} alt="" className="pointer-events-none absolute -bottom-1 right-1 w-12 h-12 object-contain opacity-95" />
          </div>
        </div>
      </div>
    </ProgramShell>
  )
}

// ─── 6. 성장 ─────────────────────────────────────────
// 성장(정원) 탭 — 실제 GardenPanel 재현. 단계 식물·물·햇빛을 3D 성장 아이콘으로.
function GrowthMock() {
  const PLANTED = 5   // 심어진 칸 (베타 MVP = 1식물)
  return (
    <ProgramShell active="성장">
      {/* 헤더 — 현재 단계 + 물/햇빛 + 진행 바 */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100 mb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <I group="growth" name="sapling" emoji="🌿" size={32} />
            <div>
              <p className="text-sm font-semibold text-emerald-800">묘목 단계</p>
              <p className="text-[11px] text-emerald-700">단계 3/5</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-sky-700"><I group="growth" name="water" emoji="💧" size={16} /> 물 42</span>
            <span className="inline-flex items-center gap-1 text-amber-700"><I group="growth" name="sun" emoji="☀️" size={16} /> 햇빛 14</span>
          </div>
        </div>
        <div className="h-2 bg-white/70 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500" style={{ width: '62%' }} />
        </div>
      </div>
      {/* 4×4 격자 */}
      <div className="bg-amber-50/50 rounded-2xl p-3 border border-amber-100 mb-3">
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 16 }).map((_, idx) => {
            const planted = idx === PLANTED
            return (
              <div key={idx} className={`relative aspect-square rounded-xl flex items-center justify-center ${planted ? 'bg-gradient-to-br from-emerald-100 to-teal-100 border-2 border-emerald-300 shadow-sm' : 'bg-amber-100/60 border border-amber-200'}`}>
                {planted ? <I group="growth" name="sapling" emoji="🌿" size={40} /> : <span className="text-xs text-amber-500/60">+</span>}
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-500 text-center mt-2 leading-relaxed">미션 인증 = 물 💧 / 매일 첫 인증 = 햇빛 ☀️</p>
      </div>
      {/* 도감 미니 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-gray-800">🌸 나의 식물 도감</span>
          <span className="text-xs text-gray-500 ml-auto">2/16</span>
        </div>
        <div className="grid grid-cols-6 gap-2">
          <div className="aspect-square flex items-center justify-center bg-violet-50 rounded-lg"><I group="growth" name="bloom" emoji="🌸" size={26} /></div>
          <div className="aspect-square flex items-center justify-center bg-violet-50 rounded-lg"><I group="growth" name="tree" emoji="🌳" size={26} /></div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center text-gray-300 text-sm">?</div>
          ))}
        </div>
      </div>
    </ProgramShell>
  )
}

// ─── 7. 마이페이지 (프로필) ──────────────────────────
function ProfileMock() {
  const stats = [
    { g: 'feature', n: 'attendance', e: '📅', label: '참여 중', v: '3', unit: '개', c: 'text-gray-900' },
    { g: 'feature', n: 'point', e: '🪙', label: '누적 포인트', v: '1,240', unit: 'P', c: 'text-emerald-600' },
    { g: 'feature', n: 'streak', e: '🔥', label: '연속 인증', v: '14', unit: '일', c: 'text-violet-600' },
  ]
  const menus = [
    { g: 'action', n: 'diary', e: '📔', title: '내 기록', desc: '걷기·운동·수면 등 내 활동 기록', bg: 'bg-emerald-50' },
    { g: 'feature', n: 'stats', e: '📊', title: '건강 리포트', desc: '이번 달 나의 건강 요약', bg: 'bg-sky-50' },
    { g: 'feature', n: 'bell', e: '🔔', title: '알림 설정', desc: '중요한 소식을 받아보세요', bg: 'bg-violet-50' },
    { g: 'cheer', n: 'letter', e: '💌', title: '문의하기', desc: '자주 묻는 질문과 1:1 문의', bg: 'bg-amber-50' },
  ]
  return (
    <>
      <Header title="마이페이지" />
      <div className="p-3 space-y-2.5 pb-4">
        {/* 프로필 배너 카드 */}
        <div className="rounded-[12px] bg-[#eef7f1] border border-emerald-100/60 p-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-white ring-2 ring-white shadow flex items-center justify-center overflow-hidden">
              <I group="cheer" name="people" emoji="🙌" size={44} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[17px] font-extrabold text-gray-900">종학님 👋</p>
              <p className="text-[11px] text-gray-500 mt-0.5">오늘도 건강한 하루 되세요! 🌿</p>
              <p className="text-[10px] text-gray-400 mt-0.5">jonghak@dodam.app</p>
            </div>
          </div>
          {/* 통계 박스 */}
          <div className="mt-3 bg-white/95 rounded-[11px] border border-gray-100 shadow-sm grid grid-cols-3">
            {stats.map((s, i) => (
              <div key={s.label} className={`flex items-center gap-1.5 px-2 py-2.5 ${i > 0 ? 'border-l border-gray-100' : ''}`}>
                <I group={s.g} name={s.n} emoji={s.e} size={30} />
                <div className="min-w-0">
                  <p className="text-[9px] text-gray-400 leading-tight truncate">{s.label}</p>
                  <p className={`text-[14px] font-extrabold leading-tight ${s.c}`}>{s.v}<span className="text-[10px]">{s.unit}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* 메뉴 카드 */}
        {menus.map((m) => (
          <div key={m.title} className="w-full flex items-center gap-3 p-3.5 bg-white rounded-[10px] shadow-sm">
            <div className={`w-12 h-12 rounded-[18px] ${m.bg} flex items-center justify-center flex-shrink-0`}>
              <I group={m.g} name={m.n} emoji={m.e} size={32} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[13px] font-bold text-gray-800">{m.title}</h3>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">{m.desc}</p>
            </div>
            <span className="text-gray-300 text-lg flex-shrink-0">›</span>
          </div>
        ))}
        <div className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 border border-red-100 text-red-500 text-[13px] font-bold rounded-[10px]">로그아웃</div>
      </div>
      <TabBar active="profile" />
    </>
  )
}

// ─── 8. 알림 ─────────────────────────────────────────
const NOTIFS = [
  { g: 'action', n: 'complete', e: '✅', title: '미션이 승인됐어요', body: '‘아침 스트레칭’ 인증이 승인되어 +10P 적립', time: '방금 전', unread: true, bg: 'bg-emerald-50' },
  { g: 'cheer', n: 'heart', e: '💚', title: '응원을 받았어요', body: '지영님이 회원님 글에 응원을 남겼어요', time: '10분 전', unread: true, bg: 'bg-rose-50' },
  { g: 'reward', n: 'trend', e: '📈', title: '순위가 올랐어요', body: '3km 달리기 챌린지에서 7위 → 5위', time: '1시간 전', unread: false, bg: 'bg-teal-50' },
  { g: 'action', n: 'comment', e: '💬', title: '새 댓글', body: '민수님이 회원님 인증에 댓글을 남겼어요', time: '3시간 전', unread: false, bg: 'bg-amber-50' },
  { g: 'feature', n: 'quiz', e: '❓', title: '오늘의 퀴즈가 도착했어요', body: '건강 퀴즈를 풀고 +10P 받아보세요', time: '오늘', unread: false, bg: 'bg-indigo-50' },
  { g: 'reward', n: 'gift', e: '🎁', title: '보상이 지급됐어요', body: '주간 개근 보상 50 리브즈 지급', time: '어제', unread: false, bg: 'bg-emerald-50' },
]
function NotifMock() {
  return (
    <>
      <Header title="알림" />
      <div className="p-3 space-y-2 pb-4">
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-[12px] font-bold text-gray-700">새 알림 <span className="text-emerald-600">2</span></span>
          <span className="text-[11px] text-gray-400">모두 읽음</span>
        </div>
        {NOTIFS.map((n, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-[12px] shadow-sm ${n.unread ? 'bg-emerald-50/40 ring-1 ring-emerald-100' : 'bg-white'}`}>
            <div className={`w-11 h-11 rounded-full ${n.bg} flex items-center justify-center flex-shrink-0`}>
              <I group={n.g} name={n.n} emoji={n.e} size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[12.5px] font-bold text-gray-800">{n.title}</p>
                {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
              </div>
              <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{n.body}</p>
              <p className="text-[9.5px] text-gray-400 mt-1">{n.time}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

// ─── 9. 퀴즈 풀기 (실제 QuizSolvePage 표준 재현 · 독립 페이지) ──────
function QuizMock() {
  const questions = [
    { q: '다음 중 유산소 운동이 아닌 것은?', pt: 5, opts: ['걷기', '달리기', '웨이트 리프팅', '수영'], sel: 2 },
    { q: '성인 권장 수면 시간에 가까운 것은?', pt: 5, opts: ['4~5시간', '7~8시간', '10시간 이상'], sel: 1 },
    { q: '하루 권장 물 섭취량에 가까운 것은?', pt: 5, opts: ['0.5L', '1.5~2L', '5L 이상'], sel: null },
  ]
  return (
    <>
      {/* 뒤로 바 (StickyBackBar) */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm h-[44px] px-2 flex items-center gap-1 border-b border-gray-50">
        <button type="button" className="p-1.5 text-gray-600"><ChevL className="w-5 h-5" /></button>
        <span className="text-[14px] font-semibold text-gray-600">프로그램으로</span>
      </div>
      <div className="px-4 pt-2 pb-6">
        {/* 퀴즈 헤더 */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-3">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-medium text-gray-800 mb-1">📝 건강 상식 퀴즈</h1>
            <div className="flex items-center gap-1 bg-amber-50 rounded-full px-2.5 py-1 flex-shrink-0"><I group="reward" name="gift" emoji="🎁" size={20} /><span className="text-[11px] font-bold text-amber-600">15점</span></div>
          </div>
          <p className="text-sm text-gray-600 mb-2">건강 습관에 대한 상식을 확인해봐요.</p>
          <div className="flex items-center gap-3 text-xs text-gray-500"><span>문제 3개</span><span>~ 7월 10일까지</span></div>
        </div>
        {/* 문제 목록 */}
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="font-medium text-gray-800"><span className="text-gray-400 mr-1">{i + 1}.</span>{q.q}</p>
                <span className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">{q.pt}점</span>
              </div>
              <div className="space-y-2">
                {q.opts.map((o, oi) => {
                  const on = q.sel === oi
                  return (
                    <div key={oi} className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${on ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                      <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${on ? 'border-emerald-500' : 'border-gray-300'}`}>{on && <span className="w-2 h-2 rounded-full bg-emerald-500" />}</span>
                      <span className={`text-[13px] ${on ? 'text-emerald-800 font-semibold' : 'text-gray-700'}`}>{o}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-[14px] font-bold">제출하기</button>
      </div>
    </>
  )
}

// ─── 10. 미션 인증 ───────────────────────────────────
function VerifyMock() {
  return (
    <>
      <Header title="미션 인증" />
      <div className="p-3 space-y-3 pb-4">
        {/* 미션 정보 */}
        <div className="bg-white rounded-[14px] shadow-md p-4 flex items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <I group="mission" name="meal" emoji="🥗" size={46} />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-extrabold text-gray-800">건강한 한 끼 인증</p>
            <p className="text-[11px] text-gray-500 mt-0.5">오늘의 식단 사진을 올려주세요</p>
            <span className="inline-block text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5 mt-1.5">+15P</span>
          </div>
        </div>
        {/* 사진 업로드 */}
        <div className="rounded-[14px] border-2 border-dashed border-gray-200 bg-gray-50/60 py-10 flex flex-col items-center">
          <I group="action" name="photo" emoji="📷" size={54} />
          <p className="text-[12px] font-bold text-gray-600 mt-2">사진 촬영 또는 업로드</p>
          <p className="text-[10px] text-gray-400 mt-0.5">인증 사진을 첨부해 주세요</p>
        </div>
        {/* 메모 */}
        <div className="rounded-[12px] bg-white shadow-sm p-3">
          <p className="text-[11px] font-bold text-gray-500 mb-1.5">한 줄 메모 (선택)</p>
          <p className="text-[12px] text-gray-400">오늘의 건강한 한 끼를 기록해보세요…</p>
        </div>
        {/* 제출 */}
        <div className="flex items-center gap-2">
          <div className="w-12 h-12 rounded-[12px] bg-gray-100 flex items-center justify-center flex-shrink-0">
            <I group="action" name="record" emoji="✏️" size={28} />
          </div>
          <div className="flex-1 py-3.5 rounded-[12px] bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-center text-[13px] font-bold">인증 제출하기</div>
        </div>
      </div>
    </>
  )
}

function IconMockupDemoPage() {
  return (
    <div className="min-h-screen bg-[#eef2f0] py-6">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-lg font-extrabold text-gray-900">3D 아이콘 · 실제 화면 목업</h1>
        <p className="text-[12px] text-gray-500 mt-1">아이콘을 실제 화면과 유사한 맥락에 배치한 미리보기예요. 실제 앱은 아직 반영하지 않았어요.</p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-8 pb-6 mt-5">
          <Phone title="① 홈 대시보드"><HomeMock /></Phone>
          <Phone title="② 둘러보기"><BrowseMock /></Phone>
          {/* 프로그램 딥드릴 — 홈(카드형)/미션/퀴즈/응원/성장 (3D) */}
          <Phone title="③ 프로그램 · 홈 (신규 카드형)"><ProgramHomeMock /></Phone>
          <Phone title="④ 프로그램 · 미션"><DetailMock /></Phone>
          <Phone title="⑤ 프로그램 · 퀴즈 풀기"><QuizMock /></Phone>
          <Phone title="⑥ 프로그램 · 응원"><CheerMock /></Phone>
          <Phone title="⑦ 프로그램 · 성장(정원)"><GrowthMock /></Phone>
          <Phone title="⑧ 랭킹"><RankMock /></Phone>
          <Phone title="⑨ 마이페이지"><ProfileMock /></Phone>
          <Phone title="⑩ 알림"><NotifMock /></Phone>
          <Phone title="⑪ 미션 인증"><VerifyMock /></Phone>
        </div>
      </div>
    </div>
  )
}

export default IconMockupDemoPage
