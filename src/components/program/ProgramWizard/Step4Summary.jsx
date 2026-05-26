import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../supabaseClient'
import { CATEGORY, PROGRAM_TYPE, JOIN_TYPE } from '../../../lib/constants'
import { formatKoreanDate } from '../../../lib/formatters'

// 마법사 Step4 (구 Step5Complete 의 요약 + 게시 부분)
// 본인 (가) 진화 — 미션은 게시 후 운영자가 직접 추가
function Step4Summary({ initialData, programId, onPrev }) {
  const navigate = useNavigate()
  const [isPublishing, setIsPublishing] = useState(false)
  const [error, setError] = useState(null)

  const handlePublish = async () => {
    setIsPublishing(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('programs')
        .update({
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

  // 카테고리 라벨
  const categoryLabels = (initialData?.categories || [])
    .map(key => Object.values(CATEGORY).find(c => c.key === key)?.label)
    .filter(Boolean)
    .join(', ')

  // 프로그램 유형
  const typeLabel = Object.values(PROGRAM_TYPE)
    .find(t => t.key === initialData?.program_type)?.label || '미지정'

  // 참여 방식
  const joinTypeLabel = Object.values(JOIN_TYPE)
    .find(j => j.key === initialData?.join_type)?.label || '미지정'

  return (
    <div>
      <h2 className="text-xl font-medium text-gray-800 mb-2">
        4단계: 요약 + 게시
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        설정한 내용을 확인하고 프로그램을 게시해주세요
      </p>

      {/* 설정 요약 */}
      <div className="bg-gray-50 p-4 rounded-md mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          📋 프로그램 설정 요약
        </h3>
        <dl className="space-y-2 text-sm">
          <div className="flex">
            <dt className="w-24 text-gray-600 flex-shrink-0">이름</dt>
            <dd className="flex-1 text-gray-800 break-words">{initialData?.name || '-'}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-gray-600 flex-shrink-0">기간</dt>
            <dd className="flex-1 text-gray-800">
              {formatKoreanDate(initialData?.start_date)} ~ {formatKoreanDate(initialData?.end_date)}
            </dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-gray-600 flex-shrink-0">유형</dt>
            <dd className="flex-1 text-gray-800">{typeLabel}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-gray-600 flex-shrink-0">카테고리</dt>
            <dd className="flex-1 text-gray-800">{categoryLabels || '-'}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-gray-600 flex-shrink-0">참여 방식</dt>
            <dd className="flex-1 text-gray-800">{joinTypeLabel}</dd>
          </div>
          <div className="flex">
            <dt className="w-24 text-gray-600 flex-shrink-0">공개 여부</dt>
            <dd className="flex-1 text-gray-800">
              {initialData?.is_public ? '공개' : '비공개'}
            </dd>
          </div>
          {initialData?.max_participants && (
            <div className="flex">
              <dt className="w-24 text-gray-600 flex-shrink-0">최대 인원</dt>
              <dd className="flex-1 text-gray-800">{initialData.max_participants}명</dd>
            </div>
          )}
        </dl>
      </div>

      {/* 미션 추가 안내 */}
      <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-md mb-6">
        <h3 className="text-sm font-medium text-emerald-800 mb-1">
          ✨ 게시 후 미션을 추가해주세요
        </h3>
        <p className="text-xs text-emerald-700">
          프로그램 게시 후 활동 페이지의 <strong>"+ 미션 추가"</strong> 버튼으로
          참여자가 인증할 미션을 자유롭게 만들 수 있어요.
        </p>
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
          className="flex-[2] px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
        >
          {isPublishing ? '게시 중...' : '🎉 프로그램 만들기'}
        </button>
      </div>
    </div>
  )
}

export default Step4Summary
