import { useState } from 'react'
import { Timer, Flame, Megaphone, Footprints, Star, ClipboardList, HelpCircle, MessageSquare, ChevronRight, Check, MapPin, Pencil, X } from 'lucide-react'
import WeeklyStreak from './WeeklyStreak'

// 달리기 테마 전용 홈(대시보드) — 목업 기준 UI (2026-06-30, v2).
//   변경: 히어로에 추천페이스+주간스트릭 통합(층층이), 회복점수→칼로리, 운영자 설정 페이스, 일러스트 연결.
//   에셋 경로(파일 넣으면 자동 적용, 없으면 폴백):
//     /illustrations/themes/running/{runner,banner,course-map}.png
//     /icons/running/{shoe,stopwatch,star,flame}.png
const RUN = '/illustrations/themes/running'
const RICON = '/icons/running'
const wd = (label, done) => ({ label, done })

// 이미지 — 없거나 로드 실패 시 fallback 렌더
function AssetImg({ src, fallback, className }) {
  const [err, setErr] = useState(false)
  if (err || !src) return fallback
  return <img src={src} alt="" aria-hidden="true" className={className} onError={() => setErr(true)} />
}

// 미션/퀴즈/커뮤니티 진입 카드 — 비활성 메뉴는 호출부에서 제외(여기선 항상 활성 박스만 렌더).
//   sized=true(박스 2개 이하): 170×133 고정 / false(3개): 그리드 셀에 맞춤.
function NavCard({ icon, title, desc, actionLabel = '바로가기', onClick, sized = false, nudgeX = 0 }) {
  return (
    <div className={`rounded-2xl p-3 bg-white border border-gray-100 shadow-soft flex flex-col ${sized ? 'w-[170px] h-[133px]' : ''}`}>
      <div className="flex items-start gap-0.5 mb-1 h-9">
        {icon}
        <p className="text-[12px] font-bold text-gray-800 leading-tight break-keep" style={{ transform: `translate(${nudgeX}px, 4px)` }}>{title}</p>
      </div>
      <p className="text-[10.5px] text-gray-500 leading-snug flex-1">{desc}</p>
      <button type="button" onClick={onClick}
        className="mt-2 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center gap-0.5 transition">
        {actionLabel} <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function RunningHome({
  programName = '러닝 프로그램',
  startDate = '2026.06.29',
  endDate = '2026.07.26',
  progress = 3,
  pace = "6'20",                 // 운영자 설정값
  weekStreak = { count: 4, days: [wd('월', true), wd('화', true), wd('수', true), wd('목', true), { label: '금', done: false, today: true }] },
  notice = '챌린지 인증 시 GPS 기록을 꼭 확인해주세요!',
  daily = { distanceKm: 42.195, timeHours: 23.3, streakDays: 7, calories: 409 },
  onOpenTab = () => {},
  onRecord = () => {},
  onNotice = null,               // 공지 클릭 동작(미지정 시 커뮤니티 탭으로)
  quizEnabled = true,            // 마법사 「퀴즈」 토글
  communityEnabled = true,       // 마법사 「커뮤니티」 토글
  paceEditable = false,          // 운영자 — 추천 페이스 수정 가능
  onPaceChange = null,           // (newPace) => void
  showStampTest = false,         // 주간 스트릭 도장 데모 트리거 노출
  streakRef = null,              // WeeklyStreak ref (playStamp 외부 호출용)
}) {
  const fmt = (n) => Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: 3 })
  // 연도 4자리 → 2자리 (2026.06.29 → 26.06.29)
  const yy = (d) => String(d || '').replace(/^\d{2}(\d{2})/, '$1')
  // 추천 페이스 인라인 수정 (운영자)
  const [editingPace, setEditingPace] = useState(false)
  const [paceInput, setPaceInput] = useState(pace)
  const savePace = () => {
    const v = paceInput.trim()
    if (v && v !== pace) onPaceChange?.(v)
    setEditingPace(false)
  }

  return (
    <div className="-mx-[11px] px-4 pb-6 space-y-3">
      {/* 1) 히어로 — 인사만 (나뭇잎·스탯 제거) */}
      <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
        <h1 className="text-[20px] font-extrabold text-gray-900 leading-snug">
          오늘도 한 걸음,<br />
          <span className="text-emerald-600">더 건강한 나를 향해</span>
        </h1>
        <p className="text-[12px] text-gray-500 mt-1.5">지속 가능한 러닝 습관을 만들어가요.</p>
      </div>

      {/* 2) 추천 페이스 / 주간 스트릭 — 별도 박스 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 추천 페이스 — 아이콘 + 컬럼(제목/값/안내 들여쓰기 정렬) */}
        <div className="rounded-2xl p-3.5 bg-white border border-gray-100 shadow-soft">
          <div className="flex items-start gap-2.5">
            <span className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <AssetImg src={`${RICON}/stopwatch.png`} className="w-10 h-10 object-contain" fallback={<Timer className="w-8 h-8 text-emerald-500" />} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-[12px] font-bold text-gray-700">추천 페이스</span>
                {paceEditable && !editingPace && (
                  <button type="button" onClick={() => { setPaceInput(pace); setEditingPace(true) }}
                    className="text-gray-300 hover:text-emerald-500 transition" aria-label="추천 페이스 수정">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {editingPace ? (
                <div className="flex items-center gap-1" style={{ marginTop: '6px' }}>
                  <input
                    value={paceInput}
                    onChange={(e) => setPaceInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') savePace(); if (e.key === 'Escape') setEditingPace(false) }}
                    autoFocus
                    maxLength={8}
                    placeholder="6'20"
                    className="w-[68px] px-1.5 py-0.5 text-[18px] font-extrabold text-emerald-600 border border-emerald-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                  <button type="button" onClick={savePace} className="w-7 h-7 rounded-md bg-emerald-500 text-white flex items-center justify-center flex-shrink-0" aria-label="저장">
                    <Check className="w-4 h-4" strokeWidth={3} />
                  </button>
                  <button type="button" onClick={() => setEditingPace(false)} className="w-7 h-7 rounded-md bg-gray-100 text-gray-400 flex items-center justify-center flex-shrink-0" aria-label="취소">
                    <X className="w-4 h-4" strokeWidth={3} />
                  </button>
                </div>
              ) : (
                <p className="text-[24px] font-extrabold text-emerald-600 leading-none" style={{ marginTop: '15px' }}>{pace}<span className="text-[12px] font-bold text-gray-400 ml-1">/km</span></p>
              )}
              <p className="text-[11px] text-gray-400" style={{ marginTop: '6px' }}>편안하게 유지해요!</p>
            </div>
          </div>
        </div>
        {/* 주간 스트릭 — 도장 찍기 연출 전용 컴포넌트 */}
        <WeeklyStreak
          ref={streakRef}
          count={weekStreak.count}
          days={weekStreak.days}
          icon={<AssetImg src={`${RICON}/flame.png`} className="w-6 h-6 object-contain" fallback={<Flame className="w-6 h-6 text-orange-400" />} />}
          showTest={showStampTest}
        />
      </div>

      {/* 2) 공지사항 */}
      <button type="button" onClick={onNotice || (() => onOpenTab('community'))}
        className="w-full flex items-center gap-3 rounded-2xl p-3.5 bg-white border border-gray-100 shadow-soft text-left hover:bg-gray-50 transition">
        <span className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0"><Megaphone className="w-4 h-4 text-emerald-500" /></span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-800">공지사항</p>
          <p className="text-[12px] text-gray-500 truncate">{notice}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
      </button>

      {/* 3) 데일리 로그 — 거리/시간/연속/칼로리 */}
      <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
        <h3 className="text-[13px] font-bold text-gray-800 mb-3">주요 기록 요약</h3>
        <div className="flex">
          {[
            { img: `${RICON}/shoe.png`,      fb: <Footprints className="w-5 h-5 text-emerald-500" />, label: '누적 거리', value: fmt(daily.distanceKm), unit: 'km' },
            { img: `${RICON}/stopwatch.png`, fb: <Timer className="w-5 h-5 text-sky-500" />,           label: '러닝 시간', value: daily.timeHours, unit: '시간' },
            { img: `${RICON}/star.png`,      fb: <Star className="w-5 h-5 text-violet-500" />,         label: '연속 인증', value: daily.streakDays, unit: '일' },
            { img: `${RICON}/flame.png`,     fb: <Flame className="w-5 h-5 text-rose-500" />,          label: '칼로리',   value: daily.calories, unit: 'kcal' },
          ].map((c, i) => (
            <div key={i} className={`flex-1 flex flex-col items-center text-center px-1 ${i !== 0 ? 'border-l border-gray-100' : ''}`}>
              <div className="flex items-center gap-0.5 mb-1">
                <AssetImg src={c.img} className="w-[18px] h-[18px] object-contain" fallback={c.fb} />
                <span className="text-[10px] text-gray-400">{c.label}</span>
              </div>
              <span className="text-[15px] font-extrabold text-gray-900 leading-tight">{c.value}<span className="text-[10px] font-medium text-gray-400 ml-0.5">{c.unit}</span></span>
            </div>
          ))}
        </div>
      </div>

      {/* 4) 마라톤 코스 = 프로그램 진행률 — 레퍼런스: 좌 텍스트 / 우 맵(풀블리드) */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-soft overflow-hidden flex items-stretch">
        {/* 좌: 제목(상단) + 기간 */}
        <div className="w-[42%] flex-shrink-0 px-4 py-3 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-0.5">
            <AssetImg src={`${RUN}/runner.png`} className="w-5 h-5 object-contain" fallback={<span className="text-[15px]">🏃</span>} />
            <h3 className="text-[13px] font-bold text-gray-800 truncate">{programName} 진행률</h3>
          </div>
          <p className="text-[11px] text-gray-400 leading-snug">{yy(startDate)} ~ {yy(endDate)}</p>
        </div>
        {/* 우: 코스 맵 (풀블리드, 깃발 2개 보이게) + 진행 위치 핀. 없으면 SVG 폴백 */}
        <div className="flex-1 relative bg-gradient-to-br from-emerald-50 to-sky-50">
          <AssetImg src={`${RUN}/course-map.png`} className="absolute inset-0 w-full h-full object-cover" fallback={<CourseRoute progress={progress} />} />
          {/* 진행 위치 핀 — 흰 길 위(세로 62%), 양끝 깃발 피해 16~84% 사이 */}
          <div className="absolute -translate-x-1/2 -translate-y-full transition-all" style={{ left: `${Math.max(16, Math.min(84, progress))}%`, top: '62%' }}>
            <MapPin className="w-5 h-5 text-emerald-600 fill-emerald-500 drop-shadow" strokeWidth={2} />
          </div>
        </div>
      </div>

      {/* 5) 미션 / 퀴즈 / 커뮤니티 — 비활성 메뉴는 박스 제거, 활성 개수에 따라 레이아웃 변경
          3개: 그리드(셀 맞춤) / 1~2개: 170×133 고정 박스 */}
      {(() => {
        const boxes = [
          { key: 'mission', actionLabel: '기록하기', onClick: onRecord, title: '미션', desc: '3km 달리기 기록 등록하기', nudgeX: 2,
            icon: <AssetImg src={`${RICON}/mission.png`} className="w-[21px] h-[21px] object-contain flex-shrink-0" fallback={<ClipboardList className="w-[21px] h-[21px] text-emerald-500 flex-shrink-0" />} /> },
          quizEnabled && { key: 'quiz', onClick: () => onOpenTab('quizzes'), title: '퀴즈', desc: '건강 퀴즈 풀기', nudgeX: 2,
            icon: <AssetImg src={`${RICON}/quiz.png`} className="w-[21px] h-[21px] object-contain flex-shrink-0" fallback={<HelpCircle className="w-[21px] h-[21px] text-emerald-500 flex-shrink-0" />} /> },
          communityEnabled && { key: 'community', onClick: () => onOpenTab('community'), title: '커뮤니티', desc: '응원·소식 나누기', nudgeX: 2,
            icon: <AssetImg src={`${RICON}/community.png`} className="w-[21px] h-[21px] object-contain flex-shrink-0" fallback={<MessageSquare className="w-[21px] h-[21px] text-emerald-500 flex-shrink-0" />} /> },
        ].filter(Boolean)
        const three = boxes.length === 3
        return (
          <div className={three ? 'grid grid-cols-3 gap-3 items-stretch' : 'flex gap-3'}>
            {boxes.map(b => (
              <NavCard key={b.key} sized={!three} icon={b.icon} title={b.title} desc={b.desc} actionLabel={b.actionLabel} onClick={b.onClick} nudgeX={b.nudgeX || 0} />
            ))}
          </div>
        )
      })()}

      {/* 6) 하단 격려 배너 (일러스트 배경) */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-100 shadow-soft bg-gradient-to-r from-sky-50 to-emerald-50">
        <AssetImg src={`${RUN}/banner.png`} className="absolute inset-0 w-full h-full object-cover" fallback={<span />} />
        <div className="relative flex items-center gap-3 p-4">
          <span className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center flex-shrink-0">
            <AssetImg src={`${RUN}/plant.png`} className="w-9 h-9 object-contain" fallback={<span className="text-xl">🌱</span>} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-gray-800">오늘도 한 걸음 더, 가볍게 달려봐요</p>
            <p className="text-[11px] text-gray-500 mt-0.5">작은 습관이 큰 변화를 만들어요!</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// 코스 맵 폴백 — 진행률만큼 초록 경로 채움. 출발🚩 → 결승🏁.
function CourseRoute({ progress = 0 }) {
  const pct = Math.max(0, Math.min(100, progress))
  const D = 'M16,70 C 70,70 70,28 120,40 S 210,72 250,46 L 300,30'
  return (
    <svg viewBox="0 0 320 92" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <path d="M0,82 C 80,70 160,90 320,72" fill="none" stroke="#bae6fd" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
      <path d={D} fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" />
      <path d={D} fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - pct} />
    </svg>
  )
}

export default RunningHome
