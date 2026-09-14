import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { HeartPulse, Loader2 } from 'lucide-react'
import Modal from '../components/common/Modal'
import { useAuth } from '../hooks/useAuth'
import { HEALTH_CONSENT, healthConsentKey, fetchHealthConsent, grantHealthConsent } from '../lib/healthConsent'

// 건강 정보(민감정보) 별도 동의 게이트 — 앱 어디서든 `await ensureHealthConsent()` 한 줄로 쓴다.
//   · 이미 동의했으면 즉시 true.
//   · 아니면 모달을 띄우고, 「동의하고 계속」= 저장 후 true, 닫기/거부 = false.
//   모달을 Provider 한 곳에만 두어 호출 측(기분 체크·설문·미션·참여)이 각자 모달을 들고 다니지 않게 한다.
const Ctx = createContext(null)

export function HealthConsentProvider({ children }) {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const queryClient = useQueryClient()

  const { data: agreed = false, isFetched } = useQuery({
    queryKey: healthConsentKey(userId),
    queryFn: () => fetchHealthConsent(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const resolverRef = useRef(null)   // 대기 중인 ensure() 의 resolve

  const settle = useCallback((value) => {
    const r = resolverRef.current
    resolverRef.current = null
    setOpen(false)
    setError(null)
    if (r) r(value)
  }, [])

  const ensureHealthConsent = useCallback(async () => {
    if (!userId) return false
    // 캐시가 아직 없으면 서버 확인 — 첫 진입에서 불필요한 모달을 띄우지 않기 위함
    const known = isFetched ? agreed : await queryClient.fetchQuery({ queryKey: healthConsentKey(userId), queryFn: () => fetchHealthConsent(userId) })
    if (known) return true
    if (resolverRef.current) settle(false)   // 중복 호출 방어
    return new Promise((resolve) => { resolverRef.current = resolve; setOpen(true) })
  }, [userId, agreed, isFetched, queryClient, settle])

  const handleAgree = async () => {
    setSaving(true); setError(null)
    try {
      await grantHealthConsent(userId)
      queryClient.setQueryData(healthConsentKey(userId), true)
      settle(true)
    } catch (e) {
      setError(e?.message || '저장에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Ctx.Provider value={{ ensureHealthConsent, healthConsented: agreed }}>
      {children}
      <Modal isOpen={open} onClose={() => settle(false)}>
        <div className="px-5 pb-5 pt-1 sm:pt-5">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <HeartPulse className="w-5 h-5 text-emerald-600" />
            </span>
            <h2 className="text-[17px] font-extrabold text-gray-900">{HEALTH_CONSENT.title}</h2>
          </div>
          <p className="text-[13px] text-gray-600 leading-relaxed break-keep mb-3">{HEALTH_CONSENT.intro}</p>
          <dl className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-[12.5px] mb-3">
            {HEALTH_CONSENT.rows.map((r) => (
              <div key={r.k} className="grid grid-cols-[64px_1fr] gap-2 px-3 py-2">
                <dt className="font-bold text-gray-500">{r.k}</dt>
                <dd className="text-gray-800 leading-relaxed break-keep">{r.v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-gray-400 leading-relaxed break-keep">
            {HEALTH_CONSENT.note} 자세한 내용은{' '}
            <Link to="/privacy" className="underline text-emerald-700" onClick={() => settle(false)}>개인정보처리방침</Link>
            {' '}2조를 확인하세요.
          </p>
          {error && <p className="text-[12px] text-red-600 mt-2">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button
              type="button"
              onClick={() => settle(false)}
              disabled={saving}
              className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-50"
            >
              동의하지 않아요
            </button>
            <button
              type="button"
              onClick={handleAgree}
              disabled={saving}
              className="flex-[1.4] h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-60"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중</> : '동의하고 계속'}
            </button>
          </div>
        </div>
      </Modal>
    </Ctx.Provider>
  )
}

export function useHealthConsent() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useHealthConsent 는 HealthConsentProvider 안에서만 사용할 수 있어요')
  return ctx
}
