import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader2, Search, Calendar, Users, Crown, Lock } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { queryKeys, lookupInviteProgram, joinByInviteCode, fetchProgramJoinInfo } from '../lib/queries'
import ProgramCover from '../components/common/ProgramCover'
import UserAvatar from '../components/common/UserAvatar'
import StickyBackBar from '../components/common/StickyBackBar'
import { formatKoreanDate } from '../lib/formatters'
import { CATEGORY } from '../lib/constants'

// 초대 코드 가입 페이지 — 코드 단독으로 lookup + 가입
// 라우트: /join?code=<TEXT>  (program 파라미터는 더 이상 사용 X)
//
// 흐름:
//   1) URL 에 code 있고 로그인 됐으면 자동 lookup → 미리보기
//   2) 사용자가 프로그램 정보 확인 후 "참여하기" 명시적 클릭
//   3) joinByInviteCode 호출 → 가입 완료
//
// 보안 — 자동 가입 X (의도와 다른 사용자 클릭 시 위험 회피).

const REASON_MESSAGES = {
  not_authenticated: '로그인이 필요해요',
  invalid_code: '일치하는 프로그램이 없어요. 코드를 다시 확인해주세요.',
  program_not_published: '아직 게시되지 않은 프로그램이에요',
  not_invite_program: '초대 코드로 가입하는 프로그램이 아니에요',
  owner_cannot_join: '본인이 운영하는 프로그램에는 참여할 수 없어요',
}

function JoinByCodePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  const urlCode = searchParams.get('code') || ''
  const [code, setCode] = useState(urlCode)

  // status: idle | looking_up | preview | joining | joined | error
  const [status, setStatus] = useState('idle')
  const [program, setProgram] = useState(null)
  const [joinResult, setJoinResult] = useState(null)
  const [errorReason, setErrorReason] = useState(null)
  const [autoTried, setAutoTried] = useState(false)

  const callLookup = async (c) => {
    setStatus('looking_up')
    setErrorReason(null)
    try {
      const data = await lookupInviteProgram(c.trim())
      if (data?.ok) {
        setProgram(data.program)
        setStatus('preview')
      } else {
        setErrorReason(data?.reason || 'unknown')
        setStatus('error')
      }
    } catch (err) {
      console.error('lookup error:', err)
      setErrorReason('rpc_error')
      setStatus('error')
    }
  }

  const callJoin = async (entryAnswer = null) => {
    setStatus('joining')
    setErrorReason(null)
    try {
      const data = await joinByInviteCode(code.trim(), entryAnswer)
      if (data?.ok) {
        queryClient.invalidateQueries({ queryKey: queryKeys.activePrograms(session?.user?.id) })
        queryClient.invalidateQueries({ queryKey: ['missions', 'today'] })
        queryClient.invalidateQueries({ queryKey: ['rankings'] })
        setJoinResult(data)
        setStatus('joined')
      } else {
        setErrorReason(data?.reason || 'unknown')
        setStatus('error')
      }
    } catch (err) {
      console.error('join error:', err)
      setErrorReason('rpc_error')
      setStatus('error')
    }
  }

  // 비로그인으로 초대링크 진입 시 — 로그인/회원가입 완료 후 이 화면으로 복귀하도록 경로 저장.
  // (소비/제거는 HomePage 가 1회만 — ref 가드로 StrictMode 안전)
  useEffect(() => {
    if (!session && urlCode) {
      sessionStorage.setItem('post_auth_redirect', window.location.pathname + window.location.search)
    }
  }, [session, urlCode])

  // URL 에 code 있고 로그인 됐으면 lookup 자동 (가입은 X — 미리보기까지만)
  useEffect(() => {
    if (autoTried) return
    if (!session || !urlCode) return
    setAutoTried(true)
    callLookup(urlCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, urlCode, autoTried])

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (!code.trim()) return
    callLookup(code.trim())
  }

  // ─── 비로그인 ─────────────────────────────────────────
  if (!session) {
    return (
      <div className="px-4 pt-2 pb-6 max-w-md mx-auto">
        <StickyBackBar fallbackPath="/dashboard" title="이전 페이지로" />
        <div className="text-center pt-8">
        <div className="text-5xl mb-3">🔐</div>
        <h1 className="text-xl font-medium text-gray-800 mb-2">로그인이 필요해요</h1>
        <p className="text-sm text-gray-500 mb-6">
          초대 코드로 참여하려면 먼저 로그인해주세요.
        </p>
        <button
          type="button"
          onClick={() => {
            // 로그인/회원가입(닉네임) 완료 후 이 초대 화면으로 자동 복귀
            sessionStorage.setItem('post_auth_redirect', window.location.pathname + window.location.search)
            navigate('/login')
          }}
          className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-2xl shadow-md transition"
        >
          로그인하러 가기
        </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-md mx-auto">
      <StickyBackBar fallbackPath="/dashboard" title="이전 페이지로" />
      <h1 className="text-2xl font-medium text-gray-800 mb-1 mt-2">🎟️ 초대 코드 참여</h1>
      <p className="text-sm text-gray-500 mb-6">
        프로그램 운영자가 알려준 코드를 입력해주세요.
      </p>

      {/* 코드 입력 폼 — 미리보기 전(idle, looking_up, error) 또는 가입 후 미노출 */}
      {(status === 'idle' || status === 'looking_up' || status === 'error') && (
        <>
          <form onSubmit={handleManualSubmit} className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">초대 코드</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="예: HEALTH 또는 ABC123"
                disabled={status === 'looking_up'}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 text-sm tracking-wider disabled:bg-gray-50"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!code.trim() || status === 'looking_up'}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-2xl shadow-md disabled:from-gray-300 disabled:to-gray-300 transition"
            >
              {status === 'looking_up' ? (
                <><Loader2 className="w-4 h-4 animate-spin" />확인 중...</>
              ) : (
                <><Search className="w-4 h-4" />프로그램 찾기</>
              )}
            </button>
          </form>

          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-center">
              <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
              <p className="text-sm text-red-700">
                {REASON_MESSAGES[errorReason] || '오류가 발생했어요. 다시 시도해주세요.'}
              </p>
            </div>
          )}
        </>
      )}

      {/* 프로그램 미리보기 → 명시적 참여.
          Day 65 본인 결정: 둘러보기 모달(ProgramDetailModal) 과 시각 구조 통일.
          banner 표지 + 카테고리 칩 + 메타 세로 리스트 + 프로그램 소개 박스. */}
      {(status === 'preview' || status === 'joining') && program && (
        <PreviewCard
          program={program}
          isJoining={status === 'joining'}
          onCancel={() => { setStatus('idle'); setProgram(null) }}
          onJoin={callJoin}
          onPreview={() => navigate(`/programs/${program.id}`)}
        />
      )}

      {/* 참여 완료 / 승인 대기 */}
      {status === 'joined' && joinResult && (
        joinResult.pending ? (
          <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center">
            <div className="text-4xl mb-2 leading-none">⏳</div>
            <p className="text-base font-medium text-amber-800 mb-1">
              {joinResult.already_applied ? '이미 신청했어요' : '참여 신청 완료'}
            </p>
            <p className="text-sm text-amber-700 mb-2 break-words">{joinResult.program_name}</p>
            <p className="text-xs text-amber-600 mb-5 break-keep">운영자가 승인하면 활동을 시작할 수 있어요.</p>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center justify-center px-6 py-2.5 bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-medium rounded-full shadow-md transition"
            >
              확인
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-base font-medium text-emerald-800 mb-1">
              {joinResult.already_joined ? '이미 참여 중이에요' : joinResult.rejoined ? '다시 참여 완료' : '참여 완료!'}
            </p>
            <p className="text-sm text-emerald-700 mb-5 break-words">
              {joinResult.program_name}
            </p>
            <button
              type="button"
              onClick={() => navigate(`/programs/${joinResult.program_id}`)}
              className="inline-flex items-center justify-center px-6 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-full shadow-md transition"
            >
              프로그램으로 이동
            </button>
          </div>
        )
      )}
    </div>
  )
}

