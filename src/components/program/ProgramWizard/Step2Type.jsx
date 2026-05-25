import { useState } from 'react'
import { PROGRAM_TYPE_LIST } from '../../../lib/constants'

function Step2Type({ initialData, onNext, onSave, onPrev }) {
  const [programType, setProgramType] = useState(initialData?.program_type || null)
  const [feedEnabled, setFeedEnabled] = useState(initialData?.feed_enabled || false)
  const [error, setError] = useState(null)

  const validate = () => {
    if (!programType) return '프로그램 유형을 선택해주세요'
    return null
  }

  const collectData = () => ({
    program_type: programType,
    feed_enabled: feedEnabled,
  })

  const handleNext = () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    onNext(collectData())
  }

  const handleSave = () => {
    onSave(collectData())
  }

  return (
    <div>
      <h2 className="text-xl font-medium text-gray-800 mb-2">
        2단계: 프로그램 유형 선택
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        본인의 프로그램에 맞는 유형을 선택해주세요
      </p>

      {/* 유형 카드 */}
      <div className="space-y-3 mb-6">
        {PROGRAM_TYPE_LIST.map(type => {
          const isSelected = programType === type.key
          return (
            <button
              key={type.key}
              type="button"
              onClick={() => setProgramType(type.key)}
              className={`
                w-full p-4 rounded-lg border-2 text-left transition
                ${isSelected
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'}
              `}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{type.emoji}</span>
                <div className="flex-1">
                  <div className={`font-medium mb-1 ${isSelected ? 'text-green-700' : 'text-gray-800'}`}>
                    {type.label}
                  </div>
                  <div className="text-sm text-gray-600">
                    {type.description}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* 피드 활성화 토글 — 참여자끼리 인증 보고 좋아요/댓글 */}
      <button
        type="button"
        onClick={() => setFeedEnabled(!feedEnabled)}
        className={`
          w-full p-4 rounded-lg border-2 text-left transition mb-6
          ${feedEnabled
            ? 'border-emerald-500 bg-emerald-50'
            : 'border-gray-200 bg-white hover:border-gray-300'}
        `}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl">📷</span>
          <div className="flex-1">
            <div className={`font-medium mb-1 ${feedEnabled ? 'text-emerald-700' : 'text-gray-800'}`}>
              피드 활성화 (커뮤니티 모드)
            </div>
            <div className="text-sm text-gray-600">
              참여자끼리 서로의 인증을 사진 피드로 보고 좋아요·댓글로 응원할 수 있어요
            </div>
          </div>
          {/* 토글 스위치 */}
          <div className={`
            relative w-10 h-6 rounded-full flex-shrink-0 transition
            ${feedEnabled ? 'bg-emerald-500' : 'bg-gray-300'}
          `}>
            <div className={`
              absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
              ${feedEnabled ? 'translate-x-4' : 'translate-x-0.5'}
            `} />
          </div>
        </div>
      </button>

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

export default Step2Type
