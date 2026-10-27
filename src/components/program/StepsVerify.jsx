import { useEffect, useState } from 'react'
import { Browser } from '@capacitor/browser'
import { ChevronLeft, RefreshCw, Check } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useHealthConsent } from '../../contexts/HealthConsentContext'
import StepsDisclosure from './StepsDisclosure'
import {
  isNativePlatform, getStepStatus, requestStepPermission, startStepWorker, getTodayStepCount, openBatterySettings, openNotificationSettings,
} from '../../lib/stepCounter'
import { syncStepWorker } from '../../lib/stepWorkerSync'

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.healthplatform.app'

// 걸음 데이터 사용 안내(고지)는 StepsDisclosure 컴포넌트 — 걷기 홈 첫 방문 시트와 같은 내용

// 걸음 자동 인증 — 앱의 걸음 일꾼(폰 센서 + 포그라운드 서비스)이 센 오늘 걸음으로 목표 달성 시 자동 인증. (2026-10-26 자체 만보기)
//   웹(PWA)에서는 걸음 센서를 못 쓰니 안내만(앱 유도). 사진·수동 불필요.
//   단계: idle → loading → (update | nosensor | disclose → noperm) → ready
//     update   = 플러그인이 없는 옛 앱(v52 이하) → Play 업데이트 안내
//     nosensor = 걸음 센서가 없는 폰
//     disclose = 권한이 아직 없음 → 걸음 데이터 사용 안내 → 민감정보 동의(최초 1회) → 신체활동 권한 창 → 일꾼 켜기
//   사진·소감(2026-10-27): 운영자가 켠 입력만 목표 달성 뒤에 보인다. 사진 칸은 MissionVerifyPage 가 만들어 photoSlot 으로 준다
//   (HEIC 변환·크롭·압축·업로드를 일반 인증과 같은 길로). 필수로 정한 입력이 비면 인증 버튼이 잠긴다.
export default function StepsVerify({
  mission, submitting, onSubmit, onCancel, doneToday = false,
  noteText = '', onNoteChange = null,
  photoSlot = null, hasPhoto = false,
  contextText = '',
}) {
  const noteAllowed = !!mission?.requires_note && typeof onNoteChange === 'function'   // 소감 켜진 걸음 미션 — 적고 한 번 눌러 인증
  const noteRequired = noteAllowed && mission?.note_required !== false                 // 운영자가 「필수」로 정했으면 비우고는 못 낸다
  const noteMissing = noteRequired && !noteText.trim()
  const photoAllowed = !!mission?.requires_image && !!photoSlot
  const photoMissing = photoAllowed && mission?.image_required !== false && !hasPhoto
  const inputMissing = noteMissing || photoMissing
  const missingLabel = photoMissing && noteMissing ? '사진과 소감을 넣으면 인증할 수 있어요' : photoMissing ? '사진을 넣으면 인증할 수 있어요' : '소감을 적으면 인증할 수 있어요'
  const goal = mission.step_goal || 8000
  const native = isNativePlatform()
  const { session } = useAuth()
  const { ensureHealthConsent } = useHealthConsent()
  const [phase, setPhase] = useState('idle')   // idle | loading | disclose | ready | noperm | nosensor | update
  const [steps, setSteps] = useState(null)
  const [batteryOptimized, setBatteryOptimized] = useState(false)
  const [notifDenied, setNotifDenied] = useState(false)   // 안드13+ 알림 권한 거절 — 일꾼은 돌지만 알림 한 줄이 안 보임
  const [err, setErr] = useState('')

  // 일꾼을 참여 상태에 맞추고(걷기 테마·살아 있는 걸음 미션이 있으면 켜진다) 오늘 걸음을 읽는다.
  const ensureWorkerAndRead = async () => {
    const userId = session?.user?.id
    const r = userId ? await syncStepWorker(userId) : { kind: 'off' }
    if (r.kind === 'off' && userId) {
      // 이 미션의 프로그램이 오늘 운영 중이 아니거나(종료·시작 전) 걸음 미션이 살아 있지 않음 — 이 미션만으로 임시로 켠다
      await startStepWorker({ goal, activeDays: [], programName: mission.programs?.name || '' })
    }
    setBatteryOptimized(!!r.batteryOptimized)
    setNotifDenied(r.notifications === 'denied')
    const s = await getTodayStepCount()
    setSteps(s ?? 0)
    setPhase('ready')
  }

  // 「걸음 불러오기」 — 상태를 보고 다음 단계를 고른다. 권한이 이미 있으면 안내 없이 바로 읽는다.
  const load = async () => {
    setErr('')
    if (!native) return
    setPhase('loading')
    try {
      const st = await getStepStatus()
      if (st.kind === 'plugin_missing') { setPhase('update'); return }
      if (st.kind === 'no_sensor') { setPhase('nosensor'); return }
      if (st.kind === 'noperm') { setPhase('disclose'); return }
      if (st.kind !== 'ready') { setErr('걸음을 불러오지 못했어요'); setPhase('idle'); return }
      await ensureWorkerAndRead()
    } catch (e) {
      setErr(e?.message || '걸음을 불러오지 못했어요')
      setPhase('idle')
    }
  }

  // 안내를 읽고 「계속」 — 민감정보 동의(없으면 모달) → 신체활동 권한 창 → 일꾼 켜기 → 읽기.
  const proceed = async () => {
    setErr('')
    if (!(await ensureHealthConsent())) { setPhase('idle'); return }
    setPhase('loading')
    try {
      const p = await requestStepPermission()
      if (!p.granted) { setPhase('noperm'); return }
      setNotifDenied(p.notifications === 'denied')
      await ensureWorkerAndRead()
    } catch (e) {
      // 권한은 받았는데 읽기·동기화가 실패(네트워크 등) — 권한 안내가 아니라 다시 시도로
      setErr(e?.message || '걸음을 불러오지 못했어요')
      setPhase('idle')
    }
  }

  // 화면이 열리면 바로 시도 — 권한이 있으면 숫자가 먼저 보이고, 없으면 안내 단계가 뜬다.
  //   (setTimeout 0: 렌더 직후 한 틱 뒤에 — 효과 안에서 바로 setState 하지 않는다는 린트 규칙)
  useEffect(() => {
    if (!native) return undefined
    const t = setTimeout(() => { load() }, 0)
    return () => clearTimeout(t)
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const openPlayStore = () => { Browser.open({ url: PLAY_URL }).catch(() => {}) }

  const reached = steps != null && steps >= goal
  const pct = steps != null ? Math.min(100, Math.round((steps / goal) * 100)) : 0
  const remaining = steps != null ? Math.max(0, goal - steps) : goal

  return (
    <div className="-mx-4 -mt-2 min-h-[100dvh] flex flex-col" style={{ background: 'linear-gradient(180deg,#f0fdf9,#f8fbf9)' }}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 flex-shrink-0">
        <button type="button" onClick={onCancel} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0"><ChevronLeft className="w-5 h-5 text-gray-700" /></button>
        <span className="text-[14px] font-bold text-gray-700 truncate">{mission.title}</span>
      </div>
      {contextText && (
        <p className="px-4 -mt-1 flex items-center gap-1.5 text-xs text-gray-500 min-w-0 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="truncate">{contextText}</span>
        </p>
      )}

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center">
        {phase === 'disclose' ? (
          <div className="w-full max-w-sm"><StepsDisclosure /></div>
        ) : (
          <>
            {/* 진행 링 */}
            <div className="relative w-52 h-52 mb-5">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#e6f4ee" strokeWidth="9" />
                <circle cx="50" cy="50" r="44" fill="none" stroke={reached ? '#10b981' : '#34d399'} strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 276.5} 276.5`} style={{ transition: 'stroke-dasharray .6s ease' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <img src={reached || doneToday ? '/icons/action/complete.png' : '/icons/running/shoe.png'} alt="" className="w-8 h-8 object-contain mb-1" />
                <p className="text-[30px] font-extrabold text-gray-900 tabular-nums leading-none">{steps != null ? steps.toLocaleString() : '—'}</p>
                <p className="text-[12px] text-gray-400 mt-1">/ {goal.toLocaleString()}보</p>
              </div>
            </div>

            {phase === 'ready' ? (
              doneToday ? (
                <>
                  <p className="text-[17px] font-extrabold text-emerald-700">오늘 걸음 인증 완료 ✅</p>
                  <p className="text-[13px] text-gray-500 mt-1">오늘 {steps.toLocaleString()}보. 이미 인증됐어요. 내일 또 걸어요.</p>
                </>
              ) : reached ? (
                <>
                  <p className="text-[17px] font-extrabold text-emerald-700">오늘 목표를 채웠어요</p>
                  <p className="text-[13px] text-gray-500 mt-1">오늘 {steps.toLocaleString()}보. {photoAllowed || noteAllowed ? (inputMissing ? '남기고 인증해요.' : '남기고 인증할까요? 비워도 돼요.') : '인증할까요?'}</p>
                  {photoAllowed && <div className="mt-3 w-full max-w-sm text-left">{photoSlot}</div>}
                  {noteAllowed && (
                    <textarea value={noteText} onChange={(e) => onNoteChange(e.target.value)} disabled={submitting} rows={2} maxLength={200}
                      placeholder={noteRequired ? '오늘 걷고 느낀 점 (필수)' : '오늘 걷고 느낀 점 (선택)'}
                      className="mt-3 w-full max-w-sm min-w-0 px-3 py-2.5 text-sm text-left border-2 border-gray-200 rounded-xl bg-white focus:outline-none focus:border-emerald-500 resize-none" />
                  )}
                </>
              ) : (
                <>
                  <p className="text-[17px] font-extrabold text-gray-800">{remaining.toLocaleString()}보 더 걸으면 돼요</p>
                  <p className="text-[13px] text-gray-500 mt-1">앱이 걸음을 세고 있어요. {noteAllowed ? '목표를 채우면 여기서 소감 적고 인증해요.' : '목표를 채우면 자동으로 인증돼요.'}</p>
                </>
              )
            ) : phase === 'loading' ? (
              <p className="text-[14px] text-gray-500">걸음 데이터를 불러오는 중…</p>
            ) : phase === 'update' ? (
              <p className="text-[13.5px] text-gray-600 leading-relaxed break-keep">걸음 자동 인증은 <b>새 버전 앱</b>에서 쓸 수 있어요.<br />Play 스토어에서 도담을 업데이트한 뒤 다시 열어 주세요.</p>
            ) : phase === 'nosensor' ? (
              <p className="text-[13.5px] text-gray-600 leading-relaxed break-keep">이 폰에는 걸음 센서가 없어서 자동 인증을 쓸 수 없어요.<br />운영자에게 다른 인증 방법을 문의해 주세요.</p>
            ) : phase === 'noperm' ? (
              <p className="text-[13.5px] text-gray-600 leading-relaxed break-keep">「신체활동」 권한이 필요해요.<br />여러 번 거절했다면 설정 › 앱 권한에서 직접 허용해 주세요.</p>
            ) : !native ? (
              <p className="text-[13.5px] text-gray-600 leading-relaxed break-keep">📱 <b>안드로이드 앱</b>에서 걸음이 <b>자동 인증</b>돼요.<br />앱을 설치하면 폰이 걸음을 세고, 목표를 넘으면 사진 없이 인증됩니다.</p>
            ) : (
              <p className="text-[13.5px] text-gray-600 leading-relaxed break-keep">오늘 걸음으로 <b className="text-emerald-600">{goal.toLocaleString()}보</b> 목표를 채우면 자동 인증돼요.</p>
            )}
            {phase === 'ready' && notifDenied && (
              <button type="button" onClick={openNotificationSettings} className="mt-3 text-[12px] text-gray-500 underline underline-offset-2 break-keep">
                알림을 허용하면 오늘 걸음이 알림 한 줄에 보여요 · 알림 설정 열기
              </button>
            )}
            {phase === 'ready' && batteryOptimized && (
              <button type="button" onClick={openBatterySettings} className="mt-3 text-[12px] text-gray-500 underline underline-offset-2 break-keep">
                폰이 걸음 세기를 멈추지 않게 배터리 최적화 끄기
              </button>
            )}
          </>
        )}
        {err && <p className="text-[12px] text-rose-500 mt-2">{err}</p>}
      </div>

      {/* 하단 액션 — 상태마다 주요 버튼 하나, 보조는 글자 버튼(§13-13) */}
      <div className="px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 flex-shrink-0">
        {phase === 'disclose' ? (
          <>
            <button type="button" onClick={proceed}
              className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-[15px] font-bold">
              동의하고 권한 허용하기
            </button>
            <button type="button" onClick={() => setPhase('idle')}
              className="w-full mt-2 py-2.5 text-[13px] font-semibold text-gray-500 hover:text-gray-700">
              나중에 할게요
            </button>
          </>
        ) : native && phase === 'ready' && doneToday ? (
          <button type="button" onClick={onCancel}
            className="w-full py-3.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-[15px] font-bold">확인</button>
        ) : native && phase === 'ready' && reached ? (
          <button type="button" disabled={submitting || inputMissing} onClick={() => onSubmit(steps)}
            className="w-full h-13 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-[15px] font-bold inline-flex items-center justify-center gap-1.5">
            <Check className="w-5 h-5" />{submitting ? '인증 중…' : inputMissing ? missingLabel : (photoAllowed || noteAllowed) ? '인증하기' : '자동 인증하기'}
          </button>
        ) : phase === 'update' ? (
          <button type="button" onClick={openPlayStore}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-[15px] font-bold">
            Play 스토어에서 업데이트
          </button>
        ) : phase === 'nosensor' || !native ? (
          <button type="button" onClick={onCancel}
            className="w-full py-3.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-[15px] font-bold">확인</button>
        ) : phase === 'noperm' ? (
          <button type="button" onClick={proceed}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-[15px] font-bold inline-flex items-center justify-center gap-1.5">
            <RefreshCw className="w-4 h-4" />권한 허용하고 불러오기
          </button>
        ) : (
          <button type="button" disabled={phase === 'loading'} onClick={load}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-[15px] font-bold inline-flex items-center justify-center gap-1.5">
            <RefreshCw className={`w-4 h-4 ${phase === 'loading' ? 'animate-spin' : ''}`} />
            {phase === 'idle' ? '걸음 불러오기' : '다시 불러오기'}
          </button>
        )}
      </div>
    </div>
  )
}
