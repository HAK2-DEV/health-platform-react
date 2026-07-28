import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Users, ChevronDown, Check } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchProgram, fetchProgramClassStats, fetchProgramClassRoster } from '../../lib/queries'
import { catOf } from '../../lib/classCategories'
import { calcProgress, progressUrgency } from '../../lib/programVisuals'
import StickyBackBar from '../../components/common/StickyBackBar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import { Reveal, CountUp } from '../../components/program/statsAnim'

// 운영자 통계 — 클래스 현황 (세션별 신청·출석·출석률)
// 라우트: /programs/:id/stats/classes
const WD = ['일', '월', '화', '수', '목', '금', '토']
const whenLabel = (iso) => {
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]}) ${hh}:${mm}`
}

function SessionRow({ s, index, roster }) {
  const c = catOf(s.category)
  const isRsvp = s.signup_mode === 'rsvp'
  const rate = s.registered > 0 ? Math.round((s.confirmed / s.registered) * 100) : null
  const isPast = new Date(s.starts_at).getTime() < Date.now()
  const [open, setOpen] = useState(false)
  // 종료 프로그램에서만 roster 가 내려온다 → 출석 명단 조회(읽기 전용)
  const attended = (roster || []).filter(p => p.att?.status === 'confirmed')
  return (
    <Reveal index={Math.min(index, 8)}>
      <div className="w-full rounded-2xl bg-white border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`inline-flex items-center gap-1 pl-1 pr-2 h-6 rounded-lg text-[11px] font-bold flex-shrink-0 ${c.pill}`}>
            {c.icon ? <img src={c.icon} alt="" aria-hidden="true" className="w-4 h-4 object-contain" /> : c.emoji} {c.label}
          </span>
          <span className="text-[11px] text-gray-400 ml-auto flex-shrink-0">{isRsvp ? '사전 신청' : '자유 참여'}{isPast ? ' · 종료' : ''}</span>
        </div>
        <p className="text-[15px] font-bold text-gray-900 mb-1.5 break-words">{s.title}</p>
        <div className="space-y-1 text-[12px] text-gray-500 mb-2.5">
          <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-gray-400" />{whenLabel(s.starts_at)}</p>
          <p className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-gray-400" />{s.instructor || '강사 미지정'} 강사{s.points ? ` · 출석 +${s.points}P` : ''}</p>
        </div>
        {/* 신청 / 출석 */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1 flex-shrink-0">
            <span className="text-[13px] text-gray-500">{isRsvp ? '신청' : '출석'}</span>
            <span className="text-[15px] font-extrabold text-gray-800 tabular-nums">
              {isRsvp ? s.registered : s.confirmed}
            </span>
            {isRsvp && s.capacity ? <span className="text-[11px] text-gray-400">/{s.capacity}</span> : null}
          </div>
          {isRsvp && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-emerald-600 font-bold">출석 {s.confirmed}명</span>
                {rate != null && <span className="text-gray-400 font-semibold">{rate}%</span>}
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${rate ?? 0}%`, transition: 'width .5s ease' }} />
              </div>
            </div>
          )}
          {!isRsvp && <span className="text-[11px] text-gray-400 ml-auto">출석 인원만 집계</span>}
        </div>

        {/* 출석 명단 — 종료 프로그램에서만 조회(읽기 전용). 관리(체크)는 클래스 관리에서. */}
        {roster && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
              className="w-full flex items-center gap-1.5 text-[12px] font-bold text-gray-500 hover:text-gray-700 transition">
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
              출석 명단 {attended.length}명 보기
            </button>
            {open && (
              attended.length === 0 ? (
                <p className="mt-2 text-[12px] text-gray-400 text-center py-2">출석한 참여자가 없어요</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {attended.map((p) => (
                    <li key={p.nickname} className="flex items-center gap-2 text-[13px]">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex-shrink-0"><Check className="w-3 h-3" strokeWidth={3} /></span>
                      <span className="text-gray-700 font-medium truncate">{p.nickname}</span>
                      {p.att?.method && <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">{p.att.method.includes('code') ? '코드' : p.att.method.includes('self') ? '자가' : '운영자'}</span>}
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        )}
      </div>
    </Reveal>
  )
}

function StatTile({ label, value, unit, valueClass = 'text-gray-900' }) {
  return (
    <div className="flex-1 rounded-2xl bg-white border border-gray-200 p-3.5 text-center">
      <p className="text-[11px] text-gray-500 mb-1">{label}</p>
      <p className="text-[20px] font-extrabold leading-none">
        <span className={valueClass}><CountUp value={value} /></span>
        {unit && <span className="text-[11px] text-gray-400 font-bold ml-0.5">{unit}</span>}
      </p>
    </div>
  )
}

export default function ProgramStatsClassesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id

  const { data: program } = useQuery({
    queryKey: queryKeys.program(id), queryFn: () => fetchProgram(id), enabled: !!session && !!id,
  })
  const isOwner = program?.owner_id === userId

  const { data: stats, isLoading } = useQuery({
    queryKey: ['program-class-stats', id], queryFn: () => fetchProgramClassStats(id),
    enabled: !!session && !!id && isOwner,
  })

  // 종료된 프로그램에서만 출석 명단 조회 허용(읽기 전용). 진행 중엔 클래스 관리에서 관리.
  const ended = !!program && progressUrgency(calcProgress(program.start_date, program.end_date)).urgency === 'ended'
  const { data: roster = [] } = useQuery({
    queryKey: ['program-class-roster', id], queryFn: () => fetchProgramClassRoster(id),
    enabled: !!session && !!id && isOwner && ended,
  })
  const rosterBySession = {}
  for (const r of roster) rosterBySession[r.id] = r.participants

  // 정렬 — 생성순(오래된 것부터, 기본) ↔ 최신순(최근 생성 먼저). created_at 기준.
  const [sortDesc, setSortDesc] = useState(false)

  if (!isOwner && program) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-2xl mx-auto">
        <StickyBackBar fallbackPath={`/programs/${id}/stats`} title="통계로" />
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-center">운영자만 통계를 볼 수 있어요</p>
      </div>
    )
  }
  if (isLoading || !program || !stats) return <LoadingState variant="page" />

  return (
    <div className="px-4 pt-2 pb-6 max-w-2xl mx-auto">
      <StickyBackBar fallbackPath={`/programs/${id}/stats`} title="통계로" breadcrumb={[program.name, '통계', '클래스']} />

      {stats.sessionCount === 0 ? (
        <EmptyState icon="🗓️" title="아직 등록된 클래스가 없어요" description="클래스를 만들면 신청·출석 현황이 여기에 모여요" variant="mint" size="lg" />
      ) : (
        <div className="space-y-3">
          {/* 요약 */}
          <Reveal index={0}>
            <div className="flex gap-2.5">
              <StatTile label="클래스" value={stats.sessionCount} unit="개" />
              <StatTile label="출석률" value={stats.attendanceRate ?? 0} unit="%" valueClass="text-emerald-600" />
              <StatTile label="참여자" value={stats.uniqueAttendees} unit="명" valueClass="text-sky-600" />
            </div>
          </Reveal>
          <Reveal index={1}>
            <div className="flex gap-2.5">
              <StatTile label="신청" value={stats.totalRegistered} unit="건" />
              <StatTile label="출석" value={stats.totalConfirmed} unit="건" valueClass="text-emerald-600" />
              <StatTile label="지급 포인트" value={stats.pointsGranted} unit="P" valueClass="text-violet-600" />
            </div>
          </Reveal>

          {/* 세션별 — 생성순/최신순 토글 */}
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <p className="text-xs text-gray-500 font-medium min-w-0 truncate">클래스별{ended ? ' · 출석 명단 조회 가능' : ''}</p>
            <div className="inline-flex items-center gap-0.5 bg-gray-100 rounded-full p-0.5 flex-shrink-0">
              <button type="button" onClick={() => setSortDesc(false)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${!sortDesc ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>생성순</button>
              <button type="button" onClick={() => setSortDesc(true)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${sortDesc ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'}`}>최신순</button>
            </div>
          </div>
          {[...stats.sessions]
            .sort((a, b) => sortDesc
              ? new Date(b.created_at) - new Date(a.created_at)
              : new Date(a.created_at) - new Date(b.created_at))
            .map((s, i) => (
              <SessionRow key={s.id} s={s} index={i} roster={ended ? (rosterBySession[s.id] || []) : undefined} />
            ))}

          <p className="text-[11px] text-gray-400 text-center pt-1 leading-relaxed">
            {ended
              ? <>여기선 <b className="text-gray-500">조회만</b> 가능해요. 출석 체크·수정은 <button type="button" onClick={() => navigate(`/programs/${id}?opmenu=classes`)} className="text-emerald-600 font-semibold underline">클래스 관리</button>에서.</>
              : <>신청자·출석자 명단·출석 관리는 <button type="button" onClick={() => navigate(`/programs/${id}?opmenu=classes`)} className="text-emerald-600 font-semibold underline">클래스 관리</button>에서.</>}
          </p>
        </div>
      )}
    </div>
  )
}
