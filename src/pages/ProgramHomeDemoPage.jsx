import { useState } from 'react'
import { ChevronLeft, Bell } from 'lucide-react'
import ProgramHome from '../components/program/ProgramHome'
import ProgramHomeLayoutEditor from '../components/program/ProgramHomeLayoutEditor'
import SubmitCelebration from '../components/common/SubmitCelebration'

// 제출 완료 연출 프리셋 (미션 / 퀴즈)
const CELEB_PRESETS = {
  mission: { emptySrc: '/icons/feature/mission-empty.png', checkSrc: '/icons/feature/mission-check.png', checkOrigin: '51% 54%', label: '미션 완료!', points: 10, pending: false },
  quiz: { emptySrc: '/icons/feature/quiz-empty.png', checkSrc: '/icons/feature/quiz-check.png', checkOrigin: '51% 51%', label: '제출 완료!', points: 20, pending: false },
}

// 프로그램 홈(카드형) UI 데모 — localhost:5173/program-home-demo.
//   실제 ProgramHome 컴포넌트를 본 페이지 통합 전 로컬에서 확인용 (RunningHomeDemoPage 와 동일 패턴).
function ProgramHomeDemoPage() {
  const [editOpen, setEditOpen] = useState(false)
  const [layout, setLayout] = useState({ order: null, hidden: [] })
  const [hero, setHero] = useState(null)
  const [goal, setGoal] = useState(null)
  const [celeb, setCeleb] = useState(null)   // { key, ...preset } — 제출 완료 연출 재생용
  const playCeleb = (type) => setCeleb({ key: Date.now(), ...CELEB_PRESETS[type] })
  const metrics = [
    { emoji: '📏', label: '누적 거리', value: '42.5', unit: 'km' },
    { emoji: '⏱️', label: '걷기 시간', value: '7.2', unit: '시간' },
    { emoji: '👣', label: '누적 걸음', value: '58,200', unit: '' },
    { emoji: '🔥', label: '연속 인증', value: '6', unit: '일' },
  ]
  const streakData = { count: 6, days: [
    { label: '월', done: true }, { label: '화', done: true }, { label: '수', done: true, today: true },
    { label: '목', done: false }, { label: '금', done: false }, { label: '토', done: false }, { label: '일', done: false },
  ] }
  const progressData = { activeDays: 14, totalDays: 30, participationRate: 82, points: 340, streak: 6 }
  const todayMissions = [
    { id: 1, title: '아침 스트레칭', thumb: null, done: false, pt: 10 },
    { id: 2, title: '물 2L 마시기', thumb: null, done: true, pt: 5 },
  ]
  const recentItems = [
    { id: 1, title: '건강한 한 끼', point: 15, time: '2시간 전' },
    { id: 2, title: '아침 스트레칭', point: 10, time: '어제' },
  ]
  return (
    <div className="min-h-screen bg-white py-3">
      <div className="max-w-[430px] mx-auto px-[11px]">
        {/* 상단 헤더(기존 ProgramDetailPage 헤더 모사) */}
        <div className="h-[44px] flex items-center justify-center relative mb-1">
          <ChevronLeft className="absolute left-1 w-5 h-5 text-gray-600" />
          <span className="text-[15px] font-bold text-gray-800">매일 걷기 30일</span>
          <div className="absolute right-1 flex items-center gap-1.5">
            <Bell className="w-[18px] h-[18px] text-gray-600" />
            <div className="w-7 h-7 rounded-full bg-gray-200" />
          </div>
        </div>

        {/* 데모 — 제출 완료 연출 재생 버튼 */}
        <div className="flex gap-2 mb-2">
          <button type="button" onClick={() => playCeleb('mission')}
            className="flex-1 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[13px] transition">
            🎬 미션 제출 효과
          </button>
          <button type="button" onClick={() => playCeleb('quiz')}
            className="flex-1 h-10 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-[13px] transition">
            🎬 퀴즈 제출 효과
          </button>
        </div>

        <ProgramHome
          programName="매일 걷기 30일"
          startDate="2026.07.01"
          endDate="2026.07.30"
          progress={45}
          categories={['WALKING']}
          participantCount={42}
          myRank={5}
          notice="이번 주 목표는 하루 6천 보예요! 함께 걸어요 👟"
          metrics={metrics}
          streakData={streakData}
          progressData={progressData}
          todayMissions={todayMissions}
          recentItems={recentItems}
          boxOrder={layout.order}
          hiddenBoxes={layout.hidden}
          homeHero={hero}
          onHeroChange={setHero}
          homeGoal={goal}
          onGoalChange={setGoal}
          ownerId="demo"
          editable
          onEditLayout={() => setEditOpen(true)}
        />
      </div>
      {editOpen && (
        <ProgramHomeLayoutEditor
          currentOrder={layout.order}
          currentHidden={layout.hidden}
          menuLabels={['미션', '퀴즈', '커뮤니티', '랭킹']}
          saving={false}
          onClose={() => setEditOpen(false)}
          onSave={(l) => { setLayout(l); setEditOpen(false) }}
        />
      )}
      {celeb && (
        <SubmitCelebration
          key={celeb.key}
          emptySrc={celeb.emptySrc} checkSrc={celeb.checkSrc} checkOrigin={celeb.checkOrigin}
          label={celeb.label} points={celeb.points} pending={celeb.pending}
          onDone={() => setCeleb(null)}
        />
      )}
    </div>
  )
}

export default ProgramHomeDemoPage
