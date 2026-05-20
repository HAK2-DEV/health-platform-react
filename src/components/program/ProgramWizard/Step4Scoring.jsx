import { useState } from 'react'
import { FEATURE } from '../../../lib/constants'

function Step4Scoring({ initialData, onNext, onSave, onPrev }) {
  // 3단계에서 활성화된 기능만 추출
  const activeFeatures = Object.entries(initialData?.features || {})
    .filter(([_, enabled]) => enabled === true)
    .map(([key, _]) => key)
  
  // 각 기능별 점수 규칙 state
  // 형태: { image_upload: { score: 10, daily_limit: 3 }, ... }
  const [scoreRules, setScoreRules] = useState(() => {
    const initial = {}
    activeFeatures.forEach(key => {
      initial[key] = initialData?.score_rules?.[key] || { score: 1, daily_limit: null }
    })
    return initial
  })
  
  const [dailyMaxScore, setDailyMaxScore] = useState(initialData?.daily_max_score || '')
  const [approvalMode, setApprovalMode] = useState(initialData?.approval_mode || 'AUTO')
  const [error, setError] = useState(null)
  
  // 점수 진화
  const updateScore = (key, value) => {
    setScoreRules({
      ...scoreRules,
      [key]: { ...scoreRules[key], score: parseInt(value) || 0 }
    })
  }
  
  // 일일 제한 진화
  const updateDailyLimit = (key, value) => {
    setScoreRules({
      ...scoreRules,
      [key]: { 
        ...scoreRules[key], 
        daily_limit: value === '' ? null : parseInt(value) || null 
      }
    })
  }
  
  // 검증
  const validate = () => {
    if (activeFeatures.length === 0) {
      return '3단계에서 기능을 먼저 선택해주세요'
    }
    for (const key of activeFeatures) {
      const rule = scoreRules[key]
      if (!rule.score || rule.score < 1) {
        const label = Object.values(FEATURE).find(f => f.key === key)?.label
        return `${label}의 점수는 1 이상이어야 합니다`
      }
    }
    return null
  }
  
  const collectData = () => ({
    score_rules: scoreRules,
    daily_max_score: dailyMaxScore === '' ? null : parseInt(dailyMaxScore),
    approval_mode: approvalMode,
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
  
  // 3단계 안 선택 시 안내
  if (activeFeatures.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">
          3단계에서 기능을 먼저 선택해주세요
        </p>
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition"
        >
          이전 단계로
        </button>
      </div>
    )
  }
  
  return (
    <div>
      <h2 className="text-xl font-medium text-gray-800 mb-2">
        4단계: 점수 규칙 설정
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        선택한 기능별 점수와 인증 방식을 설정해주세요
      </p>
      
      {/* 활동별 점수 */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          활동별 점수
        </h3>
        <div className="space-y-3">
          {activeFeatures.map(key => {
            const feature = Object.values(FEATURE).find(f => f.key === key)
            const rule = scoreRules[key]
            return (
              <div key={key} className="bg-gray-50 p-3 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{feature.emoji}</span>
                  <span className="font-medium text-gray-800">{feature.label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      활동당 점수
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={rule.score}
                        onChange={(e) => updateScore(key, e.target.value)}
                        min={1}
                        className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-green-500"
                      />
                      <span className="text-sm text-gray-500">점</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      하루 최대 (선택)
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={rule.daily_limit ?? ''}
                        onChange={(e) => updateDailyLimit(key, e.target.value)}
                        min={1}
                        placeholder="무제한"
                        className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-green-500"
                      />
                      <span className="text-sm text-gray-500">회</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      
      {/* 하루 최대 점수 (전체) */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          하루 최대 점수 (전체 합계, 선택)
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={dailyMaxScore}
            onChange={(e) => setDailyMaxScore(e.target.value)}
            min={1}
            placeholder="무제한"
            className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500"
          />
          <span className="text-gray-500">점</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          하루에 얻을 수 있는 최대 점수를 제한해요
        </p>
      </div>
      
      {/* 승인 방식 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          인증 승인 방식
        </label>
        <div className="space-y-2">
          <label className={`
            flex items-start gap-3 p-3 rounded-md border-2 cursor-pointer transition
            ${approvalMode === 'AUTO' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}
          `}>
            <input
              type="radio"
              name="approvalMode"
              value="AUTO"
              checked={approvalMode === 'AUTO'}
              onChange={(e) => setApprovalMode(e.target.value)}
              className="mt-1 text-green-500"
            />
            <div className="flex-1">
              <div className={`font-medium ${approvalMode === 'AUTO' ? 'text-green-700' : 'text-gray-800'}`}>
                자동 승인
              </div>
              <div className="text-sm text-gray-600">
                인증 시 자동으로 점수가 부여돼요
              </div>
            </div>
          </label>
          
          <label className={`
            flex items-start gap-3 p-3 rounded-md border-2 cursor-pointer transition
            ${approvalMode === 'MANUAL' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}
          `}>
            <input
              type="radio"
              name="approvalMode"
              value="MANUAL"
              checked={approvalMode === 'MANUAL'}
              onChange={(e) => setApprovalMode(e.target.value)}
              className="mt-1 text-green-500"
            />
            <div className="flex-1">
              <div className={`font-medium ${approvalMode === 'MANUAL' ? 'text-green-700' : 'text-gray-800'}`}>
                수동 승인
              </div>
              <div className="text-sm text-gray-600">
                운영자가 심사 후 점수를 부여해요
              </div>
            </div>
          </label>
        </div>
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

export default Step4Scoring