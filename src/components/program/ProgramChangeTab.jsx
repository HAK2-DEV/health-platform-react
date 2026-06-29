import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { fetchMyMoodTrend, fetchMyChangeStats, fetchParticipantChangeTrends, formatKstDate } from '../../lib/queries'

// 금연 「내 변화」(참가자) / 「참가자 추세」(운영자) 탭.
//   참가자: 본인 기분/흡연/시간대/욕구 차트.
//   운영자: 참가자 목록 → 클릭 시 그 참가자 상세(같은 차트 + 흡연 욕구 요인 기록).
//   props: programId, userId, isOwner
const DAYS = 14
const MOOD_META = {
  5: { color: '#10b981', emoji: '😄', label: '상쾌' },
  4: { color: '#34d399', emoji: '🙂', label: '괜찮' },
  3: { color: '#f59e0b', emoji: '😐', label: '보통' },
  2: { color: '#fb923c', emoji: '😟', label: '예민' },
  1: { color: '#f87171', emoji: '😣', label: '힘듦' },
}

function buildMoodSeries(moods) {
  const byDate = new Map(moods.map(m => [m.logged_date, m.mood]))
  const base = new Date()
  const out = []
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(base); d.setDate(d.getDate() - i)
    const ds = formatKstDate(d)
    out.push({ date: ds, mood: byDate.has(ds) ? byDate.get(ds) : null })
  }
  return out
}

