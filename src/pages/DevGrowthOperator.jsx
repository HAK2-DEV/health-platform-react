// 운영자 정원 뷰 (/dev/growth-operator) — 개발 단계, 아직 어디에도 링크 없음.
//
// ⚠️ 참여자 화면(/dev/growth)과 «같은 데이터, 다른 목적» 이다.
//    참여자는 자기 꽃 하나를 키운다. 운영자는 자기 꽃이 없을 수 있고(참여자가 아닐 수 있다),
//    대신 «프로그램 전체» 가 자기 것이다. 그래서 둘 다 필요하다 —
//      · 정원(3D)이 화면의 주인공. «내가 운영하는 정원이 이만큼 자랐다» 가 운영자의 보상이다.
//        명단만 두면 도구일 뿐 동기가 안 생긴다.
//      · 명단은 «행동할 때» 만 필요하므로 금색 나비 버튼으로 꺼내 본다.
//        30명을 3D 로 훑어 «오늘 누구를 챙길지» 찾게 하면 도구가 아니라 장난감이 된다.
//    둘은 연결돼 있다 — 3D 에서 꽃을 탭하면 명단이 열리며 그 사람이 강조된다.
//    3D 는 참여자 화면의 Scene 을 그대로 쓴다(복제하면 둘이 어긋난다).
//
// 「꽃은 시들지 않는다」 원칙(참여자 화면)은 그대로다 —
//    휴면 표시는 «운영자에게만» 보이는 힌트이고, 참여자 꽃은 여전히 건강하다.
import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, Wind, X } from 'lucide-react'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { useAuth } from '../hooks/useAuth'
import {
  fetchProgramGarden, fetchMyPrograms, fetchActivePrograms,
  fetchMyCheerQuota, sendGardenCheer, fetchMyGardenCheers,
} from '../lib/queries'
import { GardenCanvas } from './DevGrowthLab'

// 성장 단계 — /dev/growth 와 같은 임계값. 여기서만 쓰는 표시용이라 복사해 둔다.
const STAGE_PT = [0, 12, 30, 55, 90]
const STAGE_LABEL = ['새싹', '어린잎', '봉오리', '개화', '만개']
const STAGE_EMOJI = ['🌱', '🌿', '🌷', '🌸', '🌻']
const stageOf = (pt) => { let s = 0; for (let i = 4; i >= 0; i--) if (pt >= STAGE_PT[i]) { s = i; break } return s }

const ButterflyIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 7.5v11" />
    <path d="M12 7.5C11 5.4 9.1 4.2 7.1 4.2 4.8 4.2 3.2 5.8 3.2 8.1c0 2 1.3 3.7 3 4.6-1.3.8-2.1 2-2.1 3.4 0 1.7 1.2 2.7 2.6 2.7 2.4 0 4.5-2.2 5.3-4.4" />
    <path d="M12 7.5c1-2.1 2.9-3.3 4.9-3.3 2.3 0 3.9 1.6 3.9 3.9 0 2-1.3 3.7-3 4.6 1.3.8 2.1 2 2.1 3.4 0 1.7-1.2 2.7-2.6 2.7-2.4 0-4.5-2.2-5.3-4.4" />
    <path d="M12 7.5 10.1 4.4M12 7.5l1.9-3.1" />
  </svg>
)

// 마지막 인증 이후 며칠 — 서버가 준 날짜(KST)를 그대로 쓴다
const daysSince = (isoDate, todayStr) => {
  if (!isoDate) return null
  const a = new Date(isoDate + 'T00:00:00Z').getTime()
  const b = new Date(todayStr + 'T00:00:00Z').getTime()
  return Math.round((b - a) / 86400000)
}

