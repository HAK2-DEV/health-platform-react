import { useState } from 'react'
import { generateInviteCode } from '../../../lib/queries'

// 참여 승인 — 자동(즉시) / 운영자 승인. 공개·비공개 공통.
//   공개+자동=FREE, 공개+승인=APPROVAL, 비공개+자동=INVITE_CODE,
//   비공개+승인=INVITE_CODE+invite_requires_approval (collectData 에서 도출)
const APPROVAL_MODES = [
  { key: 'auto', emoji: '⚡', label: '자동 승인', description: '신청하면 바로 참여돼요' },
  { key: 'approval', emoji: '✅', label: '운영자 승인', description: '운영자가 승인해야 참여할 수 있어요' },
]

// 마법사 Step3 (구 Step5Complete 의 참여 조건 입력 부분)
// 본인 (가) 진화 — Step3 features / Step4 scoring 폐기 후
function Step3JoinConditions({ initialData, onNext, onSave, onPrev }) {
  const [isPublic, setIsPublic] = useState(initialData?.is_public || false)
  const [previewEnabled, setPreviewEnabled] = useState(initialData?.preview_enabled || false)
  // 참여 승인 모드 — 기존 join_type 에서 도출
  const [approvalMode, setApprovalMode] = useState(
    initialData?.join_type === 'APPROVAL' ? 'approval'
      : initialData?.join_type === 'INVITE_CODE' ? (initialData?.invite_requires_approval ? 'approval' : 'auto')
        : 'auto'
  )
  const [maxParticipants, setMaxParticipants] = useState(initialData?.max_participants || '')
  const [inviteCode, setInviteCode] = useState(initialData?.invite_code || '')
  // 입장 질문 — APPROVAL 일 때만 의미. 토글 OFF → NULL / ON → 질문 텍스트
  const [hasEntryQuestion, setHasEntryQuestion] = useState(!!initialData?.entry_question)
  const [entryQuestion, setEntryQuestion] = useState(initialData?.entry_question || '')
  const [error, setError] = useState(null)

  // 공개+승인일 때만 입장질문 사용 (비공개는 코드로 들어와 운영자 승인 — 질문 없음)
  const showEntryQuestion = isPublic && approvalMode === 'approval'

  const validate = () => {
    if (showEntryQuestion && hasEntryQuestion && !entryQuestion.trim()) {
      return '입장 질문을 입력하거나 토글을 꺼주세요'
    }
    return null
  }

  const collectData = () => {
    const base = {
      is_public: isPublic,
      preview_enabled: previewEnabled,
      max_participants: maxParticipants === '' ? null : parseInt(maxParticipants),
    }
    if (isPublic) {
      // 공개 → 둘러보기로 참여. 자동=FREE / 승인=APPROVAL
      return {
        ...base,
        join_type: approvalMode === 'approval' ? 'APPROVAL' : 'FREE',
        invite_code: null,
        invite_requires_approval: false,
        entry_question: (approvalMode === 'approval' && hasEntryQuestion) ? entryQuestion.trim() : null,
      }
    }
    // 비공개 → 초대코드로만 참여 (빈 칸이면 자동 생성). 승인 여부는 invite_requires_approval
    return {
      ...base,
      join_type: 'INVITE_CODE',
      invite_code: inviteCode.trim() || generateInviteCode(),
      invite_requires_approval: approvalMode === 'approval',
      entry_question: null,
    }
  }

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
      <h2 className="text-xl font-semibold text-gray-800 mb-2">
        3단계: 참여 조건
      </h2>
      <p className="text-sm text-gray-600 mb-6 break-keep">
        공개 범위와 참여 방식을 설정해주세요
      </p>

      {/* 공개 범위 — 비공개 / 공개 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">공개 범위</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setIsPublic(false)}
            className={`p-3 rounded-md border-2 text-left transition ${!isPublic ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}
          >
            <div className={`font-medium ${!isPublic ? 'text-emerald-700' : 'text-gray-800'}`}>🔒 비공개</div>
            <div className="text-xs text-gray-600 mt-0.5 break-keep leading-relaxed">둘러보기에 안 보여요. 초대·링크로만 참여</div>
          </button>
          <button
            type="button"
            onClick={() => setIsPublic(true)}
            className={`p-3 rounded-md border-2 text-left transition ${isPublic ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}
          >
            <div className={`font-medium ${isPublic ? 'text-emerald-700' : 'text-gray-800'}`}>🌍 공개</div>
            <div className="text-xs text-gray-600 mt-0.5 break-keep leading-relaxed">둘러보기에 노출돼 누구나 발견</div>
          </button>
        </div>
      </div>

      {/* 참여 전 미리보기 — 검색 노출(공개)과 별개로 내부 열람 허용 여부 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">참여 전 둘러보기</label>
        <button
          type="button"
          onClick={() => setPreviewEnabled(!previewEnabled)}
          className={`w-full flex items-center justify-between gap-3 p-3 rounded-md border-2 text-left transition ${previewEnabled ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}
        >
          <div className="min-w-0">
            <div className={`font-medium ${previewEnabled ? 'text-emerald-700' : 'text-gray-800'}`}>👀 미리보기 허용</div>
            <div className="text-xs text-gray-600 mt-0.5 break-keep leading-relaxed">
              {previewEnabled
                ? '참여 전에도 미션·커뮤니티·랭킹을 둘러볼 수 있어요 (인증·작성은 참여 후)'
                : '참여해야 내부를 볼 수 있어요'}
            </div>
          </div>
          <span className={`flex-shrink-0 w-10 h-6 rounded-full transition relative ${previewEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${previewEnabled ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
        </button>
      </div>

      {/* 참여 승인 — 자동 / 운영자 승인 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">참여 승인</label>
        <div className="grid grid-cols-2 gap-2">
          {APPROVAL_MODES.map(m => {
            const isSelected = approvalMode === m.key
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setApprovalMode(m.key)}
                className={`p-3 rounded-md border-2 text-left transition ${isSelected ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}
              >
                <div className={`font-medium ${isSelected ? 'text-emerald-700' : 'text-gray-800'}`}>{m.emoji} {m.label}</div>
                <div className="text-xs text-gray-600 mt-0.5 break-keep leading-relaxed">{m.description}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 비공개 → 초대 코드 안내 + 코드 (빈 칸이면 자동 생성) */}
      {!isPublic && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">초대 코드</label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="비우면 자동 생성 (예: HEALTH2026)"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
          />
          <p className="text-xs text-gray-500 mt-1 break-keep leading-relaxed">
            🔒 비공개 프로그램은 <b>초대 코드/링크로만</b> 참여해요. 비우면 6자리 코드가 자동 생성돼요.
            {approvalMode === 'approval'
              ? ' 코드를 입력하면 운영자 승인 대기로 들어가요.'
              : ' 코드를 입력하면 바로 참여돼요.'}
          </p>
        </div>
      )}

      {/* 입장 질문 — 공개 + 운영자 승인일 때만 */}
      {showEntryQuestion && (
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setHasEntryQuestion(!hasEntryQuestion)}
            className={`
              w-full p-4 rounded-2xl border-2 text-left transition mb-2
              ${hasEntryQuestion
                ? 'border-emerald-500 bg-emerald-50'
                : 'border-gray-200 bg-white hover:border-gray-300'}
            `}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">📝</span>
              <div className="flex-1">
                <div className={`font-medium mb-1 ${hasEntryQuestion ? 'text-emerald-700' : 'text-gray-800'}`}>
                  입장 질문 받기
                </div>
                <div className="text-sm text-gray-600">
                  {hasEntryQuestion
                    ? '신청자가 답변을 작성해야 신청 가능. 운영자가 답변 보고 승인/거절'
                    : '신청자가 그냥 신청 → 대기. 운영자가 닉네임만 보고 승인/거절'}
                </div>
              </div>
              <div className={`
                relative w-10 h-6 rounded-full flex-shrink-0 transition
                ${hasEntryQuestion ? 'bg-emerald-500' : 'bg-gray-300'}
              `}>
                <div className={`
                  absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                  ${hasEntryQuestion ? 'translate-x-4' : 'translate-x-0.5'}
                `} />
              </div>
            </div>
          </button>

          {hasEntryQuestion && (
            <div className="ml-1">
              <label className="block text-xs font-medium text-gray-700 mb-1 mt-2">
                질문 내용
              </label>
              <textarea
                value={entryQuestion}
                onChange={(e) => setEntryQuestion(e.target.value)}
                placeholder="예: 이 프로그램에 참여하려는 이유를 알려주세요"
                rows={3}
                maxLength={150}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 text-sm resize-none"
              />
              <p className="text-[11px] text-gray-500 mt-1 text-right">
                {entryQuestion.length}/150
              </p>
            </div>
          )}
        </div>
      )}

      {/* 최대 참여 인원 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          최대 참여 인원 (선택)
        </label>
        <div className="flex items-center gap-1 w-full">
          <input
            type="number"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(e.target.value)}
            min={1}
            placeholder="무제한"
            className="flex-1 min-w-0 px-3 py-2 border-2 border-gray-200 rounded-md focus:outline-none focus:border-emerald-500"
          />
          <span className="text-gray-500 flex-shrink-0">명</span>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <p className="p-2 mb-4 bg-red-100 text-red-700 rounded-xl text-sm text-center">
          {error}
        </p>
      )}

      {/* 버튼 */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          className="flex-1 px-3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition whitespace-nowrap text-sm"
        >
          이전
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="flex-1 px-3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition whitespace-nowrap text-sm"
        >
          임시 저장
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="flex-1 px-3 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-md transition whitespace-nowrap text-sm"
        >
          다음
        </button>
      </div>
    </div>
  )
}

export default Step3JoinConditions
