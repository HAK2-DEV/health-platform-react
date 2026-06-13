import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import StickyBackBar from '../components/common/StickyBackBar'

// 운영자 가이드 — 주제 탭별 화면 워크스루.
//   상단 탭(운영자 패널 / 미션 / 퀴즈…)을 누르면 그 주제 화면만 표시 → 스크롤 최소화.
//   실제 스크린샷(public/guide/*.png) 위에 번호 콜아웃 + "여기서 무엇을" 캡션.
//   프로필 → 「운영자 가이드」 + 첫 프로그램 직후 환영 캐러셀에서 진입 (Day 66).

const TOPICS = [
  { key: 'panel', label: '운영자 패널', emoji: '🎛️' },
  { key: 'mission', label: '미션 가이드', emoji: '🎯' },
  { key: 'quiz', label: '퀴즈 가이드', emoji: '❓' },
]

// 화면별 단계. topic: 소속 탭. markers: { n, x%, y% } — 스크린샷 위 번호 위치.
const STEPS = [
  {
    key: 'operator_panel',
    topic: 'panel',
    badge: '운영자 패널',
    title: '프로그램 상세 — 운영에 필요한 게 다 모여 있어요',
    desc: '내 프로그램을 열면 보이는 「운영자 패널」. 여기서 대부분의 운영을 합니다.',
    src: '/guide/03_operator_panel.png',
    markers: [
      { n: 1, x: 25, y: 31 },
      { n: 2, x: 9, y: 49 },
      { n: 3, x: 9, y: 56 },
      { n: 4, x: 52, y: 56 },
      { n: 5, x: 9, y: 63 },
      { n: 6, x: 52, y: 63 },
    ],
    captions: [
      ['「미션」 탭', '미션을 추가하고 관리해요 (라이브러리 / 직접 만들기)'],
      ['개요 글 작성', '프로그램 소개·공지를 작성해요'],
      ['프로그램 수정', '이름·기간·카테고리·표지 변경'],
      ['게시물 관리', '퀴즈 생성·관리'],
      ['인증 심사', '운영자 심사 미션을 승인/반려해요'],
      ['참여자 통계', '참여·인증·미션별 현황을 한눈에'],
    ],
  },
  {
    key: 'mission_tab',
    topic: 'mission',
    badge: '미션 추가',
    title: '「미션」 탭 — 여기서 미션을 추가해요',
    desc: '프로그램 상세에서 「미션」 탭을 누르면 보이는 화면. 추가한 미션이 목록에 쌓여요.',
    src: '/guide/04_mission_create.png',
    markers: [
      { n: 1, x: 68, y: 32 },
      { n: 2, x: 6, y: 31 },
    ],
    captions: [
      ['+ 미션 추가', '추천 라이브러리에서 고르거나 직접 만들기'],
      ['미션 목록', '추가한 미션이 여기 쌓이고, 눌러서 수정·삭제'],
    ],
  },
  {
    key: 'library',
    topic: 'mission',
    badge: '추천 라이브러리',
    title: '추천 미션 라이브러리 — 골라서 한 번에 추가',
    desc: '「+ 미션 추가」를 누르면 나와요. 카테고리 묶음을 골라 미션을 한꺼번에 추가해요.',
    src: '/guide/05_library.png',
    markers: [
      { n: 1, x: 6, y: 25 },
      { n: 2, x: 8, y: 34 },
      { n: 3, x: 8, y: 87 },
    ],
    captions: [
      ['카테고리 탭', '운동·식단·공감·마음관리 등 카테고리별 추천 묶음'],
      ['묶음 카드', '누르면 미션을 미리보고 점수·필수/선택을 조정해 한 번에 추가'],
      ['직접 만들기', '추천 외 원하는 미션을 직접 만들기로 추가'],
    ],
  },
  {
    key: 'mission_adjust',
    topic: 'mission',
    badge: '미션 조정',
    title: '미션 조정 — 점수·필수/선택까지 세밀하게',
    desc: '묶음에서 미션을 고르면 나오는 조정 화면. 제목 옆 ✏️로 안내 문구도 직접 수정할 수 있어요.',
    src: '/guide/06_mission_create_detail.png',
    markers: [
      { n: 1, x: 13, y: 36 },
      { n: 2, x: 13, y: 44 },
      { n: 3, x: 13, y: 72 },
      { n: 4, x: 16, y: 84 },
      { n: 5, x: 41, y: 92 },
    ],
    captions: [
      ['인증 입력', '사진·기록·소감을 골라 한 미션에 조합 (여러 개 가능)'],
      ['입력별 점수·필수', '입력마다 점수 + 필수/선택. 예: 사진 7P 필수 + 소감 5P 선택 = 최대 12P'],
      ['승인 방식', '자동 승인(즉시 점수) / 운영자 심사(검토 후 점수)'],
      ['제출 화면 미리보기', '참여자가 보게 될 화면을 미리 확인'],
      ['미션 추가', '조정이 끝나면 눌러서 발행'],
    ],
  },
  {
    key: 'quiz_info',
    topic: 'quiz',
    badge: '퀴즈',
    title: '퀴즈 — 건강 상식으로 참여에 재미를',
    desc: '운영자 패널 「게시물 관리」에서 퀴즈를 만들어요. (화면 캡처는 곧 추가됩니다)',
    src: null,
    captions: [
      ['퀴즈 라이브러리', '대상자·주제를 고르면 문항·정답·해설·출처가 준비돼 있어요'],
      ['점수·정답 공개', '퀴즈 점수와 정답 공개 여부를 설정'],
      ['자동/수동 채점', '객관식·OX는 자동 채점, 주관식은 운영자가 채점'],
    ],
  },
]

