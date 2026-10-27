import { useCallback, useEffect, useMemo, useState } from 'react'
import { Browser } from '@capacitor/browser'
import { ChevronRight } from 'lucide-react'
import Modal from '../common/Modal'
import StepsDisclosure from './StepsDisclosure'
import { useAuth } from '../../hooks/useAuth'
import { useHealthConsent } from '../../contexts/HealthConsentContext'
import { checkMissionToday } from '../../lib/formatters'
import { isNativePlatform, getStepStatus, requestStepPermission, getTodayStepCount, getDailyStepCounts } from '../../lib/stepCounter'
import { syncStepWorker, missionDays } from '../../lib/stepWorkerSync'

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.healthplatform.app'
const DOW = ['일', '월', '화', '수', '목', '금', '토']
const seenKey = (programId) => `dodam-steps-setup-seen-${programId}`
const ls = {
  get(k) { try { return localStorage.getItem(k) } catch { return null } },
  set(k, v) { try { localStorage.setItem(k, v) } catch { /* 무시 */ } },
}
// 'YYYY-MM-DD' → ISO 요일(1=월 … 7=일)
const isoDow = (d) => { const w = new Date(`${d}T00:00:00Z`).getUTCDay(); return w === 0 ? 7 : w }
// 걷기 프로그램 홈 맨 위 「오늘 걸음」 카드 (2026-10-27, 본인 결정: 홈 상단 작게 + 누르면 미션 화면 크게).
//   ① 참여 후 이 프로그램을 «처음» 열면 걸음 고지 시트를 한 번 띄운다 — 걸음은 허용한 순간부터만 세지므로 늦게 물을수록 걸음이 빠진다.
//      「나중에」면 다시 자동으로 띄우지 않고, 카드의 「걸음 세기 시작」이나 미션 화면에서 다시 할 수 있다.
//   ② 허용 뒤엔 오늘 걸음/목표 + 최근 7일 막대. 기준은 어제의 나와 내 약속 — 남과 비교하는 숫자는 없다. 인증 없는 요일은 회색.
//   웹(PWA)·옛 앱·센서 없는 폰은 각자 한 줄 안내. (웹의 Play 설치 링크는 내부 테스트 뒤에 — 메모 project_pwa_play_install_link_todo)
export default function WalkingTodayCard({ programId, stepMissions = [], todayCounts = {}, onOpenMission }) {
  const native = isNativePlatform()
  const { session } = useAuth()
  const userId = session?.user?.id ?? null
  const { ensureHealthConsent } = useHealthConsent()
  const [status, setStatus] = useState(null)        // getStepStatus() 결과
  const [today, setToday] = useState(null)
  const [daily, setDaily] = useState([])
  const [sheetOpen, setSheetOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  // 오늘 기준 미션 — 오늘 인증하는 걸음 미션 중 목표가 가장 큰 것, 없으면(쉬는 날) 첫 걸음 미션
  const todays = useMemo(() => stepMissions.filter((m) => checkMissionToday(m).active), [stepMissions])
  const target = useMemo(() => (todays.length ? [...todays].sort((a, b) => (b.step_goal || 0) - (a.step_goal || 0))[0] : stepMissions[0]) || null, [todays, stepMissions])
  const restDay = stepMissions.length > 0 && todays.length === 0
  const goal = Number(target?.step_goal) || 0
  const doneToday = !!target && !restDay && (todayCounts[target.id]?.total || 0) > 0
  const activeDows = useMemo(() => { const s = new Set(); stepMissions.forEach((m) => missionDays(m).forEach((d) => s.add(d))); return s }, [stepMissions])

  const refresh = useCallback(async () => {
    if (!native) return
    const st = await getStepStatus()
    setStatus(st)
    if (st.kind === 'ready') {
      const [t, d] = await Promise.all([getTodayStepCount(), getDailyStepCounts(7)])
      setToday(t ?? 0)
      setDaily(d)
    }
    return st
  }, [native])

  useEffect(() => {
    if (!native) return undefined
    let alive = true
    // setTimeout 0: 렌더 직후 한 틱 뒤에 — 효과 안에서 바로 setState 하지 않는다는 린트 규칙
    const t = setTimeout(() => {
      refresh().then((st) => {
        if (!alive || !st) return
        if (st.kind === 'noperm' && !ls.get(seenKey(programId))) { ls.set(seenKey(programId), '1'); setSheetOpen(true) }   // 참여 후 첫 방문 1회
      })
    }, 0)
    const onVis = () => { if (document.visibilityState === 'visible') refresh() }
    const onAuto = () => refresh()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('dodam:steps-auto-verified', onAuto)
    return () => { alive = false; clearTimeout(t); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('dodam:steps-auto-verified', onAuto) }
  }, [native, programId, refresh])

  // 고지 → 민감정보 동의(최초 1회) → 신체활동·알림 권한 → 일꾼 켜기
  const start = async () => {
    setSheetOpen(false)
    if (!(await ensureHealthConsent())) return
    setBusy(true)
    try {
      const p = await requestStepPermission()
      if (p.granted && userId) await syncStepWorker(userId)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const open = () => { if (target) onOpenMission?.(target.id) }
  const kind = !native ? 'web' : status?.kind || 'loading'
  const reached = goal > 0 && (today ?? 0) >= goal
  const pct = goal > 0 && today != null ? Math.min(100, Math.round((today / goal) * 100)) : 0
  const maxBar = Math.max(goal, ...daily.map((d) => d.steps || 0), 1)
  const todayKey = daily.length ? daily[daily.length - 1].date : null

  // 카드 머리 — 3D 운동화 + 「오늘 걸음」 + 오른쪽 목표/쉬는 날
  const head = (
    <div className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
        <img src="/icons/running/shoe.png" alt="" className="w-6 h-6 object-contain" />
      </span>
      <p className="text-base font-semibold text-gray-800 flex-1 min-w-0">오늘 걸음</p>
      {kind === 'ready' && (
        <span className={`text-xs font-semibold rounded-full px-2.5 py-1 flex-shrink-0 ${restDay ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>
          {restDay ? '쉬는 날' : doneToday ? '오늘 인증 완료' : `목표 ${goal.toLocaleString()}보`}
        </span>
      )}
    </div>
  )

  let body
  if (kind === 'ready') {
    const line = restDay ? '오늘은 인증이 없는 날이에요. 걸음은 그대로 쌓여요.'
      : doneToday ? '오늘 걸음 인증을 마쳤어요. 내일 또 걸어요.'
      : reached ? '오늘 목표를 채웠어요. 눌러서 인증해요.'
      : `${Math.max(0, goal - (today ?? 0)).toLocaleString()}보 더 걸으면 돼요`
    body = (
      <>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-gray-800 tabular-nums">{(today ?? 0).toLocaleString()}</span>
          <span className="text-xs text-gray-500">{goal > 0 && !restDay ? `/ ${goal.toLocaleString()}보` : '보'}</span>
        </div>
        {!restDay && goal > 0 && (
          <div className="mt-2 h-2 rounded-full bg-emerald-50 overflow-hidden">
            <div className={`h-full rounded-full ${reached ? 'bg-emerald-500' : 'bg-emerald-400'}`} style={{ width: `${pct}%`, transition: 'width .3s ease-out' }} />
          </div>
        )}
        <p className="mt-2 text-sm text-gray-600 break-keep">{line}</p>
        {daily.length === 7 && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1.5">최근 7일</p>
            <div className="grid grid-cols-7 gap-1.5 items-end h-10">
              {daily.map((d) => {
                const isToday = d.date === todayKey
                const rest = activeDows.size > 0 && !activeDows.has(isoDow(d.date))
                const h = d.steps > 0 ? Math.max(8, Math.round((d.steps / maxBar) * 100)) : 0
                return (
                  <div key={d.date} className="h-full flex items-end">
                    <div className={`w-full rounded-t-[5px] rounded-b-[2px] ${isToday ? 'bg-emerald-600' : rest ? 'bg-gray-200' : d.steps >= goal && goal > 0 ? 'bg-emerald-400' : 'bg-emerald-200'}`}
                      style={{ height: h ? `${h}%` : '4px' }} title={`${d.date} · ${d.steps.toLocaleString()}보`} />
                  </div>
                )
              })}
            </div>
            <div className="grid grid-cols-7 gap-1.5 mt-1 text-[11px] text-center tabular-nums">
              {daily.map((d) => {
                const w = new Date(`${d.date}T00:00:00Z`).getUTCDay()
                return <span key={d.date} className={d.date === todayKey ? 'font-bold text-emerald-700' : 'text-gray-400'}>{DOW[w]}</span>
              })}
            </div>
          </div>
        )}
      </>
    )
  } else if (kind === 'noperm') {
    body = (
      <>
        <p className="mt-2 text-sm text-gray-600 break-keep">앱이 걸음을 세려면 한 번 허용이 필요해요. 허용한 때부터 세요.</p>
        <button type="button" disabled={busy} onClick={(e) => { e.stopPropagation(); setSheetOpen(true) }}
          className="mt-3 w-full py-3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-sm font-bold disabled:opacity-60">
          {busy ? '켜는 중…' : '걸음 세기 시작'}
        </button>
      </>
    )
  } else if (kind === 'plugin_missing') {
    body = (
      <>
        <p className="mt-2 text-sm text-gray-600 break-keep">걸음은 새 버전 앱에서 세져요. Play 스토어에서 도담을 업데이트해 주세요.</p>
        <button type="button" onClick={(e) => { e.stopPropagation(); Browser.open({ url: PLAY_URL }).catch(() => {}) }}
          className="mt-3 w-full py-3 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-sm font-bold">Play 스토어에서 업데이트</button>
      </>
    )
  } else if (kind === 'no_sensor') {
    body = <p className="mt-2 text-sm text-gray-600 break-keep">이 폰에는 걸음 센서가 없어 걸음을 셀 수 없어요. 운영자에게 다른 인증 방법을 물어봐 주세요.</p>
  } else if (kind === 'web') {
    body = <p className="mt-2 text-sm text-gray-600 break-keep">걸음은 안드로이드 앱이 세요. 앱으로 참여하면 이 자리에 오늘 걸음이 보여요.</p>
  } else {
    body = <div className="mt-3 h-16 rounded-xl bg-gray-50 animate-pulse" />
  }

  const tappable = kind === 'ready' && !!target
  return (
    <>
      <div role={tappable ? 'button' : undefined} tabIndex={tappable ? 0 : undefined}
        onClick={tappable ? open : undefined} onKeyDown={tappable ? (e) => { if (e.key === 'Enter') open() } : undefined}
        className={`bg-white border border-gray-100 rounded-card-lg shadow-soft p-4 ${tappable ? 'cursor-pointer hover:shadow-elevated transition-shadow' : ''}`}>
        {head}
        {body}
        {tappable && (
          <p className="mt-3 flex items-center justify-end gap-0.5 text-xs font-semibold text-emerald-700">
            {reached && !doneToday && !restDay ? '인증하러 가기' : '자세히 보기'} <ChevronRight className="w-3.5 h-3.5" />
          </p>
        )}
      </div>

      <Modal isOpen={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="px-5 pb-5 pt-1 sm:pt-5">
          <StepsDisclosure onPolicyClick={() => setSheetOpen(false)} />
          <div className="mt-4 flex flex-col gap-1.5">
            <button type="button" onClick={start}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 text-white text-[15px] font-bold">
              동의하고 걸음 세기 시작
            </button>
            <button type="button" onClick={() => setSheetOpen(false)} className="w-full py-2.5 text-[13px] font-semibold text-gray-500">나중에 할게요</button>
          </div>
        </div>
      </Modal>
    </>
  )
}
