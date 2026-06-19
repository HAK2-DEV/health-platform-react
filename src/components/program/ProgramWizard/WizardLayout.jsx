import { Link } from 'react-router-dom'
import { Fragment } from 'react'
import { ArrowLeft, Check } from 'lucide-react'

// 4단계 정보 (본인 (가) 진화 — features/scoring 폐기, 미션은 게시 후 직접 추가)
const STEPS = [
  { number: 1, label: '기본 정보' },
  { number: 2, label: '프로그램 옵션' },
  { number: 3, label: '참여 조건' },
  { number: 4, label: '요약·게시' },
]

function WizardLayout({ currentStep, children }) {
  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-6">
        <Link 
          to="/dashboard"
          className="p-2 hover:bg-gray-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </Link>
        <h1 className="text-lg font-medium text-gray-800">
          프로그램 생성
        </h1>
      </div>
      
      {/* 진행률 — 단계 인디케이터 (원 + 라벨 + 완료 ✓) */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft px-4 py-3 mb-6">
        <div className="flex items-start">
          {STEPS.map((step, index) => {
            const done = currentStep > step.number
            const active = currentStep === step.number
            return (
              <Fragment key={step.number}>
                {index > 0 && (
                  <div className={`flex-1 h-0.5 mt-[14px] mx-1 rounded-full ${currentStep >= step.number ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                )}
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold ${
                    done || active ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
                  }`}>
                    {done ? <Check className="w-4 h-4" /> : step.number}
                  </div>
                  <span className={`mt-1 text-[10px] font-medium whitespace-nowrap ${active ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {step.label}
                  </span>
                </div>
              </Fragment>
            )
          })}
        </div>
      </div>
      
      {/* 단계별 콘텐츠 */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        {children}
      </div>
    </div>
  )
}

export default WizardLayout