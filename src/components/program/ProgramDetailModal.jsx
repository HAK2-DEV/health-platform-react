import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import { formatKoreanDate } from '../../lib/formatters'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { CATEGORY } from '../../lib/constants'

// 참여 상태: 'loading' | 'owner' | 'active' | 'none'
// (MVP 1차 — PENDING/REJECTED/COMPLETED 는 APPROVAL 도입 시 추가)

function ProgramDetailModal({ program, isOpen, onClose }) {
  const { session } = useAuth()
  const [participationStatus, setParticipationStatus] = useState('loading')
  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState(null)

  // FREE 방식 즉시 참여 (status=ACTIVE INSERT)
  const handleJoin = async () => {
    if (!session || !program) return

    setIsJoining(true)
    setJoinError(null)

    const { error } = await supabase
      .from('program_participants')
      .insert({
        program_id: program.id,
        user_id: session.user.id,
        status: 'ACTIVE',
      })

    if (error) {
      console.error('참여 실패:', error)
      setJoinError(error.message)
      setIsJoining(false)
      return
    }

    setParticipationStatus('active')
    setIsJoining(false)
  }

  useEffect(() => {
    if (!program || !session) return

    // owner 판단 먼저 (DB 조회 불필요)
    if (program.owner_id === session.user.id) {
      setParticipationStatus('owner')
      return
    }

    // 본인의 참여 행 조회 (0행이면 null — maybeSingle 사용)
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

      if (data?.status === 'ACTIVE') {
        setParticipationStatus('active')
      } else {
        setParticipationStatus('none')
      }
    }

    checkParticipation()
  }, [program, session])

  // 카테고리 key → 한글 라벨
  const categoryLabels = (program?.categories || [])
    .map(key => Object.values(CATEGORY).find(c => c.key === key)?.label)
    .filter(Boolean)

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {program && (
        <div className="p-6">
          {/* 이름 */}
          <h2 className="text-xl font-medium text-gray-800 mb-3 pr-8">
            {program.name}
          </h2>

          {/* 카테고리 뱃지 */}
          {categoryLabels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {categoryLabels.map((label, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded"
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* 기간 */}
          {(program.start_date || program.end_date) && (
            <p className="text-sm text-gray-600 mb-4">
              📅 {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
            </p>
          )}

          {/* 목표 */}
          {program.description && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-1">목표</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">
                {program.description}
              </p>
            </div>
          )}

          {/* 참여 상태 분기 */}
          <div className="border-t pt-4">
            {participationStatus === 'loading' && (
              <p className="text-center text-sm text-gray-400">확인 중...</p>
            )}
            {participationStatus === 'owner' && (
              <p className="text-center text-sm text-gray-500">
                내가 운영하는 프로그램입니다
              </p>
            )}
            {participationStatus === 'active' && (
              <div className="p-3 bg-green-50 text-green-700 text-sm text-center rounded">
                ✓ 참여 중
              </div>
            )}
            {participationStatus === 'none' && (
              <>
                {joinError && (
                  <p className="mb-3 p-2 bg-red-100 text-red-700 rounded text-sm text-center">
                    {joinError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="w-full px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-md transition disabled:bg-gray-400"
                >
                  {isJoining ? '참여 중...' : '참여하기'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

export default ProgramDetailModal
