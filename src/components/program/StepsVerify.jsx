import { useState } from 'react'
import { ChevronLeft, Footprints, RefreshCw, Check } from 'lucide-react'
import { isNativePlatform, isHealthAvailable, requestStepsPermission, getTodaySteps } from '../../lib/health'

// 걸음 자동 인증 — 네이티브(Android=Health Connect, iOS=HealthKit) 걸음으로 목표 달성 시 자동 인증.
//   웹(PWA)에서는 건강 API가 없어 안내만(네이티브 앱 유도). 사진·수동 불필요.
export default function StepsVerify({ mission, submitting, onSubmit, onCancel }) {
  const goal = mission.step_goal || 8000
  const native = isNativePlatform()
  const [phase, setPhase] = useState('idle')   // idle | loading | ready | noperm | unavailable
  const [steps, setSteps] = useState(null)
  const [err, setErr] = useState('')

  const load = async () => {
    setErr('')
    if (!native) return
    setPhase('loading')
    try {
      const avail = await isHealthAvailable()
      if (!avail) { setPhase('unavailable'); return }
      const p = await requestStepsPermission()
      if (!p?.granted) { setPhase('noperm'); return }
      const s = await getTodaySteps()
      setSteps(s ?? 0)
      setPhase('ready')
    } catch (e) {
      setErr(e?.message || '걸음을 불러오지 못했어요')
      setPhase('idle')
    }
  }

  const reached = steps != null && steps >= goal
  const pct = steps != null ? Math.min(100, Math.round((steps / goal) * 100)) : 0
  const remaining = steps != null ? Math.max(0, goal - steps) : goal

  return (
    <div className="-mx-4 -mt-2 min-h-[100dvh] flex flex-col" style={{ background: 'linear-gradient(180deg,#f0fdf9,#f8fbf9)' }}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 flex-shrink-0">
        <button type="button" onClick={onCancel} className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0"><ChevronLeft className="w-5 h-5 text-gray-700" /></button>
        <span className="text-[14px] font-bold text-gray-700 truncate">{mission.title}</span>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center">
        {/* 진행 링 */}
        <div className="relative w-52 h-52 mb-5">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#e6f4ee" strokeWidth="9" />
            <circle cx="50" cy="50" r="44" fill="none" stroke={reached ? '#10b981' : '#34d399'} strokeWidth="9" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 276.5} 276.5`} style={{ transition: 'stroke-dasharray .6s ease' }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Footprints className={`w-7 h-7 mb-1 ${reached ? 'text-emerald-500' : 'text-emerald-400'}`} />
            <p className="text-[30px] font-extrabold text-gray-900 tabular-nums leading-none">{steps != null ? steps.toLocaleString() : '—'}</p>
            <p className="text-[12px] text-gray-400 mt-1">/ {goal.toLocaleString()}보</p>
          </div>
        </div>

        {phase === 'ready' ? (
          reached ? (
            <>
              <p className="text-[17px] font-extrabold text-emerald-700">목표 달성! 🎉</p>
              <p className="text-[13px] text-gray-500 mt-1">오늘 {steps.toLocaleString()}보 걸었어요. 인증할까요?</p>
            </>
          ) : (
            <>
              <p className="text-[17px] font-extrabold text-gray-800">{remaining.toLocaleString()}보 더 걸으면 돼요</p>
              <p className="text-[13px] text-gray-500 mt-1">목표를 채우고 다시 불러오면 자동 인증돼요.</p>
            </>
          )
        ) : phase === 'loading' ? (
          <p className="text-[14px] text-gray-500">걸음 데이터를 불러오는 중…</p>
        ) : phase === 'unavailable' ? (
          <p className="text-[13.5px] text-gray-600 leading-relaxed break-keep">Health Connect(삼성헬스 연동)를 사용할 수 없어요.<br />설정에서 Health Connect를 켜고 삼성헬스와 연결해 주세요.</p>
        ) : phase === 'noperm' ? (
          <p className="text-[13.5px] text-gray-600 leading-relaxed break-keep">걸음 읽기 권한이 필요해요.<br />아래 버튼을 눌러 권한을 허용해 주세요.</p>
        ) : !native ? (
          <p className="text-[13.5px] text-gray-600 leading-relaxed break-keep">📱 <b>안드로이드 앱</b>에서 걸음이 <b>자동 인증</b>돼요.<br />앱을 설치하고 삼성헬스와 연결하면 사진 없이 인증됩니다.</p>
        ) : (
          <p className="text-[13.5px] text-gray-600 leading-relaxed break-keep">오늘 걸음으로 <b className="text-emerald-600">{goal.toLocaleString()}보</b> 목표를 채우면 자동 인증돼요.</p>
        )}
        {err && <p className="text-[12px] text-rose-500 mt-2">{err}</p>}
      </div>

      {/* 하단 액션 */}
      <div className="px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 flex-shrink-0">
        {native && phase === 'ready' && reached ? (
          <button type="button" disabled={submitting} onClick={() => onSubmit(steps)}
            className="w-full h-13 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-[15px] font-bold inline-flex items-center justify-center gap-1.5">
            <Check className="w-5 h-5" />{submitting ? '인증 중…' : '자동 인증하기'}
          </button>
        ) : native ? (
          <button type="button" disabled={phase === 'loading'} onClick={load}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-[15px] font-bold inline-flex items-center justify-center gap-1.5">
            <RefreshCw className={`w-4 h-4 ${phase === 'loading' ? 'animate-spin' : ''}`} />
            {phase === 'idle' ? '걸음 불러오기' : phase === 'noperm' ? '권한 허용하고 불러오기' : '다시 불러오기'}
          </button>
        ) : (
          <button type="button" onClick={onCancel}
            className="w-full py-3.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-600 text-[15px] font-bold">확인</button>
        )}
      </div>
    </div>
  )
}
