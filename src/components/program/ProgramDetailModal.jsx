import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Users, Target, Award, Crown, Lock, ShieldCheck, Globe2, Calendar } from 'lucide-react'
import Modal from '../common/Modal'
import { formatKoreanDate } from '../../lib/formatters'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { CATEGORY } from '../../lib/constants'
import { queryKeys, fetchProgramJoinInfo, invalidateParticipation } from '../../lib/queries'
import ProgramCover from '../common/ProgramCover'
import UserAvatar from '../common/UserAvatar'
import ConfirmModal from '../common/ConfirmModal'

// 참여 상태: 'loading' | 'owner' | 'active' | 'pending' | 'rejected' | 'none'
// Day 65 본인 결정 — 모달 UX 강화 (베타 첫 인상):
//   - 표지 사진 hero (16:9)
//   - 운영자 정보 (닉네임 + 아바타)
//   - 참여자 수 + 미션 개수 + 일일 최대 점수 (메타 3분할)
//   - 참여 방식 배지 (FREE / INVITE_CODE / APPROVAL)
//   - 참여 후 흐름 안내
function ProgramDetailModal({ program, isOpen, onClose, onPrev, onNext }) {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [participationStatus, setParticipationStatus] = useState('loading')
  const [isJoining, setIsJoining] = useState(false)
  const [joinError, setJoinError] = useState(null)
  const [justJoined, setJustJoined] = useState(false)
  const [reserveMsg, setReserveMsg] = useState(null)  // 참여 예약 확인 모달

  // APPROVAL 입장 답변 — 「참여 신청하기」 누르면 입장 질문 폼이 펼쳐짐(showEntryForm)
  const [entryAnswer, setEntryAnswer] = useState('')
  const [showEntryForm, setShowEntryForm] = useState(false)

  // 모달 fetch — 운영자/참여자/미션 정보 한 번에
  const { data: joinInfo } = useQuery({
    queryKey: queryKeys.programJoinInfo(program?.id),
    queryFn: () => fetchProgramJoinInfo(program.id),
    enabled: !!program?.id && isOpen,
  })

  useEffect(() => {
    if (!isOpen) {
      setJustJoined(false)
      setEntryAnswer('')
      setJoinError(null)
      setShowEntryForm(false)
    }
  }, [isOpen])

  const goToActivity = () => {
    onClose()
    navigate(`/programs/${program.id}`)
  }

  // 참여/신청 처리
  const handleJoin = async () => {
    if (!session || !program) return

    if (program.join_type === 'INVITE_CODE') {
      onClose()
      navigate('/join')
      return
    }

    setIsJoining(true)
    setJoinError(null)

    const insertData = {
      program_id: program.id,
      user_id: session.user.id,
    }

    if (program.join_type === 'APPROVAL') {
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
      insertData.status = 'ACTIVE'
    }

    // upsert — 예전에 나갔던(status='LEFT') 행이 남아 있으면 INSERT 가 유니크 제약에
    // 걸리므로, (program_id, user_id) 충돌 시 기존 행을 되살린다. left_at 도 초기화.
    const { error } = await supabase
      .from('program_participants')
      .upsert({ ...insertData, left_at: null }, { onConflict: 'program_id,user_id' })

    if (error) {
      console.error('참여 실패:', error)
      setJoinError(error.message)
      setIsJoining(false)
      return
    }

    setParticipationStatus(insertData.status === 'PENDING' ? 'pending' : 'active')
    setJustJoined(true)
    setIsJoining(false)
    setShowEntryForm(false)   // 입장 질문 모달 닫기

    const userId = session.user.id
    queryClient.invalidateQueries({ queryKey: queryKeys.activePrograms(userId) })
    queryClient.invalidateQueries({ queryKey: ['missions', 'today'] })
    queryClient.invalidateQueries({ queryKey: ['rankings'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    queryClient.invalidateQueries({ queryKey: queryKeys.programJoinInfo(program.id) })
    // 프로그램 상세/인증/댓글 권한 판정 쿼리 — 참여 직후 stale "미참여" 방지
    queryClient.invalidateQueries({ queryKey: ['my-participation', program.id, userId] })
    queryClient.invalidateQueries({ queryKey: ['my-part-status', program.id, userId] })
    // 참여자 수·둘러보기·통계 등 「참여자 수」를 쓰는 모든 화면 갱신 (ACTIVE 로 즉시 참여한 경우)
    if (insertData.status === 'ACTIVE') invalidateParticipation(queryClient, { programId: program.id, userId })
    else queryClient.invalidateQueries({ queryKey: queryKeys.publicPrograms(userId) })
  }

  // 시작 전 프로그램 — 참여 예약 (시작일에 자동 참여). confirm 후 handleJoin 재사용.
  //   ACTIVE 로 등록되므로 대시보드 「참여 예정」에 자동 카운트, 시작일 지나면 「참여 중」.
  const handleReserve = () => {
    const isApproval = program?.join_type === 'APPROVAL'
    const msg = isApproval
      ? '운영자 승인 후, 시작일에 자동으로 참여돼요.'
      : `${formatKoreanDate(program?.start_date)} 시작일에 자동으로 참여돼요.`
    setReserveMsg(msg)
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

  // ─── 표시용 라벨 ─────────────────────────────────────
  const categoryLabels = (program?.categories || [])
    .map(key => Object.values(CATEGORY).find(c => c.key === key))
    .filter(Boolean)

  // 기간 검증
  const now = new Date()
  const programStart = program?.start_date
    ? new Date(`${program.start_date}T00:00:00+09:00`)
    : null
  const programEnd = program?.end_date
    ? new Date(`${program.end_date}T23:59:59+09:00`)
    : null
  const isBeforeStart = programStart && now < programStart
  const isAfterEnd = programEnd && now > programEnd
  const inactiveJoinLabel = isAfterEnd
    ? `${formatKoreanDate(program?.end_date)} 에 종료된 프로그램입니다`
    : null

  // 참여 방식 메타
  const joinTypeMeta = (() => {
    switch (program?.join_type) {
      case 'INVITE_CODE':
        return { label: '초대 코드 참여', icon: Lock, cls: 'bg-amber-100 text-amber-700' }
      case 'APPROVAL':
        return { label: '승인 후 참여', icon: ShieldCheck, cls: 'bg-sky-100 text-sky-700' }
      default:
        return { label: '자유 참여', icon: Globe2, cls: 'bg-emerald-100 text-emerald-700' }
    }
  })()

  const joinButtonText = program?.join_type === 'INVITE_CODE'
    ? '초대 코드 입력하기'
    : program?.join_type === 'APPROVAL'
    ? '참여 신청하기'
    : '바로 참여하기'

  // 시작 전 — 예약 버튼 라벨
  const reserveButtonText = program?.join_type === 'INVITE_CODE'
    ? '초대 코드로 예약하기'
    : program?.join_type === 'APPROVAL'
    ? '참여 예약 신청하기'
    : '참여 예약하기'

  // 참여 흐름 안내 메시지
  const joinFlowMessage = (() => {
    if (!program) return ''
    if (program.join_type === 'APPROVAL') {
      return '신청 후 운영자가 승인하면 활동을 시작할 수 있어요.'
    }
    if (program.join_type === 'INVITE_CODE') {
      return '운영자가 알려준 초대 코드를 입력하면 참여돼요.'
    }
    return '참여 후 바로 첫 인증을 시작할 수 있어요.'
  })()

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} onPrev={onPrev} onNext={onNext}>
      {program && (
        <div>
          {/* ─── 표지 banner (16:7 짧은 비율, Day 65 본인 결정 — 모달 비율 균형) ─── */}
          <div className="relative -m-px overflow-hidden rounded-t-2xl">
            <ProgramCover
              imagePath={program.cover_image_path}
              categories={program.categories}
              name={program.name}
              variant="banner"
            />
            {/* 하단 흰색 페이드 — 표지와 텍스트 영역 자연스럽게 연결 (Day 65 본인 결정) */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent via-white/60 to-white pointer-events-none" />
            {/* 우상단 배지 — 공개/비공개 + 참여 방식 */}
            <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${program.is_public ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                {program.is_public ? '🌍 공개' : '🔒 비공개'}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${joinTypeMeta.cls}`}>
                <joinTypeMeta.icon className="w-3 h-3" />
                {joinTypeMeta.label}
              </span>
            </div>
          </div>

          {/* 텍스트 영역 — 표지 하단과 자연스럽게 겹치도록 살짝 끌어올림 (하단 패딩 0 → 버튼과 9px) */}
          <div className="px-6 pt-6 pb-0 -mt-4 relative">
            {/* ─── 카테고리 칩 (제목 위, Day 65 본인 결정) ─── */}
            {categoryLabels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {categoryLabels.map(c => (
                  <span key={c.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs">
                    <span>{c.emoji}</span>
                    {c.label}
                  </span>
                ))}
              </div>
            )}

            {/* ─── 제목 + 운영자 ─── */}
            <h2 className="text-xl font-bold text-gray-800 mb-2 pr-8 leading-tight">
              {program.name}
            </h2>
            {joinInfo?.ownerNickname && (
              <div className="flex items-center gap-1.5 mb-[9px] text-xs text-gray-500">
                <UserAvatar
                  avatarPath={joinInfo.ownerAvatarPath}
                  nickname={joinInfo.ownerNickname}
                  size="sm"
                />
                <span>by</span>
                <span className="font-medium text-gray-700">{joinInfo.ownerNickname}</span>
                <Crown className="w-3 h-3 text-amber-400" />
              </div>
            )}

            {/* ─── 정보 카드 — 기간/참여자/미션/일일 최대 세로 리스트 (Day 65 본인 모의도) ─── */}
            {(() => {
              const totalDays = (program.start_date && program.end_date)
                ? Math.round((new Date(program.end_date) - new Date(program.start_date)) / 86400000) + 1
                : null
              const rows = [
                {
                  icon: <Calendar className="w-4 h-4 text-emerald-500" />,
                  label: '기간',
                  value: (program.start_date || program.end_date) ? (
                    <div className="leading-tight">
                      <div>{formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}</div>
                      {totalDays && (
                        <div className="text-xs text-emerald-600 mt-0.5">총 {totalDays}일</div>
                      )}
                    </div>
                  ) : '-',
                },
                {
                  icon: <Users className="w-4 h-4 text-emerald-500" />,
                  label: '참여자 수',
                  value: program.max_participants
                    ? `${joinInfo?.participantCount ?? '-'}명 / 최대 ${program.max_participants}명`
                    : `${joinInfo?.participantCount ?? '-'}명 참여 중`,
                },
              ]
              return (
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 mb-[9px] shadow-sm">
                  <dl className="divide-y divide-gray-100">
                    {rows.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                        <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
                          {row.icon}
                        </div>
                        <dt className="w-20 flex-shrink-0 text-sm font-medium text-gray-700">
                          {row.label}
                        </dt>
                        <dd className="flex-1 min-w-0 text-sm text-gray-800 text-right">
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )
            })()}

            {/* ─── 프로그램 소개 박스 — 배경색으로 구분 (Day 65 본인 모의도) ─── */}
            {program.description
              && program.description.trim()
              && program.description.trim() !== program.name?.trim() && (
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 mb-[9px]">
                <p className="text-xs font-semibold text-emerald-700 mb-1.5">📋 프로그램 소개</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                  {program.description}
                </p>
              </div>
            )}

          </div>

          {/* ─── 참여 상태 sticky 하단 (Day 65 본인 결정) ─── */}
          {/* 콘텐츠 영역 밖으로 분리. 모달 outer overflow-y-auto 의 스크롤 컨텍스트에서 sticky 동작.
              상단에 흰색 페이드 그라데이션으로 콘텐츠가 sticky 박스 영역으로 자연스럽게 사라짐. */}
          <div className="sticky bottom-0 bg-white px-6 pt-0 pb-3 z-10">
            {/* 상단 페이드 — 콘텐츠가 sticky 영역에 진입할 때 부드럽게 흰색으로 사라짐 */}
            <div className="pointer-events-none absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-white" />
            {participationStatus === 'loading' && (
              <p className="text-center text-sm text-gray-400 py-2">확인 중...</p>
            )}

            {participationStatus === 'owner' && (
              <button
                type="button"
                onClick={goToActivity}
                className="w-full px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-2xl transition shadow-md shadow-amber-300/40"
              >
                활동·관리 페이지로 →
              </button>
            )}

            {participationStatus === 'active' && (
              <div>
                {justJoined && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-center rounded-2xl mb-2 text-sm">
                    {isBeforeStart
                      ? '🎉 참여 예약 완료! 시작일에 자동으로 참여돼요'
                      : '🎉 참여 완료! 바로 첫 인증을 시작해보세요'}
                  </div>
                )}
                <button
                  type="button"
                  onClick={goToActivity}
                  className="w-full px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold rounded-2xl transition shadow-md shadow-emerald-300/40"
                >
                  {justJoined ? (isBeforeStart ? '프로그램 보기 →' : '첫 인증하러 가기 →') : '활동 페이지로 →'}
                </button>
              </div>
            )}

            {participationStatus === 'pending' && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-center rounded-2xl text-sm">
                ⏳ <span className="font-semibold">승인 대기 중</span> · 운영자가 확인 후 승인할 거예요
              </div>
            )}

            {participationStatus === 'rejected' && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-center rounded-2xl text-sm">
                😢 <span className="font-semibold">참여 거절</span> · 운영자에게 문의해주세요
              </div>
            )}

            {participationStatus === 'none' && (() => {
              // 입장 질문이 있는 승인제 프로그램 — 「참여 신청하기」 누르면 폼 펼침(2단계)
              const needsEntryForm = program.join_type === 'APPROVAL' && !!program.entry_question && !isAfterEnd
              return (
              <>
                {/* 입장 질문 오류는 모달 안에서 표시 → 모달 열렸을 땐 숨김 */}
                {joinError && !showEntryForm && (
                  <p className="mb-3 px-3 py-2.5 bg-red-100 text-red-700 rounded-xl text-sm text-center">
                    {joinError}
                  </p>
                )}

                {isAfterEnd ? (
                  <div>
                    <button
                      type="button"
                      disabled
                      className="w-full px-4 py-3 bg-gray-200 text-gray-500 font-semibold rounded-2xl cursor-not-allowed"
                    >
                      {joinButtonText}
                    </button>
                    <p className="text-[11px] text-gray-500 mt-1.5 text-center">
                      {inactiveJoinLabel}
                    </p>
                  </div>
                ) : isBeforeStart ? (
                  <div>
                    <button
                      type="button"
                      onClick={needsEntryForm ? () => { setJoinError(null); setShowEntryForm(true) } : handleReserve}
                      disabled={isJoining}
                      className="w-full px-4 py-3 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-2xl transition shadow-md shadow-amber-300/40 disabled:from-gray-400 disabled:to-gray-400 disabled:shadow-none"
                    >
                      {isJoining ? '처리 중...' : reserveButtonText}
                    </button>
                    <p className="text-[11px] text-amber-700 text-center" style={{ marginTop: '9px' }}>
                      {formatKoreanDate(program.start_date)} 시작 — 예약하면 시작일에 자동으로 참여돼요
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={needsEntryForm ? () => { setJoinError(null); setShowEntryForm(true) } : handleJoin}
                    disabled={isJoining}
                    className="w-full px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-semibold rounded-2xl transition shadow-md shadow-emerald-300/40 disabled:from-gray-400 disabled:to-gray-400 disabled:shadow-none"
                  >
                    {isJoining ? '처리 중...' : joinButtonText}
                  </button>
                )}

                {/* 미리보기 허용 프로그램 — 참여 전 내부 둘러보기(열람 전용) */}
                {program.preview_enabled && (
                  <button
                    type="button"
                    onClick={() => { onClose(); navigate(`/programs/${program.id}`) }}
                    className="w-full mt-2 px-4 py-3 bg-white border-2 border-emerald-200 text-emerald-700 font-semibold rounded-2xl hover:bg-emerald-50 transition"
                  >
                    둘러보기
                  </button>
                )}
              </>
            )
          })()}
          </div>
        </div>
      )}
    </Modal>

    {/* 참여 예약 확인 — 브라우저 confirm 대체 커스텀 UI */}
    <ConfirmModal
      isOpen={reserveMsg !== null}
      onClose={() => setReserveMsg(null)}
      onConfirm={() => { setReserveMsg(null); handleJoin() }}
      title="프로그램 참여 예약"
      message={reserveMsg}
      confirmLabel="예약하기"
      busy={isJoining}
    />

    {/* 입장 질문 답변 — 정중앙 모달 (회색 딤 배경) */}
    {showEntryForm && (
      <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-5"
        style={{ touchAction: 'pan-y' }} onClick={() => !isJoining && setShowEntryForm(false)}>
        <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
          <p className="text-[16px] font-bold text-sky-900 leading-snug whitespace-pre-wrap break-words">
            📝 {program?.entry_question}
          </p>
          <p className="text-[12px] text-gray-500 mt-1 mb-3.5">답변을 작성하면 운영자가 확인 후 승인해요.</p>
          <textarea
            value={entryAnswer}
            onChange={(e) => setEntryAnswer(e.target.value)}
            placeholder="답변을 입력해주세요 (최대 200자)"
            rows={4}
            maxLength={200}
            autoFocus
            disabled={isJoining}
            className="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-sky-500 text-[14px] resize-none disabled:bg-gray-50"
          />
          {joinError && (
            <p className="mt-3 px-3 py-2.5 bg-red-100 text-red-700 rounded-xl text-sm text-center">{joinError}</p>
          )}
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={() => setShowEntryForm(false)} disabled={isJoining}
              className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition disabled:opacity-50">취소</button>
            <button type="button" onClick={handleJoin} disabled={isJoining}
              className="flex-[1.6] h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition disabled:opacity-50">
              {isJoining ? '처리 중...' : '신청 제출'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

export default ProgramDetailModal
