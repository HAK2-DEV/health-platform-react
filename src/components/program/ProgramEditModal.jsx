import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { supabase } from '../../supabaseClient'
import { CATEGORY_LIST, PROGRAM } from '../../lib/constants'
import { formatKoreanDate } from '../../lib/formatters'

// 운영자가 PUBLISHED 프로그램의 안전 항목만 수정.
// 수정 가능: name, description, categories, end_date, max_participants, is_public
// 수정 불가 (자식 데이터 충돌 우려):
//   start_date (참여자 활동 시작 이후 변경 불가),
//   features / score_rules / approval_mode / bundle_image_numeric (missions 재생성 필요)
//
// end_date 변경 시 027 트리거가 자동으로 missions.active_until 동기화.
function ProgramEditModal({ program, isOpen, onClose, onSuccess }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categories, setCategories] = useState([])
  const [endDate, setEndDate] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [feedEnabled, setFeedEnabled] = useState(false)
  const [podiumEnabled, setPodiumEnabled] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  // 모달 열릴 때마다 program 데이터로 초기화
  useEffect(() => {
    if (program && isOpen) {
      setName(program.name || '')
      setDescription(program.description || '')
      setCategories(program.categories || [])
      setEndDate(program.end_date || '')
      setMaxParticipants(program.max_participants ?? '')
      setIsPublic(!!program.is_public)
      setFeedEnabled(!!program.feed_enabled)
      setPodiumEnabled(!!program.podium_enabled)
      setError(null)
      setIsSaving(false)
    }
  }, [program, isOpen])

  const toggleCategory = (key) => {
    if (categories.includes(key)) {
      setCategories(categories.filter(c => c !== key))
    } else {
      setCategories([...categories, key])
    }
  }

  const validate = () => {
    if (!name.trim()) return '프로그램 이름을 입력해주세요'
    if (name.length > PROGRAM.NAME_MAX_LENGTH) {
      return `프로그램 이름은 최대 ${PROGRAM.NAME_MAX_LENGTH}자까지 가능합니다`
    }
    if (!endDate) return '종료일을 입력해주세요'
    if (program?.start_date && endDate < program.start_date) {
      return '종료일은 시작일 이후여야 합니다'
    }
    if (description.length > PROGRAM.DESCRIPTION_MAX_LENGTH) {
      return `목표 설명은 최대 ${PROGRAM.DESCRIPTION_MAX_LENGTH}자까지 가능합니다`
    }
    if (categories.length === 0) return '카테고리를 최소 1개 선택해주세요'
    return null
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSaving(true)
    setError(null)

    const { error: updateError } = await supabase
      .from('programs')
      .update({
        name: name.trim(),
        description: description.trim(),
        categories,
        end_date: endDate,
        max_participants: maxParticipants === '' ? null : parseInt(maxParticipants),
        is_public: isPublic,
        feed_enabled: feedEnabled,
        podium_enabled: podiumEnabled,
      })
      .eq('id', program.id)

    if (updateError) {
      console.error('프로그램 수정 실패:', updateError)
      setError(updateError.message)
      setIsSaving(false)
      return
    }

    onSuccess?.()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {program && (
        <div className="p-6">
          <h2 className="text-xl font-medium text-gray-800 mb-4 pr-8">
            프로그램 수정
          </h2>

          {/* 이름 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              프로그램 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={PROGRAM.NAME_MAX_LENGTH}
              disabled={isSaving}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500 disabled:bg-gray-50"
            />
          </div>

          {/* 운영 기간 — 시작일 readonly */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              운영 기간
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-gray-50 border-2 border-gray-200 rounded-md text-sm text-gray-500">
                {formatKoreanDate(program.start_date)}
              </div>
              <span className="text-gray-500">~</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={program.start_date}
                disabled={isSaving}
                className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500 disabled:bg-gray-50"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              시작일은 수정 불가. 종료일만 변경 가능 — 미션 활성 기간도 자동 동기화돼요.
            </p>
          </div>

          {/* 목표 설명 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              목표 설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={PROGRAM.DESCRIPTION_MAX_LENGTH}
              rows={3}
              disabled={isSaving}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500 disabled:bg-gray-50 resize-none"
            />
          </div>

          {/* 카테고리 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              카테고리 (복수 선택)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_LIST.map(category => {
                const isSelected = categories.includes(category.key)
                return (
                  <button
                    key={category.key}
                    type="button"
                    onClick={() => toggleCategory(category.key)}
                    disabled={isSaving}
                    className={`
                      flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border-2 text-sm transition disabled:opacity-50
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

          {/* 최대 참여 인원 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              최대 참여 인원 (선택)
            </label>
            <input
              type="number"
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(e.target.value)}
              min={1}
              placeholder="무제한"
              disabled={isSaving}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500 disabled:bg-gray-50"
            />
          </div>

          {/* 공개 여부 */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                disabled={isSaving}
                className="w-4 h-4 text-green-500"
              />
              <span className="text-sm text-gray-700">공개 검색 허용</span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              다른 사용자들의 둘러보기에 노출돼요
            </p>
          </div>

          {/* 피드 활성화 — 커뮤니티 모드 */}
          <button
            type="button"
            onClick={() => setFeedEnabled(!feedEnabled)}
            disabled={isSaving}
            className={`
              w-full mb-3 p-3 rounded-lg border-2 text-left transition disabled:opacity-50
              ${feedEnabled
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-200 bg-white hover:border-gray-300'}
            `}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-xl">📷</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${feedEnabled ? 'text-emerald-700' : 'text-gray-800'}`}>
                  피드 활성화 (커뮤니티 모드)
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  참여자끼리 인증 사진을 피드로 보고 좋아요·댓글로 응원해요
                </p>
              </div>
              <div className={`
                relative w-9 h-5 rounded-full flex-shrink-0 transition mt-0.5
                ${feedEnabled ? 'bg-emerald-500' : 'bg-gray-300'}
              `}>
                <div className={`
                  absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                  ${feedEnabled ? 'translate-x-4' : 'translate-x-0.5'}
                `} />
              </div>
            </div>
          </button>

          {/* 포디움 활성화 — Top 3 시상대 */}
          <button
            type="button"
            onClick={() => setPodiumEnabled(!podiumEnabled)}
            disabled={isSaving}
            className={`
              w-full mb-4 p-3 rounded-lg border-2 text-left transition disabled:opacity-50
              ${podiumEnabled
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 bg-white hover:border-gray-300'}
            `}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-xl">🏆</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${podiumEnabled ? 'text-amber-700' : 'text-gray-800'}`}>
                  포디움 활성화 (Top 3 시상대)
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  랭킹 페이지에 1·2·3등 시상대 시각화. 끄면 평면 랭킹.
                </p>
              </div>
              <div className={`
                relative w-9 h-5 rounded-full flex-shrink-0 transition mt-0.5
                ${podiumEnabled ? 'bg-amber-500' : 'bg-gray-300'}
              `}>
                <div className={`
                  absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
                  ${podiumEnabled ? 'translate-x-4' : 'translate-x-0.5'}
                `} />
              </div>
            </div>
          </button>

          {/* 에러 */}
          {error && (
            <p className="mb-3 p-2 bg-red-100 text-red-700 rounded text-sm text-center">
              {error}
            </p>
          )}

          {/* 버튼 */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-[2] px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
            >
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ProgramEditModal
