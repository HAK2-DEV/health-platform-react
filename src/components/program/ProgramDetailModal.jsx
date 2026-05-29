import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Modal from '../common/Modal'
import { formatKoreanDate } from '../../lib/formatters'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { CATEGORY } from '../../lib/constants'
import { queryKeys } from '../../lib/queries'

// 참여 상태: 'loading' | 'owner' | 'active' | 'pending' | 'rejected' | 'none'
//   pending  — APPROVAL 신청 후 운영자 승인 대기
//   rejected — 운영자가 거절
//   active   — 정상 참여 중
//   owner    — 내가 만든 프로그램

function ProgramDetailModal({ program, isOpen, onClose }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [participationStatus, setParticipationStatus] = useState('loading')
  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState(null)
  const [justJoined, setJustJoined] = useState(false)

  // APPROVAL 입장 답변
  const [entryAnswer, setEntryAnswer] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setJustJoined(false)
      setEntryAnswer('')
      setJoinError(null)
    }
  }, [isOpen])

  const goToActivity = () => {
    onClose()
    navigate(`/programs/${program.id}`)
  }

  // 참여/신청 처리 — join_type 별 분기
  const handleJoin = async () => {
    if (!session || !program) return

    // INVITE_CODE 는 /join 페이지로
    if (program.join_type === 'INVITE_CODE') {
      onClose()
      navigate(`/join?program=${program.id}`)
      return
    }

    setIsJoining(true)
    setJoinError(null)

    const insertData = {
      program_id: program.id,
      user_id: session.user.id,
    }

    if (program.join_type === 'APPROVAL') {
      // 입장 질문 있으면 답변 필수
      if (program.entry_question && !entryAnswer.trim()) {
        setJoinError('입장 질문에 답변을 작성해주세요')
        setIsJoining(false)
        return
      }
      insertData.status = 'PENDING'
      if (program.entry_question) {
        insertData.entry_answer = entryAnswer.trim()
      }
    } else {
      // FREE
      insertData.status = 'ACTIVE'
    }

    const { error } = await supabase
      .from('program_participants')
      .insert(insertData)

    if (error) {
      console.error('참여 실패:', error)
      setJoinError(error.message)
      setIsJoining(false)
      return
    }

    setParticipationStatus(insertData.status === 'PENDING' ? 'pending' : 'active')
    setJustJoined(true)
    setIsJoining(false)

    const userId = session.user.id
    queryClient.invalidateQueries({ queryKey: queryKeys.activePrograms(userId) })
    queryClient.invalidateQueries({ queryKey: ['missions', 'today'] })
    queryClient.invalidateQueries({ queryKey: ['rankings'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
  }

  // 참여 상태 조회
  useEffect(() => {
    if (!program || !session) return

    if (program.owner_id === session.user.id) {
      setParticipationStatus('owner')
      return
    }

    const checkParticipation = async () => {
      setParticipationStatus('loading')
      const { data, error } = await supabase
        .from('program_participants')
        .select('status')
        .eq('program_id', program.id)
        .eq('user_id', session.user.id)
        .maybeSingle()

      if (error) {
        console.error('참여 상태 조회 실패:', error)
        setParticipationStatus('none')
        return
      }

      if (data?.status === 'ACTIVE') setParticipationStatus('active')
      else if (data?.status === 'PENDING') setParticipationStatus('pending')
      else if (data?.status === 'REJECTED') setParticipationStatus('rejected')
      else setParticipationStatus('none')
    }

    checkParticipation()
  }, [program, session])

  // ─── 표시용 라벨 계산 ─────────────────────────────────
  const categoryLabels = (program?.categories || [])
    .map(key => Object.values(CATEGORY).find(c => c.key === key)?.label)
    .filter(Boolean)
    .join(', ')

  // 기간 검증 (시작 전 / 종료 후 차단)
  const now = new Date()
  const programStart = program?.start_date
    ? new Date(`${program.start_date}T00:00:00+09:00`)
    : null
  const programEnd = program?.end_date
    ? new Date(`${program.end_date}T23:59:59+09:00`)
    : null
  const isBeforeStart = programStart && now < programStart
  const isAfterEnd = programEnd && now > programEnd
  const isProgramInactive = isBeforeStart || isAfterEnd
  const inactiveJoinLabel = isBeforeStart
    ? `${formatKoreanDate(program?.start_date)} 시작 예정 — 이후 참여 가능`
    : isAfterEnd
    ? `${formatKoreanDate(program?.end_date)} 에 종료된 프로그램입니다`
    : null

  // join_type 별 버튼 텍스트
  const joinButtonText = program?.join_type === 'INVITE_CODE'
    ? '초대 코드로 참여하기'
    : program?.join_type === 'APPROVAL'
    ? '신청하기'
    : '참여하기'

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {program && (
        <div className="p-6">
          {/* 이름 */}
          <h2 className="text-xl font-medium text-gray-800 mb-4 pr-8">
            {program.name}
          </h2>

          {/* 요약 — Step4 Summary 스타일 */}
          <div className="bg-gray-50/60 p-4 rounded-2xl mb-5">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-1">
              📋 프로그램 정보
            </h3>
            <dl className="space-y-2 text-sm">
              {/* 목표 (description 이 이름과 다를 때만) */}
              {program.description
                && program.description.trim()
                && program.description.trim() !== program.name?.trim() && (
                <div className="flex">
                  <dt className="w-20 text-gray-500 flex-shrink-0">목표</dt>
                  <dd className="flex-1 text-gray-800 whitespace-pre-wrap break-words">
                    {program.description}
                  </dd>
                </div>
              )}
              <div className="flex">
                <dt className="w-20 text-gray-500 flex-shrink-0">기간</dt>
                <dd className="flex-1 text-gray-800">
                  {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                </dd>
              </div>
              {categoryLabels && (
                <div className="flex">
                  <dt className="w-20 text-gray-500 flex-shrink-0">카테고리</dt>
                  <dd className="flex-1 text-gray-800">{categoryLabels}</dd>
                </div>
              )}
              {program.max_participants && (
                <div className="flex">
                  <dt className="w-20 text-gray-500 flex-shrink-0">정원</dt>
                  <dd className="flex-1 text-gray-800">최대 {program.max_participants}명</dd>
                </div>
              )}
            </dl>
          </div>

          {/* 참여 상태 분기 */}
          <div className="border-t pt-4">
            {participationStatus === 'loading' && (
              <p className="text-center text-sm text-gray-400">확인 중...</p>
            )}

            {participationStatus === 'owner' && (
              <div>
                <p className="text-center text-sm text-gray-500 mb-5">
                  내가 운영하는 프로그램입니다
                </p>
                <button
                  type="button"
                  onClick={goToActivity}
                  className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-2xl transition"
                >
                  활동/관리 페이지로 →
                </button>
              </div>
            )}

            {participationStatus === 'active' && (
              <div>
                {justJoined ? (
                  <div className="p-4 bg-emerald-100 border-2 border-emerald-400 text-emerald-800 text-center rounded-2xl mb-5 animate-pulse">
                    <div className="text-3xl mb-1">🎉</div>
                    <div className="font-medium">참여 완료!</div>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-50 text-emerald-700 text-sm text-center rounded-2xl mb-5">
                    ✓ 참여 중
                  </div>
                )}
                <button
                  type="button"
                  onClick={goToActivity}
                  className="w-full px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-2xl transition"
                >
                  활동 페이지로 →
                </button>
              </div>
            )}

            {participationStatus === 'pending' && (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 text-amber-800 text-center rounded-2xl">
                <div className="text-2xl mb-1">⏳</div>
                <div className="font-medium mb-1">승인 대기 중</div>
                <div className="text-xs text-amber-700">
                  운영자가 확인 후 참여를 승인할 거예요
                </div>
              </div>
            )}

            {participationStatus === 'rejected' && (
              <div className="p-4 bg-red-50 border-2 border-red-200 text-red-800 text-center rounded-2xl">
                <div className="text-2xl mb-1">😢</div>
                <div className="font-medium mb-1">참여가 거절되었어요</div>
                <div className="text-xs text-red-700">
                  운영자에게 문의해주세요
                </div>
              </div>
            )}

            {participationStatus === 'none' && (
              <>
                {joinError && (
                  <p className="mb-3 p-2 bg-red-100 text-red-700 rounded text-sm text-center">
                    {joinError}
                  </p>
                )}

                {/* APPROVAL + 입장 질문 — 답변 입력 폼 */}
                {program.join_type === 'APPROVAL' && program.entry_question && !isProgramInactive && (
                  <div className="mb-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
                    <p className="text-xs font-medium text-emerald-800 mb-2 flex items-center gap-1">
                      📝 입장 질문
                    </p>
                    <p className="text-sm text-gray-700 mb-2 whitespace-pre-wrap">
                      {program.entry_question}
                    </p>
                    <textarea
                      value={entryAnswer}
                      onChange={(e) => setEntryAnswer(e.target.value)}
                      placeholder="답변을 입력해주세요"
                      rows={3}
                      maxLength={500}
                      disabled={isJoining}
                      className="w-full px-3 py-2 border-2 border-gray-200 bg-white rounded-xl focus:outline-none focus:border-emerald-500 text-sm resize-none disabled:bg-gray-50"
                    />
                    <p className="text-[11px] text-gray-500 mt-1 text-right">
                      {entryAnswer.length}/500
                    </p>
                  </div>
                )}

                {isProgramInactive ? (
                  <div>
                    <button
                      type="button"
                      disabled
                      className="w-full px-4 py-3 bg-gray-300 text-gray-500 font-medium rounded-2xl cursor-not-allowed"
                    >
                      {joinButtonText}
                    </button>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      {inactiveJoinLabel}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleJoin}
                    disabled={isJoining}
                    className="w-full px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-2xl transition disabled:from-gray-400 disabled:to-gray-400"
                  >
                    {isJoining ? '처리 중...' : joinButtonText}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ProgramDetailModal