export default function DevGrowthOperator() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const uid = session?.user?.id
  const [sp, setSp] = useSearchParams()
  const programId = sp.get('program') || null

  const [opts, setOpts] = useState([])
  const [data, setData] = useState(null)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  const [sending, setSending] = useState(null)     // 보내는 중인 상대 userId

  // 고를 수 있는 프로그램 — 내가 운영하는 것 + 참여 중인 것
  useEffect(() => {
    if (!uid) return
    let alive = true
    Promise.all([fetchMyPrograms(uid).catch(() => []), fetchActivePrograms(uid).catch(() => [])])
      .then(([mine, joined]) => {
        if (!alive) return
        const seen = new Map()
        ;[...mine, ...joined].forEach((p) => {
          if (p?.id && !seen.has(p.id)) seen.set(p.id, { id: p.id, name: p.name || p.title || '(이름 없음)' })
        })
        setOpts([...seen.values()])
      })
    return () => { alive = false }
  }, [uid])

  useEffect(() => {
    if (!programId) { return }
    let alive = true
    Promise.all([
      fetchProgramGarden(programId),
      fetchMyCheerQuota(programId).catch(() => null),
      fetchMyGardenCheers(programId).catch(() => []),
    ])
      .then(([g, quota, mine]) => {
        if (!alive) return
        // 「오늘」 판정은 여기서 — 렌더 중 Date.now() 는 순수하지 않다.
        const kst = (v) => new Date(new Date(v).getTime() + 9 * 3600000).toISOString().slice(0, 10)
        const today = kst(Date.now())
        const sentToday = new Set(mine.filter((c) => c.dir === 'out' && kst(c.createdAt) === today).map((c) => c.otherId))
        setData({ id: programId, ...g, quota, today, sentToday })
        setErr(null); setBusy(false)
      })
      .catch((e) => { if (alive) { setErr(e.message || String(e)); setBusy(false) } })
    return () => { alive = false }
  }, [programId, tick])

  const reload = () => { setBusy(true); setTick((v) => v + 1) }
  const garden = programId && data?.id === programId ? data : null
  const quota = garden?.quota
  const remain = quota ? Math.max(0, quota.limit - quota.used) : 0

  // 휴면 기준 = 프로그램 리듬의 허용 간격(floor(G*1.5+1)) — 매일형/주3회형에서 같은 잣대를 쓰면 안 된다
  const allow = garden ? Math.floor((garden.paceGap || 2) * 1.5 + 1) : 4

  const rows = useMemo(() => {
    if (!garden) return []
    return garden.members
      .filter((m) => m.userId !== uid)                       // 나 자신에겐 못 보낸다
      .map((m) => {
        const stage = stageOf(m.points)
        const gap = daysSince(m.lastVerifiedOn, garden.today)
        return { ...m, stage, gap, quiet: gap == null || gap > allow }
      })
      // 조용한 사람 먼저, 그중에서도 오래된 순
      .sort((a, b) => (b.quiet - a.quiet) || ((b.gap ?? 999) - (a.gap ?? 999)) || a.nickname.localeCompare(b.nickname))
  }, [garden, uid, allow])

  const quiet = rows.filter((r) => r.quiet)
  const active = rows.filter((r) => !r.quiet)

  // 3D 정원에 넘길 나비 — 남의 응원은 마릿수만 안다(RLS). 순서는 members 와 같다.
  const cheers3d = useMemo(() => {
    if (!garden) return []
    const out = []
    garden.members.forEach((m, i) => {
      for (let k = 0; k < (m.pendingCheers || 0); k++) out.push({ id: 'p:' + i + ':' + k, seed: out.length + 1, at: -999, to: i })
    })
    return out
  }, [garden])
  // 3D 에서 꽃을 탭하면 아래 명단에서 그 사람이 강조된다 — 두 화면이 «같은 사람» 을 가리켜야 한다.
  const [picked, setPicked] = useState(null)
  const [listOpen, setListOpen] = useState(false)   // 금색 나비를 누르면 명단이 열린다
  useBodyScrollLock(listOpen)
  const pickedId = picked != null && garden?.members[picked] ? garden.members[picked].userId : null
  const cardRefs = useRef(new Map())
  // 꽃을 탭하면 «그 사람 화면» 으로 간다(명단이 아니라). 참여자 화면과 같은 자리에서
  // 「물 주기 / 햇빛 쬐기」 대신 「응원 보내기」가 놓인다 — 운영자가 남의 꽃에 물을 줄 수는 없다.
  const pickFlower = (idx) => { setPicked(idx); setListOpen(false) }
  // 명단을 열어둔 채 꽃을 고른 경우엔 그 카드로 스크롤한다.
  useEffect(() => {
    if (!pickedId || !listOpen) return
    const t = window.setTimeout(() => {
      const el = cardRefs.current.get(pickedId)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
    return () => window.clearTimeout(t)
  }, [pickedId, listOpen])
  // 지금 고른 참여자(rows 기준 — 단계·휴면 여부가 계산돼 있다)
  const sel = useMemo(() => (pickedId ? rows.find((r) => r.userId === pickedId) || null : null), [rows, pickedId])
  const pct = sel ? (sel.stage >= 4 ? 100
    : Math.round(((sel.points - STAGE_PT[sel.stage]) / (STAGE_PT[sel.stage + 1] - STAGE_PT[sel.stage])) * 100)) : 0
  const selDone = sel ? garden.sentToday.has(sel.userId) : false
  const selCan = sel && !selDone && remain > 0

  const send = (m) => {
    if (!programId || remain <= 0 || garden.sentToday.has(m.userId)) return
    setSending(m.userId); setErr(null)
    sendGardenCheer(programId, m.userId)
      .then(() => { setSending(null); reload() })
      .catch((e) => { setSending(null); setErr(e.message || String(e)) })
  }

  const Card = ({ m }) => {
    const done = garden.sentToday.has(m.userId)
    const can = !done && remain > 0
    const on = pickedId === m.userId
    return (
      <div ref={(el) => { if (el) cardRefs.current.set(m.userId, el); else cardRefs.current.delete(m.userId) }}
        className={`flex items-center gap-3 rounded-2xl p-3 transition ${on ? 'bg-amber-50 ring-2 ring-amber-300 shadow' : 'bg-white shadow-sm'}`}>
        <span className="text-[22px] shrink-0" aria-hidden>{STAGE_EMOJI[m.stage]}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-gray-900 truncate">{m.nickname}</p>
          <p className="text-[11px] text-gray-400">
            {STAGE_LABEL[m.stage]} · 인증 {m.verifyDays}일 · 연속 {m.streak}
            {m.pendingCheers > 0 && <span className="text-pink-500 font-bold"> · 응원 {m.pendingCheers}</span>}
          </p>
          <p className={`text-[11px] font-bold ${m.quiet ? 'text-amber-600' : 'text-emerald-600'}`}>
            {m.gap == null ? '아직 인증 없음' : m.gap === 0 ? '오늘 인증했어요' : `${m.gap}일째 소식 없음`}
          </p>
        </div>
        <button type="button" onClick={() => send(m)} disabled={!can || sending === m.userId}
          className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition active:scale-90 ${
            done ? 'bg-gray-100 text-gray-300'
              : can ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow'
              : 'bg-gray-100 text-gray-300'}`}
          aria-label={done ? '오늘 이미 보냈어요' : '응원 나비 보내기'}>
          <ButterflyIcon className="w-[22px] h-[22px]" />
        </button>
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-gray-50">
      <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <button type="button" onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-700">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-[17px] font-extrabold text-gray-900">운영자 정원</h1>
          <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-1 rounded-full">/dev/growth-operator</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={programId || ''}
            onChange={(e) => setSp(e.target.value ? { program: e.target.value } : {})}
            className="flex-1 min-w-0 text-[13px] font-bold text-gray-800 bg-white rounded-xl px-3 py-2 border-0 shadow-sm">
            <option value="">프로그램을 고르세요</option>
            {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {garden && (
            <button type="button" onClick={reload} disabled={busy}
              className="shrink-0 text-[12px] font-extrabold text-emerald-600 underline disabled:text-gray-300 px-1">
              {busy ? '읽는 중…' : '다시 읽기'}
            </button>
          )}
        </div>
        {garden && (
          <div className="flex items-center gap-3 mt-2 text-[12px] font-bold">
            <span className={quota?.isOperator ? 'text-amber-600' : 'text-gray-500'}>
              {quota?.isOperator ? '운영자' : '참여자'} · 나비 {remain}/{quota?.limit ?? 3}
            </span>
            <span className="text-gray-400">참여자 {garden.members.length}명</span>
            <span className="text-gray-400">리듬 {garden.paceGap}일</span>
          </div>
        )}
        {err && <p className="text-[12px] font-bold text-rose-500 mt-2">{err}</p>}
      </div>

      {/* 정원이 화면의 주인공이다 — 운영자의 보상은 «내가 운영하는 정원이 자란다» 이다.
          명단은 «행동할 때» 만 필요하므로 금색 나비를 눌러 꺼내 본다. */}
      <div className="flex-1 min-h-0 relative bg-gradient-to-b from-sky-100 to-emerald-50">
        {!programId && (
          <p className="text-[13px] text-gray-400 text-center pt-24">위에서 프로그램을 고르세요.</p>
        )}
        {garden && (
          <Suspense fallback={null}>
            <GardenCanvas key={programId} members={garden.members} cheers={cheers3d}
              selected={picked} onSelect={pickFlower} />
          </Suspense>
        )}

        {/* 금색 나비 — 운영자의 «행동» 버튼. 남은 마릿수를 배지로 달아 한도가 늘 보이게 한다.
            꽃을 고른 동안엔 아래 카드가 그 자리를 대신하므로 숨긴다. */}
        {garden && !sel && (
          <button type="button" onClick={() => { setPicked(null); setListOpen(true) }}
            className="absolute right-4 bottom-5 w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-xl flex items-center justify-center active:scale-90 transition"
            aria-label="응원 보낼 참여자 목록">
            <ButterflyIcon className="w-7 h-7" />
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-white text-amber-600 text-[12px] font-extrabold flex items-center justify-center shadow">
              {remain}
            </span>
          </button>
        )}
        {garden && !sel && quiet.length > 0 && (
          <p className="absolute left-4 bottom-7 text-[12px] font-extrabold text-amber-700 bg-white/85 rounded-full px-3 py-1.5 shadow">
            오늘 챙길 분 {quiet.length}명
          </p>
        )}

        {/* 참여자 한 명 — 참여자 화면과 같은 자리, 같은 모양. 다만 할 수 있는 일이 다르다.
            참여자는 「물 주기 / 햇빛 쬐기」(자기 활동), 운영자는 「응원 보내기」 하나뿐이다. */}
        {sel && (
          <>
            <button type="button" onClick={() => setPicked(null)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/85 shadow flex items-center justify-center text-gray-700"
              aria-label="정원으로">
              <X className="w-5 h-5" />
            </button>
            <div className="absolute bottom-4 left-4 right-4 bg-white rounded-3xl p-4 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[15px] font-extrabold text-gray-900 truncate">
                  {sel.nickname}<span className="text-gray-400 font-bold">의 꽃</span>
                </p>
                <p className="text-[15px] font-extrabold text-emerald-600">{sel.stage >= 4 ? '완성' : pct + '%'}</p>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500" style={{ width: pct + '%' }} />
              </div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-gray-400">
                  레벨 {sel.stage + 1} · {STAGE_LABEL[sel.stage]} · 인증 {sel.verifyDays}일 · 연속 {sel.streak}
                </p>
                <p className={`text-[11px] font-bold ${sel.quiet ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {sel.gap == null ? '아직 인증 없음' : sel.gap === 0 ? '오늘 인증했어요' : `${sel.gap}일째 소식 없음`}
                </p>
              </div>

              <button type="button" onClick={() => send(sel)} disabled={!selCan || sending === sel.userId}
                className={`w-full rounded-2xl px-4 py-3 flex items-center gap-3 transition active:scale-[0.98] ${
                  selCan ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-md' : 'bg-gray-100 text-gray-400'}`}>
                <ButterflyIcon className="w-6 h-6 shrink-0" />
                <span className="text-left min-w-0">
                  <span className="block text-[14px] font-extrabold">
                    {selDone ? '오늘 이미 응원했어요' : remain <= 0 ? '오늘 나비를 다 보냈어요' : '응원 나비 보내기'}
                  </span>
                  <span className={`block text-[11px] ${selCan ? 'text-white/85' : 'text-gray-400'}`}>
                    {selDone ? '내일 다시 보낼 수 있어요'
                      : remain <= 0 ? `내일 다시 ${quota?.limit ?? 10}마리를 보낼 수 있어요`
                      : `이 꽃에 나비가 앉아요 · 오늘 ${remain}마리 남음`}
                  </span>
                </span>
              </button>
              <p className="text-[11px] text-gray-400 mt-2 leading-relaxed break-keep">
                나비는 이 꽃에 앉아 기다리다가, {sel.nickname}님이 다음에 인증할 때 힘을 보태요.
                {sel.quiet && ' 오래 쉰 분께 닿으면 두 배로 돌아와요.'}
              </p>
              {err && <p className="text-[11px] font-bold text-rose-500 mt-2">{err}</p>}
            </div>
          </>
        )}
      </div>

      {/* 명단 — 화면 가운데 오버레이 */}
      {listOpen && garden && (
        <div className="fixed inset-0 z-30 flex items-center justify-center p-4"
          onClick={() => setListOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-md max-h-[78dvh] bg-gray-50 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-4 pt-4 pb-2 shrink-0">
              <ButterflyIcon className="w-5 h-5 text-amber-500" />
              <h2 className="text-[15px] font-extrabold text-gray-900 flex-1">응원 보내기</h2>
              <span className="text-[12px] font-extrabold text-amber-600">나비 {remain}/{quota?.limit ?? 3}</span>
              <button type="button" onClick={() => setListOpen(false)}
                className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            {err && <p className="text-[12px] font-bold text-rose-500 px-4 pb-2">{err}</p>}
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {garden && quiet.length > 0 && (
                <section>
                  <div className="flex items-baseline gap-2 mb-2 px-1">
                    <h2 className="text-[14px] font-extrabold text-gray-900">오늘 챙길 분</h2>
                    <span className="text-[12px] font-bold text-amber-600">{quiet.length}명</span>
                  </div>
                  {/* 기준은 «며칠» 이 아니라 그 프로그램의 리듬이다 — 매일형과 주3회형에 같은 잣대를 대면 안 된다 */}
                  <p className="text-[11px] text-gray-400 mb-2 px-1">이 프로그램 리듬({garden.paceGap}일)으로 {allow}일 넘게 소식이 없어요</p>
                  <div className="space-y-2">{quiet.map((m) => <Card key={m.userId} m={m} />)}</div>
                </section>
              )}

              {garden && active.length > 0 && (
                <section>
                  <div className="flex items-baseline gap-2 mb-2 px-1">
                    <h2 className="text-[14px] font-extrabold text-gray-900">잘 하고 있는 분</h2>
                    <span className="text-[12px] font-bold text-emerald-600">{active.length}명</span>
                  </div>
                  <div className="space-y-2">{active.map((m) => <Card key={m.userId} m={m} />)}</div>
                </section>
              )}

              {garden && rows.length === 0 && (
                <p className="text-[13px] text-gray-400 text-center py-16">보낼 수 있는 참여자가 없어요.</p>
              )}


              <p className="text-[11px] text-gray-400 leading-relaxed break-keep px-1">
                <Wind className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                나비는 점수를 바로 주지 않아요. 그분이 <b>다음에 인증할 때</b> 힘을 보탭니다.
                오래 쉰 분께 닿으면 보낸 사람에게 두 배로 돌아와요.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
