import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import StickyBackBar from '../components/common/StickyBackBar'

// 운영자 가이드 — 화면별 워크스루.
//   실제 스크린샷(public/guide/*.png) 위에 번호 콜아웃을 얹고, 아래에 "여기서 무엇을" 캡션.
//   프로필 → 「운영자 가이드」 + 첫 프로그램 직후 환영 캐러셀에서 진입 (Day 66).
//
//   스크린샷 파일은 public/guide/ 에 직접 추가해야 함 (채팅 이미지는 자동 저장 불가).

// 한 줄 흐름 안내
const FLOW = ['프로그램 만들기', '미션·퀴즈 추가', '인증 심사', '통계로 관리']

// 화면별 단계. markers: { n, x%, y% } — 스크린샷 위 번호 위치.
const STEPS = [
  {
    key: 'operator_panel',
    badge: '운영자 패널',
    title: '프로그램 상세 — 운영에 필요한 게 다 모여 있어요',
    desc: '내 프로그램을 열면 보이는 「운영자 패널」. 여기서 대부분의 운영을 합니다.',
    src: '/guide/03_operator_panel.png',
    // 글씨를 가리지 않게 각 버튼의 좌상단 모서리에 배치
    markers: [
      { n: 1, x: 31, y: 36 },
      { n: 2, x: 10, y: 50 },
      { n: 3, x: 10, y: 57 },
      { n: 4, x: 53, y: 57 },
      { n: 5, x: 10, y: 64 },
      { n: 6, x: 53, y: 64 },
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
    badge: '미션 추가',
    title: '「미션」 탭 — 여기서 미션을 추가해요',
    desc: '프로그램 상세에서 「미션」 탭을 누르면 보이는 화면. 추가한 미션이 목록에 쌓여요.',
    src: '/guide/04_mission_create.png',
    markers: [
      { n: 1, x: 67, y: 33 },
      { n: 2, x: 7, y: 32 },
    ],
    captions: [
      ['+ 미션 추가', '추천 라이브러리에서 고르거나 직접 만들기'],
      ['미션 목록', '추가한 미션이 여기 쌓이고, 눌러서 수정·삭제'],
    ],
  },
  {
    key: 'library',
    badge: '추천 라이브러리',
    title: '추천 미션 라이브러리 — 골라서 한 번에 추가',
    desc: '「+ 미션 추가」를 누르면 나와요. 카테고리 묶음을 골라 미션을 한꺼번에 추가해요.',
    src: '/guide/05_library.png',
    markers: [
      { n: 1, x: 9, y: 26 },
      { n: 2, x: 10, y: 40 },
      { n: 3, x: 10, y: 87 },
    ],
    captions: [
      ['카테고리 탭', '운동·식단·공감·마음관리 등 카테고리별 추천 묶음'],
      ['묶음 카드', '누르면 미션을 미리보고 점수·필수/선택을 조정해 한 번에 추가'],
      ['직접 만들기', '추천 외 원하는 미션을 직접 만들기로 추가'],
    ],
  },
]

// 스크린샷 + 번호 콜아웃 (이미지 없으면 자리표시자)
function AnnotatedShot({ src, markers }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
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
      {markers.map(m => (
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

function OperatorGuidePage() {
  const navigate = useNavigate()

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
            화면을 따라가며 "어디서 무엇을" 하는지 익혀보세요.
          </p>
        </div>

        {/* 흐름 한 줄 */}
        <div className="flex items-center flex-wrap gap-1.5 mb-5">
          {FLOW.map((f, i) => (
            <span key={f} className="inline-flex items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs font-semibold text-gray-700">{f}</span>
              {i < FLOW.length - 1 && <span className="text-gray-300">›</span>}
            </span>
          ))}
        </div>

        {/* 화면별 워크스루 */}
        <div className="space-y-5">
          {STEPS.map(step => (
            <div key={step.key} className="bg-white border border-gray-100 rounded-card shadow-soft p-4">
              <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold mb-1.5">
                {step.badge}
              </span>
              <h2 className="font-bold text-gray-800 leading-snug">{step.title}</h2>
              <p className="text-xs font-medium text-gray-500 mt-0.5 mb-3">{step.desc}</p>

              <div className="grid sm:grid-cols-2 gap-4 items-start">
                <AnnotatedShot src={step.src} markers={step.markers} />
                <ol className="space-y-2">
                  {step.captions.map((c, i) => (
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
              </div>
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
