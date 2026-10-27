import { useState, useEffect } from 'react'
import { isNativePlatform, getStepStatus, requestStepPermission, startStepWorker, stopStepWorker, getTodayStepCount, getDailyStepCounts, openBatterySettings, debugAddSteps } from '../../lib/stepCounter'
import StepsVerify from '../../components/program/StepsVerify'
import WalkingTodayCard from '../../components/program/WalkingTodayCard'

// 🔧 걸음 일꾼 시험 화면 (자체 만보기, 2026-10-26) — 숨긴 개발용. 라우트: /dev/health (dev 빌드에만 포함)
//   목적: 로그인·프로그램 없이 네이티브 일꾼(권한 → 켜기 → 알림 → 오늘 걸음)을 돌려 본다.
//   에뮬레이터엔 걸음 센서가 없어 「+50걸음」(디버그 전용)으로 숫자를 흉내 낸다. 실제 걸음은 갤럭시 실기.
function Row({ k, v }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 text-[13px]">
      <span className="text-gray-500">{k}</span>
      <span className="font-bold text-gray-800 text-right break-all">{String(v)}</span>
    </div>
  )
}

const Btn = ({ onClick, children, tone = 'emerald' }) => (
  <button type="button" onClick={onClick}
    className={`h-11 rounded-xl text-sm font-bold ${tone === 'emerald' ? 'bg-emerald-500 text-white' : tone === 'dark' ? 'bg-emerald-600 text-white' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
    {children}
  </button>
)

export default function HealthPocPage() {
  const [status, setStatus] = useState(null)
  const [today, setToday] = useState(null)
  const [daily, setDaily] = useState([])
  const [log, setLog] = useState([])
  const [preview, setPreview] = useState(false)
  const [cardPreview, setCardPreview] = useState(false)   // 걷기 홈 상단 카드 미리보기
  const [note, setNote] = useState('')

  const push = (m) => setLog((l) => [`${new Date().toLocaleTimeString()} · ${m}`, ...l].slice(0, 30))
  const refresh = async () => {
    const s = await getStepStatus(); setStatus(s); push(`status=${s.kind} enabled=${s.enabled} running=${s.running} today=${s.today} battOpt=${s.batteryOptimized}`)
  }
  useEffect(() => {
    const t = setTimeout(() => { push(`native=${isNativePlatform()}`); refresh() }, 0)
    return () => clearTimeout(t)
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const doPerm = async () => { const p = await requestStepPermission(); push(`permission granted=${p.granted} notifications=${p.notifications}`); refresh() }
  const doStart = async () => { const r = await startStepWorker({ goal: 100, activeDays: [], programName: '시험 걷기 프로그램' }); push(`start → ${r.kind} running=${r.running}`); refresh() }
  const doStop = async () => { await stopStepWorker(); push('stop'); refresh() }
  const doRead = async () => { const s = await getTodayStepCount(); setToday(s); push(`today=${s}`); const d = await getDailyStepCounts(7); setDaily(d) }
  const doDebug = async () => { const s = await debugAddSteps(50); push(`debug +50 → ${s}`); doRead() }

  if (preview) {
    return (
      <div className="max-w-md mx-auto px-4 pt-2">
        <StepsVerify mission={{ title: '하루 100보 걷기 (미리보기)', step_goal: 100, schedule_mode: 'ALL_DAYS', requires_note: true, note_required: false, requires_image: true, image_required: false }}
          submitting={false} noteText={note} onNoteChange={setNote} hasPhoto={false}
          contextText="시험 걷기 프로그램 · 보건소 건강팀 · 3일째"
          photoSlot={<div><p className="text-sm font-bold text-gray-700 mb-1.5">사진 <span className="text-xs font-normal text-amber-600">(선택)</span></p><div className="flex gap-2"><button type="button" className="flex-1 h-11 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 text-sm font-semibold">사진 고르기</button><button type="button" className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold">바로 찍기</button></div></div>}
          onSubmit={(s) => { setPreview(false); push(`StepsVerify onSubmit(${s})`) }} onCancel={() => setPreview(false)} />
      </div>
    )
  }

  if (cardPreview) {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <button type="button" onClick={() => setCardPreview(false)} className="text-sm text-gray-500">‹ 돌아가기</button>
        <p className="text-xs text-gray-500">참여자 카드 (실제 센서)</p>
        <WalkingTodayCard programId="dev-preview" todayCounts={{}}
          stepMissions={[{ id: 'dev-m1', title: '하루 100보 걷기', verify_style: 'steps', step_goal: 100, schedule_mode: 'WEEKDAYS', active_days: [] }]}
          onOpenMission={(mid) => { setCardPreview(false); push(`open mission ${mid}`) }} />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-6">
      <h1 className="text-xl font-extrabold text-gray-900 mb-1">👣 걸음 일꾼 시험</h1>
      <p className="text-[12px] text-gray-400 mb-4">자체 만보기 · 네이티브 검증용. 로그인·DB 연동 없음.</p>
      <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4 mb-4">
        <Row k="네이티브 플랫폼" v={isNativePlatform()} />
        <Row k="상태" v={status ? status.kind : '확인 중…'} />
        <Row k="일꾼" v={status ? `${status.enabled ? '켜짐' : '꺼짐'} / ${status.running ? '동작 중' : '멈춤'}` : '-'} />
        <Row k="오늘 걸음" v={today === null ? (status?.today ?? '-') : `${today.toLocaleString()} 보`} />
        <Row k="알림 권한" v={status ? (status.notifications || '-') : '-'} />
        <Row k="배터리 최적화" v={status ? (status.batteryOptimized ? '켜짐(폰이 재울 수 있음)' : '제외됨') : '-'} />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <Btn onClick={doPerm}>권한 요청</Btn>
        <Btn onClick={doStart} tone="dark">일꾼 켜기(목표 100)</Btn>
        <Btn onClick={doStop} tone="light">일꾼 끄기</Btn>
        <Btn onClick={doRead} tone="light">오늘 걸음 읽기</Btn>
        <Btn onClick={doDebug} tone="light">+50걸음 (디버그)</Btn>
        <Btn onClick={openBatterySettings} tone="light">배터리 설정 열기</Btn>
      </div>
      <button type="button" onClick={() => setPreview(true)}
        className="w-full h-11 mb-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-bold">StepsVerify 화면 미리보기</button>
      <button type="button" onClick={() => setCardPreview(true)}
        className="w-full h-11 mb-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-bold">걷기 홈 카드 미리보기</button>
      {daily.length > 0 && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4 mb-4">
          <p className="text-[12px] font-bold text-gray-600 mb-2">최근 7일</p>
          {daily.map((d) => <Row key={d.date} k={d.date} v={`${Number(d.steps).toLocaleString()} 보`} />)}
        </div>
      )}
      <div className="rounded-2xl bg-gray-900 text-gray-100 p-3 font-mono text-[11px] leading-relaxed">
        <p className="text-gray-400 mb-1">log</p>
        {log.map((l, i) => <div key={i} className="break-all">{l}</div>)}
      </div>
    </div>
  )
}
