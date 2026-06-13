import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, Target, FileQuestion, ShieldCheck, Users, Sprout, Plus,
} from 'lucide-react'
import StickyBackBar from '../components/common/StickyBackBar'

// 운영자 가이드 — 신규 운영자가 "여기서 뭘 할 수 있는지" 를 한눈에.
//   프로필 → 「운영자 가이드」 진입 + 첫 프로그램 생성 직후 환영 캐러셀에서 「가이드 보기」.
//   언제든 열람 가능한 레퍼런스 (Day 66).
const SECTIONS = [
  {
    icon: ClipboardList,
    tone: 'bg-emerald-50 text-emerald-600',
    title: '프로그램 만들기',
    desc: '나만의 건강 프로그램을 만드는 첫걸음이에요.',
    points: [
      '이름·기간·카테고리·표지를 마법사로 차근차근 설정',
      '성장 트랙(랭킹 · 정원 · 별자리) 중 하나 선택',
      '베타에서는 1인당 2개까지 운영할 수 있어요',
    ],
  },
  {
    icon: Target,
    tone: 'bg-sky-50 text-sky-600',
    title: '미션 추가',
    desc: '참가자가 매일 실천할 미션을 만들어요.',
    points: [
      '추천 라이브러리에서 골라 한 번에 추가하거나 직접 만들기',
      '인증 유형: 사진 · 기록 · 소감 (한 미션에 여러 개도 가능)',
      '입력별 점수와 필수/선택 지정 (예: 사진 7P 필수 + 소감 3P 선택)',
      '미션 아이콘은 기본 갤러리에서 고르거나 직접 업로드',
    ],
  },
  {
    icon: FileQuestion,
    tone: 'bg-violet-50 text-violet-600',
    title: '퀴즈 만들기',
    desc: '건강 상식 퀴즈로 참여에 재미를 더해요.',
    points: [
      '퀴즈 라이브러리에서 대상자·주제를 골라 손쉽게 추가',
      '문항·정답·해설·출처가 미리 준비돼 있어요',
      '점수와 정답 공개 여부를 직접 설정',
    ],
  },
  {
    icon: ShieldCheck,
    tone: 'bg-amber-50 text-amber-600',
    title: '인증 심사',
    desc: '공정하게 점수를 관리해요.',
    points: [
      '자동 승인(즉시 점수) / 운영자 심사(검토 후 점수) 선택',
      '부적절한 인증은 「점수 제외」로 랭킹에서 빼기',
      '「피드 가리기」로 커뮤니티에서 숨기고, 언제든 복구 가능',
    ],
  },
  {
    icon: Users,
    tone: 'bg-pink-50 text-pink-600',
    title: '참여자 관리',
    desc: '함께하는 사람들을 살펴봐요.',
    points: [
      '가입 승인제 프로그램은 요청을 검토하고 승인',
      '참여자별 인증 현황·미션별 분포를 통계로 확인',
      '초대 링크로 친구·동료를 손쉽게 초대',
    ],
  },
  {
    icon: Sprout,
    tone: 'bg-teal-50 text-teal-600',
    title: '성장 트랙',
    desc: '참여 동기를 북돋는 게이미피케이션이에요.',
    points: [
      '랭킹 — 점수로 순위를 겨뤄요',
      '정원 — 인증할수록 꽃이 자라요',
      '별자리 — 출석으로 별을 채워요',
    ],
  },
]

function OperatorGuidePage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-surface-app">
      <div className="max-w-2xl mx-auto px-4 pt-2 pb-10">
        <StickyBackBar fallbackPath="/profile" title="프로필로" />

        {/* 헤더 */}
        <div className="rounded-card-lg bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-50 border border-emerald-100/60 px-5 py-6 mb-5">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            🌿 운영자 가이드
          </h1>
          <p className="text-sm font-medium text-gray-600 mt-1.5 leading-relaxed">
            누구나 건강 운영자가 될 수 있어요.<br />
            이 앱에서 무엇을 할 수 있는지 한눈에 살펴보세요.
          </p>
        </div>

        {/* 섹션 카드 */}
        <div className="space-y-3">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={i} className="bg-white border border-gray-100 rounded-card shadow-soft p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.tone}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-bold text-gray-800">{s.title}</h2>
                    <p className="text-xs font-medium text-gray-500">{s.desc}</p>
                  </div>
                </div>
                <ul className="space-y-1 pl-1">
                  {s.points.map((p, j) => (
                    <li key={j} className="flex items-start gap-1.5 text-sm text-gray-700 leading-relaxed">
                      <span className="text-emerald-500 mt-0.5 flex-shrink-0">·</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
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
