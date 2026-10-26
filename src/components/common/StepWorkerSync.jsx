import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { App as CapApp } from '@capacitor/app'
import { useAuth } from '../../hooks/useAuth'
import { isNativePlatform, stopStepWorker } from '../../lib/stepCounter'
import { syncStepWorker, autoVerifyStepMissions } from '../../lib/stepWorkerSync'
import { queryKeys } from '../../lib/queries'

// 걸음 일꾼 동기화 — 화면 없는 컴포넌트 (2026-10-26, 자체 만보기 1차).
//   로그인한 사용자가 바뀌거나 앱이 앞으로 돌아올 때(resume) 걷기 프로그램 참여 상태에 맞춰 일꾼을 켜고 끄고,
//   오늘 인증하는 걸음 미션이 목표를 넘겼으면 자동으로 인증을 낸다. 로그아웃하면 일꾼을 끈다(검토 10-26).
//   네이티브 앱에서만 일하고 웹에선 아무것도 안 한다.
//   ⚠️ 중복 실행 방지: 한 번에 하나만 돌고, 30초 안에 다시 부르면 건너뛴다(앱 전환이 잦을 때 쿼리 폭주 방지).
export default function StepWorkerSync() {
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const queryClient = useQueryClient()
  const busyRef = useRef(false)
  const lastRef = useRef(0)
  const prevUserRef = useRef(null)

  useEffect(() => {
    if (!isNativePlatform()) return undefined
    // 로그아웃·계정 전환 — 이전 사용자의 일꾼(상시 알림)을 끈다
    if (prevUserRef.current && prevUserRef.current !== userId) stopStepWorker().catch(() => {})
    prevUserRef.current = userId
    if (!userId) return undefined
    let alive = true
    const run = async (force) => {
      if (busyRef.current) return
      if (!force && Date.now() - lastRef.current < 30_000) return
      busyRef.current = true
      try {
        const r = await syncStepWorker(userId)
        if (!alive) return
        lastRef.current = Date.now()
        // start() 직후엔 서비스가 아직 안 떠서 running=false 일 수 있다 — enabled 면 켠 것으로 본다
        if ((r?.kind === 'running' || r?.enabled) && r.stepMissions?.length) {
          const done = await autoVerifyStepMissions(userId, r.stepMissions, r.programs)
          if (done.length) {
            queryClient.invalidateQueries({ queryKey: queryKeys.todayCounts(userId) })
            queryClient.invalidateQueries({ queryKey: ['verifications'] })
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dodam:steps-auto-verified', { detail: done }))
          }
        }
      } catch (e) {
        console.warn('[걸음 일꾼 동기화]', e?.message || e)
      } finally {
        busyRef.current = false
      }
    }
    run(true)
    const onVis = () => { if (document.visibilityState === 'visible') run(false) }
    document.addEventListener('visibilitychange', onVis)
    const sub = CapApp.addListener('resume', () => run(false))
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVis)
      sub.then((h) => h.remove()).catch(() => {})
    }
  }, [userId, queryClient])

  return null
}
