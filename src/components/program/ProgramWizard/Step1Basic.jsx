import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { CATEGORY_LIST, PROGRAM } from '../../../lib/constants'
import { getTodayKST } from '../../../lib/formatters'

const SCHEDULE_MODES = [
  { key: 'ALL_DAYS', label: '매일' },
  { key: 'WEEKDAYS', label: '평일만 (월-금)' },
  { key: 'WEEKENDS', label: '주말만 (토-일)' },
  { key: 'CUSTOM', label: '직접 선택' },
]

const WEEKDAYS = [
  { num: 1, label: '월' },
  { num: 2, label: '화' },
  { num: 3, label: '수' },
  { num: 4, label: '목' },
  { num: 5, label: '금' },
  { num: 6, label: '토' },
  { num: 7, label: '일' },
]

function Step1Basic({ initialData, onNext, onSave }) {
  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [startDate, setStartDate] = useState(initialData?.start_date || '')
  const [endDate, setEndDate] = useState(initialData?.end_date || '')
  const [categories, setCategories] = useState(initialData?.categories || [])
  
  // 세부 설정 (펼치기/접기)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [scheduleMode, setScheduleMode] = useState(initialData?.schedule_mode || 'ALL_DAYS')
  const [activeDays, setActiveDays] = useState(initialData?.active_days || [])
  const [excludedPeriods, setExcludedPeriods] = useState(initialData?.excluded_periods || [])
  
  const [error, setError] = useState(null)
  
  // 카테고리 토글
  const toggleCategory = (key) => {
    if (categories.includes(key)) {
      setCategories(categories.filter(c => c !== key))
    } else {
      setCategories([...categories, key])
    }
  }
  
  // 운영 요일 토글 (CUSTOM 모드)
  const toggleActiveDay = (num) => {
    if (activeDays.includes(num)) {
      setActiveDays(activeDays.filter(d => d !== num))
    } else {
      setActiveDays([...activeDays, num].sort())
    }
  }
  
  // 제외 기간 추가
  const addExcludedPeriod = () => {
    setExcludedPeriods([
      ...excludedPeriods,
      { start_date: '', end_date: '', reason: '' }
    ])
  }
  
  // 제외 기간 삭제
  const removeExcludedPeriod = (index) => {
    setExcludedPeriods(excludedPeriods.filter((_, i) => i !== index))
  }
  
  // 제외 기간 수정
  const updateExcludedPeriod = (index, field, value) => {
    const updated = [...excludedPeriods]
    updated[index] = { ...updated[index], [field]: value }
    setExcludedPeriods(updated)
  }
  
  // 검증
  const validate = () => {
    if (!name.trim()) return '프로그램 이름을 입력해주세요'
    if (name.length > PROGRAM.NAME_MAX_LENGTH) {
      return `프로그램 이름은 최대 ${PROGRAM.NAME_MAX_LENGTH}자까지 가능합니다`
    }
    if (!startDate) return '시작일을 선택해주세요'
    if (!endDate) return '종료일을 선택해주세요'
    if (startDate > endDate) return '종료일은 시작일 이후여야 합니다'
    if (description.length > PROGRAM.DESCRIPTION_MAX_LENGTH) {
      return `목표 설명은 최대 ${PROGRAM.DESCRIPTION_MAX_LENGTH}자까지 가능합니다`
    }
    if (categories.length === 0) return '카테고리를 최소 1개 선택해주세요'
    if (scheduleMode === 'CUSTOM' && activeDays.length === 0) {
      return '운영 요일을 최소 1일 선택해주세요'
    }
    return null
  }
  
  // 데이터 모음
  const collectData = () => ({
    name: name.trim(),
    description: description.trim(),
    start_date: startDate,
    end_date: endDate,
    categories,
    schedule_mode: scheduleMode,
    active_days: scheduleMode === 'CUSTOM' ? activeDays : [],
    excluded_periods: excludedPeriods.filter(p => p.start_date && p.end_date),
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
        1단계: 기본 정보 입력
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        프로그램의 기본 정보를 입력해주세요
      </p>
      
      {/* 프로그램 이름 */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          프로그램 이름
        </label>
        <div className="relative">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={PROGRAM.NAME_MAX_LENGTH}
            placeholder="예: 봄철 걷기 챌린지"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {name.length}/{PROGRAM.NAME_MAX_LENGTH}
          </span>
        </div>
      </div>
      
      {/* 운영 기간 */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          운영 기간
        </label>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            min={getTodayKST()}
            className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500"
          />
          <span className="text-gray-500">~</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || getTodayKST()} 
            className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500"
          />
        </div>
      </div>
      
      {/* 세부 설정 토글 */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 mb-5"
      >
        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        세부 설정 (운영 요일, 제외 기간)
      </button>
      
      {/* 세부 설정 내용 */}
      {showAdvanced && (
        <div className="bg-gray-50 p-4 rounded-md mb-5 space-y-4">
          {/* 운영 요일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              운영 요일
            </label>
            <div className="space-y-2">
              {SCHEDULE_MODES.map(mode => (
                <label key={mode.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleMode"
                    value={mode.key}
                    checked={scheduleMode === mode.key}
                    onChange={(e) => setScheduleMode(e.target.value)}
                    className="text-green-500"
                  />
                  <span className="text-sm text-gray-700">{mode.label}</span>
                </label>
              ))}
            </div>
            
            {/* CUSTOM 모드 = 요일 선택 */}
            {scheduleMode === 'CUSTOM' && (
              <div className="flex gap-1 mt-3">
                {WEEKDAYS.map(day => (
                  <button
                    key={day.num}
                    type="button"
                    onClick={() => toggleActiveDay(day.num)}
                    className={`
                      w-10 h-10 rounded-md text-sm transition
                      ${activeDays.includes(day.num)
                        ? 'bg-green-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}
                    `}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* 제외 기간 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                제외 기간 (휴일, 휴가 등)
              </label>
              <button
                type="button"
                onClick={addExcludedPeriod}
                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
              >
                <Plus className="w-3 h-3" />
                추가
              </button>
            </div>
            
            {excludedPeriods.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">
                제외 기간이 없습니다
              </p>
            ) : (
              <div className="space-y-2">
                {excludedPeriods.map((period, index) => (
                  <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                    <input
                      type="date"
                      value={period.start_date}
                      onChange={(e) => updateExcludedPeriod(index, 'start_date', e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-green-500"
                    />
                    <span className="text-xs text-gray-500">~</span>
                    <input
                      type="date"
                      value={period.end_date}
                      onChange={(e) => updateExcludedPeriod(index, 'end_date', e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-green-500"
                    />
                    <input
                      type="text"
                      value={period.reason}
                      onChange={(e) => updateExcludedPeriod(index, 'reason', e.target.value)}
                      placeholder="사유"
                      className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-green-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeExcludedPeriod(index)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 목표 설정 */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          목표 설정
        </label>
        <div className="relative">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={PROGRAM.DESCRIPTION_MAX_LENGTH}
            placeholder="예: 매일 7천보 이상 걷고, 건강한 습관을 만들어봐요!"
            rows={4}
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500 resize-none"
          />
          <span className="absolute right-3 bottom-2 text-xs text-gray-400">
            {description.length}/{PROGRAM.DESCRIPTION_MAX_LENGTH}
          </span>
        </div>
      </div>
      
      {/* 카테고리 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          카테고리 (복수 선택 가능)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORY_LIST.map(category => {
            const isSelected = categories.includes(category.key)
            return (
              <button
                key={category.key}
                type="button"
                onClick={() => toggleCategory(category.key)}
                className={`
                  flex items-center justify-center gap-1 px-3 py-2 rounded-md border-2 text-sm transition
                  ${isSelected 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}
                `}
              >
                <span>{category.emoji}</span>
                <span>{category.label}</span>
              </button>
            )
          })}
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

export default Step1Basic