// 제출 시각 → 'M/D H시' (KST)
function noteWhen(at) {
  const d = new Date(new Date(at).getTime() + 9 * 3600 * 1000)
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${d.getUTCHours()}시`
}

function ProgramChangeTab({ programId, userId, isOwner }) {
  const { data: moods = [] } = useQuery({
    queryKey: ['mood-trend', programId, userId],
    queryFn: () => fetchMyMoodTrend({ programId, userId }),
    enabled: !!programId && !!userId && !isOwner,
  })
  const { data: stats } = useQuery({
    queryKey: ['change-stats', programId, userId],
    queryFn: () => fetchMyChangeStats({ programId, userId }),
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
    if (selected) return <ParticipantDetail programId={programId} user={selected} onBack={() => navigate(-1)} />
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
  return <ChangeCharts moods={moods} stats={stats} />
}

// 참가자 상세 (운영자가 한 명 선택)
function ParticipantDetail({ programId, user, onBack }) {
  const { data: moods = [] } = useQuery({
    queryKey: ['mood-trend', programId, user.user_id],
    queryFn: () => fetchMyMoodTrend({ programId, userId: user.user_id }),
    enabled: !!programId && !!user.user_id,
  })
  const { data: stats } = useQuery({
    queryKey: ['change-stats', programId, user.user_id],
    queryFn: () => fetchMyChangeStats({ programId, userId: user.user_id }),
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
      <ChangeCharts moods={moods} stats={stats} />
    </div>
  )
}

// 변화 차트 묶음 — 기분/흡연추세/시간대/욕구시간대/흡연 욕구 요인(노트)
function ChangeCharts({ moods, stats }) {
  const series = useMemo(() => buildMoodSeries(moods), [moods])
  const logged = series.filter(s => s.mood != null)
  const avg = logged.length ? logged.reduce((s, x) => s + x.mood, 0) / logged.length : null
  const notes = stats?.cravingNotes || []

  return (
    <div className="space-y-[9px]">
      {/* 기분 변화 */}
      <div className="bg-white rounded-2xl shadow-elevated p-4">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-gray-800">기분 변화</h3>
          <span className="text-[11px] text-gray-400 ml-auto">최근 {DAYS}일</span>
        </div>
        {logged.length === 0 ? (
          <p className="text-[13px] text-gray-500 py-8 text-center">아직 기분 기록이 없어요.</p>
        ) : (
          <>
            <p className="text-[12px] text-gray-600 mb-3">
              {avg >= 4 ? '요즘 기분이 좋은 편이에요 😊' : avg >= 3 ? '잔잔하게 유지되고 있어요 🌿' : '조금 힘든 시기예요 💚'}
            </p>
            <MoodChart series={series} />
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
      </div>

      {/* 흡연 추세 */}
      <div className="bg-white rounded-2xl shadow-elevated p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🚬</span>
          <h3 className="text-sm font-bold text-gray-800">흡연 추세</h3>
          <span className="text-[11px] text-gray-400 ml-auto">최근 14일 · 총 {stats?.smokeTotal ?? 0}개비</span>
        </div>
        {(stats?.smokeTotal ?? 0) === 0
          ? <p className="text-[13px] text-gray-500 py-6 text-center">기록된 흡연이 없어요. 잘하고 있어요! 💚</p>
          : <DailyBars series={stats.smokingTrend} />}
      </div>

      {/* 자주 피는 시간대 */}
      <div className="bg-white rounded-2xl shadow-elevated p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">⏰</span>
          <h3 className="text-sm font-bold text-gray-800">자주 피는 시간대</h3>
        </div>
        {(stats?.smokeHourHist?.some(n => n > 0))
          ? <HourlyChart data={stats.smokeHourHist} color="#fb923c" />
          : <p className="text-[13px] text-gray-500 py-6 text-center">흡연 기록에 「핀 시각」을 적으면 시간대 패턴이 보여요.</p>}
      </div>

      {/* 욕구가 강한 시간대 */}
      <div className="bg-white rounded-2xl shadow-elevated p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">🔥</span>
          <h3 className="text-sm font-bold text-gray-800">욕구가 강한 시간대</h3>
        </div>
        {(stats?.cravingTotal ?? 0) > 0
          ? <HourlyChart data={stats.cravingHourHist} color="#f87171" />
          : <p className="text-[13px] text-gray-500 py-6 text-center">「흡연 욕구가 올라온 순간」을 기록하면 시간대가 보여요.</p>}
      </div>

      {/* 흡연 욕구 요인 — 참가자가 적은 내용 */}
      <div className="bg-white rounded-2xl shadow-elevated p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">💭</span>
          <h3 className="text-sm font-bold text-gray-800">흡연 욕구 요인</h3>
          <span className="text-[11px] text-gray-400 ml-auto">적은 내용</span>
        </div>
        {notes.length === 0 ? (
          <p className="text-[13px] text-gray-500 py-6 text-center">「흡연 욕구가 올라온 순간」에 적은 기록이 여기 모여요.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n, i) => (
              <li key={i} className="border-l-2 border-rose-200 pl-3 py-0.5">
                <span className="block text-[13px] text-gray-700 leading-snug break-keep">{n.text}</span>
                <span className="text-[11px] text-gray-400">{noteWhen(n.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

// 일자별 흡연 개비 막대 (최근 14일)
function DailyBars({ series }) {
  const max = Math.max(1, ...series.map(s => s.cigarettes))
  return (
    <>
      <div className="flex items-end gap-[3px] h-20">
        {series.map((s, i) => {
          const pct = (s.cigarettes / max) * 100
          return (
            <div key={i} className="flex-1 flex flex-col justify-end h-full" title={`${s.date} · ${s.cigarettes}개비`}>
              <div className={`w-full rounded-sm ${s.cigarettes === 0 ? 'bg-gray-100' : 'bg-orange-300'}`} style={{ height: s.cigarettes === 0 ? '3px' : `${Math.max(8, pct)}%` }} />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-400">
        <span>{series[0]?.date.slice(5)}</span>
        <span>{series[series.length - 1]?.date.slice(5)}</span>
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

// 기분 라인 차트 — x=일자, y=기분(1~5)
function MoodChart({ series }) {
  const W = 320, H = 96, padX = 6, padY = 12
  const n = series.length
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
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={MOOD_META[p.mood].color} />
      ))}
    </svg>
  )
}

export default ProgramChangeTab
