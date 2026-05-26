import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

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
      
      {/* 진행률 */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((step, index) => (
          <div key={step.number} className="flex items-center flex-1">
            {/* 단계 동그라미 */}
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
              ${currentStep === step.number 
                ? 'bg-emerald-500 text-white' 
                : currentStep > step.number 
                  ? 'bg-emerald-200 text-emerald-700' 
                  : 'bg-gray-200 text-gray-500'}
            `}>
              {step.number}
            </div>
            
            {/* 단계 사이 선 */}
            {index < STEPS.length - 1 && (
              <div className={`
                flex-1 h-0.5 mx-2
                ${currentStep > step.number ? 'bg-emerald-300' : 'bg-gray-200'}
              `} />
            )}
          </div>
        ))}
      </div>
      
      {/* 단계별 콘텐츠 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {children}
      </div>
    </div>
  )
}

export default WizardLayout