import { useState } from 'react'
import WelcomeOperatorModal from '../../components/program/WelcomeOperatorModal'

// 🔧 운영자 환영 투어 데모 — 라우트: /dev/welcome-tour
//   G2 확인용: 마지막 아웃트로에 "미션을 만들어야 참여자가 인증할 수 있어요" 인과 문구 추가.
//   programId=null → 미리보기(전 스텝 표시). 아웃트로는 step 17(intro+16+outro=18).
export default function WelcomeTourDemo() {
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState(0)
  const [replay, setReplay] = useState(0)

  const openAt = (s) => { setStart(s); setReplay((k) => k + 1); setOpen(true) }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="max-w-xs text-center">
        <h1 className="text-[17px] font-extrabold text-gray-900">운영자 환영 투어 데모</h1>
        <p className="mt-2 text-[12px] leading-relaxed text-gray-500 break-keep">
          <b className="text-gray-700">G2</b> — 마지막 아웃트로에 인과 문구 추가 확인용.<br />
          "미션을 만들어야 참여자가 인증할 수 있어요."
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" onClick={() => openAt(0)}
            className="h-11 rounded-xl bg-emerald-500 text-white text-[14px] font-bold active:scale-[0.98] transition">
            처음부터 보기
          </button>
          <button type="button" onClick={() => openAt(17)}
            className="h-11 rounded-xl bg-white border border-emerald-300 text-emerald-700 text-[14px] font-bold active:scale-[0.98] transition">
            아웃트로 바로 보기 →
          </button>
        </div>
        <p className="mt-3 text-[11px] text-gray-400">아웃트로 CTA "첫 미션 만들러 가기"는 실제 프로그램에선 미션 추가를 자동으로 엽니다(?addmission=1).</p>
      </div>
      <WelcomeOperatorModal key={replay} isOpen={open} onClose={() => setOpen(false)} programId={null} initialStep={start} />
    </div>
  )
}