// 미리보기 카드 — ProgramDetailModal 의 시각 구조를 차용 (banner + 카테고리 + 메타 + 소개 박스).
// 차이점: 모달이 아니라 페이지 안에 인라인 렌더, sticky 대신 콘텐츠 바로 아래 액션 버튼.
function PreviewCard({ program, isJoining, onCancel, onJoin, onPreview }) {
  const { data: joinInfo } = useQuery({
    queryKey: queryKeys.programJoinInfo(program?.id),
    queryFn: () => fetchProgramJoinInfo(program.id),
    enabled: !!program?.id,
  })

  // 비공개+승인 + 입장 질문이 있으면 답변 입력 (링크 유출 대비 신청자 선별)
  const [entryAnswer, setEntryAnswer] = useState('')
  const needsAnswer = !!(program.invite_requires_approval && program.entry_question)
  const answerMissing = needsAnswer && !entryAnswer.trim()

  const categoryLabels = (program.categories || [])
    .map(key => Object.values(CATEGORY).find(c => c.key === key))
    .filter(Boolean)

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
    <>
    {/* pb-24 — 하단 고정 버튼이 소개 글을 가리지 않게 여백 확보 */}
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden pb-24">
      {/* 표지 banner + 우상단 초대 코드 배지 + 하단 페이드 */}
      <div className="relative overflow-hidden">
        <ProgramCover
          imagePath={program.cover_image_path}
          categories={program.categories}
          name={program.name}
          variant="banner"
        />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent via-white/60 to-white pointer-events-none" />
        {/* 상단 바 — 카테고리(좌) + 초대 코드 배지(우) */}
        <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {categoryLabels.map(c => (
              <span key={c.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/90 text-gray-700 shadow-sm">
                <span>{c.emoji}</span>{c.label}
              </span>
            ))}
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 shadow-sm flex-shrink-0 whitespace-nowrap">
            <Lock className="w-3 h-3" />
            초대 코드 참여
          </span>
        </div>
      </div>

      {/* 텍스트 영역 — 표지 하단과 자연스럽게 겹치도록 살짝 끌어올림 */}
      <div className="p-6 -mt-4 relative">
        {/* 제목 + 운영자 */}
        <h2 className="text-xl font-bold text-gray-800 mb-2 leading-tight">
          {program.name}
        </h2>
        {joinInfo?.ownerNickname && (
          <div className="flex items-center gap-1.5 mb-4 text-xs text-gray-500">
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

        {/* 메타 카드 — 기간/참여자 세로 리스트 */}
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 mb-4 shadow-sm">
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

        {/* 프로그램 소개 박스 (description 첫 줄이 name 과 같으면 그 줄 제거) */}
        {(() => {
          const raw = (program.description || '').trim()
          if (!raw) return null
          const n = program.name?.trim() || ''
          let body = raw
          if (n) {
            const lines = raw.split('\n')
            if (lines[0].trim() === n) {
              body = lines.slice(1).join('\n').trim()
            }
          }
          if (!body) return null
          return (
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 mb-4">
              <p className="text-xs font-semibold text-emerald-700 mb-1.5">📋 프로그램 소개</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                {body}
              </p>
            </div>
          )
        })()}

        {/* 입장 질문 — 비공개+승인 + 질문 있을 때 */}
        {needsAnswer && (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
            <p className="text-sm font-semibold text-gray-800 mb-2">📝 {program.entry_question}</p>
            <textarea
              value={entryAnswer}
              onChange={(e) => setEntryAnswer(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="답변을 작성해주세요 (운영자가 보고 승인/거절해요)"
              disabled={isJoining}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400 disabled:bg-gray-50 resize-none"
            />
            <p className="text-[11px] text-gray-400 mt-0.5 text-right">{entryAnswer.length}/300</p>
          </div>
        )}

        {/* 안내 */}
        <p className="text-xs text-emerald-700 mb-3 p-2 bg-emerald-50 rounded-xl text-center break-keep">
          {program.invite_requires_approval
            ? '아래 버튼을 누르면 운영자 승인 대기로 신청돼요.'
            : '아래 버튼을 누르면 이 프로그램에 참여돼요.'}
        </p>

      </div>
    </div>

    {/* 하단 고정 버튼 — 둘러보기 + 참여 신청하기. 한 화면에서 스크롤 없이 노출 */}
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-4 py-3"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
    >
      <div className="max-w-md mx-auto flex gap-2">
        {program.preview_enabled && (
          <button
            type="button"
            onClick={onPreview}
            disabled={isJoining}
            className="flex-1 px-3 py-3 bg-white border-2 border-emerald-200 text-emerald-700 text-sm font-semibold rounded-xl hover:bg-emerald-50 transition disabled:opacity-50"
          >
            👀 둘러보기
          </button>
        )}
        <button
          type="button"
          onClick={() => onJoin(entryAnswer)}
          disabled={isJoining || answerMissing}
          className={`${program.preview_enabled ? 'flex-[2]' : 'flex-1'} inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-xl shadow-md disabled:from-gray-300 disabled:to-gray-300 transition`}
        >
          {isJoining && <Loader2 className="w-4 h-4 animate-spin" />}
          {isJoining
            ? (program.invite_requires_approval ? '신청 중...' : '참여 중...')
            : (program.invite_requires_approval ? '참여 신청하기' : '참여하기')}
        </button>
      </div>
    </div>
    </>
  )
}

export default JoinByCodePage
