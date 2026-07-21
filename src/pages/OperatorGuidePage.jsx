import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'

// 운영자 가이드 — 주제 탭별 화면 워크스루.
//   상단 탭(운영자 패널 / 미션 / 퀴즈…)을 누르면 그 주제 화면만 표시 → 스크롤 최소화.
//   실제 스크린샷(public/guide/*.png) 위에 번호 콜아웃 + "여기서 무엇을" 캡션.
//   프로필 → 「운영자 가이드」 + 첫 프로그램 직후 환영 캐러셀에서 진입 (Day 66).

const TOPICS = [
  { key: 'wizard', label: '프로그램 만들기', emoji: '✨' },
  { key: 'panel', label: '운영자 패널', emoji: '🎛️' },
  { key: 'mission', label: '미션 가이드', emoji: '🎯' },
  { key: 'quiz', label: '퀴즈 가이드', emoji: '❓' },
]

// 화면별 단계. topic: 소속 탭. markers: { n, x%, y% } — 스크린샷 위 번호 위치.
const STEPS = [
  {
    key: 'wizard_1',
    topic: 'wizard',
    badge: '1단계',
    title: '1단계: 기본 정보 입력',
    desc: '대표 사진(선택)·이름·기간·목표·카테고리를 정해요.',
    src: '/guide/13_wizard_1b.png',
    markers: [
      { n: 1, x: 8, y: 22 },
      { n: 2, x: 8, y: 33 },
      { n: 3, x: 8, y: 48 },
      { n: 4, x: 8, y: 66 },
    ],
    captions: [
      ['프로그램 이름', '한눈에 알아볼 이름 (예: 봄철 걷기 챌린지)'],
      ['운영 기간', '시작 ~ 종료 날짜'],
      ['목표 설정', '프로그램이 지향하는 목표'],
      ['카테고리', '운동·식단·수면 등 복수 선택 가능'],
    ],
  },
  {
    key: 'wizard_2',
    topic: 'wizard',
    badge: '2단계',
    title: '2단계: 프로그램 옵션',
    desc: '피드·참여 동기 방식 등 분위기를 정해요.',
    src: '/guide/14_wizard_2a.png',
    markers: [
      { n: 1, x: 8, y: 39 },
      { n: 2, x: 8, y: 56 },
      { n: 3, x: 8, y: 68 },
    ],
    captions: [
      ['커뮤니티 피드', '참여자끼리 인증을 피드로 보고 좋아요·댓글'],
      ['참여 동기 방식', '랭킹(점수 경쟁) / 성장(곧 출시)'],
      ['부가 옵션', '랭킹 Top3·기간 필터'],
    ],
  },
  {
    key: 'wizard_3',
    topic: 'wizard',
    badge: '3단계',
    title: '3단계: 참여 조건',
    desc: '참여 방식과 공개 여부를 정해요.',
    src: '/guide/16_wizard_3a.png',
    markers: [
      { n: 1, x: 8, y: 42 },
      { n: 2, x: 8, y: 69 },
      { n: 3, x: 8, y: 79 },
    ],
    captions: [
      ['참여 방식', '공개 / 승인 후 / 초대 코드 (승인 시 입장 질문, 초대 시 코드 발급)'],
      ['최대 참여 인원', '비우면 무제한'],
      ['공개 검색 허용', '더 많은 참여 유도'],
    ],
  },
  {
    key: 'wizard_3b',
    topic: 'wizard',
    badge: '3단계 · 승인',
    title: '참여 조건 — 승인 후 참여',
    desc: '운영자가 승인한 사람만 참여하게 할 때.',
    src: '/guide/17_wizard_3b.png',
    markers: [
      { n: 1, x: 8, y: 48 },
      { n: 2, x: 8, y: 70 },
      { n: 3, x: 8, y: 85 },
    ],
    captions: [
      ['승인 후 참여', '운영자가 승인한 사람만 참여해요'],
      ['입장 질문 받기', '신청자가 답변을 작성해야 신청 가능 → 보고 승인/거절'],
      ['질문 내용', '신청자에게 물어볼 질문 (예: 참여 이유)'],
    ],
  },
  {
    key: 'wizard_3c',
    topic: 'wizard',
    badge: '3단계 · 초대',
    title: '참여 조건 — 초대 코드 참여',
    desc: '초대 코드를 가진 사람만 참여하게 할 때.',
    src: '/guide/18_wizard_3c.png',
    markers: [
      { n: 1, x: 8, y: 58 },
      { n: 2, x: 8, y: 70 },
    ],
    captions: [
      ['초대 코드 참여', '초대 코드를 가진 사람만 참여해요'],
      ['초대 코드', '비우면 자동 생성 (예: HEALTH2026), 직접 입력도 가능'],
    ],
  },
  {
    key: 'wizard_4',
    topic: 'wizard',
    badge: '4단계',
    title: '4단계: 요약 + 게시',
    desc: '설정을 확인하고 프로그램을 게시해요.',
    src: '/guide/19_wizard_4.png',
    markers: [
      { n: 1, x: 8, y: 45 },
      { n: 2, x: 41, y: 78 },
    ],
    captions: [
      ['설정 요약', '이름·기간·카테고리·옵션·참여 방식을 마지막 확인'],
      ['프로그램 만들기', '게시! 이후 「미션 추가」로 미션을 넣어요'],
    ],
  },
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
    key: 'quiz_manage',
    topic: 'quiz',
    badge: '게시물 관리',
    title: '게시물 관리 — 퀴즈 + 가려진 게시물',
    desc: '운영자 패널 「게시물 관리」로 들어오면 보이는 화면.',
    src: '/guide/08.png',
    markers: [
      { n: 1, x: 8, y: 27 },
      { n: 2, x: 4, y: 38 },
      { n: 3, x: 6, y: 61 },
    ],
    captions: [
      ['+ 퀴즈 만들기', '퀴즈 라이브러리에서 대상자·주제를 골라 만들기'],
      ['퀴즈 목록', '만든 퀴즈 — 문제 수·제출 수·정답 공개 표시 (✏️ 수정 / 🗑 삭제)'],
      ['가려진 게시물', '인증 심사에서 「피드 가리기」 한 게시물을 모아보고 복구'],
    ],
  },
  {
    key: 'quiz_library',
    topic: 'quiz',
    badge: '퀴즈 라이브러리',
    title: '퀴즈 라이브러리 — 대상자만 고르면 끝',
    desc: '「+ 퀴즈 만들기」를 누르면 나와요. 출처 검증된 건강 상식 퀴즈를 제공해요.',
    src: '/guide/09.png',
    markers: [
      { n: 1, x: 5, y: 68 },
      { n: 2, x: 5, y: 92 },
    ],
    captions: [
      ['대상자 선택', '군인·20대 / 근로자 등 대상자를 고르면 주제·문항이 나와요'],
      ['빈 퀴즈 직접 만들기', '라이브러리 없이 직접 문항을 작성'],
    ],
  },
  {
    key: 'quiz_form',
    topic: 'quiz',
    badge: '퀴즈 만들기',
    title: '퀴즈 만들기 — 제목·기간·정답 공개',
    desc: '대상자·주제를 고르면 이어지는 폼. 빈 퀴즈도 여기서 시작해요.',
    src: '/guide/10.png',
    markers: [
      { n: 1, x: 8, y: 22 },
      { n: 2, x: 8, y: 52 },
      { n: 3, x: 8, y: 80},
  
    ],
    captions: [
      ['제목', '퀴즈 제목 (필수)'],
      ['풀이 기한', '시작/종료 — 시작 비우면 즉시, 종료 비우면 무기한'],
      ['정답 공개', '제출 후 참가자에게 정답·해설 공개 여부'],
   
    ],
  },
  {
    key: 'quiz_question',
    topic: 'quiz',
    badge: '문항 편집',
    title: '문항 편집 — 유형·정답·해설·점수',
    desc: '문항마다 유형과 점수를 정해요. 「+ 문제 추가」로 여러 문항을 넣을 수 있어요.',
    src: '/guide/11.png',
    markers: [
      { n: 1, x: 11, y: 12 },
      { n: 2, x: 8, y: 33 },
      { n: 3, x: 8, y: 55},
      { n: 4, x: 5, y: 74 },
      { n: 5, x: 8, y: 83 },
      { n: 6, x: 8, y: 90 },
    ],
    captions: [
      ['유형', '객관식 / OX / 서술형 중 선택'],
      ['보기·정답', '보기를 입력하고 정답을 선택 (+ 보기 추가)'],
      ['해설', '정답 해설 — 정답 공개 시 참가자에게 노출'],
      ['점수·지급', '문항 점수 + 맞추면 지급 / 틀려도 지급'],
      ['문제 추가', '여러 문항을 추가한 뒤 발행'],
      ['퀴즈 발행하기', '문항까지 작성하고 발행'],
    ],
  },
  {
    key: 'quiz_features',
    topic: 'quiz',
    badge: '퀴즈 특징',
    title: '퀴즈는 이렇게 동작해요',
    desc: '건강 상식 퀴즈로 참여에 재미를 더해요.',
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
  const [topic, setTopic] = useState('wizard')
  const [stepIdx, setStepIdx] = useState(0)
  const visibleSteps = STEPS.filter(s => s.topic === topic)
  const total = visibleSteps.length
  const safeIdx = Math.min(stepIdx, total - 1)
  const step = visibleSteps[safeIdx]

  const selectTopic = (k) => { setTopic(k); setStepIdx(0) }

  return (
    <div className="min-h-screen bg-surface-app">
      <div className="max-w-2xl mx-auto px-4 pb-6">
        {/* 헤더 — 뒤로가기 내장 (별도 sticky 바 제거 → 상단 여백 제거) */}
        <div className="rounded-b-card-lg bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-50 border-b border-emerald-100/60 -mx-4 px-4 pt-3 pb-4 mb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-9 h-9 -ml-1 mb-1 flex items-center justify-center rounded-full text-gray-700 hover:bg-white/60 transition"
            title="뒤로"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            🌿 운영자 가이드
          </h1>
          <p className="text-sm font-medium text-gray-600 mt-1 leading-relaxed">
            주제를 골라 "어디서 무엇을" 하는지 한 단계씩 익혀보세요.
          </p>
        </div>

        {/* 주제 탭 */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 mb-3 scrollbar-hide">
          {TOPICS.map(t => {
            const active = topic === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => selectTopic(t.key)}
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

        {/* 현재 단계 카드 — 스크린샷은 폰 크기로 제한 + 사진 위 좌우 페이저 */}
        {step && (
          <div className="bg-white border border-gray-100 rounded-card shadow-soft p-4">
            <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold mb-1.5">
              {step.badge}
            </span>
            <h2 className="font-bold text-gray-800 leading-snug">{step.title}</h2>
            <p className="text-xs font-medium text-gray-500 mt-0.5 mb-3">{step.desc}</p>

            {step.src ? (
              <div className="grid sm:grid-cols-2 gap-4 items-start">
                <div className="relative">
                  {/* 사진 — 가운데 정렬(양옆 흰 여백 확보) */}
                  <div className="w-full max-w-[180px] mx-auto">
                    <AnnotatedShot src={step.src} markers={step.markers} />
                  </div>
                  {total > 1 && (
                    <>
                      {/* 좌우 화살표 — 사진 바깥 흰 여백, 세로 중앙 */}
                      <button
                        type="button"
                        disabled={safeIdx === 0}
                        onClick={() => setStepIdx(i => Math.max(0, i - 1))}
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-md border border-gray-100 text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition"
                        title="이전"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        disabled={safeIdx >= total - 1}
                        onClick={() => setStepIdx(i => Math.min(total - 1, i + 1))}
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-md border border-gray-100 text-gray-700 hover:bg-gray-50 disabled:opacity-30 transition"
                        title="다음"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/45 text-white text-[10px] font-medium">
                        {safeIdx + 1} / {total}
                      </span>
                    </>
                  )}
                </div>
                <StepCaptions captions={step.captions} />
              </div>
            ) : (
              <>
                <StepCaptions captions={step.captions} />
                {total > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <button
                      type="button"
                      disabled={safeIdx === 0}
                      onClick={() => setStepIdx(i => Math.max(0, i - 1))}
                      className="inline-flex items-center gap-0.5 px-3 py-1.5 text-sm font-medium text-gray-600 rounded-full hover:bg-gray-100 disabled:opacity-30 transition"
                    >
                      <ChevronLeft className="w-4 h-4" /> 이전
                    </button>
                    <span className="text-xs font-medium text-gray-400">{safeIdx + 1} / {total}</span>
                    <button
                      type="button"
                      disabled={safeIdx >= total - 1}
                      onClick={() => setStepIdx(i => Math.min(total - 1, i + 1))}
                      className="inline-flex items-center gap-0.5 px-3 py-1.5 text-sm font-medium text-gray-600 rounded-full hover:bg-gray-100 disabled:opacity-30 transition"
                    >
                      다음 <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 하단 CTA */}
        <button
          type="button"
          onClick={() => navigate('/programs/new')}
          className="w-full mt-4 flex items-center justify-center gap-1.5 py-3.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold rounded-card-lg shadow-soft transition"
        >
          <Plus className="w-5 h-5" /> 지금 프로그램 만들기
        </button>
      </div>
    </div>
  )
}

export default OperatorGuidePage
