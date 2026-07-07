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
//   5칸: 대시보드 / 프로그램 / 가운데 기록하기(+) / 랭킹 / 마이페이지. solid heroicons(MIT).
//   상호작용·부채꼴 메뉴는 생략하고 모양만 그대로.
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

function TabBar({ active }) {
  const tabs = [
    { key: 'dashboard', label: '대시보드', Icon: HomeSolid },
    { key: 'programs', label: '프로그램', Icon: FlagSolid },
    { key: 'rankings', label: '랭킹', Icon: ChartSolid },
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

// ─── 1. 홈 대시보드 ───────────────────────────────────
function HomeMock() {
  const stats = [
    { label: '참여자', num: '128', unit: '명', c: 'text-emerald-600' },
    { label: '내 순위', num: '7', unit: '등', c: 'text-gray-900' },
    { label: '남은 기간', num: '12', unit: '일', c: 'text-gray-900' },
    { label: '달성률', num: '84', unit: '%', c: 'text-emerald-600' },
  ]
  const today = [
    { g: 'action', n: 'record', e: '✏️', v: 3, label: '기록', bar: 'bg-blue-500' },
    { g: 'action', n: 'complete', e: '✅', v: 5, label: '완료', bar: 'bg-emerald-500' },
    { g: 'action', n: 'comment', e: '💬', v: 8, label: '댓글', bar: 'bg-amber-500' },
    { g: 'reward', n: 'leaves', e: '🌿', v: 42, label: '리브즈', bar: 'bg-teal-500' },
  ]
  return (
    <>
      <Header title="도담" />
      <div className="p-3 space-y-2.5 pb-4">
        {/* 인사말 */}
        <div className="rounded-[12px] bg-gradient-to-r from-emerald-50 to-teal-50 p-3.5">
          <p className="text-[12px] text-gray-600">오늘도 건강한 하루 되세요! 👋</p>
          <p className="text-[19px] font-extrabold text-gray-900 leading-tight mt-0.5">종학님</p>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold mt-1">운영자</span>
        </div>
        {/* 대표 프로그램 */}
        <div className="bg-white rounded-[12px] shadow-md p-3.5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-bold text-gray-800">참여 중인 프로그램</h3>
            <span className="text-[11px] text-gray-400">전체 보기 ›</span>
          </div>
          <div className="flex gap-2.5">
            <div className="w-[70px] h-[70px] rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <I group="category" name="running" emoji="🏃" size={46} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-gray-800 truncate">3km 달리기 챌린지</p>
              <p className="text-[10px] text-gray-400 mt-0.5">기간 07.01 ~ 07.28</p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10px] text-gray-400">진행률</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: '38%' }} />
                </div>
                <span className="text-[11px] font-bold text-emerald-600">38%</span>
              </div>
            </div>
          </div>
          <div className="h-px bg-gray-100 my-2.5" />
          <div className="flex">
            {stats.map((s, i) => (
              <div key={s.label} className={`flex-1 text-center px-1 ${i > 0 ? 'border-l border-gray-100' : ''}`}>
                <p className="text-[10px] text-gray-400">{s.label}</p>
                <p className="font-bold leading-tight"><span className={`text-[13px] ${s.c}`}>{s.num}</span><span className="text-[9px] text-gray-400">{s.unit}</span></p>
              </div>
            ))}
          </div>
        </div>
        {/* 오늘의 활동 */}
        <div className="bg-white rounded-[12px] shadow-md p-3.5">
          <h3 className="text-[13px] font-bold text-gray-800 mb-3">오늘의 활동 요약</h3>
          <div className="flex">
            {today.map((m, i) => (
              <div key={m.label} className={`flex-1 flex flex-col items-center px-1.5 ${i > 0 ? 'border-l border-gray-100' : ''}`}>
                <div className="w-10 h-10 rounded-full bg-emerald-50/70 flex items-center justify-center mb-1">
                  <I group={m.g} name={m.n} emoji={m.e} size={30} />
                </div>
                <p className="text-[16px] font-extrabold text-gray-900 leading-none">{m.v}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 mb-1">{m.label}</p>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${Math.min(100, m.v * 14)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
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

// ─── 3. 프로그램 상세 (탭 + 미션) ──────────────────────
const DETAIL_TABS = [
  { key: 'overview', label: '개요', group: 'feature', name: 'stats', e: '📊' },
  { key: 'missions', label: '미션', group: 'feature', name: 'mission', e: '📋' },
  { key: 'quiz', label: '퀴즈', group: 'feature', name: 'quiz', e: '❓' },
  { key: 'community', label: '커뮤니티', group: 'feature', name: 'community', e: '💬' },
  { key: 'ranking', label: '랭킹', group: 'reward', name: 'ranking', e: '🏆' },
]
const DETAIL_MISSIONS = [
  { g: 'mission', n: 'stretching', e: '🤸', name: '아침 스트레칭', pt: 10, done: true },
  { g: 'mission', n: 'meal', e: '🥗', name: '건강한 한 끼 인증', pt: 15, done: true },
  { g: 'mission', n: 'sleep', e: '🌙', name: '11시 전 취침', pt: 10, done: false },
  { g: 'action', n: 'water', e: '💧', name: '물 2L 마시기', pt: 5, done: false },
]
function DetailMock() {
  const [tab, setTab] = useState('missions')
  return (
    <>
      <Header title="3km 달리기 챌린지" />
      {/* 탭 */}
      <div className="sticky top-[44px] z-10 bg-white flex border-b border-gray-100">
        {DETAIL_TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 ${tab === t.key ? '' : 'opacity-45'}`}>
            <I group={t.group} name={t.name} emoji={t.e} size={22} className={tab === t.key ? '' : 'grayscale'} />
            <span className={`text-[9.5px] font-bold ${tab === t.key ? 'text-emerald-600' : 'text-gray-400'}`}>{t.label}</span>
            {tab === t.key && <span className="w-6 h-0.5 rounded-full bg-emerald-500 mt-0.5" />}
          </button>
        ))}
      </div>
      <div className="p-3 space-y-2.5 pb-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] font-bold text-gray-700">오늘의 미션 <span className="text-emerald-600">2/4</span></span>
          <span className="text-[10px] text-gray-400">획득 25P</span>
        </div>
        {DETAIL_MISSIONS.map((m) => (
          <div key={m.name} className={`bg-white rounded-[12px] shadow-sm p-3 flex items-center gap-3 ${m.done ? 'opacity-95' : ''}`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${m.done ? 'bg-emerald-50' : 'bg-gray-50'}`}>
              <I group={m.g} name={m.n} emoji={m.e} size={34} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-gray-800 truncate">{m.name}</p>
              <p className="text-[10px] text-emerald-600 font-bold mt-0.5">+{m.pt}P</p>
            </div>
            {m.done ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 flex-shrink-0">
                <I group="action" name="complete" emoji="✅" size={18} /> 완료
              </span>
            ) : (
              <span className="text-[11px] font-bold text-white bg-emerald-500 rounded-full px-3 py-1.5 flex-shrink-0">인증</span>
            )}
          </div>
        ))}
        {/* 퀴즈 카드 */}
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-[12px] p-3 flex items-center gap-3">
          <I group="feature" name="quiz" emoji="❓" size={40} />
          <div className="flex-1">
            <p className="text-[13px] font-bold text-gray-800">오늘의 건강 퀴즈</p>
            <p className="text-[10px] text-gray-500 mt-0.5">맞히면 +10P · 하루 1회</p>
          </div>
          <span className="text-[11px] font-bold text-indigo-600 bg-white rounded-full px-3 py-1.5">풀기</span>
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
const CHEER_POSTS = [
  { g: 'cheer', n: 'people', e: '🙌', name: '지영', body: '오늘 3km 완주했어요! 다들 힘내요 💪', likes: 12, cmt: 4 },
  { g: 'cheer', n: 'letter', e: '💌', name: '민수', body: '한 주간 개근 성공! 응원 편지 남기고 갑니다', likes: 8, cmt: 2 },
  { g: 'cheer', n: 'sprout', e: '🍀', name: '수진', body: '작은 습관이 새싹처럼 자라는 게 느껴져요 🌱', likes: 15, cmt: 6 },
]
function CheerMock() {
  return (
    <>
      <Header title="응원 게시판" />
      <div className="p-3 space-y-2.5 pb-4">
        {/* 작성 유도 */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-[12px] p-3 flex items-center gap-3">
          <I group="cheer" name="heart" emoji="💚" size={34} />
          <span className="flex-1 text-[12px] text-gray-500">오늘의 응원 한마디를 남겨보세요</span>
          <span className="text-[11px] font-bold text-white bg-emerald-500 rounded-full px-3 py-1.5">작성</span>
        </div>
        {CHEER_POSTS.map((p) => (
          <div key={p.name} className="bg-white rounded-[12px] shadow-sm p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center">
                <I group={p.g} name={p.n} emoji={p.e} size={26} />
              </div>
              <div className="flex-1">
                <p className="text-[12px] font-bold text-gray-800">{p.name}</p>
                <p className="text-[9px] text-gray-400">방금 전</p>
              </div>
            </div>
            <p className="text-[12.5px] text-gray-700 leading-relaxed">{p.body}</p>
            <div className="flex items-center gap-4 mt-2.5 pt-2 border-t border-gray-50">
              <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
                <I group="cheer" name="heart-red" emoji="❤️" size={18} /> {p.likes}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
                <I group="action" name="comment" emoji="💬" size={16} /> {p.cmt}
              </span>
            </div>
          </div>
        ))}
      </div>
      <TabBar active="programs" />
    </>
  )
}

// ─── 6. 성장 ─────────────────────────────────────────
function GrowthMock() {
  const stages = [
    { n: 'seed', e: '🌰', label: '씨앗', on: true },
    { n: 'sprout', e: '🌱', label: '새싹', on: true },
    { n: 'sapling', e: '🌿', label: '묘목', on: true },
    { n: 'tree', e: '🌳', label: '나무', on: false },
    { n: 'bloom', e: '🌸', label: '만개', on: false },
  ]
  return (
    <>
      <Header title="나의 성장" />
      <div className="p-3 space-y-2.5 pb-4">
        {/* 현재 단계 히어로 */}
        <div className="bg-gradient-to-b from-emerald-50 to-white rounded-[12px] shadow-md p-4 flex flex-col items-center">
          <I group="growth" name="sapling" emoji="🌿" size={96} />
          <p className="text-[15px] font-extrabold text-gray-800 mt-2">묘목 단계</p>
          <p className="text-[11px] text-gray-500 mt-0.5">꾸준함이 나무로 자라고 있어요</p>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: '62%' }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5">다음 단계까지 인증 6번</p>
        </div>
        {/* 단계 진행 */}
        <div className="bg-white rounded-[12px] shadow-sm p-3">
          <p className="text-[12px] font-bold text-gray-700 mb-3">성장 단계</p>
          <div className="flex items-end justify-between">
            {stages.map((s) => (
              <div key={s.n} className="flex flex-col items-center gap-1">
                <I group="growth" name={s.n} emoji={s.e} size={s.on ? 40 : 32} className={s.on ? '' : 'opacity-30 grayscale'} />
                <span className={`text-[9px] font-bold ${s.on ? 'text-emerald-600' : 'text-gray-300'}`}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        {/* 물·햇빛 액션 */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-white rounded-[12px] shadow-sm p-3 flex items-center gap-2.5">
            <I group="growth" name="water" emoji="💧" size={38} />
            <div>
              <p className="text-[12px] font-bold text-gray-800">물 주기</p>
              <p className="text-[9px] text-gray-400">= 미션 인증</p>
            </div>
          </div>
          <div className="bg-white rounded-[12px] shadow-sm p-3 flex items-center gap-2.5">
            <I group="growth" name="sun" emoji="☀️" size={38} />
            <div>
              <p className="text-[12px] font-bold text-gray-800">햇빛</p>
              <p className="text-[9px] text-gray-400">= 출석</p>
            </div>
          </div>
        </div>
      </div>
      <TabBar active="programs" />
    </>
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

// ─── 9. 퀴즈 풀기 ────────────────────────────────────
function QuizMock() {
  const opts = [
    { k: 'A', t: '하루 30분 이상 걷기', on: false },
    { k: 'B', t: '물을 충분히 마시기', on: true },
    { k: 'C', t: '자기 전 스마트폰 보기', on: false },
    { k: 'D', t: '규칙적인 수면 시간', on: false },
  ]
  return (
    <>
      <Header title="건강 퀴즈" />
      <div className="p-3 space-y-3 pb-4">
        {/* 히어로 */}
        <div className="bg-gradient-to-b from-indigo-50 to-white rounded-[14px] shadow-md p-4 flex flex-col items-center text-center">
          <I group="feature" name="quiz" emoji="❓" size={72} />
          <p className="text-[11px] font-bold text-indigo-500 mt-2">오늘의 퀴즈 · 3/5</p>
          <p className="text-[15px] font-extrabold text-gray-800 leading-snug mt-1">다음 중 건강에<br />도움이 되지 <span className="text-rose-500">않는</span> 습관은?</p>
        </div>
        {/* 보기 */}
        <div className="space-y-2">
          {opts.map((o) => (
            <div key={o.k} className={`flex items-center gap-3 p-3 rounded-[12px] border-2 ${o.on ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-white'}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-extrabold flex-shrink-0 ${o.on ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{o.k}</span>
              <span className={`text-[13px] font-bold ${o.on ? 'text-indigo-700' : 'text-gray-700'}`}>{o.t}</span>
            </div>
          ))}
        </div>
        {/* 보상 + 제출 */}
        <div className="flex items-center gap-2 pt-1">
          <div className="flex items-center gap-1.5 bg-amber-50 rounded-full px-3 py-2">
            <I group="reward" name="gift" emoji="🎁" size={22} />
            <span className="text-[11px] font-bold text-amber-600">+10P</span>
          </div>
          <div className="flex-1 py-3 rounded-[12px] bg-indigo-500 text-white text-center text-[13px] font-bold">제출하기</div>
        </div>
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
          <Phone title="③ 프로그램 상세 · 미션"><DetailMock /></Phone>
          <Phone title="④ 랭킹"><RankMock /></Phone>
          <Phone title="⑤ 응원 게시판"><CheerMock /></Phone>
          <Phone title="⑥ 성장"><GrowthMock /></Phone>
          <Phone title="⑦ 마이페이지"><ProfileMock /></Phone>
          <Phone title="⑧ 알림"><NotifMock /></Phone>
          <Phone title="⑨ 퀴즈 풀기"><QuizMock /></Phone>
          <Phone title="⑩ 미션 인증"><VerifyMock /></Phone>
        </div>
      </div>
    </div>
  )
}

export default IconMockupDemoPage
