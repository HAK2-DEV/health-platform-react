import { useState } from 'react'
import { ChevronLeft, Bell } from 'lucide-react'
import QuitSmokingHome, { QUIT_BOX_ORDER, QUIT_BOX_LABELS } from '../components/program/QuitSmokingHome'
import QuitSmokingTip from '../components/program/QuitSmokingTip'
import ProgramHomeLayoutEditor from '../components/program/ProgramHomeLayoutEditor'

// 금연 카드형 홈 데모 — /quit-smoking-demo.
//   두 변형 비교: 「기본(지표 히어로만)」 vs 「편집형 추가(편집 히어로 + 목표카드 + 주간스트릭)」.
const MOODS = [
  { key: 'great', label: '상쾌해요', emoji: '😄' },
  { key: 'good', label: '괜찮아요', emoji: '🙂' },
  { key: 'ok', label: '보통', emoji: '😐' },
  { key: 'edgy', label: '예민해요', emoji: '😟' },
  { key: 'hard', label: '힘들어요', emoji: '😣' },
]

// 데모용 기분 체크 placeholder (실제는 MoodCheck 위젯이 쿼리로 동작)
function MoodPlaceholder() {
  const [sel, setSel] = useState(null)
  return (
    <div className="rounded-2xl p-3.5 bg-white border border-gray-100 shadow-soft">
      <p className="text-[13px] font-bold text-gray-800 mb-2.5">오늘 기분은 어때요?</p>
      <div className="flex justify-between">
        {MOODS.map((m) => (
          <button key={m.key} type="button" onClick={() => setSel(m.key)}
            className={`flex flex-col items-center gap-1 w-12 py-1.5 rounded-xl transition ${sel === m.key ? 'bg-emerald-50 ring-1 ring-emerald-300' : 'hover:bg-gray-50'}`}>
            <span className="text-2xl leading-none">{m.emoji}</span>
            <span className="text-[10px] text-gray-500">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function BannerPlaceholder() {
  return (
    <div className="rounded-2xl p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border border-gray-100 shadow-soft flex items-center gap-3">
      <span className="w-11 h-11 rounded-full bg-white/70 flex items-center justify-center text-2xl flex-shrink-0">🌿</span>
      <div>
        <p className="text-[13px] font-extrabold text-gray-800">오늘도 깨끗한 하루, 함께해요</p>
        <p className="text-[11px] text-gray-500 mt-0.5">작은 실천이 큰 변화를 만들어요!</p>
      </div>
    </div>
  )
}

const VARIANTS = [
  { key: 'basic', label: '기본' },
  { key: 'extras', label: '편집형 추가' },
  { key: 'goal', label: '절충(목표카드)' },
]
export default function QuitSmokingHomeDemoPage() {
  const [variant, setVariant] = useState('basic')
  const [hero, setHero] = useState(null)
  const [goal, setGoal] = useState(null)
  const [layout, setLayout] = useState({ order: null, hidden: [] })
  const [editOpen, setEditOpen] = useState(false)

  const progressData = { activeDays: 8, totalDays: 30, participationRate: 67, points: 240, streak: 12 }
  const streakData = { count: 12, days: [
    { label: '월', done: true }, { label: '화', done: true }, { label: '수', done: true, today: true },
    { label: '목', done: false }, { label: '금', done: false }, { label: '토', done: false }, { label: '일', done: false },
  ] }

  return (
    <div className="min-h-screen bg-white py-3">
      <div className="max-w-[430px] mx-auto px-[11px]">
        {/* 헤더 */}
        <div className="h-[44px] flex items-center justify-center relative mb-1">
          <ChevronLeft className="absolute left-1 w-5 h-5 text-gray-600" />
          <span className="text-[15px] font-bold text-gray-800">금연 챌린지 30일</span>
          <div className="absolute right-1 flex items-center gap-1.5">
            <Bell className="w-[18px] h-[18px] text-gray-600" />
            <div className="w-7 h-7 rounded-full bg-gray-200" />
          </div>
        </div>

        {/* 변형 토글 (기본 / 편집형 추가 / 절충) */}
        <div className="flex gap-1 mb-2 p-1 bg-gray-100 rounded-xl">
          {VARIANTS.map((v) => (
            <button key={v.key} type="button" onClick={() => setVariant(v.key)}
              className={`flex-1 h-9 rounded-lg text-[12px] font-bold transition ${variant === v.key ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>
              {v.label}
            </button>
          ))}
        </div>

        <QuitSmokingHome
          key={variant}
          programId="demo"
          programName="금연 챌린지 30일"
          categories={['NO_SMOKING']}
          streak={12}
          savedAmount={6750}
          smokedToday={false}
          statusLabel="진행중"
          notice="금연 3일차, 잘하고 있어요! 💚"
          progressData={progressData}
          progress={40}
          streakData={streakData}
          moodSlot={<MoodPlaceholder />}
          tipSlot={<QuitSmokingTip />}
          bannerSlot={<BannerPlaceholder />}
          variant={variant}
          homeHero={hero}
          onHeroChange={setHero}
          homeGoal={goal}
          onGoalChange={setGoal}
          ownerId="demo"
          editable
          boxOrder={layout.order}
          hiddenBoxes={layout.hidden}
          onEditLayout={() => setEditOpen(true)}
        />
      </div>
      {editOpen && (
        <ProgramHomeLayoutEditor
          boxKeys={QUIT_BOX_ORDER}
          boxLabels={QUIT_BOX_LABELS}
          currentOrder={layout.order}
          currentHidden={layout.hidden}
          menuLabels={['미션', '퀴즈', '응원', '내 변화']}
          saving={false}
          onClose={() => setEditOpen(false)}
          onSave={(l) => { setLayout(l); setEditOpen(false) }}
        />
      )}
    </div>
  )
}
