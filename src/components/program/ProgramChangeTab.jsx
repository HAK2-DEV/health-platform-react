import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchMyMoodTrend, fetchMyChangeStats, fetchParticipantChangeTrends, formatKstDate } from '../../lib/queries'
import Modal from '../common/Modal'
import { Reveal } from './statsAnim'

// 금연 「내 변화」(참가자) / 「참가자 추세」(운영자) 탭.
//   참가자: 본인 기분/흡연/시간대/욕구 차트.
//   운영자: 참가자 목록 → 클릭 시 그 참가자 상세(같은 차트 + 흡연 욕구 요인 기록).
//   props: programId, userId, isOwner
const MOOD_META = {
  5: { color: '#10b981', emoji: '😄', label: '상쾌' },
  4: { color: '#34d399', emoji: '🙂', label: '괜찮' },
  3: { color: '#f59e0b', emoji: '😐', label: '보통' },
  2: { color: '#fb923c', emoji: '😟', label: '예민' },
  1: { color: '#f87171', emoji: '😣', label: '힘듦' },
}

// 기간 라벨 — 프로그램 개월수에 맞춰
const periodLabel = (d) => d >= 175 ? '6개월' : d >= 85 ? '3개월' : d >= 25 ? '1개월' : `${d}일`

// 기간 적응형 시리즈 — 1개월(≤31일)=일별, 그 이상=주별 집계.
//   기분: 버킷 평균(소수 허용) / 흡연: 버킷 합계. 오늘 기준 periodDays 일 구간.
function buildSeries(moods, stats, periodDays) {
  const gran = periodDays <= 31 ? 'day' : 'week'
  const today = new Date()
  const dayList = []
  for (let i = periodDays - 1; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); dayList.push(formatKstDate(d)) }
  const moodBy = new Map((moods || []).map(m => [m.logged_date, m.mood]))
  const cigBy = new Map((stats?.smokingTrend || []).map(s => [s.date, s.cigarettes]))
  const buckets = []
  if (gran === 'day') dayList.forEach(ds => buckets.push([ds]))
  else for (let b = 0; b < dayList.length; b += 7) buckets.push(dayList.slice(b, b + 7))
  const moodSeries = [], cigSeries = []
  for (const days of buckets) {
    const mv = days.map(d => moodBy.get(d)).filter(v => v != null)
    const mood = mv.length ? Math.round((mv.reduce((a, x) => a + x, 0) / mv.length) * 10) / 10 : null
    const cig = days.reduce((a, d) => a + (cigBy.get(d) || 0), 0)
    moodSeries.push({ label: (days[0] || '').slice(5), mood })
    cigSeries.push({ label: (days[0] || '').slice(5), cigarettes: cig })
  }
  return { moodSeries, cigSeries, gran, firstLabel: (dayList[0] || '').slice(5), lastLabel: (dayList[dayList.length - 1] || '').slice(5) }
}