// 스크린샷 + 번호 콜아웃 (이미지 없으면 자리표시자)
function AnnotatedShot({ src, markers }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="aspect-[9/19] w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-gray-400 text-xs gap-1">
        <span className="text-2xl">📱</span>
        화면 미리보기 준비 중
      </div>
    )
  }
  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
      <img src={src} alt="" className="w-full block" onError={() => setFailed(true)} />
      {(markers || []).map(m => (
        <span
          key={m.n}
          style={{ left: `${m.x}%`, top: `${m.y}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-md"
        >
          {m.n}
        </span>
      ))}
    </div>
  )
}

function StepCaptions({ captions }) {
  return (
    <ol className="space-y-2">
      {captions.map((c, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            {i + 1}
          </span>
          <span className="text-sm text-gray-700 leading-snug">
            <b className="text-gray-800">{c[0]}</b> — {c[1]}
          </span>
        </li>
      ))}
    </ol>
  )
}

function OperatorGuidePage() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('panel')
  const visibleSteps = STEPS.filter(s => s.topic === topic)

  return (
    <div className="min-h-screen bg-surface-app">
      <div className="max-w-2xl mx-auto px-4 pt-2 pb-10">
        <StickyBackBar fallbackPath="/profile" title="프로필로" />

        {/* 헤더 */}
        <div className="rounded-card-lg bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-50 border border-emerald-100/60 px-5 py-6 mb-4">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            🌿 운영자 가이드
          </h1>
          <p className="text-sm font-medium text-gray-600 mt-1.5 leading-relaxed">
            주제를 골라 "어디서 무엇을" 하는지 익혀보세요.
          </p>
        </div>

        {/* 주제 탭 */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 mb-4 scrollbar-hide">
          {TOPICS.map(t => {
            const active = topic === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTopic(t.key)}
                className={`flex-shrink-0 inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-sm transition
                  ${active
                    ? 'bg-emerald-500 text-white shadow-sm font-semibold'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* 선택한 주제의 화면들 */}
        <div className="space-y-5">
          {visibleSteps.map(step => (
            <div key={step.key} className="bg-white border border-gray-100 rounded-card shadow-soft p-4">
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold mb-1.5">
                {step.badge}
              </span>
              <h2 className="font-bold text-gray-800 leading-snug">{step.title}</h2>
              <p className="text-xs font-medium text-gray-500 mt-0.5 mb-3">{step.desc}</p>

              {step.src ? (
                <div className="grid sm:grid-cols-2 gap-4 items-start">
                  <AnnotatedShot src={step.src} markers={step.markers} />
                  <StepCaptions captions={step.captions} />
                </div>
              ) : (
                <StepCaptions captions={step.captions} />
              )}
            </div>
          ))}
        </div>

        {/* 하단 CTA */}
        <button
          type="button"
          onClick={() => navigate('/programs/new')}
          className="w-full mt-5 flex items-center justify-center gap-1.5 py-3.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold rounded-card-lg shadow-soft transition"
        >
          <Plus className="w-5 h-5" /> 지금 프로그램 만들기
        </button>
      </div>
    </div>
  )
}

export default OperatorGuidePage
