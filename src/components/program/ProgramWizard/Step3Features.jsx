import { useState } from 'react'
import { FEATURE_LIST } from '../../../lib/constants'

function Step3Features({ initialData, onNext, onSave, onPrev }) {
  // initialData.features 가 객체 { image_upload: true, ... } 형태
  // 본인의 state 도 같은 형태 유지
  const [features, setFeatures] = useState(initialData?.features || {})
  const [error, setError] = useState(null)
  
  // 기능 토글
  const toggleFeature = (key) => {
    setFeatures({
      ...features,
      [key]: !features[key]
    })
  }
  
  // 활성화된 기능 개수
  const activeCount = Object.values(features).filter(v => v === true).length
  
  // 검증
  const validate = () => {
    if (activeCount === 0) {
      return '기능을 최소 1개 선택해주세요'
    }
    return null
  }
  
  const handleNext = () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    onNext({ features })
  }
  
  const handleSave = () => {
    onSave({ features })
  }
  
  return (
    <div>
      <h2 className="text-xl font-medium text-gray-800 mb-2">
        3단계: 기능 모듈 선택
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        본인의 프로그램에 필요한 기능을 선택해주세요 (복수 선택 가능)
      </p>
      
      {/* 활성화 카운트 */}
      <div className="mb-4 text-sm text-gray-600">
        선택한 기능: <span className="font-medium text-green-600">{activeCount}개</span>
      </div>
      
      {/* 기능 카드 */}
      <div className="space-y-3 mb-6">
        {FEATURE_LIST.map(feature => {
          const isSelected = features[feature.key] === true
          return (
            <button
              key={feature.key}
              type="button"
              onClick={() => toggleFeature(feature.key)}
              className={`
                w-full p-4 rounded-lg border-2 text-left transition
                ${isSelected
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'}
              `}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{feature.emoji}</span>
                <div className="flex-1">
                  <div className={`font-medium mb-1 ${isSelected ? 'text-green-700' : 'text-gray-800'}`}>
                    {feature.label}
                  </div>
                  <div className="text-sm text-gray-600">
                    {feature.description}
                  </div>
                </div>
                {/* 체크박스 */}
                <div className={`
                  w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0
                  ${isSelected
                    ? 'bg-green-500 border-green-500'
                    : 'bg-white border-gray-300'}
                `}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
      
      {/* 안내 메시지 */}
      <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800 mb-6">
        💡 다음 단계에서 선택한 기능에 대한 점수 규칙을 설정해요
      </div>
      
      {/* 에러 */}
      {error && (
        <p className="p-2 mb-4 bg-red-100 text-red-700 rounded text-sm text-center">
          {error}
        </p>
      )}
      
      {/* 버튼 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition"
        >
          이전
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition"
        >
          임시 저장
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-md transition"
        >
          다음
        </button>
      </div>
    </div>
  )
}

export default Step3Features