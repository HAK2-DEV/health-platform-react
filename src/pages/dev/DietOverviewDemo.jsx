import { useState } from 'react'
import DietOverview from '../../components/program/DietOverview'

// 🔧 식단 개요 데모 — 실제 컴포넌트(DietOverview)를 목데이터로 미리보기. 라우트: /dev/diet-overview
const TODAY = { kcal: 1230, carb: 156, protein: 78, fat: 41 }
const WEEK = [
  { label: '월', kcal: 1450 }, { label: '화', kcal: 1620 }, { label: '수', kcal: 1380 },
  { label: '목', kcal: 1710 }, { label: '금', kcal: 1290 }, { label: '토', kcal: 1880 }, { label: '일', kcal: 1280 },
]
const MEALS = [
  { key: 'breakfast', label: '아침', emoji: '🌅', kcal: 420, done: true },
  { key: 'lunch', label: '점심', emoji: '☀️', kcal: 560, done: true },
  { key: 'dinner', label: '저녁', emoji: '🌙', kcal: 0, done: false },
  { key: 'snack', label: '간식', emoji: '🍪', kcal: 250, done: true },
]
const STREAK = { count: 4, days: [
  { label: '월', done: true }, { label: '화', done: true }, { label: '수', done: true },
  { label: '목', done: true, today: true }, { label: '금', done: false }, { label: '토', done: false }, { label: '일', done: false },
] }
const MENU = [
  { iconSrc: '/icons/feature/mission.png', iconEmoji: '📋', title: '미션', desc: '목표를 달성해요', actionLabel: '기록하기', onClick: () => {} },
  { iconSrc: '/icons/feature/quiz.png', iconEmoji: '❓', title: '퀴즈', desc: '건강 지식을 배워요', actionLabel: '풀어보기', onClick: () => {} },
  { iconSrc: '/icons/feature/community.png', iconEmoji: '💬', title: '커뮤니티', desc: '함께 응원해요', actionLabel: '바로가기', onClick: () => {} },
  { iconSrc: '/icons/reward/ranking.png', iconEmoji: '🏆', title: '랭킹', desc: '순위를 확인해요', actionLabel: '확인하기', onClick: () => {} },
]

export default function DietOverviewDemo() {
  const [goal, setGoal] = useState(1800)
  return (
    <div className="max-w-md mx-auto px-4 py-5" style={{ background: '#fdfbf7', minHeight: '100dvh' }}>
      <h1 className="text-lg font-extrabold text-gray-900">🍱 식단 개요 (실컴포넌트 미리보기)</h1>
      <p className="text-[12px] text-gray-400 mb-4">DietOverview · 목데이터 · /dev/diet-overview</p>

      {/* 커버 히어로 목업 (실제 배선 시 ProgramHomeHero 로 대체) */}
      <div className="relative h-32 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-end p-4 mb-2.5">
        <div className="text-white">
          <p className="text-[11px] opacity-80">D+12 · 4주 여정</p>
          <p className="text-[17px] font-extrabold leading-tight">채움 4주 식단 챌린지</p>
          <p className="text-[11px] opacity-80 mt-0.5">운영 · 채움건강</p>
        </div>
      </div>

      <DietOverview
        today={TODAY}
        goal={goal}
        onGoalChange={setGoal}
        week={WEEK}
        meals={MEALS}
        streak={STREAK}
        streakIcon="leaf"
        menu={MENU}
      />
    </div>
  )
}