// 제출 시각 → 'M/D H시' (KST)
function noteWhen(at) {
  const d = new Date(new Date(at).getTime() + 9 * 3600 * 1000)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}시`
}
// 제출 시각 → KST 시(0~23)
const kstHourOf = (at) => (new Date(at).getUTCHours() + 9) % 24

function ProgramChangeTab({ programId, userId, isOwner, periodDays = 14 }) {
  const { data: moods = [] } = useQuery({
    queryKey: ['mood-trend', programId, userId],
    queryFn: () => fetchMyMoodTrend({ programId, userId }),
    enabled: !!programId && !!userId && !isOwner,
  })
  const { data: stats } = useQuery({
    queryKey: ['change-stats', programId, userId, periodDays],
    queryFn: () => fetchMyChangeStats({ programId, userId, days: periodDays }),
    enabled: !!programId && !!userId && !isOwner,
  })
  const { data: participants = [] } = useQuery({
    queryKey: ['participant-trends', programId],
    queryFn: () => fetchParticipantChangeTrends(programId),
    enabled: !!programId && isOwner,
  })
  // 선택 참가자를 URL(?puser=)로 — 히스토리에 쌓여 헤더 ‹/브라우저·하드웨어 뒤로가 목록으로 복귀.
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get('puser')
  const selected = selectedId ? (participants.find(p => p.user_id === selectedId) || null) : null
  const selectParticipant = (p) => setSearchParams(prev => {
    const n = new URLSearchParams(prev); n.set('puser', p.user_id); return n
  })  // push(히스토리 추가) → 뒤로가기로 목록 복귀

  // ─── 운영자 ───
  if (isOwner) {
    if (selected) return <ParticipantDetail programId={programId} user={selected} periodDays={periodDays} onBack={() => navigate(-1)} />
    return (
      <div className="bg-white rounded-2xl shadow-elevated p-4">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-gray-800">참가자 추세</h3>
          <span className="text-[11px] text-gray-400 ml-auto">{participants.length}명</span>
        </div>
        <p className="text-[12px] text-gray-500 mb-3">참가자를 누르면 상세를 봐요. 신경 쓸 분이 위로 와요.</p>
        {participants.length === 0 ? (
          <p className="text-[13px] text-gray-500 py-8 text-center">아직 참가자 데이터가 없어요.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {participants.map(p => (
              <button key={p.user_id} type="button" onClick={() => selectParticipant(p)}
                className="w-full flex items-center gap-2 py-2.5 text-left hover:bg-gray-50 -mx-1 px-1 rounded-lg transition">
                <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{p.nickname}</span>
                <span className="inline-flex items-center gap-1 text-xs w-[68px]" title="최근 기분">
                  {p.latestMood
                    ? <><span>{MOOD_META[p.latestMood].emoji}</span><span className="text-gray-500 truncate">{MOOD_META[p.latestMood].label}</span></>
                    : <span className="text-gray-300">기분 –</span>}
                </span>
                <span className="text-xs text-gray-600 w-[56px] text-right whitespace-nowrap">🚬 {p.smokeTotal}</span>
                <span className="text-xs text-gray-400 w-[44px] text-right whitespace-nowrap" title="욕구 기록">🔥 {p.cravingCount}</span>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── 참가자 ───
  return <ChangeCharts moods={moods} stats={stats} periodDays={periodDays} />
}

// 참가자 상세 (운영자가 한 명 선택)
function ParticipantDetail({ programId, user, onBack, periodDays = 14 }) {
  const { data: moods = [] } = useQuery({
    queryKey: ['mood-trend', programId, user.user_id],
    queryFn: () => fetchMyMoodTrend({ programId, userId: user.user_id }),
    enabled: !!programId && !!user.user_id,
  })
  const { data: stats } = useQuery({
    queryKey: ['change-stats', programId, user.user_id, periodDays],
    queryFn: () => fetchMyChangeStats({ programId, userId: user.user_id, days: periodDays }),
    enabled: !!programId && !!user.user_id,
  })
  return (
    <div className="space-y-[9px]">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="w-4 h-4" /> 참가자 추세
      </button>
      <div className="bg-white rounded-2xl shadow-elevated p-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">{(user.nickname || '?').slice(0, 1)}</span>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{user.nickname}</p>
          <p className="text-[12px] text-gray-500">누적 흡연 {user.smokeTotal ?? 0}개비 · 욕구 기록 {user.cravingCount ?? 0}회</p>
        </div>
      </div>
      <ChangeCharts moods={moods} stats={stats} periodDays={periodDays} />
    </div>
  )
}

// 변화 차트 묶음 — 기분/흡연추세/시간대/욕구시간대/흡연 욕구 요인(노트). 데모에서도 재사용 → export.
export function ChangeCharts({ moods, stats, periodDays = 14 }) {
  const { moodSeries, cigSeries, gran, firstLabel, lastLabel } = useMemo(
    () => buildSeries(moods, stats, periodDays), [moods, stats, periodDays])
  const logged = moodSeries.filter(s => s.mood != null)
  const avg = logged.length ? logged.reduce((s, x) => s + x.mood, 0) / logged.length : null
  const notes = stats?.cravingNotes || []
  const pLabel = periodLabel(periodDays)
  const granNote = gran === 'week' ? ' · 주별' : ''
  const [detail, setDetail] = useState(null)
  const [notesExpanded, setNotesExpanded] = useState(false)
  // 최근순(notes 는 이미 최신→오래된 정렬) 5개만, 나머지는 전체 보기로 아래에 이어짐
  const shownNotes = notesExpanded ? notes : notes.slice(0, 5)
  const smokeHas = (stats?.smokeTotal ?? 0) > 0
  const smokeHourHas = stats?.smokeHourHist?.some(n => n > 0)
  const cravingHas = (stats?.cravingTotal ?? 0) > 0

  return (
    <>
    <div className="space-y-[9px]">
      {/* 기분 변화 */}
      <Reveal index={0}><div className="bg-white rounded-2xl shadow-elevated p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-gray-800">기분 변화</h3>
          <span className="text-[11px] text-gray-400 ml-auto">최근 {pLabel}{granNote}</span>
        </div>
        {logged.length === 0 ? (
          <p className="text-[13px] text-gray-500 py-8 text-center">아직 기분 기록이 없어요.</p>
        ) : (
          <>
            <p className="text-[12px] text-gray-600 mb-3">
              {avg >= 4 ? '요즘 기분이 좋은 편이에요 😊' : avg >= 3 ? '잔잔하게 유지되고 있어요 🌿' : '조금 힘든 시기예요 💚'}
            </p>
            <MoodChart series={moodSeries} />
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
              {[5, 4, 3, 2, 1].map(v => (
                <span key={v} className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                  <span className="w-2 h-2 rounded-full" style={{ background: MOOD_META[v].color }} />
                  {MOOD_META[v].label}
                </span>
              ))}
            </div>
          </>
        )}
      </div></Reveal>

      {/* 흡연 추세 — 탭 시 상세 */}
      <Reveal index={1}><div className={`bg-white rounded-2xl shadow-elevated p-4 ${smokeHas ? 'cursor-pointer active:bg-gray-50 transition' : ''}`}
        role={smokeHas ? 'button' : undefined} onClick={smokeHas ? () => setDetail('smoke') : undefined}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🚬</span>
          <h3 className="text-sm font-bold text-gray-800">흡연 추세</h3>
          <span className="text-[11px] text-gray-400 ml-auto">최근 {pLabel}{granNote} · 총 {stats?.smokeTotal ?? 0}개비</span>
          {smokeHas && <ChevronRight className="w-4 h-4 text-gray-300 -mr-1" />}
        </div>
        {(stats?.smokeTotal ?? 0) === 0
          ? <p className="text-[13px] text-gray-500 py-6 text-center">기록된 흡연이 없어요. 잘하고 있어요! 💚</p>
          : <>
              <DailyBars series={cigSeries} firstLabel={firstLabel} lastLabel={lastLabel} />
              <p className="text-[11px] text-gray-400 text-center mt-2">탭하면 정확한 개비 수를 봐요</p>
            </>}
      </div></Reveal>

      {/* 자주 피는 시간대 — 탭 시 상세 */}
      <Reveal index={2}><div className={`bg-white rounded-2xl shadow-elevated p-4 ${smokeHourHas ? 'cursor-pointer active:bg-gray-50 transition' : ''}`}
        role={smokeHourHas ? 'button' : undefined} onClick={smokeHourHas ? () => setDetail('smokeHour') : undefined}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">⏰</span>
          <h3 className="text-sm font-bold text-gray-800">자주 피는 시간대</h3>
          {smokeHourHas && <ChevronRight className="w-4 h-4 text-gray-300 ml-auto -mr-1" />}
        </div>
        {smokeHourHas
          ? <HourlyChart data={stats.smokeHourHist} color="#fb923c" />
          : <p className="text-[13px] text-gray-500 py-6 text-center">흡연 기록에 「핀 시각」을 적으면 시간대 패턴이 보여요.</p>}
      </div></Reveal>

      {/* 욕구가 강한 시간대 — 탭 시 상세 */}
      <Reveal index={3}><div className={`bg-white rounded-2xl shadow-elevated p-4 ${cravingHas ? 'cursor-pointer active:bg-gray-50 transition' : ''}`}
        role={cravingHas ? 'button' : undefined} onClick={cravingHas ? () => setDetail('craving') : undefined}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🔥</span>
          <h3 className="text-sm font-bold text-gray-800">욕구가 강한 시간대</h3>
          {cravingHas && <ChevronRight className="w-4 h-4 text-gray-300 ml-auto -mr-1" />}
        </div>
        {cravingHas
          ? <><HourlyChart data={stats.cravingHourHist} color="#f87171" />
              <p className="text-[11px] text-gray-400 text-center mt-2">탭하면 시각·요인·흡연량을 함께 봐요</p></>
          : <p className="text-[13px] text-gray-500 py-6 text-center">「흡연 욕구가 올라온 순간」을 기록하면 시간대가 보여요.</p>}
      </div></Reveal>

      {/* 흡연 욕구 요인 — 참가자가 적은 내용 */}
      <Reveal index={4}><div className="bg-white rounded-2xl shadow-elevated p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">💭</span>
          <h3 className="text-sm font-bold text-gray-800">흡연 욕구 요인</h3>
          <span className="text-[11px] text-gray-400 ml-auto">적은 내용</span>
        </div>
        {notes.length === 0 ? (
          <p className="text-[13px] text-gray-500 py-6 text-center">「흡연 욕구가 올라온 순간」에 적은 기록이 여기 모여요.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {shownNotes.map((n, i) => (
                <li key={i} className="border-l-2 border-rose-200 pl-3 py-0.5">
                  <span className="block text-[13px] text-gray-700 leading-snug break-keep">{n.text}</span>
                  <span className="text-[11px] text-gray-400">{noteWhen(n.at)}</span>
                </li>
              ))}
            </ul>
            {notes.length > 5 && (
              <button type="button" onClick={() => setNotesExpanded(v => !v)}
                className="w-full mt-2.5 h-9 rounded-xl bg-gray-50 text-gray-500 text-[13px] font-semibold hover:bg-gray-100 transition">
                {notesExpanded ? '접기' : `전체 보기 (${notes.length}개)`}
              </button>
            )}
          </>
        )}
      </div></Reveal>
    </div>

    {/* 카드 탭 → 상세 분석 시트 */}
    <Modal isOpen={!!detail} onClose={() => setDetail(null)}>
      {detail === 'smoke' && <SmokeTrendDetail stats={stats} cigSeries={cigSeries} gran={gran} periodDays={periodDays} pLabel={pLabel} />}
      {detail === 'smokeHour' && <SmokeHourDetail stats={stats} />}
      {detail === 'craving' && <CravingDetail stats={stats} />}
    </Modal>
    </>
  )
}

// ─── 상세 시트(카드 탭) ─────────────────────────────────────────
const HOUR_BANDS = [
  { key: '새벽', from: 0, to: 6, emoji: '🌙' },
  { key: '오전', from: 6, to: 12, emoji: '☀️' },
  { key: '오후', from: 12, to: 18, emoji: '🌤️' },
  { key: '저녁·밤', from: 18, to: 24, emoji: '🌆' },
]
function SheetHead({ emoji, title, sub }) {
  return (
    <div className="px-5 pt-1 pb-3">
      <h2 className="text-[17px] font-extrabold text-gray-900 flex items-center gap-2"><span>{emoji}</span>{title}</h2>
      {sub && <p className="text-[12px] text-gray-500 mt-1 leading-snug break-keep">{sub}</p>}
    </div>
  )
}
function StatCell({ label, value, unit, tone }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 text-center">
      <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
      <p className={`text-lg font-extrabold ${tone || 'text-gray-800'}`}>{value}{unit && <span className="text-[11px] font-semibold text-gray-400 ml-0.5">{unit}</span>}</p>
    </div>
  )
}

// 흡연 추세 상세 — 정확한 개비 수(버킷별 리스트 + 요약)
function SmokeTrendDetail({ stats, cigSeries, gran, periodDays, pLabel }) {
  const daily = stats?.smokingTrend || []
  const total = stats?.smokeTotal || 0
  const cleanDays = daily.filter(d => d.cigarettes === 0).length
  const maxDay = daily.reduce((m, d) => d.cigarettes > m.cigarettes ? d : m, { cigarettes: 0, date: '' })
  const avg = periodDays ? total / periodDays : 0
  const rows = cigSeries
  const max = Math.max(1, ...rows.map(r => r.cigarettes))
  return (
    <div className="pb-6">
      <SheetHead emoji="🚬" title="흡연 추세 상세" sub={`최근 ${pLabel} 동안의 흡연량을 ${gran === 'week' ? '주별' : '일별'}로 정확히 봐요`} />
      <div className="px-5 grid grid-cols-2 gap-2 mb-4">
        <StatCell label="총 흡연" value={total} unit="개비" tone="text-orange-500" />
        <StatCell label="하루 평균" value={avg.toFixed(1)} unit="개비" />
        <StatCell label="금연한 날" value={cleanDays} unit="일" tone="text-emerald-600" />
        <StatCell label="가장 많던 날" value={maxDay.cigarettes} unit="개비" />
      </div>
      <div className="px-5">
        <h3 className="text-[13px] font-bold text-gray-700 mb-2">{gran === 'week' ? '주별' : '일별'} 흡연량</h3>
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 w-10 flex-shrink-0 tabular-nums">{r.label}</span>
              <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-orange-300" style={{ width: `${(r.cigarettes / max) * 100}%` }} />
              </div>
              <span className={`text-[12px] w-14 text-right tabular-nums ${r.cigarettes === 0 ? 'text-gray-300' : 'text-gray-700 font-semibold'}`}>{r.cigarettes}개비</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// 자주 피는 시간대 상세 — 시간대 밴드 분포 + 시간별 개비 수
function SmokeHourDetail({ stats }) {
  const hist = stats?.smokeHourHist || new Array(24).fill(0)
  const total = hist.reduce((a, b) => a + b, 0)
  let peak = 0; for (let h = 1; h < 24; h++) if (hist[h] > hist[peak]) peak = h
  const bands = HOUR_BANDS.map(b => ({ ...b, count: hist.slice(b.from, b.to).reduce((a, x) => a + x, 0) }))
  const bandMax = Math.max(1, ...bands.map(b => b.count))
  const activeHours = hist.map((c, h) => ({ h, c })).filter(x => x.c > 0).sort((a, b) => b.c - a.c)
  return (
    <div className="pb-6">
      <SheetHead emoji="⏰" title="자주 피는 시간대 상세" sub={total ? `주로 ${peak}시경에 가장 많이 피워요` : '기록이 없어요'} />
      <div className="px-5 mb-4">
        <h3 className="text-[13px] font-bold text-gray-700 mb-2">시간대별 분포</h3>
        <div className="space-y-2">
          {bands.map(b => (
            <div key={b.key} className="flex items-center gap-2">
              <span className="text-[12px] text-gray-600 w-16 flex-shrink-0">{b.emoji} {b.key}</span>
              <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-orange-300" style={{ width: `${(b.count / bandMax) * 100}%` }} />
              </div>
              <span className="text-[11px] text-gray-700 font-semibold w-[74px] text-right tabular-nums">{b.count}개비·{total ? Math.round(b.count / total * 100) : 0}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="px-5">
        <h3 className="text-[13px] font-bold text-gray-700 mb-2">시간별 상세</h3>
        <div className="flex flex-wrap gap-1.5">
          {activeHours.map(({ h, c }) => (
            <span key={h} className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-lg text-[12px] ${h === peak ? 'bg-orange-100 text-orange-700 font-bold' : 'bg-gray-100 text-gray-600'}`}>{h}시 <b className="tabular-nums">{c}</b></span>
          ))}
        </div>
      </div>
    </div>
  )
}

