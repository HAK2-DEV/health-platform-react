import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { 
  JOIN_TYPE_LIST, 
  CATEGORY, 
  PROGRAM_TYPE,
  FEATURE 
} from '../../../lib/constants'
import { formatKoreanDate } from '../../../lib/formatters'

function Step5Complete({ initialData, programId, onPrev }) {
  const navigate = useNavigate()
  
  const [joinType, setJoinType] = useState(initialData?.join_type || 'FREE')
  const [isPublic, setIsPublic] = useState(initialData?.is_public || false)
  const [maxParticipants, setMaxParticipants] = useState(initialData?.max_participants || '')
  const [inviteCode, setInviteCode] = useState(initialData?.invite_code || '')
  
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState(null)
  
  // 검증
  const validate = () => {
    if (!joinType) return '참여 방식을 선택해주세요'
    if (joinType === 'INVITE_CODE' && !inviteCode.trim()) {
      return '초대 코드를 입력해주세요'
    }
    return null
  }
  
  // 프로그램 게시 (DRAFT → PUBLISHED)
  const handlePublish = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    
    setIsPublishing(true)
    setError(null)
    
    try {
      const { error: updateError } = await supabase
        .from('programs')
        .update({
          join_type: joinType,
          is_public: isPublic,
          max_participants: maxParticipants === '' ? null : parseInt(maxParticipants),
          invite_code: joinType === 'INVITE_CODE' ? inviteCode.trim() : null,
          status: 'PUBLISHED',
          published_at: new Date().toISOString(),
        })
        .eq('id', programId)
      
      if (updateError) throw updateError
      
      // 게시 완료 → 대시보드
      navigate('/dashboard')
    } catch (err) {
      console.error('프로그램 게시 실패:', err)
      setError(err.message)
    } finally {
      setIsPublishing(false)
    }
  }
  
  // 카테고리 라벨들
  const categoryLabels = (initialData?.categories || [])
    .map(key => Object.values(CATEGORY).find(c => c.key === key)?.label)
    .filter(Boolean)
    .join(', ')
  
  // 프로그램 유형 라벨
  const typeLabel = Object.values(PROGRAM_TYPE)
    .find(t => t.key === initialData?.program_type)?.label || '미지정'
  
  // 활성화된 기능 개수
  const activeFeatures = Object.entries(initialData?.features || {})
    .filter(([_, v]) => v === true)
    .map(([key]) => Object.values(FEATURE).find(f => f.key === key)?.label)
    .filter(Boolean)
  
  return (
    <div>
      <h2 className="text-xl font-medium text-gray-800 mb-2">
        5단계: 참여 조건 + 완료
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        마지막 설정 후 프로그램을 게시해주세요
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
                  ${isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}
                `}
              >
                <input
                  type="radio"
                  name="joinType"
                  value={type.key}
                  checked={isSelected}
                  onChange={(e) => setJoinType(e.target.value)}
                  className="mt-1 text-green-500"
                />
                <span className="text-xl">{type.emoji}</span>
                <div className="flex-1">
                  <div className={`font-medium ${isSelected ? 'text-green-700' : 'text-gray-800'}`}>
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
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500"
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
            className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-green-500"
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
            className="mt-1 text-green-500 w-5 h-5"
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
      
      {/* 설정 요약 */}
      <div className="bg-gray-50 p-4 rounded-md mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          📋 프로그램 설정 요약
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex">
            <dt className="w-24 text-gray-600">이름</dt>
            <dd className="flex-1 text-gray-800">{initialData?.name || '-'}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-gray-600">기간</dt>
            <dd className="flex-1 text-gray-800">
              {formatKoreanDate(initialData?.start_date)} ~ {formatKoreanDate(initialData?.end_date)}
            </dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-gray-600">유형</dt>
            <dd className="flex-1 text-gray-800">{typeLabel}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-gray-600">카테고리</dt>
            <dd className="flex-1 text-gray-800">{categoryLabels || '-'}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-gray-600">활성 기능</dt>
            <dd className="flex-1 text-gray-800">
              {activeFeatures.length > 0 ? activeFeatures.join(', ') : '-'}
            </dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-gray-600">승인 방식</dt>
            <dd className="flex-1 text-gray-800">
              {initialData?.approval_mode === 'AUTO' ? '자동 승인' : '수동 승인'}
            </dd>
          </div>
        </dl>
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
          disabled={isPublishing}
          className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition disabled:opacity-50"
        >
          이전
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={isPublishing}
          className="flex-[2] px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
        >
          {isPublishing ? '게시 중...' : '🎉 프로그램 만들기'}
        </button>
      </div>
    </div>
  )
}

export default Step5Complete