import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateInviteCode } from '../../../lib/queries'
import InfoTip from '../../common/InfoTip'

// 3단계: 참여 조건 — 무스크롤 서브스텝. 공개 범위 → 참여 승인 → 최대 인원.
const APPROVAL_MODES = [
  { key: 'auto', emoji: '⚡', label: '자동 승인', description: '신청하면 바로 참여돼요' },
  { key: 'approval', emoji: '✅', label: '운영자 승인', description: '운영자가 승인해야 참여할 수 있어요' },
]
const SUB = [
  { q: '누구에게 공개할까요?', sub: '비공개는 초대 코드로만 참여해요.' },
  { q: '참여 승인은 어떻게 할까요?', sub: '자동이면 바로 참여돼요.\n승인이면 운영자 확인 후 참여돼요.' },
  { q: '최대 참여 인원을 정할까요?', sub: '비워두면 최대 100명까지 참가할 수 있습니다.' },
]
const TOTAL = SUB.length
const slideVariants = {
  enter: (d) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d) => ({ x: d > 0 ? -40 : 40, opacity: 0 }),
}

function Step3JoinConditions({ initialData, onNext, onSave, onPrev, enterAtEnd = false }) {
  const [isPublic, setIsPublic] = useState(initialData?.is_public || false)
  const [previewEnabled, setPreviewEnabled] = useState(initialData?.preview_enabled || false)
  const [approvalMode, setApprovalMode] = useState(
    initialData?.join_type === 'APPROVAL' ? 'approval'
      : initialData?.join_type === 'INVITE_CODE' ? (initialData?.invite_requires_approval ? 'approval' : 'auto')
        : 'auto'
  )
  const [maxParticipants, setMaxParticipants] = useState(initialData?.max_participants || '')
  const [inviteCode, setInviteCode] = useState(initialData?.invite_code || '')
  const [hasEntryQuestion, setHasEntryQuestion] = useState(!!initialData?.entry_question)
  const [entryQuestion, setEntryQuestion] = useState(initialData?.entry_question || '')
  const [error, setError] = useState(null)

  const [subStep, setSubStep] = useState(enterAtEnd ? TOTAL - 1 : 0)
  const [dir, setDir] = useState(enterAtEnd ? -1 : 1)

  // 운영자 승인이면 입장질문 사용 (공개·비공개 모두 — 링크 유출 대비해 비공개+승인도 질문 받음)
  const showEntryQuestion = approvalMode === 'approval'

  const collectData = () => {
    // 최대 인원 100명 제한 — 비우면 100, 입력하면 1~100으로 클램프
    const parsedMax = parseInt(maxParticipants, 10)
    const cappedMax = (maxParticipants === '' || isNaN(parsedMax)) ? 100 : Math.min(Math.max(parsedMax, 1), 100)
    const base = {
      is_public: isPublic,
      preview_enabled: previewEnabled,
      max_participants: cappedMax,
    }
    if (isPublic) {
      return {
        ...base,
        join_type: approvalMode === 'approval' ? 'APPROVAL' : 'FREE',
        invite_code: null,
        invite_requires_approval: false,
        entry_question: (approvalMode === 'approval' && hasEntryQuestion) ? entryQuestion.trim() : null,
      }
    }
    return {
      ...base,
      join_type: 'INVITE_CODE',
      invite_code: inviteCode.trim() || generateInviteCode(),
      invite_requires_approval: approvalMode === 'approval',
      // 비공개+승인도 입장 질문 받음 (링크 유출 대비)
      entry_question: (approvalMode === 'approval' && hasEntryQuestion) ? entryQuestion.trim() : null,
    }
  }

  const validateSub = (s) => {
    if (s === 1 && showEntryQuestion && hasEntryQuestion && !entryQuestion.trim()) {
      return '입장 질문을 입력하거나 토글을 꺼주세요'
    }
    if (s === 2 && maxParticipants !== '' && parseInt(maxParticipants, 10) > 100) {
      return '최대 인원은 100명까지 가능해요'
    }
    return null
  }

  const goNext = () => {
    const err = validateSub(subStep)
    if (err) { setError(err); return }
    setError(null)
    if (subStep < TOTAL - 1) { setDir(1); setSubStep(s => s + 1) }
    else onNext(collectData())
  }
  const goPrev = () => {
    setError(null)
    if (subStep === 0) { onPrev(); return }
    setDir(-1); setSubStep(s => s - 1)
  }
  const handleSave = () => onSave(collectData())

  return (
    <div>
      {/* 진행 바 */}
      <div className="flex gap-1.5" style={{ marginBottom: '9px' }}>
        {SUB.map((_, i) => (
          <span key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= subStep ? 'bg-emerald-500' : 'bg-gray-200'}`} />
        ))}
      </div>

      <div className="min-h-[300px]">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={subStep} custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.22, ease: 'easeOut' }}>
            <h2 className="text-xl font-bold text-gray-800 break-keep flex items-center gap-1.5" style={{ marginBottom: '9px' }}>
              <span>{SUB[subStep].q}</span>
              <InfoTip>{SUB[subStep].sub}</InfoTip>
            </h2>

            {/* 0: 공개 범위 + 참여 전 둘러보기 */}
            {subStep === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                <div className="grid grid-cols-2" style={{ gap: '9px' }}>
                  <button type="button" onClick={() => setIsPublic(false)}
                    className={`p-3 rounded-[10px] border-2 text-left transition ${!isPublic ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                    <div className={`font-medium ${!isPublic ? 'text-emerald-700' : 'text-gray-800'}`}>🔒 비공개</div>
                    <div className="text-xs text-gray-600 mt-0.5 break-keep leading-relaxed">초대·링크로만 찾을 수 있어요{' '}
                        <span className="whitespace-nowrap"></span>
                    </div>
                  </button>
                  <button type="button" onClick={() => setIsPublic(true)}
                    className={`p-3 rounded-[10px] border-2 text-left transition ${isPublic ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                    <div className={`font-medium ${isPublic ? 'text-emerald-700' : 'text-gray-800'}`}>🌍 공개</div>
                    <div className="text-xs text-gray-600 mt-0.5 break-keep leading-relaxed">누구나 검색해서 찾을 수 있어요.</div>
                  </button>
                </div>
                <button type="button" onClick={() => setPreviewEnabled(!previewEnabled)}
                  className={`w-full flex items-center justify-between gap-3 p-3 rounded-[10px] border-2 text-left transition ${previewEnabled ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                  <div className="min-w-0">
                    <div className={`font-medium ${previewEnabled ? 'text-emerald-700' : 'text-gray-800'}`}>👀 참여 전 둘러보기</div>
                    <div className="text-xs text-gray-600 mt-0.5 break-keep leading-relaxed">
                      {previewEnabled ? '참여 전에도 미션·커뮤니티·랭킹을 볼 수 있어요 (인증·작성은 참여 후)' : '참여해야 내부를 볼 수 있어요'}
                    </div>
                  </div>
                  <span className={`flex-shrink-0 w-10 h-6 rounded-full transition relative ${previewEnabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${previewEnabled ? 'left-[18px]' : 'left-0.5'}`} />
                  </span>
                </button>
              </div>
            )}

            {/* 1: 참여 승인 + (비공개→초대코드 / 공개+승인→입장질문) */}
            {subStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                <div className="grid grid-cols-2" style={{ gap: '9px' }}>
                  {APPROVAL_MODES.map(m => {
                    const on = approvalMode === m.key
                    return (
                      <button key={m.key} type="button" onClick={() => setApprovalMode(m.key)}
                        className={`p-3 rounded-[10px] border-2 text-left transition ${on ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                        <div className={`font-medium ${on ? 'text-emerald-700' : 'text-gray-800'}`}>{m.emoji} {m.label}</div>
                        <div className="text-xs text-gray-600 mt-0.5 break-keep leading-relaxed">{m.description}</div>
                      </button>
                    )
                  })}
                </div>

                {!isPublic && (
                  <div>
                    <input type="text" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="초대 코드 — 비우면 자동 생성"
                      className="w-full px-3 py-3 border-2 border-gray-200 rounded-[10px] focus:outline-none focus:border-emerald-500 text-sm" />
                    <p className="text-[11px] text-gray-500 break-keep leading-relaxed" style={{ marginTop: '9px' }}>
  🔒 비공개는 <b>초대 코드/링크로만</b> 참여해요.<br />
  비우면 자동 생성.
  {approvalMode === 'approval'
    ? ' 코드 입력 시 승인 대기로 들어가요.'
    : ' 코드 입력 시 바로 참여돼요.'}
</p>
                  </div>
                )}

                {showEntryQuestion && (
                  <div>
                    <button type="button" onClick={() => setHasEntryQuestion(!hasEntryQuestion)}
                      className={`w-full p-3 rounded-[10px] border-2 text-left transition ${hasEntryQuestion ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                      <div className="flex items-start gap-2.5">
                        <span className="text-xl">📝</span>
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium ${hasEntryQuestion ? 'text-emerald-700' : 'text-gray-800'}`}>입장 질문 받기</div>
                          <div className="text-xs text-gray-600 mt-0.5 break-keep leading-relaxed">
                            {hasEntryQuestion ? '신청자가 답변을 작성 → 운영자가 보고 승인/거절' : '닉네임만 보고 승인/거절'}
                          </div>
                        </div>
                        <div className={`relative w-10 h-6 rounded-full flex-shrink-0 transition ${hasEntryQuestion ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${hasEntryQuestion ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                      </div>
                    </button>
                    {hasEntryQuestion && (
                      <div className="mt-1.5">
                        <textarea value={entryQuestion} onChange={(e) => setEntryQuestion(e.target.value)}
                          placeholder="예: 이 프로그램에 참여하려는 이유를 알려주세요" rows={2} maxLength={150}
                          className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-[10px] focus:outline-none focus:border-emerald-500 text-sm resize-none" />
                        <p className="text-[11px] text-gray-400 mt-0.5 text-right">{entryQuestion.length}/150</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 2: 최대 인원 */}
            {subStep === 2 && (
              <div className="flex items-center gap-1 w-full">
                <input type="number" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} min={1} max={100}
                  placeholder="최대 100명"
                  className="flex-1 min-w-0 px-3 py-3 border-2 border-gray-200 rounded-[10px] focus:outline-none focus:border-emerald-500" />
                <span className="text-gray-500 flex-shrink-0">명</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && (
        <p className="p-2 bg-red-100 text-red-700 rounded-[10px] text-sm text-center" style={{ marginTop: '9px' }}>{error}</p>
      )}

      {/* 네비게이션 — 첫 서브스텝의 이전은 2단계로 */}
      <div className="flex" style={{ gap: '9px', marginTop: '18px' }}>
        <button type="button" onClick={goPrev}
          className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-[10px] transition text-sm">이전</button>
        <button type="button" onClick={handleSave}
          className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-[10px] transition text-sm">임시저장</button>
        <button type="button" onClick={goNext}
          className="flex-1 px-3 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-bold rounded-[10px] transition text-sm">
          {subStep < TOTAL - 1 ? '다음' : '다음 단계로'}
        </button>
      </div>
    </div>
  )
}

export default Step3JoinConditions