// 욕구가 강한 시간대 상세 — 시각·요인(적은 내용)·그 시간대 실제 흡연량
function CravingDetail({ stats }) {
  const cHist = stats?.cravingHourHist || new Array(24).fill(0)
  const sHist = stats?.smokeHourHist || new Array(24).fill(0)
  const allNotes = stats?.cravingNotes || []
  const notesByHour = {}
  allNotes.forEach(n => { const h = kstHourOf(n.at); (notesByHour[h] = notesByHour[h] || []).push(n) })
  let peak = 0; for (let h = 1; h < 24; h++) if (cHist[h] > cHist[peak]) peak = h
  const cravingTotal = cHist.reduce((a, b) => a + b, 0)
  const hours = cHist.map((c, h) => ({ h, c, s: sHist[h], hnotes: notesByHour[h] || [] }))
    .filter(x => x.c > 0).sort((a, b) => b.c - a.c)
  return (
    <div className="pb-6">
      <SheetHead emoji="🔥" title="욕구가 강한 시간대 상세" sub="욕구가 올라온 시각·요인과, 그 시간대에 실제로 피운 양을 함께 봐요" />
      <div className="px-5 grid grid-cols-2 gap-2 mb-4">
        <StatCell label="욕구 기록" value={cravingTotal} unit="회" tone="text-rose-500" />
        <StatCell label="가장 강한 시간" value={`${peak}시`} unit="" />
      </div>
      <div className="px-5 space-y-2.5">
        {hours.map(({ h, c, s, hnotes }) => (
          <div key={h} className="rounded-xl border border-gray-100 p-3">
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1">
              <span className={`inline-flex items-center justify-center px-2 h-6 rounded-lg text-[13px] font-bold ${h === peak ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-600'}`}>{h}시</span>
              <span className="text-[12px] text-gray-500">욕구 <b className="text-rose-500">{c}회</b></span>
              <span className="text-[12px] text-gray-500">· 흡연 <b className={s > 0 ? 'text-orange-500' : 'text-emerald-600'}>{s}개비</b></span>
            </div>
            {hnotes.length > 0 ? (
              <ul className="space-y-1 mt-1.5">
                {hnotes.map((n, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-rose-300 mt-[3px] text-[10px]">●</span>
                    <span className="text-[12px] text-gray-600 leading-snug break-keep">{n.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-gray-400 mt-0.5">적어둔 요인이 없어요</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// 흡연 개비 막대 — 버킷(일/주)별. gap 은 막대 수에 따라 축소.
function DailyBars({ series, firstLabel, lastLabel }) {
  const max = Math.max(1, ...series.map(s => s.cigarettes))
  const gap = series.length > 20 ? 'gap-[2px]' : 'gap-[3px]'
  return (
    <>
      <div className={`flex items-end ${gap} h-20`}>
        {series.map((s, i) => {
          const pct = (s.cigarettes / max) * 100
          return (
            <div key={i} className="flex-1 flex flex-col justify-end h-full" title={`${s.label} · ${s.cigarettes}개비`}>
              <div className={`w-full rounded-sm ${s.cigarettes === 0 ? 'bg-gray-100' : 'bg-orange-300'}`} style={{ height: s.cigarettes === 0 ? '3px' : `${Math.max(8, pct)}%` }} />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-400">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </>
  )
}

// 24시간 히스토그램 (시간대 패턴) — peak 강조
function HourlyChart({ data, color }) {
  const max = Math.max(1, ...data)
  let peak = 0
  for (let h = 1; h < 24; h++) if (data[h] > data[peak]) peak = h
  return (
    <>
      {data[peak] > 0 && (
        <p className="text-[12px] text-gray-600 mb-2">주로 <b className="text-gray-800">{peak}시</b>경에 가장 많아요</p>
      )}
      <div className="flex items-end gap-[2px] h-14">
        {data.map((c, h) => {
          const pct = (c / max) * 100
          const isPeak = h === peak && c > 0
          return (
            <div key={h} className="flex-1 flex flex-col justify-end h-full" title={`${h}시 · ${c}회`}>
              <div className="w-full rounded-sm" style={{ height: c === 0 ? '3px' : `${Math.max(8, pct)}%`, background: c === 0 ? '#f3f4f6' : (isPeak ? color : `${color}80`) }} />
            </div>
          )
        })}
      </div>
      <div className="relative h-3 text-[10px] text-gray-400 mt-0.5">
        <span className="absolute left-0">0</span>
        <span className="absolute left-1/2 -translate-x-1/2">12</span>
        <span className="absolute right-0">24</span>
      </div>
    </>
  )
}

// 기분 라인 차트 — x=버킷(일/주), y=기분(1~5, 주별은 평균 소수). 점 색은 반올림 단계.
function MoodChart({ series }) {
  const W = 320, H = 96, padX = 6, padY = 12
  const n = series.length
  const r = n > 20 ? 2.2 : 3.5
  const stepX = (W - padX * 2) / Math.max(1, n - 1)
  const yOf = (mood) => padY + ((5 - mood) / 4) * (H - padY * 2)
  const pts = series.map((s, i) => ({ ...s, x: padX + i * stepX, y: s.mood != null ? yOf(s.mood) : null }))
  const linePts = pts.filter(p => p.y != null)
  const polyline = linePts.map(p => `${p.x},${p.y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: '96px' }} preserveAspectRatio="none">
      <line x1={padX} y1={yOf(3)} x2={W - padX} y2={yOf(3)} stroke="#f3f4f6" strokeWidth="1" />
      {linePts.length > 1 && (
        <polyline points={polyline} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" opacity="0.5" />
      )}
      {pts.map((p, i) => p.y == null ? null : (
        <circle key={i} cx={p.x} cy={p.y} r={r} fill={MOOD_META[Math.round(p.mood)].color} />
      ))}
    </svg>
  )
}

export default ProgramChangeTab
