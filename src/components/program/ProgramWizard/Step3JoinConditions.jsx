import { useState } from 'react'
import { JOIN_TYPE_LIST } from '../../../lib/constants'

// 마법사 Step3 (구 Step5Complete 의 참여 조건 입력 부분)
// 본인 (가) 진화 — Step3 features / Step4 scoring 폐기 후
function Step3JoinConditions({ initialData, onNext, onSave, onPrev }) {
  const [joinType, setJoinType] = useState(initialData?.join_type || 'FREE')
  const [isPublic, setIsPublic] = useState(initialData?.is_public || false)
  const [maxParticipants, setMaxParticipants] = useState(initialData?.max_participants || '')
  const [inviteCode, setInviteCode] = useState(initialData?.invite_code || '')
  const [error, setError] = useState(null)

  const validate = () => {
    if (!joinType) return '참여 방식을 선택해주세요'
    if (joinType === 'INVITE_CODE' && !inviteCode.trim()) {
      return '초대 코드를 입력해주세요'
    }
    return null
  }

  const collectData = () => ({
    join_type: joinType,
    is_public: isPublic,
    max_participants: maxParticipants === '' ? null : parseInt(maxParticipants),
    invite_code: joinType === 'INVITE_CODE' ? inviteCode.trim() : null,
  })

  const handleNext = () => {
    const err = validate()
    if (err) { setError(err); return }
    setError(null)
    onNext(collectData())
  }

  const handleSave = () => {
    onSave(collectData())
  }

  return (
    <div>
      <h2 className="text-xl font-medium text-gray-800 mb-2">
        3단계: 참여 조건
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        참여 방식과 공개 여부를 설정해주세요
      </p>

      {/* 참여 방식 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          참여 방식
        </label>
        <div className="space-y-2">
          {JOIN_TYPE_LIST.map(type => {
            const isSelected = joinType === type.key
            return (
              <label
                key={type.key}
                className={`
                  flex items-start gap-3 p-3 rounded-md border-2 cursor-pointer transition
                  ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}
                `}
              >
                <input
                  type="radio"
                  name="joinType"
                  value={type.key}
                  checked={isSelected}
                  onChange={(e) => setJoinType(e.target.value)}
                  className="mt-1 text-emerald-500"
                />
                <span className="text-xl">{type.emoji}</span>
                <div className="flex-1">
                  <div className={`font-medium ${isSelected ? 'text-emerald-700' : 'text-gray-800'}`}>
                    {type.label}
                  </div>
                  <div className="text-sm text-gray-600">
                    {type.description}
                  </div>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {/* 초대 코드 (INVITE_CODE 모드 시) */}
      {joinType === 'INVITE_CODE' && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            초대 코드
          </label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="예: HEALTH2026"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            이 코드를 가진 사람만 참여할 수 있어요
          </p>
        </div>
      )}

      {/* 최대 참여 인원 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          최대 참여 인원 (선택)
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            min={1}
            placeholder="무제한"
            className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
          />
          <span className="text-gray-500">명</span>
        </div>
      </div>

      {/* 공개 여부 */}
      <div className="mb-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="mt-1 text-emerald-500 w-5 h-5"
          />
          <div>
            <div className="font-medium text-gray-800">
              공개 검색 허용
            </div>
            <div className="text-sm text-gray-600">
              다른 사용자들이 둘러볼 수 있어요
            </div>
          </div>
        </label>
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
          className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition"
        >
          다음
        </button>
      </div>
    </div>
  )
}

export default Step3JoinConditions
