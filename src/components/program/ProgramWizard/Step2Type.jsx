import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, ChevronRight, Heart, MessageCircle, Circle, X, Calendar, Users, Check } from 'lucide-react'
import { MISSION_LIBRARY } from '../../../lib/missionLibrary'
import { CATEGORY } from '../../../lib/constants'
import UserAvatar from '../../common/UserAvatar'
import InfoTip from '../../common/InfoTip'

// 2단계: 사용할 메뉴 — "한 번에 한 질문" 서브스텝(타입폼 방식).
//   토글 나열 대신, 화면당 결정 하나 + 예/아니요 큰 버튼 + "참여자에게 이렇게 보여요" 미리보기.
//   초등학생도 이해할 수 있는 문구. 순서(테마 자동 반영):
//     일반/달리기: 소통 → 순위 → 팀 → 퀴즈 → 강사 클래스
//     금연:        응원 → 내 변화 → 퀴즈 → 강사 클래스
//   collectData(저장 payload)는 기존과 동일 — 표시 로직만 재구성.

const slideVariants = {
  enter: (d) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
}

// 예 / 아니요 큰 선택 버튼 (토글 대신 — 켠 건지 한눈에)
function YesNo({ value, onChange, yesLabel = '네, 쓸래요 👍', noLabel = '아니요, 안 쓸래요' }) {
  const base = 'px-3 py-4 rounded-[12px] border-2 text-center text-sm font-bold transition break-keep'
  return (
    <div className="grid grid-cols-2" style={{ gap: '9px' }}>
      <button type="button" onClick={() => onChange(true)}
        className={`${base} ${value === true ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
        {yesLabel}
      </button>
      <button type="button" onClick={() => onChange(false)}
        className={`${base} ${value === false ? 'border-gray-400 bg-gray-100 text-gray-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
        {noLabel}
      </button>
    </div>
  )
}

// 실제 개요 메뉴 버튼(ProgramHome NavCard)과 동일한 세로 카드 — "이 버튼을 눌러 들어가요" 진입 연출용
function NavCardSample({ iconSrc, title, desc, actionLabel }) {
  return (
    <motion.div animate={{ scale: [1, 0.94, 1] }} transition={{ repeat: Infinity, duration: 1.1 }}
      className="w-[108px] rounded-2xl p-2 pt-3 bg-white border border-gray-100 shadow-soft flex flex-col items-center text-center gap-1">
      <img src={iconSrc} alt="" aria-hidden="true" className="w-9 h-9 object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
      <p className="text-[12px] font-bold text-gray-800 leading-tight">{title}</p>
      <p className="text-[9.5px] text-gray-500 leading-tight break-keep mb-1">{desc}</p>
      <div className="w-full h-7 mt-auto rounded-lg bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center gap-0.5">
        {actionLabel} <ChevronRight className="w-3 h-3" />
      </div>
    </motion.div>
  )
}

// 실제 피드 리스트 카드(FeedContent renderListRow)를 그대로 복제 — "실제 화면" 미리보기용
function FeedRowSample({ img, nick, note, likes, comments, time, liked = false }) {
  return (
    <div className="w-full flex items-center gap-3 text-left bg-white shadow-elevated rounded-2xl p-2.5">
      <div className="w-[64px] h-[64px] rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
        <img src={img} alt="" aria-hidden="true" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-gray-800 truncate">{nick}</span>
          <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">{time}</span>
        </div>
        <p className="text-[12px] text-gray-600 line-clamp-1 mt-0.5">{note}</p>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500">
          <motion.span className="flex items-center gap-0.5" animate={{ scale: liked ? [1, 1.35, 1] : 1 }} transition={{ duration: 0.4 }}>
            <Heart className={`w-3 h-3 ${liked ? 'fill-red-500 text-red-500' : ''}`} /> {likes}
          </motion.span>
          <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {comments}</span>
        </div>
      </div>
    </div>
  )
}

// 소통 데모 — "커뮤니티 진입 → 게시판(인증) 선택 → 피드 좋아요"를 루프로.
//   실제 NavCard(커뮤니티 진입) / 게시판 칩 / FeedContent 카드 마크업 복제.
const DEMO_BOARDS = [{ id: 'all', label: '전체' }, { id: 'cert', label: '인증' }, { id: 'free', label: '자유' }, { id: 'notice', label: '공지' }]
function FeedDemo() {
  // phase: 0 진입카드 → 1 게시판칩(전체) → 2 인증 선택+피드 → 3 좋아요 → (loop)
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const dwell = [1400, 800, 1400, 1500]
    const t = setTimeout(() => setPhase(p => (p + 1) % 4), dwell[phase])
    return () => clearTimeout(t)
  }, [phase])
  const selected = phase >= 2 ? 'cert' : 'all'
  const showFeed = phase >= 2
  const liked = phase === 3
  const slide = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.28, ease: 'easeOut' } }

  return (
    <div className="h-[224px] overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === 0 ? (
          <motion.div key="entry" {...slide} className="h-full flex items-center justify-center">
            <NavCardSample iconSrc="/icons/feature/community.png" title="커뮤니티" desc="함께 응원해요" actionLabel="바로가기" />
          </motion.div>
        ) : (
          <motion.div key="board" {...slide}>
            {/* 게시판 칩 */}
            <div className="flex gap-2 pb-2 mb-1">
              {DEMO_BOARDS.map(b => {
                const on = b.id === selected
                return (
                  <span key={b.id}
                    className={`flex-shrink-0 inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-300 ${
                      on ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-500'}`}>
                    {b.label}
                  </span>
                )
              })}
            </div>
            {/* 선택된 게시판 피드 */}
            {showFeed && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-2">
                <FeedRowSample img="/illustrations/program-covers/running.jpg" nick="민지" note="오늘 5km 완주했어요! 💪" likes={liked ? 4 : 3} comments={2} time="방금" liked={liked} />
                <FeedRowSample img="/illustrations/program-covers/diet.jpg" nick="준호" note="오늘 아침 샐러드 인증 🥗" likes={5} comments={1} time="12분 전" />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// 순위 데모 — "개요 랭킹 버튼 탭 → 순위표 진입 → 내(다인)가 4위→3위로 올라가는 연출"을 루프로.
function RankDemo() {
  // phase: 0 진입카드 → 1 목록(기본) → 2 나 상승 → (loop)
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const dwell = [1500, 1400, 2000]
    const t = setTimeout(() => setPhase(p => (p + 1) % 3), dwell[phase])
    return () => clearTimeout(t)
  }, [phase])
  const meScore = phase === 2 ? 260 : 210
  const rows = [
    { id: 'a', nick: '민지', score: 320 },
    { id: 'b', nick: '준호', score: 290 },
    { id: 'c', nick: '서연', score: 250 },
    { id: 'me', nick: '다인', score: meScore, me: true },
  ].sort((x, y) => y.score - x.score).map((r, i) => ({ ...r, rank: i + 1 }))
  const slide = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.28, ease: 'easeOut' } }
  return (
    <div className="h-[264px] overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === 0 ? (
          <motion.div key="entry" {...slide} className="h-full flex items-center justify-center">
            <NavCardSample iconSrc="/icons/reward/ranking.png" title="랭킹" desc="순위를 확인해요" actionLabel="확인하기" />
          </motion.div>
        ) : (
          <motion.div key="list" {...slide} className="bg-white rounded-2xl shadow-elevated overflow-hidden">
            {rows.map(r => (
              <motion.div key={r.id} layout transition={{ duration: 0.5, ease: 'easeInOut' }}
                className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 ${r.me ? 'bg-emerald-50/60' : 'bg-white'}`}>
                <span className="w-6 text-center text-base font-bold text-gray-500 flex-shrink-0">{r.rank}</span>
                <UserAvatar nickname={r.nick} size="md" />
                <span className={`flex-1 min-w-0 font-bold truncate ${r.me ? 'text-emerald-800' : 'text-gray-800'}`}>
                  {r.nick}{r.me && <span className="ml-1.5 text-xs text-emerald-600 font-medium">(나)</span>}
                </span>
                <span className="flex-shrink-0 text-emerald-600 font-extrabold">
                  {r.score.toLocaleString()}<span className="text-xs font-bold text-emerald-500 ml-0.5">P</span>
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// 실제 Top3 시상대(RankingsPage Podium)를 그대로 복제 — "실제 화면" 미리보기용
const MEDAL_IMG = { 1: '/icons/ranking/medal-1.png', 2: '/icons/ranking/medal-2.png', 3: '/icons/ranking/medal-3.png' }
const PODIUM_RING = { 1: 'ring-amber-300', 2: 'ring-gray-300', 3: 'ring-orange-300' }
function PodiumSample() {
  const data = { 1: { nick: '민지', score: 320 }, 2: { nick: '준호', score: 290 }, 3: { nick: '서연', score: 250 } }
  const slot = (place) => {
    const row = data[place]
    const isFirst = place === 1
    return (
      <div className={`relative flex flex-col items-center rounded-2xl bg-white shadow-elevated px-2 ${
        isFirst ? 'pt-8 pb-3.5 -mt-4 border border-amber-200' : 'pt-6 pb-3'}`}>
        {isFirst && (
          <img src="/icons/ranking/leaves.png" alt="" aria-hidden="true"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[135%] max-w-none z-0 pointer-events-none select-none" />
        )}
        <img src={MEDAL_IMG[place]} alt={`${place}등`}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
          className={`absolute left-1/2 -translate-x-1/2 z-20 drop-shadow-sm pointer-events-none select-none ${
            isFirst ? '-top-7 w-14 h-14' : '-top-5 w-[50px] h-[50px]'}`} />
        <div className={`relative z-10 rounded-full ring-2 ${PODIUM_RING[place]} p-0.5 bg-white`}>
          <UserAvatar nickname={row.nick} size={isFirst ? 'lg' : 'md'} />
        </div>
        <p className="relative z-10 mt-1.5 text-[13px] font-bold truncate w-full text-center text-gray-800">{row.nick}</p>
        <p className={`relative z-10 mt-0.5 font-extrabold text-emerald-600 ${isFirst ? 'text-lg' : 'text-base'}`}>
          {row.score.toLocaleString()}<span className="text-[11px] font-bold text-emerald-500 ml-1">P</span>
        </p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 items-end gap-2.5 pt-[33px]">
      {slot(2)}{slot(1)}{slot(3)}
    </div>
  )
}

// 시상대 데모 — "개요 랭킹 버튼 탭 → 시상대(Top3) + 그 아래 등수별 유저 목록"을 루프로.
function PodiumDemo() {
  const [phase, setPhase] = useState(0)  // 0 진입카드 → 1 시상대+목록 → (loop)
  useEffect(() => {
    const t = setTimeout(() => setPhase(p => (p + 1) % 2), phase === 0 ? 1500 : 2600)
    return () => clearTimeout(t)
  }, [phase])
  const slide = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.28, ease: 'easeOut' } }
  const rest = [
    { rank: 4, nick: '다인', score: 210, me: true },
    { rank: 5, nick: '유진', score: 180, me: false },
  ]
  return (
    <div className="h-[300px] overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === 0 ? (
          <motion.div key="entry" {...slide} className="h-full flex items-center justify-center">
            <NavCardSample iconSrc="/icons/reward/ranking.png" title="랭킹" desc="순위를 확인해요" actionLabel="확인하기" />
          </motion.div>
        ) : (
          <motion.div key="podium" {...slide} className="space-y-3">
            <PodiumSample />
            <div className="bg-white rounded-2xl shadow-elevated overflow-hidden">
              {rest.map(r => (
                <div key={r.rank} className={`flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 ${r.me ? 'bg-emerald-50/60' : ''}`}>
                  <span className="w-6 text-center text-base font-bold text-gray-500 flex-shrink-0">{r.rank}</span>
                  <UserAvatar nickname={r.nick} size="md" />
                  <span className={`flex-1 min-w-0 font-bold truncate ${r.me ? 'text-emerald-800' : 'text-gray-800'}`}>
                    {r.nick}{r.me && <span className="ml-1.5 text-xs text-emerald-600 font-medium">(나)</span>}
                  </span>
                  <span className="flex-shrink-0 text-emerald-600 font-extrabold">
                    {r.score.toLocaleString()}<span className="text-xs font-bold text-emerald-500 ml-0.5">P</span>
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// 실제 팀 랭킹 리스트(TeamRankingPanel TeamRow)를 그대로 복제 — "실제 화면" 미리보기용
function TeamListSample() {
  const teams = [
    { rank: 1, emoji: '🔥', name: '불꽃팀', count: 4, cap: 4, names: '민지, 준호, 서연 외 1', total: 1120, avg: 280, mine: false },
    { rank: 2, emoji: '💪', name: '튼튼팀', count: 3, cap: 4, names: '다인, 유진, 성호', total: 810, avg: 270, mine: true },
  ]
  return (
    <div className="bg-white rounded-2xl shadow-elevated divide-y divide-gray-100 overflow-hidden">
      {teams.map(t => (
        <div key={t.rank} className={`w-full text-left flex items-center gap-3 px-4 py-3 ${t.mine ? 'bg-violet-50/60' : ''}`}>
          <span className="w-6 text-center text-base font-bold text-gray-500 flex-shrink-0">{t.rank}</span>
          <span className="text-xl flex-shrink-0 w-7 text-center">{t.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className={`font-bold truncate ${t.mine ? 'text-violet-800' : 'text-gray-800'}`}>
              {t.name}{t.mine && <span className="ml-1.5 text-xs text-violet-600 font-medium">(내 팀)</span>}
            </p>
            <p className="text-xs text-gray-500 truncate">👤 {t.count}/{t.cap} · {t.names}</p>
          </div>
          <div className="text-right flex-shrink-0 leading-tight">
            <span className="text-violet-600 font-extrabold">{t.total.toLocaleString()}<span className="text-xs font-bold text-violet-500 ml-0.5">P</span></span>
            <p className="text-[11px] text-gray-400">인당 {t.avg}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// 퀴즈 데모 — "입장 카드 탭 → 실제 퀴즈 진입 → Q1(OX)·Q2(객관식) 자동 응답"을 루프로 재생.
//   실제 QuizSolvePage 문항 카드/입력 마크업을 그대로 복제 + framer-motion 으로 흐름을 영상처럼.
function QuizDemo() {
  // phase: 0 입장카드 → 1 Q1 미선택 → 2 Q1 선택 → 3 Q2 미선택 → 4 Q2 선택 → (loop)
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const dwell = [1500, 850, 1200, 850, 1600]
    const t = setTimeout(() => setPhase(p => (p + 1) % 5), dwell[phase])
    return () => clearTimeout(t)
  }, [phase])

  const scene = phase === 0 ? 'entry' : phase <= 2 ? 'q1' : 'q2'
  const q1Answered = phase === 2
  const q2Answered = phase === 4
  const q2Options = ['빠르게 걷기', '무거운 역기 들기', '가만히 앉아있기']
  const slide = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.28, ease: 'easeOut' } }

  return (
    <div className="h-[236px] overflow-hidden">
      <AnimatePresence mode="wait">
        {scene === 'entry' && (
          <motion.div key="entry" {...slide} className="h-full flex items-center justify-center">
            <NavCardSample iconSrc="/icons/feature/quiz.png" title="퀴즈" desc="건강 지식을 배워요" actionLabel="풀어보기" />
          </motion.div>
        )}

        {scene === 'q1' && (
          <motion.div key="q1" {...slide} className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[12px] font-extrabold">Q1</span>
              <span className="text-[12px] text-gray-400">10점</span>
            </div>
            <p className="text-[15px] font-bold text-gray-800 leading-snug mb-4 break-keep">하루 물 권장량은 약 2L다?</p>
            <div className="flex gap-2">
              <div className={`flex-1 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${q1Answered ? 'bg-emerald-100 ring-2 ring-emerald-400' : 'bg-emerald-50'}`}>
                <Circle className="w-7 h-7 text-emerald-500" strokeWidth={3} />
              </div>
              <div className="flex-1 h-14 rounded-2xl flex items-center justify-center bg-rose-50">
                <X className="w-7 h-7 text-rose-500" strokeWidth={3} />
              </div>
            </div>
          </motion.div>
        )}

        {scene === 'q2' && (
          <motion.div key="q2" {...slide} className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[12px] font-extrabold">Q2</span>
              <span className="text-[12px] text-gray-400">10점</span>
            </div>
            <p className="text-[15px] font-bold text-gray-800 leading-snug mb-4 break-keep">유산소 운동은 무엇일까요?</p>
            <div className="space-y-2">
              {q2Options.map((opt, oIdx) => {
                const selected = q2Answered && oIdx === 0
                return (
                  <div key={oIdx} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-left text-sm transition-all duration-300 ${
                    selected ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-gray-200 text-gray-700'}`}>
                    <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${selected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'}`} />
                    {opt}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// 클래스 데모 — "클래스 일정 → 상세 → 신청하기 → 신청됨✓"를 루프로 재생.
//   실제 ClassOverviewCard / ClassDetail 마크업을 그대로 복제.
function ClassDemo() {
  // phase: 0 일정 목록 → 1 상세(신청하기) → 2 상세(신청됨✓) → (loop)
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    const dwell = [1700, 1300, 1600]
    const t = setTimeout(() => setPhase(p => (p + 1) % 3), dwell[phase])
    return () => clearTimeout(t)
  }, [phase])
  const applied = phase === 2
  const slide = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.28, ease: 'easeOut' } }

  return (
    <div className="h-[208px] overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === 0 ? (
          <motion.div key="list" {...slide} className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4">
            <div className="flex items-center gap-2 mb-3">
              <img src="/icons/feature/attendance.png" alt="" aria-hidden="true" className="w-6 h-6 object-contain flex-shrink-0" onError={(e) => { e.currentTarget.style.display = 'none' }} />
              <h3 className="text-sm font-bold text-gray-800">클래스 일정</h3>
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">이번 주 2</span>
              <motion.span animate={{ opacity: [1, 0.35, 1] }} transition={{ repeat: Infinity, duration: 1.1 }} className="ml-auto inline-flex items-center text-[12px] text-gray-400">전체 보기 <ChevronRight className="w-4 h-4" /></motion.span>
            </div>
            <div className="space-y-2">
              {[
                { pill: 'bg-emerald-50 text-emerald-700', emoji: '🧘', label: '요가', title: '월요일 아침 요가', date: '7/28(월)', cap: '8/12' },
                { pill: 'bg-violet-50 text-violet-700', emoji: '🤸', label: '필라테스', title: '수요일 코어 필라테스', date: '7/30(수)', cap: '5/10' },
              ].map((s, i) => (
                <div key={i} className="w-full flex items-center gap-3 rounded-xl bg-gray-50 p-2.5 text-left">
                  <span className={`inline-flex items-center gap-1 px-2 h-6 rounded-lg text-[11px] font-bold flex-shrink-0 ${s.pill}`}>{s.emoji} {s.label}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-gray-800 truncate">{s.title}</p>
                    <p className="text-[11px] text-gray-500 truncate">{s.date} · 19:00 · 김OO 강사</p>
                  </div>
                  <span className="text-[11px] text-gray-400 flex-shrink-0">{s.cap}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div key="detail" {...slide} className="space-y-2">
            <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4 space-y-2">
              <span className="inline-flex w-fit items-center gap-1 px-2 h-6 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700">🧘 요가</span>
              <p className="text-[15px] font-bold text-gray-900">월요일 아침 요가</p>
              <p className="flex items-center gap-2 text-[13px] text-gray-700"><Calendar className="w-4 h-4 text-emerald-500 flex-shrink-0" />7/28(월) 19:00~20:00</p>
              <p className="flex items-center gap-2 text-[13px] text-gray-700"><Users className="w-4 h-4 text-emerald-500 flex-shrink-0" />정원 8/12명 · 사전 신청 · 출석 +20P</p>
            </div>
            {applied ? (
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} transition={{ duration: 0.25 }}
                className="w-full h-12 rounded-2xl bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4" />신청됨 ✓
              </motion.div>
            ) : (
              <div className="w-full h-12 rounded-2xl bg-emerald-500 text-white font-bold flex items-center justify-center">신청하기</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// 팀 데모 — "랭킹 화면에서 개인/팀 토글을 눌러 팀 랭킹으로 전환"을 루프로 (실제 토글 + TeamRankingPanel 마크업)
function TeamDemo() {
  const [phase, setPhase] = useState(0)  // 0 개인, 1 팀
  useEffect(() => {
    const t = setTimeout(() => setPhase(p => (p + 1) % 2), phase === 0 ? 1700 : 2300)
    return () => clearTimeout(t)
  }, [phase])
  const scope = phase === 0 ? 'individual' : 'team'
  const slide = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.28, ease: 'easeOut' } }
  const indiv = [
    { rank: 1, nick: '민지', score: 320 },
    { rank: 2, nick: '준호', score: 290 },
    { rank: 3, nick: '서연', score: 250 },
  ]
  return (
    <div className="h-[252px] overflow-hidden">
      {/* 개인/팀 토글 */}
      <div className="flex justify-end mb-3">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-pill">
          {[{ v: 'individual', l: '개인' }, { v: 'team', l: '팀' }].map(o => {
            const on = o.v === scope
            return (
              <span key={o.v} className={`px-3.5 h-[30px] flex items-center rounded-pill text-[13px] font-bold transition-colors duration-300 ${on ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500'}`}>{o.l}</span>
            )
          })}
        </div>
      </div>
      <AnimatePresence mode="wait">
        {scope === 'individual' ? (
          <motion.div key="ind" {...slide} className="bg-white rounded-2xl shadow-elevated overflow-hidden">
            {indiv.map(r => (
              <div key={r.rank} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0">
                <span className="w-6 text-center text-base font-bold text-gray-500 flex-shrink-0">{r.rank}</span>
                <UserAvatar nickname={r.nick} size="md" />
                <span className="flex-1 min-w-0 font-bold truncate text-gray-800">{r.nick}</span>
                <span className="flex-shrink-0 text-emerald-600 font-extrabold">{r.score.toLocaleString()}<span className="text-xs font-bold text-emerald-500 ml-0.5">P</span></span>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div key="team" {...slide}>
            <TeamListSample />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// "참여자에게 이렇게 보여요" 미리보기 박스
function Preview({ children }) {
  return (
    <div className="rounded-[12px] border border-gray-200 bg-gray-50/70 p-3" style={{ marginBottom: '14px' }}>
      <p className="text-[11px] font-bold text-gray-400" style={{ marginBottom: '8px' }}>👀 참여자에게 이렇게 보여요</p>
      {children}
    </div>
  )
}

// 2지선다 선택 버튼 (팀 점수 방식·정원 정책)
function Seg({ options, value, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map(o => (
        <button
          key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`flex-1 px-3 py-2 rounded-[10px] border-2 text-sm text-center transition ${
            value === o.value
              ? 'border-violet-500 bg-violet-50 text-violet-700 font-medium'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// 팀 정원 숫자 선택 (min~max 범위)
function NumSelect({ value, onChange, min, max }) {
  const opts = []
  for (let i = min; i <= max; i++) opts.push(i)
  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="px-3 py-2 rounded-[10px] border-2 border-gray-200 bg-white text-sm text-gray-700 focus:border-violet-400 focus:outline-none"
    >
      {opts.map(n => <option key={n} value={n}>{n}명</option>)}
    </select>
  )
}

// 강사 클래스 — 출석 확정 방식 (운영자 선택)
const CLASS_METHODS = [
  {
    key: 'operator_roll', icon: '/icons/class/roll.png', title: '운영자 출석부 체크', tag: '추천',
    desc: '클래스가 끝나면 운영자(또는 강사)가 참가자 명단에서 참석자를 직접 체크해요. 가장 정확하고 부정 출석이 없어요.',
    caution: '매 클래스마다 명단 체크 한 번이 필요해요.',
  },
  {
    key: 'venue_code', icon: '/icons/class/code.png', title: '현장 출석 코드',
    desc: '강사가 현장에서 그날의 6자리 코드를 알려주면, 참가자가 앱에 입력해 스스로 출석해요. 운영자 손이 덜 가요.',
    caution: '코드가 밖으로 공유되면 현장에 없어도 출석될 수 있어요.',
  },
  {
    key: 'self_approve', icon: '/icons/class/hand.png', title: '자가출석 + 운영자 승인',
    desc: "참가자가 '출석'을 누르면 신청이 쌓이고, 운영자가 미션 인증처럼 한 번에 승인/거절해요. 익숙한 방식이에요.",
    caution: '승인 전까지는 포인트가 지급되지 않아요.',
  },
]
function ClassMethodCard({ m, selected, onSelect }) {
  return (
    <button type="button" onClick={onSelect}
      className={`w-full p-4 rounded-[10px] border-2 text-left transition ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
      style={{ marginBottom: '9px' }}>
      <div className="flex items-start gap-3">
        <img src={m.icon} alt="" aria-hidden="true" className="w-9 h-9 object-contain flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-bold ${selected ? 'text-emerald-700' : 'text-gray-800'}`}>{m.title}</p>
            {m.tag && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white font-bold flex-shrink-0">{m.tag}</span>}
            <span className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'border-emerald-500' : 'border-gray-300'}`}>
              {selected && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
            </span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed break-keep mt-1.5">{m.desc}</p>
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-2 break-keep">⚠️ {m.caution}</p>
        </div>
      </div>
    </button>
  )
}

function Step2Type({ initialData, onNext, onSave, onPrev, enterAtEnd = false }) {
  // 커뮤니티 메뉴 사용 (= 피드 활성). 기본 ON — DRAFT 재진입 시 저장값 사용
  const [communityEnabled, setCommunityEnabled] = useState(
    initialData?.community_enabled !== undefined ? !!initialData.community_enabled
      : initialData?.feed_enabled !== undefined ? !!initialData.feed_enabled : true
  )
  const [quizEnabled, setQuizEnabled] = useState(initialData?.quiz_enabled !== false)
  const [rankingEnabled, setRankingEnabled] = useState(initialData?.ranking_enabled !== false)
  const [podiumEnabled, setPodiumEnabled] = useState(!!initialData?.podium_enabled)  // 상위 3명 시상대 (기본 OFF)

  // 팀 기능 — 랭킹 메뉴가 켜져 있어야 동작(팀 랭킹이 랭킹 탭에 노출되므로)
  const [teamEnabled, setTeamEnabled] = useState(!!initialData?.team_enabled)
  const [teamScoreMode, setTeamScoreMode] = useState(initialData?.team_score_mode || 'sum')
  const [teamSizeType, setTeamSizeType] = useState(initialData?.team_size_type || 'range')
  const [teamSizeMin, setTeamSizeMin] = useState(initialData?.team_size_min || 2)
  const [teamSizeMax, setTeamSizeMax] = useState(initialData?.team_size_max || 4)
  const [teamSizeFixed, setTeamSizeFixed] = useState(initialData?.team_size_fixed || 4)

  // Step 1 카테고리 → 테마 판별
  const selectedCategories = initialData?.categories || []
  const isQuitCat = selectedCategories.includes(CATEGORY.NO_SMOKING.key)   // 금연 테마
  const isRunningCat = selectedCategories.includes(CATEGORY.RUNNING.key)   // 달리기 테마

  // 금연 카테고리 — 「내 변화」 탭 사용 (랭킹/팀 대신). 신규 생성 시 금연이면 기본 ON.
  const [changeTabEnabled, setChangeTabEnabled] = useState(
    initialData?.change_tab_enabled != null
      ? initialData.change_tab_enabled === true
      : isQuitCat
  )

  // 강사 클래스 운영 — 기능 토글 + 출석 확정 방식 (기본 OFF / operator_roll)
  const [classEnabled, setClassEnabled] = useState(!!initialData?.class_feature_enabled)
  const [attendanceMode, setAttendanceMode] = useState(initialData?.class_attendance_mode || 'operator_roll')
  const [checkinBeforeMin, setCheckinBeforeMin] = useState(initialData?.class_checkin_before_min ?? 30)

  const [missionPreviewOpen, setMissionPreviewOpen] = useState(false)
  const classAnchorRef = useRef(null)  // 「네, 클래스가 있어요」 → 이 버튼을 화면 상단으로 스크롤

  // 범위형 최소 변경 시 최대가 더 작아지지 않게 보정
  const handleMinChange = (v) => {
    setTeamSizeMin(v)
    if (v > teamSizeMax) setTeamSizeMax(v)
  }
  const teamOn = teamEnabled && rankingEnabled

  const recommendedBundles = MISSION_LIBRARY.filter(b =>
    selectedCategories.length === 0 || selectedCategories.includes(b.category)
  )

  // 서브스텝 구성 — 테마별. 각 key 가 한 화면(질문 하나).
  const featureSteps = isQuitCat
    ? ['community', 'change', 'quiz', 'class']
    : ['community', 'ranking', 'podium', 'team', 'quiz', 'class']
  const TOTAL = featureSteps.length

  const [subStep, setSubStep] = useState(enterAtEnd ? TOTAL - 1 : 0)
  const [dir, setDir] = useState(enterAtEnd ? -1 : 1)
  const cur = featureSteps[Math.min(subStep, TOTAL - 1)]

  const collectData = () => {
    const base = {
      feed_enabled: communityEnabled,
      community_enabled: communityEnabled,
      quiz_enabled: quizEnabled,
      gamification_type: 'RANKING',  // NOT NULL — 표시는 ranking_enabled 로 제어
      streak_preset: 'medium',
      streak_milestones: null,
      class_feature_enabled: classEnabled,
      class_attendance_mode: attendanceMode,
      class_checkin_before_min: Number(checkinBeforeMin) || 30,
    }
    if (isQuitCat) {
      return {
        ...base,
        theme: 'QUIT_SMOKING',
        ranking_enabled: false,
        podium_enabled: false,
        change_tab_enabled: changeTabEnabled,
        team_enabled: false,
        team_score_mode: null, team_size_type: null,
        team_size_min: null, team_size_max: null, team_size_fixed: null,
      }
    }
    return {
      ...base,
      theme: isRunningCat ? 'RUNNING' : null,
      ranking_enabled: rankingEnabled,
      podium_enabled: rankingEnabled ? podiumEnabled : false,  // 시상대는 순위표가 켜져야 의미
      change_tab_enabled: false,
      team_enabled: teamEnabled,
      team_score_mode: teamEnabled ? teamScoreMode : null,
      team_size_type: teamEnabled ? teamSizeType : null,
      team_size_min: teamEnabled && teamSizeType === 'range' ? teamSizeMin : null,
      team_size_max: teamEnabled && teamSizeType === 'range' ? teamSizeMax : null,
      team_size_fixed: teamEnabled && teamSizeType === 'fixed' ? teamSizeFixed : null,
    }
  }

  const goNext = () => {
    if (subStep < TOTAL - 1) { setDir(1); setSubStep(s => s + 1) }
    else onNext(collectData())
  }
  const goPrev = () => {
    setDir(-1)
    if (subStep > 0) setSubStep(s => s - 1)
    else onPrev?.()
  }
  const handleSave = () => onSave(collectData())

  // 각 서브스텝 질문 메타
  const META = {
    community: {
      q: isQuitCat ? '서로 응원하게 할까요?' : '서로 이야기 나누게 할까요?',
      sub: isQuitCat
        ? '참가자·운영자가 글과 댓글로 서로 응원해요.'
        : '사진·글로 오늘의 활동을 자랑하고,\n서로 댓글·좋아요로 응원해요.',
    },
    ranking: {
      q: '순위표를 보여줄까요?',
      sub: '점수가 높은 사람부터 줄을 세워 보여줘요.\n서로 선의의 경쟁을 하게 돼요.',
    },
    podium: {
      q: '상위 3명 시상대를 보여줄까요?',
      sub: '1·2·3등을 메달과 함께 시상대로 크게 보여줘요.\n상위권에 동기 부여가 돼요.\n(참여자 3명 이상일 때 나타나요)',
    },
    team: {
      q: '팀을 짜서 같이 도전할까요?',
      sub: '참여자끼리 팀을 만들어 함께 점수를 모아요.\n순위표에 팀 순위도 함께 보여요.',
    },
    quiz: {
      q: '건강 퀴즈를 낼까요?',
      sub: '참여자가 O/X·객관식 문제를 풀며\n건강 상식을 배워요.',
    },
    class: {
      q: '정해진 시간에 모이는 수업이 있나요?',
      sub: '요가·필라테스처럼 강사가 진행하는\n클래스 일정을 운영해요. 없으면 그냥 넘어가세요.',
    },
    change: {
      q: '「내 변화」 탭을 쓸까요?',
      sub: '참가자가 자신의 기분·흡연 추세·시간대 패턴을 그래프로 봐요.\n운영자는 참가자별 변화를 확인할 수 있어요.',
    },
  }

  return (
    <div>
      {/* 서브스텝 진행 바 */}
      <div className="flex gap-1.5" style={{ marginBottom: '9px' }}>
        {featureSteps.map((_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= subStep ? 'bg-emerald-500' : 'bg-gray-200'}`} />
        ))}
      </div>

      <div className="min-h-[320px]">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={cur}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <h2 className="text-xl font-bold text-gray-800 break-keep flex items-center gap-1.5" style={{ marginBottom: '16px' }}>
              <span>{META[cur].q}</span>
              <InfoTip>{META[cur].sub}</InfoTip>
            </h2>

            {/* ── 소통(커뮤니티/응원) ── */}
            {cur === 'community' && (<>
              <Preview>
                <FeedDemo />
              </Preview>
              <YesNo value={communityEnabled} onChange={setCommunityEnabled} />
              {communityEnabled && (
                <p className="text-[13px] text-gray-500 leading-relaxed break-keep" style={{ marginTop: '12px' }}>
                  💡 댓글을 달면 점수를 줘서 참여를 유도할 수도 있어요 — 발행 후 「커뮤니티 설정」에서 켤 수 있어요.
                </p>
              )}
            </>)}

            {/* ── 순위(랭킹) ── */}
            {cur === 'ranking' && (<>
              <Preview>
                <RankDemo />
              </Preview>
              <YesNo value={rankingEnabled} onChange={setRankingEnabled} />
            </>)}

            {/* ── 시상대 (Top3) ── */}
            {cur === 'podium' && (<>
              <Preview>
                <PodiumDemo />
              </Preview>
              <YesNo value={podiumEnabled} onChange={setPodiumEnabled} />
              {podiumEnabled && !rankingEnabled && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[10px] px-3 py-2 break-keep" style={{ marginTop: '9px' }}>
                  ⚠️ 시상대는 순위표 안에 보여요. 앞 단계에서 <span className="font-medium">순위표를 「네」로</span> 해야 시상대가 나와요.
                </p>
              )}
            </>)}

            {/* ── 팀 ── */}
            {cur === 'team' && (<>
              <Preview>
                <TeamDemo />
              </Preview>
              <YesNo value={teamEnabled} onChange={setTeamEnabled} />

              {teamEnabled && !rankingEnabled && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-[10px] px-3 py-2 break-keep" style={{ marginTop: '9px' }}>
                  ⚠️ 팀 순위는 순위표 안에 보여요. 앞 단계에서 <span className="font-medium">순위표를 「네」로</span> 해야 팀 기능이 동작해요.
                </p>
              )}
              {teamOn && (
                <div className="rounded-[10px] border-2 border-violet-200 bg-violet-50/40 p-4 space-y-4" style={{ marginTop: '9px' }}>
                  <div>
                    <p className="text-sm font-medium text-gray-800" style={{ marginBottom: '6px' }}>팀 점수 방식</p>
                    <Seg
                      value={teamScoreMode}
                      onChange={setTeamScoreMode}
                      options={[
                        { value: 'sum', label: '합계 + 평균' },
                        { value: 'average', label: '평균만' },
                      ]}
                    />
                    <p className="text-xs text-gray-600 leading-relaxed break-keep mt-2">
                      {teamScoreMode === 'sum'
                        ? '팀원 점수 합계로 순위를 매겨요. 인당 평균도 함께 보여 작은 팀도 인정받아요.'
                        : '팀원 점수의 평균으로 순위를 매겨요. 인원수가 많아도 유리하지 않아요.'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800" style={{ marginBottom: '6px' }}>팀 정원 정책</p>
                    <Seg
                      value={teamSizeType}
                      onChange={setTeamSizeType}
                      options={[
                        { value: 'range', label: '범위형' },
                        { value: 'fixed', label: '고정형' },
                      ]}
                    />
                    {teamSizeType === 'range' ? (
                      <div className="mt-3">
                        <div className="flex items-center gap-2">
                          <NumSelect value={teamSizeMin} onChange={handleMinChange} min={2} max={8} />
                          <span className="text-gray-400 text-sm">~</span>
                          <NumSelect value={teamSizeMax} onChange={setTeamSizeMax} min={teamSizeMin} max={8} />
                        </div>
                        <p className="text-xs text-gray-600 leading-relaxed break-keep mt-2">
                          팀장이 이 범위 안에서 팀 정원을 직접 골라요. 2명부터 순위에 반영돼요.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <NumSelect value={teamSizeFixed} onChange={setTeamSizeFixed} min={2} max={8} />
                        <p className="text-xs text-gray-600 leading-relaxed break-keep mt-2">
                          모든 팀의 정원이 {teamSizeFixed}명으로 고정돼요. {teamSizeFixed}명이 다 모여야 팀이 활성화돼요.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>)}

            {/* ── 퀴즈 ── */}
            {cur === 'quiz' && (<>
              <Preview>
                <QuizDemo />
              </Preview>
              <YesNo value={quizEnabled} onChange={setQuizEnabled} />
            </>)}

            {/* ── 내 변화 (금연) ── */}
            {cur === 'change' && (<>
              <Preview>
                <div className="space-y-2">
                  {/* 기분 변화 — 실제 MoodChart 스타일(가는 선 + 기분별 색점) */}
                  <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                    <p className="text-[11px] font-bold text-gray-700 mb-1.5">📈 기분 변화</p>
                    <svg viewBox="0 0 120 30" className="w-full" style={{ maxHeight: 30 }} preserveAspectRatio="none">
                      <line x1="4" y1="15" x2="116" y2="15" stroke="#f3f4f6" strokeWidth="1" />
                      <polyline points="6,22 28,11 50,22 72,5 94,11 116,5" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.5" strokeLinejoin="round" strokeLinecap="round" />
                      {[[6, 22, '#f59e0b'], [28, 11, '#34d399'], [50, 22, '#f59e0b'], [72, 5, '#10b981'], [94, 11, '#34d399'], [116, 5, '#10b981']].map(([x, y, c], i) => (
                        <circle key={i} cx={x} cy={y} r="2.5" fill={c} />
                      ))}
                    </svg>
                  </div>
                  {/* 흡연 추세 — 실제 DailyBars 스타일(orange 막대, 줄어드는 추세) */}
                  <div className="bg-white rounded-lg border border-gray-100 p-2.5">
                    <p className="text-[11px] font-bold text-gray-700 mb-1.5">🚬 흡연 추세</p>
                    <div className="flex items-end gap-[3px] h-7">
                      {[5, 4, 4, 3, 3, 2, 1].map((v, i) => (
                        <div key={i} className="flex-1 rounded-sm bg-orange-300" style={{ height: `${(v / 5) * 100}%` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </Preview>
              <YesNo value={changeTabEnabled} onChange={setChangeTabEnabled} />
            </>)}

            {/* ── 강사 클래스 ── */}
            {cur === 'class' && (<>
              <div className="flex items-start gap-2 p-3 rounded-[10px] bg-amber-50 border border-amber-200" style={{ marginBottom: '12px' }}>
                <span className="text-base flex-shrink-0">⚠️</span>
                <p className="text-[12px] text-amber-800 leading-relaxed break-keep">
                  강사 클래스는 <span className="font-bold">프로그램을 만든 뒤에는 켜고 끌 수 없어요.</span> 신중히 골라주세요.
                </p>
              </div>
              <Preview>
                <ClassDemo />
              </Preview>
              <div ref={classAnchorRef} style={{ scrollMarginTop: '12px' }}>
                <YesNo value={classEnabled} onChange={(v) => {
                  setClassEnabled(v)
                  // 「네」 선택 시 출석 방식이 아래로 펼쳐지므로, 이 버튼을 화면 상단으로 스크롤
                  if (v) requestAnimationFrame(() => requestAnimationFrame(() => classAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })))
                }} yesLabel="네, 클래스가 있어요" noLabel="아니요, 없어요" />
              </div>

              {classEnabled && (
                <div className="rounded-[10px] border-2 border-emerald-200 bg-emerald-50/40 p-4" style={{ marginTop: '9px' }}>
                  <p className="text-base font-bold text-gray-800" style={{ marginBottom: '3px' }}>출석은 어떻게 확인할까요?</p>
                  <p className="text-sm text-gray-600 leading-relaxed break-keep" style={{ marginBottom: '12px' }}>
                    출석이 확정되면 <b className="text-emerald-700">포인트·연속인증</b>에 반영돼요.
                  </p>
                  {CLASS_METHODS.map(m => (
                    <ClassMethodCard key={m.key} m={m} selected={attendanceMode === m.key} onSelect={() => setAttendanceMode(m.key)} />
                  ))}
                  {attendanceMode !== 'operator_roll' && (
                    <div className="rounded-[10px] border border-gray-200 bg-white p-3" style={{ marginTop: '3px' }}>
                      <p className="text-sm font-bold text-gray-800" style={{ marginBottom: '2px' }}>언제부터 출석할 수 있나요?</p>
                      <p className="text-xs text-gray-500 break-keep" style={{ marginBottom: '8px' }}>
                        <b className="text-emerald-700">신청한 참가자</b>가 클래스 시작 전부터 출석할 수 있어요.
                      </p>
                      <select value={checkinBeforeMin} onChange={(e) => setCheckinBeforeMin(Number(e.target.value))}
                        className="w-full h-10 px-2.5 rounded-lg border-2 border-gray-200 bg-white text-sm text-gray-700 focus:border-emerald-400 focus:outline-none">
                        {[10, 15, 30, 60, 120].map(n => <option key={n} value={n}>시작 {n}분 전부터</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* 마지막 화면 — 추천 미션 묶음 미리보기(참고용, 발행 후 추가) */}
              <div className="bg-gray-50/60 rounded-[10px] border border-gray-200 overflow-hidden" style={{ marginTop: '14px' }}>
                <button
                  type="button"
                  onClick={() => setMissionPreviewOpen(v => !v)}
                  className="w-full flex items-center justify-between gap-2 p-4 text-left hover:bg-gray-100/40 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">💡</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">이 카테고리엔 이런 미션이 어울려요</p>
                      <p className="text-[11px] text-gray-500 truncate">추천 묶음 {recommendedBundles.length}개 — 발행 후 한 번에 추가할 수 있어요</p>
                    </div>
                  </div>
                  {missionPreviewOpen
                    ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>
                {missionPreviewOpen && (
                  <div className="px-4 pb-4">
                    {recommendedBundles.length === 0 ? (
                      <p className="text-xs text-gray-500 py-2 text-center">1단계에서 카테고리를 먼저 선택해주세요</p>
                    ) : (
                      <div className="grid gap-2 min-w-0">
                        {recommendedBundles.map(b => (
                          <div key={b.key} className="flex items-start gap-3 p-3 bg-white rounded-[10px] border border-gray-100 w-full min-w-0">
                            <span className="text-xl flex-shrink-0">{b.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 break-keep">{b.title}</p>
                              <p className="text-[11px] text-gray-500 leading-snug break-keep mt-0.5">
                                {b.description}<br />
                                <span className="text-gray-400">미션 {b.missions.length}개</span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-emerald-700 mt-3 leading-relaxed">
                      ℹ️ 참고용 예시예요. 발행 후 <span className="font-medium">"➕ 미션 추가"</span>에서 원하는 미션을 자유롭게 만들 수 있어요.
                    </p>
                  </div>
                )}
              </div>
            </>)}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 네비게이션 — 1·3단계와 동일 (이전/임시저장/다음) */}
      <div className="flex" style={{ gap: '9px', marginTop: '18px' }}>
        <button type="button" onClick={goPrev}
          className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-[10px] transition text-sm whitespace-nowrap">이전</button>
        <button type="button" onClick={handleSave}
          className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-[10px] transition text-sm whitespace-nowrap">임시저장</button>
        <button type="button" onClick={goNext}
          className="flex-1 px-3 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-[10px] transition text-sm whitespace-nowrap">
          {subStep < TOTAL - 1 ? '다음' : '다음 단계로'}
        </button>
      </div>
    </div>
  )
}

export default Step2Type
