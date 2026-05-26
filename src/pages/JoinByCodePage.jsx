import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader2, Send } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import { queryKeys } from '../lib/queries'

// 초대 코드 가입 페이지
// 라우트: /join?program=<UUID>&code=<TEXT>
//   - URL 파라미터 있으면 자동으로 RPC 호출
//   - 없거나 실패하면 수동 입력 폼 제공
//
// 보안:
//   - 비로그인 사용자도 페이지 진입 가능 — 단 RPC 호출 전 로그인 유도
//   - join_with_invite_code RPC 는 auth.uid 없으면 not_authenticated 반환

const REASON_MESSAGES = {
  not_authenticated: '로그인이 필요해요',
  program_not_found: '프로그램을 찾을 수 없어요',
  program_not_published: '아직 게시되지 않은 프로그램이에요',
  not_invite_program: '초대 코드로 가입하는 프로그램이 아니에요',
  no_code_set: '운영자가 아직 초대 코드를 설정하지 않았어요',
  invalid_code: '초대 코드가 일치하지 않아요',
  owner_cannot_join: '본인이 운영하는 프로그램에는 참여할 수 없어요',
}

function JoinByCodePage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  const urlProgramId = searchParams.get('program') || ''
  const urlCode = searchParams.get('code') || ''

  const [programId, setProgramId] = useState(urlProgramId)
  const [code, setCode] = useState(urlCode)
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [result, setResult] = useState(null)
  const [errorReason, setErrorReason] = useState(null)
  const [autoTried, setAutoTried] = useState(false)

  const callRpc = async (pId, c) => {
    setStatus('loading')
    setErrorReason(null)
    const { data, error } = await supabase.rpc('join_with_invite_code', {
      p_program_id: pId,
      p_code: c.trim(),
    })

    if (error) {
      console.error('join RPC error:', error)
      setStatus('error')
      setErrorReason('rpc_error')
      return
    }

    if (data?.ok) {
      // 가입/재가입/이미가입 모두 성공 — 캐시 무효화 + 결과 표시
      queryClient.invalidateQueries({ queryKey: queryKeys.activePrograms(session?.user?.id) })
      queryClient.invalidateQueries({ queryKey: ['missions', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      setResult(data)
      setStatus('success')
    } else {
      setErrorReason(data?.reason || 'unknown')
      setStatus('error')
    }
  }

  // URL 파라미터 있고 로그인 됐으면 1회 자동 시도
  useEffect(() => {
    if (autoTried) return
    if (!session) return // 로그인 후 자동 시도
    if (!urlProgramId || !urlCode) return
    setAutoTried(true)
    callRpc(urlProgramId, urlCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, urlProgramId, urlCode, autoTried])

  const handleManualSubmit = (e) => {
    e.preventDefault()
    if (!programId.trim() || !code.trim()) {
      setErrorReason('missing_fields')
      setStatus('error')
      return
    }
    callRpc(programId.trim(), code.trim())
  }

  const goToProgram = () => {
    if (result?.program_id) navigate(`/programs/${result.program_id}`)
  }

  // ─── 비로그인 상태 ─────────────────────────────────────
  if (!session) {
    return (
      <div className="px-4 pt-10 pb-6 max-w-md mx-auto text-center">
        <div className="text-5xl mb-3">🔐</div>
        <h1 className="text-xl font-medium text-gray-800 mb-2">로그인이 필요해요</h1>
        <p className="text-sm text-gray-500 mb-6">
          초대 링크로 참여하려면 먼저 로그인해주세요.
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
        프로그램 코드를 입력하면 참여자가 돼요.
      </p>

      {/* 로딩 중 */}
      {status === 'loading' && (
        <div className="bg-gray-50/60 p-8 rounded-2xl text-center">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-600">초대 코드를 확인하는 중...</p>
        </div>
      )}

      {/* 성공 */}
      {status === 'success' && result && (
        <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="text-base font-medium text-emerald-800 mb-1">
            {result.already_joined ? '이미 참여 중이에요' : result.rejoined ? '다시 참여 완료' : '참여 완료!'}
          </p>
          <p className="text-sm text-emerald-700 mb-5 break-words">
            {result.program_name}
          </p>
          <button
            type="button"
            onClick={goToProgram}
            className="inline-flex items-center justify-center px-6 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-full shadow-md transition"
          >
            프로그램으로 이동
          </button>
        </div>
      )}

      {/* 실패 또는 폼 입력 */}
      {(status === 'idle' || status === 'error') && (
        <>
          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-center mb-4">
              <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
              <p className="text-sm text-red-700">
                {REASON_MESSAGES[errorReason] || '참여에 실패했어요. 다시 시도해주세요.'}
              </p>
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                프로그램 ID
              </label>
              <input
                type="text"
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                placeholder="운영자가 알려준 프로그램 ID"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                초대 코드
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="예: HEALTH2026"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={!programId.trim() || !code.trim()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white font-medium rounded-2xl shadow-md disabled:from-gray-300 disabled:to-gray-300 transition"
            >
              <Send className="w-4 h-4" />
              참여하기
            </button>
          </form>

          <p className="text-[11px] text-gray-400 mt-4 text-center leading-relaxed">
            운영자가 보낸 초대 링크를 클릭하면 자동으로 입력돼요.<br />
            링크 형식: <code className="text-gray-500">/join?program=ID&amp;code=XYZ</code>
          </p>
        </>
      )}
    </div>
  )
}

export default JoinByCodePage
