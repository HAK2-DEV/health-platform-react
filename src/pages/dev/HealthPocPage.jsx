import { useState, useEffect } from 'react'
import { isNativePlatform, isHealthAvailable, requestStepsPermission, getTodaySteps, getDailySteps } from '../../lib/health'

// 🔧 걸음 자동연동 PoC (Health Connect / 안드) — 숨긴 개발용 화면. 라우트: /dev/health
//   목적: 실기기에서 "오늘 걸음 수"를 읽어 화면에 찍어 타당성만 검증. 홈/미션/DB 연동 없음.
//   검증 후 방향(표시·자동인증) 재결정. 이 페이지는 검증 끝나면 제거.
function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 text-[13px]">
      <span className="text-gray-500">{k}</span>
      <span className="font-bold text-gray-800 text-right break-all">{String(v)}</span>
    </div>
  )
}

export default function HealthPocPage() {
  const [avail, setAvail] = useState(null)
  const [perm, setPerm] = useState(null)
  const [steps, setSteps] = useState(null)
  const [daily, setDaily] = useState([])
  const [log, setLog] = useState([])
  const [busy, setBusy] = useState(false)

  const push = (m) => setLog((l) => [`${new Date().toLocaleTimeString()} · ${m}`, ...l].slice(0, 20))

  useEffect(() => {
    (async () => {
      push(`native=${isNativePlatform()}`)
      try { const a = await isHealthAvailable(); setAvail(a); push(`isHealthAvailable=${a}`) }
      catch (e) { push(`avail err: ${e?.message}`) }
    })()
  }, [])

  const doPerm = async () => {
    setBusy(true)
    try { const r = await requestStepsPermission(); setPerm(r?.granted); push(`permission granted=${r?.granted} ${r?.reason || ''}`) }
    catch (e) { push(`perm err: ${e?.message}`) }
    setBusy(false)
  }

  const doRead = async () => {
    setBusy(true)
    try {
      const s = await getTodaySteps(); setSteps(s); push(`todaySteps=${s}`)
      const d = await getDailySteps(7); setDaily(d); push(`daily=${d.length}일`)
    } catch (e) { push(`read err: ${e?.message}`) }
    setBusy(false)
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <h1 className="text-xl font-extrabold text-gray-900 mb-1">🩺 걸음 연동 PoC</h1>
      <p className="text-[12px] text-gray-400 mb-4">Health Connect(안드) · 실기기 검증용. 홈/DB 연동 없음.</p>

      <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4 mb-4">
        <Row k="네이티브 플랫폼" v={isNativePlatform()} />
        <Row k="Health 사용 가능" v={avail === null ? '확인 중…' : avail} />
        <Row k="권한 요청 결과" v={perm === null ? '-' : perm} />
        <Row k="오늘 걸음" v={steps === null ? '-' : `${steps.toLocaleString()} 보`} />
      </div>

      <div className="flex gap-2 mb-4">
        <button type="button" onClick={doPerm} disabled={busy}
          className="flex-1 h-11 rounded-xl bg-emerald-500 text-white text-sm font-bold disabled:opacity-50">권한 요청</button>
        <button type="button" onClick={doRead} disabled={busy}
          className="flex-1 h-11 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">걸음 읽기</button>
      </div>

      {daily.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4 mb-4">
          <p className="text-[12px] font-bold text-gray-600 mb-2">최근 7일</p>
          {daily.map((d) => <Row key={d.date} k={d.date} v={`${d.steps.toLocaleString()} 보`} />)}
        </div>
      )}

      <div className="rounded-2xl bg-gray-900 text-gray-100 p-3 font-mono text-[11px] leading-relaxed">
        <p className="text-gray-400 mb-1">log</p>
        {log.map((l, i) => <div key={i} className="break-all">{l}</div>)}
      </div>

      {!isNativePlatform() && (
        <p className="text-[12px] text-amber-600 mt-4 leading-relaxed break-keep">
          ⚠️ 웹(브라우저)에서는 항상 사용 불가로 나와요. 실제 검증은 <b>네이티브 앱(안드 실기기)</b>에서 하세요.
        </p>
      )}
    </div>
  )
}
