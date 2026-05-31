import { useState } from 'react'
import { CATEGORY_LIST, PROGRAM } from '../../../lib/constants'
import { getTodayKST } from '../../../lib/formatters'
import { useAuth } from '../../../hooks/useAuth'
import CoverImageUploader from '../../common/CoverImageUploader'

// 운영 요일 / 제외 기간 은 미션 단위로 이동 (032 마이그레이션, MissionCreateModal 에서 설정).
// 프로그램에는 더 이상 세부 설정 토글이 없음.
function Step1Basic({ initialData, onNext, onSave }) {
  const { session } = useAuth()
  const ownerId = session?.user?.id

  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [startDate, setStartDate] = useState(initialData?.start_date || '')
  const [endDate, setEndDate] = useState(initialData?.end_date || '')
  const [categories, setCategories] = useState(initialData?.categories || [])
  const [coverImagePath, setCoverImagePath] = useState(initialData?.cover_image_path || null)
  const [error, setError] = useState(null)

  // 카테고리 토글
  const toggleCategory = (key) => {
    if (categories.includes(key)) {
      setCategories(categories.filter(c => c !== key))
    } else {
      setCategories([...categories, key])
    }
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
    return null
  }

  // 데이터 모음 (빈 문자열 날짜는 null로 — 임시저장 시 Postgres date 거부 방지)
  //   schedule_mode/active_days/excluded_periods 는 더 이상 프로그램에 저장하지 않음 (미션으로 이동)
  const collectData = () => ({
    name: name.trim(),
    description: description.trim(),
    start_date: startDate || null,
    end_date: endDate || null,
    categories,
    cover_image_path: coverImagePath,
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

  // 임시저장: 이름만 필수 (날짜/카테고리 등은 비어도 저장 가능)
  const handleSave = () => {
    if (!name.trim()) {
      setError('프로그램 이름을 입력해주세요')
      return
    }
    setError(null)
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

      {/* 대표 사진 (선택) — 카테고리 선택 전이면 ETC 이모지 fallback */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          대표 사진 (선택)
        </label>
        <CoverImageUploader
          ownerId={ownerId}
          imagePath={coverImagePath}
          onChange={setCoverImagePath}
          categories={categories}
          name={name}
        />
      </div>

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
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {name.length}/{PROGRAM.NAME_MAX_LENGTH}
          </span>
        </div>
      </div>
      
      {/* 운영 기간 — 모바일 세로/데스크탑 가로 */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          운영 기간
        </label>
        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-500 mb-1">📅 시작</p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={getTodayKST()}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
            />
          </div>
          <span className="hidden sm:inline text-gray-500 flex-shrink-0 pb-2">~</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-500 mb-1">📅 종료</p>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || getTodayKST()}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>
      
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
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500 resize-none"
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
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
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
          className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition"
        >
          다음
        </button>
      </div>
    </div>
  )
}

export default Step1Basic