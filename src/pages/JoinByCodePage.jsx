import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader2, Search } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { queryKeys, lookupInviteProgram, joinByInviteCode } from '../lib/queries'
import ProgramCover from '../components/common/ProgramCover'
import { formatKoreanDate } from '../lib/formatters'

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

  const callJoin = async () => {
    setStatus('joining')
    setErrorReason(null)
    try {
      const data = await joinByInviteCode(code.trim())
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
      <div className="px-4 pt-10 pb-6 max-w-md mx-auto text-center">
        <div className="text-5xl mb-3">🔐</div>
        <h1 className="text-xl font-medium text-gray-800 mb-2">로그인이 필요해요</h1>
        <p className="text-sm text-gray-500 mb-6">
          초대 코드로 참여하려면 먼저 로그인해주세요.
        </p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-2xl shadow-md transition"
        >
          로그인하러 가기
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-6 max-w-md mx-auto">
      <h1 className="text-2xl font-medium text-gray-800 mb-1">🎟️ 초대 코드 참여</h1>
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

      {/* 프로그램 미리보기 → 명시적 참여 */}
      {(status === 'preview' || status === 'joining') && program && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <ProgramCover
            imagePath={program.cover_image_path}
            categories={program.categories}
            name={program.name}
            variant="card"
          />
          <div className="p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-1">{program.name}</h2>
            {(() => {
              // description 첫 줄이 name 과 같으면 그 줄 제거 (중복 회피)
              const raw = (program.description || '').trim()
              if (!raw) return null
              const name = program.name?.trim() || ''
              let body = raw
              if (name) {
                const lines = raw.split('\n')
                if (lines[0].trim() === name) {
                  body = lines.slice(1).join('\n').trim()
                }
              }
              if (!body) return null
              return (
                <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap break-words leading-relaxed">
                  {body}
                </p>
              )
            })()}
            {(program.start_date || program.end_date) && (
              <p className="text-xs text-gray-500 mb-1">
                📅 {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
              </p>
            )}
            {program.max_participants && (
              <p className="text-xs text-gray-500 mb-3">정원: 최대 {program.max_participants}명</p>
            )}

            <p className="text-xs text-emerald-700 mb-3 p-2 bg-emerald-50 rounded-xl text-center">
              아래 버튼을 누르면 이 프로그램에 참여돼요.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setStatus('idle'); setProgram(null) }}
                disabled={status === 'joining'}
                className="flex-1 px-3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition disabled:opacity-50"
              >
                다른 코드
              </button>
              <button
                type="button"
                onClick={callJoin}
                disabled={status === 'joining'}
                className="flex-[2] inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-xl shadow-md disabled:from-gray-300 disabled:to-gray-300 transition"
              >
                {status === 'joining' && <Loader2 className="w-4 h-4 animate-spin" />}
                {status === 'joining' ? '참여 중...' : '참여하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 참여 완료 */}
      {status === 'joined' && joinResult && (
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
      )}
    </div>
  )
}

export default JoinByCodePage
