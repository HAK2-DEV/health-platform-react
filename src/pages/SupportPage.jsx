import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, HelpCircle, Mail, MessageCircle } from 'lucide-react'
import NotificationBell from '../components/common/NotificationBell'

const CONTACT_EMAIL = 'f23-10599@naver.com'

// 자주 묻는 질문 — 정적 콘텐츠 (건강증진 플랫폼 기준). 추후 추가/수정 자유.
const FAQS = [
  {
    q: '프로그램은 어떻게 참여하나요?',
    a: '하단 가운데 + 버튼 → 「프로그램 생성」 옆에서, 또는 「프로그램」 탭의 둘러보기에서 마음에 드는 프로그램을 찾아 참여 신청하면 돼요. 자동 승인 프로그램은 바로 참여되고, 승인제는 운영자 승인 후 활동할 수 있어요.',
  },
  {
    q: '미션 인증은 어떻게 하나요?',
    a: '하단 + 버튼 → 「인증하기」 → 프로그램과 미션을 고른 뒤, 미션이 요구하는 사진·숫자·메모를 입력해 제출하면 인증돼요. 자동 승인 미션은 즉시, 검토형은 운영자 확인 후 점수가 들어와요.',
  },
  {
    q: '포인트와 랭킹은 어떻게 쌓이나요?',
    a: '미션을 인증하면 미션에 설정된 점수를 받아요. 받은 점수는 프로그램 랭킹과 내 누적 포인트에 반영돼요. 같은 미션을 하루 여러 번 인증할 수 있는지는 미션 설정(무제한/하루 N회)에 따라 달라요.',
  },
  {
    q: '연속 인증(연속일)은 어떻게 유지되나요?',
    a: '하루에 하나라도 인증하면 연속일이 이어져요. 하루를 건너뛰면 연속이 끊겨 1일부터 다시 시작해요.',
  },
  {
    q: '프로그램에서 나가려면 어떻게 하나요?',
    a: '프로그램 상세 화면 맨 아래 「이 프로그램에서 나가기」를 누르면 돼요. 나가면 랭킹·집계에서 빠지지만, 지금까지의 기록은 보존돼요. 다시 참여하면 이어서 활동할 수 있어요.',
  },
  {
    q: '알림이 오지 않아요.',
    a: '「프로필 → 알림 설정」에서 알림이 켜져 있는지 확인해주세요. 그래도 안 온다면 기기/브라우저의 알림 권한이 꺼져 있을 수 있어요. 설치형(PWA)으로 추가하면 알림이 더 안정적이에요.',
  },
  {
    q: '비밀번호 변경·계정 정보는 어디서 바꾸나요?',
    a: '「프로필 → 계정 설정」에서 닉네임·계정 정보를 관리하고, 회원 탈퇴도 할 수 있어요.',
  },
  {
    q: '직접 프로그램을 만들 수 있나요?',
    a: '네! 하단 + 버튼 → 「프로그램 생성」으로 누구나 운영자가 되어 프로그램을 만들 수 있어요. 마법사를 따라 이름·카테고리·기간·미션을 설정하면 돼요.',
  },
]

function FaqItem({ item, open, onToggle }) {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="text-emerald-500 font-bold text-sm flex-shrink-0">Q</span>
        <span className="flex-1 text-[14px] font-semibold text-gray-800 break-keep">{item.q}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
          <p className="pb-4 pl-5 pr-1 text-[13px] text-gray-600 leading-relaxed break-keep whitespace-pre-line">{item.a}</p>
        </div>
      </div>
    </div>
  )
}

// 고객센터 — 자주 묻는 질문(FAQ) + 1:1 문의(이메일).
function SupportPage() {
  const navigate = useNavigate()
  const [openIdx, setOpenIdx] = useState(0)

  const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('[도담] 문의하기')}`

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-md mx-auto h-[46px] px-4 flex items-center justify-center relative">
          <button type="button" onClick={() => navigate(-1)} className="absolute left-3 p-1.5 -ml-1.5 text-gray-500 hover:text-gray-800" aria-label="뒤로">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-[17px] font-bold text-gray-800">고객센터</span>
          <div className="absolute right-3"><NotificationBell bare /></div>
        </div>
      </header>

      <div className="w-full max-w-md mx-auto px-4 pt-3 pb-10 space-y-3">
        {/* 인트로 */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-5">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <HelpCircle className="w-5 h-5 text-emerald-500" />
            </span>
            <div>
              <h2 className="text-[16px] font-extrabold text-gray-900 leading-tight">무엇을 도와드릴까요?</h2>
              <p className="text-[12px] text-gray-500 mt-0.5">자주 묻는 질문을 먼저 확인해보세요.</p>
            </div>
          </div>
        </div>

        {/* 자주 묻는 질문 */}
        <section className="bg-white border border-gray-100 rounded-2xl shadow-soft px-4 py-1">
          <h3 className="text-[13px] font-bold text-gray-400 pt-3 pb-1">자주 묻는 질문</h3>
          {FAQS.map((item, i) => (
            <FaqItem key={i} item={item} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? -1 : i)} />
          ))}
        </section>

        {/* 1:1 문의 */}
        <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
          <div className="flex items-center gap-2 mb-1">
            <MessageCircle className="w-4 h-4 text-emerald-500" />
            <h3 className="text-[15px] font-bold text-gray-800">원하는 답을 못 찾으셨나요?</h3>
          </div>
          <p className="text-[13px] text-gray-500 leading-relaxed mb-3 break-keep">
            궁금한 점이나 불편한 점이 있으면 이메일로 문의해주세요. 보통 1~2일 안에 답변드려요.
          </p>
          <a
            href={mailto}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-bold flex items-center justify-center gap-2 transition"
          >
            <Mail className="w-4 h-4" /> 이메일로 문의하기
          </a>
          <p className="text-[11px] text-gray-400 text-center mt-2 select-all">{CONTACT_EMAIL}</p>
        </section>
      </div>
    </div>
  )
}

export default SupportPage
