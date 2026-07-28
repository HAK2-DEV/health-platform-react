import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import {
  queryKeys, fetchProgram, fetchPendingReviewsEnriched, fetchProgramReviewStats,
  fetchProgramTodayParticipation, fetchProgramOperatorToday, fetchProgramApproved, fetchProgramRejected,
  fetchProgramParticipants, invalidateParticipation,
} from '../../lib/queries'
import UserAvatar from '../../components/common/UserAvatar'
import LoadingState from '../../components/common/LoadingState'
import EmptyState from '../../components/common/EmptyState'
import ReportsManageSection from '../../components/program/ReportsManageSection'

// 「오늘의 운영」 상세 — 단일 4탭 (/programs/:id/operator-today?tab=review|join|report|rate).
//   대시보드 「오늘의 운영 현황」 타일 클릭 시 진입. 선택 프로그램 기준.
//   인증심사·참여승인은 인라인 처리(승인/거절), 신고처리는 ReportsManageSection 재사용, 참여율은 오늘 인증/미인증 명단.
const ICON = { review: '/icons/operator/review.png', join: '/icons/operator/approve.png', report: '/icons/operator/report-flag.png', rate: '/icons/operator/rate.png' }
const TAB_KEYS = ['review', 'join', 'report', 'rate']
const TABS = [
  { key: 'review', label: '인증 심사', accent: 'bg-emerald-50 text-emerald-700' },
  { key: 'join', label: '참여 승인', accent: 'bg-sky-50 text-sky-700' },
  { key: 'report', label: '신고 처리', accent: 'bg-amber-50 text-amber-700' },
  { key: 'rate', label: '참여율', accent: 'bg-violet-50 text-violet-700' },
]

const fmtTime = (ts) => ts ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }).format(new Date(ts)) : ''
// 월·일·시간 (연도 제외) — 예: "7월 20일 오전 12:06"
const fmtDayTime = (ts) => ts ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts)) : ''

function OperatorTodayPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = session?.user?.id

  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const tab = TAB_KEYS.includes(rawTab) ? rawTab : 'review'
  const setTab = (t) => setSearchParams({ tab: t }, { replace: true })

  const { data: program, isLoading: isProgramLoading } = useQuery({
    queryKey: queryKeys.program(id),
    queryFn: () => fetchProgram(id),
    enabled: !!session && !!id,
  })
  const isOwner = program?.owner_id === userId

  // 탭 뱃지 카운트 (심사/승인/신고/참여율) — 대시보드와 동일 캐시 공유
  const { data: op } = useQuery({
    queryKey: queryKeys.programOperatorToday(id),
    queryFn: () => fetchProgramOperatorToday(id),
    enabled: !!session && !!id && isOwner,
  })
  const counts = {
    review: op?.review ?? 0, join: op?.join ?? 0,
    report: op?.report ?? 0, rate: `${op?.todayRate ?? 0}%`,
  }

  const invalidateBadges = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.programOperatorToday(id) })
    queryClient.invalidateQueries({ queryKey: ['home-stats'] })
  }

  // 스크롤 위치 보존 — 「보러가기」로 게시글을 보고 돌아올 때 이전 위치 복원.
  //   App 의 전역 scrollTo(0,0)(pathname 변경 시)이 나중에 실행되므로, 그 이후 double rAF 로 복원.
  useEffect(() => {
    const key = `optoday-scroll:${id}`
    const saved = sessionStorage.getItem(key)
    if (saved != null) {
      sessionStorage.removeItem(key)
      const y = parseInt(saved, 10)
      if (y > 0) requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
    }
    return () => { sessionStorage.setItem(key, String(window.scrollY)) }
  }, [id])

  if (isProgramLoading) return <LoadingState variant="page" />
  if (!program) {
    return (
      <div className="p-6 max-w-md mx-auto">
        <p className="p-4 bg-red-100 text-red-700 rounded">프로그램을 찾을 수 없습니다</p>
        <Link to="/dashboard" className="block mt-4 text-emerald-600 hover:underline">← 대시보드로</Link>
      </div>
    )
  }
  if (!isOwner) {
    return (
      <div className="px-4 pt-4 pb-6 max-w-md mx-auto">
        <button type="button" onClick={() => navigate('/dashboard')} className="w-9 h-9 -ml-1 mb-2 flex items-center justify-center rounded-full hover:bg-gray-100">
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <p className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded text-center">운영자만 볼 수 있어요</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-[460px] mx-auto h-[52px] px-2 flex items-center">
          <button type="button" onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
          <h1 className="flex-1 text-center text-[16px] font-extrabold text-gray-900">오늘의 운영</h1>
          <span className="w-9 h-9" aria-hidden="true" />
        </div>
        <div className="max-w-[460px] mx-auto flex px-2">
          {TABS.map(t => {
            const on = t.key === tab
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`flex-1 pb-2.5 pt-1 flex flex-col items-center gap-1 border-b-2 transition ${on ? 'border-emerald-500' : 'border-transparent'}`}>
                <span className={`text-[12px] font-bold ${on ? 'text-gray-900' : 'text-gray-400'}`}>{t.label}</span>
                <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center ${on ? t.accent : 'bg-gray-100 text-gray-400'}`}>{counts[t.key]}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-[460px] mx-auto px-4 py-4">
        {tab === 'review' && <ReviewTab programId={id} session={session} onChanged={invalidateBadges} />}
        {tab === 'join' && <JoinTab programId={id} onChanged={invalidateBadges} />}
        {tab === 'report' && <ReportsManageSection programId={id} returnTo={`/programs/${id}/operator-today?tab=report`} />}
        {tab === 'rate' && <RateTab programId={id} />}
      </div>
    </div>
  )
}

// ── 인증 심사 탭 ───────────────────────────────────────────────
function ReviewTab({ programId, session, onChanged }) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState('pending')   // 아코디언: pending | approved | rejected | null
  const { data: stats } = useQuery({
    queryKey: queryKeys.programReviewStats(programId),
    queryFn: () => fetchProgramReviewStats(programId),
    enabled: !!programId,
  })
  const { data: pending = [], isLoading } = useQuery({
    queryKey: queryKeys.pendingReviews(programId),
    queryFn: () => fetchPendingReviewsEnriched(programId),
    enabled: !!programId,
  })

  // 인증 사진 signed URL
  const [imageUrls, setImageUrls] = useState({})
  useEffect(() => {
    const targets = pending.filter(r => r.v_image_path)
    if (targets.length === 0) { setImageUrls({}); return }
    let cancelled = false
    Promise.all(targets.map(r =>
      supabase.storage.from('verification-images').createSignedUrl(r.v_image_path, 3600)
        .then(({ data }) => ({ id: r.v_id, url: data?.signedUrl || null }))
        .catch(() => ({ id: r.v_id, url: null }))
    )).then(results => {
      if (cancelled) return
      const map = {}
      for (const r of results) if (r.url) map[r.id] = r.url
      setImageUrls(map)
    })
    return () => { cancelled = true }
  }, [pending.length])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pendingReviews(programId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.programReviewStats(programId) })
    queryClient.invalidateQueries({ queryKey: ['scores'] })
    queryClient.invalidateQueries({ queryKey: ['rankings'] })
    queryClient.invalidateQueries({ queryKey: ['stats'] })
    queryClient.invalidateQueries({ queryKey: ['feed'] })
    onChanged()
  }
  const approveMutation = useMutation({
    mutationFn: async (vid) => {
      const { error } = await supabase.from('verifications')
        .update({ status: 'APPROVED', reviewed_at: new Date().toISOString(), reviewer_id: session.user.id })
        .eq('id', vid)
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (e) => alert(`승인 실패: ${e.message}`),
  })
  const rejectMutation = useMutation({
    mutationFn: async ({ vid, reason }) => {
      const { error } = await supabase.from('verifications')
        .update({ status: 'REJECTED', reviewed_at: new Date().toISOString(), reviewer_id: session.user.id, rejection_reason: reason })
        .eq('id', vid)
      if (error) throw error
    },
    onSuccess: invalidate,
    onError: (e) => alert(`반려 실패: ${e.message}`),
  })
  const busy = approveMutation.isPending || rejectMutation.isPending

  const [rejectingId, setRejectingId] = useState(null)
  const [reason, setReason] = useState('')
  const submitReject = () => {
    if (!reason.trim()) return
    rejectMutation.mutate({ vid: rejectingId, reason: reason.trim() }, {
      onSuccess: () => { setRejectingId(null); setReason('') },
    })
  }

  return (
    <div className="space-y-2.5">
      {/* 오늘 심사 현황 통계 박스 — 세 박스 모두 탭 시 아래로 펼침(아코디언) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft flex divide-x divide-gray-100 overflow-hidden">
        {[
          { key: 'pending', label: '대기', value: stats?.pending ?? pending.length, cls: 'text-amber-500' },
          { key: 'approved', label: `누적 승인 ${stats?.approvedTotal ?? 0}건`, value: stats?.approvedToday ?? 0, cls: 'text-emerald-600' },
          { key: 'rejected', label: '오늘 거절', value: stats?.rejectedToday ?? 0, cls: 'text-gray-500' },
        ].map(s => {
          const on = expanded === s.key
          return (
            <button key={s.key} type="button" onClick={() => setExpanded(cur => cur === s.key ? null : s.key)}
              className={`flex-1 py-3 px-1 text-center transition ${on ? 'bg-gray-100/80' : 'hover:bg-gray-50 active:bg-gray-100'}`}>
              <p className={`text-[22px] font-extrabold leading-none ${s.cls}`}>{s.value}<span className="text-[12px] text-gray-400 font-bold ml-0.5">건</span></p>
              <p className="text-[11px] text-gray-500 mt-1 inline-flex items-center justify-center gap-0.5 whitespace-nowrap">
                {s.label}<ChevronRight className={`w-3 h-3 text-gray-400 transition-transform ${on ? 'rotate-90' : ''}`} />
              </p>
            </button>
          )
        })}
      </div>

      {/* 누적 승인 아코디언 */}
      {expanded === 'approved' && <ApprovedList programId={programId} />}
      {/* 오늘 거절 아코디언 */}
      {expanded === 'rejected' && <RejectedList programId={programId} />}

      {/* 대기 아코디언 — 심사(승인/반려) */}
      {expanded === 'pending' && (isLoading ? (
        <LoadingState />
      ) : pending.length === 0 ? (
        <EmptyState icon="📭" title="심사 대기 중인 인증이 없어요" />
      ) : pending.map(r => {
        const hasNote = !!r.v_note && r.v_note.trim().length > 0
        return (
          <div key={r.v_id} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-3.5">
            <div className="flex items-start gap-3">
              <UserAvatar avatarPath={r.u_avatar_path} nickname={r.u_nickname} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-gray-900 truncate">{r.u_nickname}</p>
                <p className="text-[12.5px] font-semibold text-gray-600 truncate">{r.m_title}</p>
                {hasNote && <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">“{r.v_note}”</p>}
              </div>
              <p className="text-[11px] text-gray-400 flex-shrink-0">{fmtTime(r.v_submitted_at)}</p>
            </div>
            {r.v_image_path && (
              imageUrls[r.v_id] ? (
                <a href={imageUrls[r.v_id]} target="_blank" rel="noopener noreferrer" className="block mt-2">
                  <img src={imageUrls[r.v_id]} alt="인증 사진" className="w-full max-h-56 object-contain rounded-xl bg-gray-50 border border-gray-100" />
                </a>
              ) : (
                <div className="mt-2 h-24 rounded-xl bg-gray-100 flex items-center justify-center text-[12px] text-gray-400">사진 불러오는 중...</div>
              )
            )}
            {rejectingId === r.v_id ? (
              <div className="mt-2.5">
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={100} autoFocus disabled={busy}
                  placeholder="반려 사유를 입력해주세요"
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-red-400 resize-none text-sm disabled:bg-gray-50" />
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => { setRejectingId(null); setReason('') }} disabled={busy}
                    className="flex-1 h-9 rounded-xl bg-gray-100 text-gray-600 text-[13px] font-bold disabled:opacity-50">취소</button>
                  <button type="button" onClick={submitReject} disabled={busy || !reason.trim()}
                    className="flex-[2] h-9 rounded-xl bg-red-500 text-white text-[13px] font-bold disabled:bg-gray-300">{busy ? '처리 중...' : '반려 확정'}</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-2.5">
                <button type="button" onClick={() => setRejectingId(r.v_id)} disabled={busy}
                  className="flex-1 h-9 rounded-xl border-2 border-red-200 text-red-600 text-[13px] font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"><X className="w-4 h-4" />반려</button>
                <button type="button" onClick={() => approveMutation.mutate(r.v_id)} disabled={busy}
                  className="flex-[2] h-9 rounded-xl bg-emerald-500 text-white text-[13px] font-bold inline-flex items-center justify-center gap-1 disabled:bg-gray-300"><Check className="w-4 h-4" />승인</button>
              </div>
            )}
          </div>
        )
      }))}
    </div>
  )
}

// ── 참여 승인 탭 ───────────────────────────────────────────────
function JoinTab({ programId, onChanged }) {
  const queryClient = useQueryClient()
  const { data: pending = [], isLoading } = useQuery({
    queryKey: ['program-pending', programId],
    queryFn: async () => {
      const { data: pp, error } = await supabase
        .from('program_participants')
        .select('id, user_id, status, joined_at, entry_answer')
        .eq('program_id', programId).eq('status', 'PENDING')
        .order('joined_at', { ascending: true })
      if (error) throw error
      if (!pp?.length) return []
      const uids = pp.map(r => r.user_id)
      const { data: users } = await supabase.from('users').select('id, nickname, avatar_path').in('id', uids)
      const umap = new Map((users || []).map(u => [u.id, u]))
      return pp.map(r => ({ ...r, user: umap.get(r.user_id) || null }))
    },
    enabled: !!programId,
  })

  // 전체 ACTIVE 참여자 (공개 프로그램 자동 참가 등 — 승인 없이 바로 참가). 오늘 참가는 여기서 파생.
  const [showAll, setShowAll] = useState(false)
  const { data: participants = [] } = useQuery({
    queryKey: queryKeys.programParticipants(programId),
    queryFn: () => fetchProgramParticipants(programId),
    enabled: !!programId,
  })
  const joinedToday = useMemo(() => {
    const todayStr = kstDateStr(new Date())
    return participants.filter(p => kstDateStr(p.joined_at) === todayStr)
  }, [participants])

  const reviewMutation = useMutation({
    mutationFn: async ({ participationId, action }) => {
      const { error } = await supabase.from('program_participants')
        .update({ status: action === 'approve' ? 'ACTIVE' : 'REJECTED' })
        .eq('id', participationId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-pending', programId] })
      queryClient.invalidateQueries({ queryKey: ['program-pending-count', programId] })
      queryClient.invalidateQueries({ queryKey: queryKeys.programParticipants(programId) })  // 승인 시 참가자 목록 반영
      queryClient.invalidateQueries({ queryKey: ['rankings'] })
      invalidateParticipation(queryClient, { programId })
      onChanged()
    },
    onError: (e) => alert(`처리 실패: ${e.message}`),
  })
  const busy = reviewMutation.isPending

  if (isLoading) return <LoadingState />
  if (pending.length === 0 && participants.length === 0) {
    return <EmptyState icon="✅" title="승인 대기·참가한 사람이 없어요" />
  }

  return (
    <div className="space-y-2.5">
      {/* 승인 대기 — 승인/거절 필요 */}
      {pending.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <p className="text-[13px] font-bold text-amber-600">승인 대기 {pending.length}건</p>
          </div>
          {pending.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-3.5">
              <div className="flex items-center gap-3">
                <UserAvatar avatarPath={p.user?.avatar_path} nickname={p.user?.nickname} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-gray-900 truncate">{p.user?.nickname || '(?)'}</p>
                  <p className="text-[11px] text-gray-400">신청 · {fmtTime(p.joined_at)}</p>
                </div>
              </div>
              {p.entry_answer && (
                <div className="mt-2 rounded-xl bg-gray-50 p-2.5 text-[12.5px] text-gray-600 whitespace-pre-wrap break-words">📝 {p.entry_answer}</div>
              )}
              <div className="flex gap-2 mt-2.5">
                <button type="button" onClick={() => reviewMutation.mutate({ participationId: p.id, action: 'reject' })} disabled={busy}
                  className="flex-1 h-9 rounded-xl border-2 border-red-200 text-red-600 text-[13px] font-bold inline-flex items-center justify-center gap-1 disabled:opacity-50"><X className="w-4 h-4" />거절</button>
                <button type="button" onClick={() => reviewMutation.mutate({ participationId: p.id, action: 'approve' })} disabled={busy}
                  className="flex-[2] h-9 rounded-xl bg-emerald-500 text-white text-[13px] font-bold inline-flex items-center justify-center gap-1 disabled:bg-gray-300"><Check className="w-4 h-4" />승인</button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* 오늘 참가 — 승인 없이 바로 참가(공개 프로그램 등). 읽기 전용 */}
      {joinedToday.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 pt-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <p className="text-[13px] font-bold text-emerald-700">오늘 참가 {joinedToday.length}명</p>
          </div>
          {joinedToday.map(p => <ParticipantRow key={p.id} p={p} />)}
        </>
      )}

      {/* 전체 참가자 — 접힘 기본, 탭 시 전체 명단 펼침 */}
      {participants.length > 0 && (
        <>
          <button type="button" onClick={() => setShowAll(v => !v)}
            className="w-full flex items-center gap-1.5 pt-3 text-left">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            <p className="text-[13px] font-bold text-gray-500">전체 참가자 {participants.length}명</p>
            <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showAll ? 'rotate-90' : ''}`} />
          </button>
          {showAll && participants.map(p => <ParticipantRow key={p.id} p={p} />)}
        </>
      )}
    </div>
  )
}

// 참가자 한 줄 (읽기 전용) — 아바타 + 닉네임 + 참가 시각 + 「참가함」
function ParticipantRow({ p }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-soft px-3.5 py-2.5">
      <UserAvatar avatarPath={p.user?.avatar_path} nickname={p.user?.nickname} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-gray-800 truncate">{p.user?.nickname || '(?)'}</p>
        <p className="text-[11px] text-gray-400">참가 · {fmtDayTime(p.joined_at)}</p>
      </div>
      <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 flex-shrink-0">
        <Check className="w-3.5 h-3.5" />참가함
      </span>
    </div>
  )
}

// ── 참여율 탭 ─────────────────────────────────────────────────
function RateTab({ programId }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.programTodayParticipation(programId),
    queryFn: () => fetchProgramTodayParticipation(programId),
    enabled: !!programId,
  })
  if (isLoading || !data) return <LoadingState />

  return (
    <div className="space-y-2.5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 flex items-center gap-4">
        <img src={ICON.rate} alt="" aria-hidden="true" className="w-14 h-14 object-contain" />
        <div>
          <p className="text-[12px] font-semibold text-gray-500">오늘 참여율</p>
          <p className="text-[28px] font-extrabold text-gray-900 leading-none mt-0.5">{data.rate}<span className="text-[16px] text-gray-400">%</span></p>
          <p className="text-[12px] text-gray-500 mt-1">참여자 {data.participants}명 중 {data.done.length}명 인증</p>
        </div>
      </div>

      <p className="text-[12px] font-bold text-emerald-600 mt-3 mb-1">오늘 인증함 ({data.done.length})</p>
      {data.done.length === 0 ? (
        <p className="text-[12px] text-gray-400 bg-white rounded-xl border border-gray-100 px-3.5 py-3">아직 오늘 인증한 참여자가 없어요</p>
      ) : data.done.map(u => (
        <div key={u.user_id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-soft px-3.5 py-2.5">
          <UserAvatar avatarPath={u.avatar_path} nickname={u.nickname} size="sm" />
          <span className="flex-1 text-[13px] font-semibold text-gray-800 truncate">{u.nickname}</span>
          <span className="text-[11px] text-emerald-600 font-bold flex-shrink-0">✓ {fmtTime(u.time)}</span>
        </div>
      ))}

      {data.notYet.length > 0 && (
        <>
          <p className="text-[12px] font-bold text-gray-400 mt-3 mb-1">아직 안 함 ({data.notYet.length})</p>
          {data.notYet.map(u => (
            <div key={u.user_id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-soft px-3.5 py-2.5 opacity-70">
              <UserAvatar avatarPath={u.avatar_path} nickname={u.nickname} size="sm" />
              <span className="flex-1 text-[13px] font-semibold text-gray-600 truncate">{u.nickname}</span>
              <span className="text-[11px] text-gray-400 flex-shrink-0">미인증</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

// ── 인증 심사 → 「누적 승인」 드릴다운 (읽기 전용 · 오늘/이전 구분) ──────────────
const kstDateStr = (ts) => ts ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts)) : ''
const fmtDay = (ts) => ts ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(new Date(ts)) : ''

function ApprovedCard({ v, url }) {
  const hasNote = !!v.note && v.note.trim().length > 0
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-3.5">
      <div className="flex items-start gap-3">
        <UserAvatar avatarPath={v.user?.avatar_path} nickname={v.user?.nickname} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-gray-900 truncate">{v.user?.nickname || '(?)'}</p>
          <p className="text-[12.5px] font-semibold text-gray-600 truncate">{v.missions?.title || '(미션)'}</p>
          {hasNote && <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">“{v.note}”</p>}
        </div>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-emerald-600 flex-shrink-0">
          <Check className="w-3.5 h-3.5" />{fmtTime(v.reviewed_at)}
        </span>
      </div>
      {v.image_path && url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
          <img src={url} alt="인증 사진" className="w-full max-h-56 object-contain rounded-xl bg-gray-50 border border-gray-100" />
        </a>
      )}
    </div>
  )
}

function ApprovedList({ programId }) {
  const { data: items = [], isLoading, isError, error } = useQuery({
    queryKey: queryKeys.programApproved(programId),
    queryFn: () => fetchProgramApproved(programId),
    enabled: !!programId,
  })

  // 인증 사진 signed URL
  const [imageUrls, setImageUrls] = useState({})
  useEffect(() => {
    const targets = items.filter(v => v.image_path)
    if (targets.length === 0) { setImageUrls({}); return }
    let cancelled = false
    Promise.all(targets.map(v =>
      supabase.storage.from('verification-images').createSignedUrl(v.image_path, 3600)
        .then(({ data }) => ({ id: v.id, url: data?.signedUrl || null }))
        .catch(() => ({ id: v.id, url: null }))
    )).then(results => {
      if (cancelled) return
      const map = {}
      for (const r of results) if (r.url) map[r.id] = r.url
      setImageUrls(map)
    })
    return () => { cancelled = true }
  }, [items.length])

  // 오늘(KST) / 이전 구분
  const { today, earlier } = useMemo(() => {
    const todayStr = kstDateStr(new Date())
    const today = [], earlier = []
    for (const v of items) (kstDateStr(v.reviewed_at) === todayStr ? today : earlier).push(v)
    return { today, earlier }
  }, [items])

  return (
    <div className="space-y-2.5 pt-1">
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <p className="text-[12px] text-red-500 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">불러오기 실패: {error?.message || '알 수 없는 오류'}</p>
      ) : items.length === 0 ? (
        <EmptyState icon="✅" title="승인한 인증이 없어요" />
      ) : (
        <>
          {/* 오늘 승인 */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <p className="text-[13px] font-bold text-emerald-700">오늘 승인 {today.length}건</p>
          </div>
          {today.length === 0 ? (
            <p className="text-[12px] text-gray-400 bg-white rounded-xl border border-gray-100 px-3.5 py-3">오늘 승인한 인증이 없어요</p>
          ) : today.map(v => <ApprovedCard key={v.id} v={v} url={imageUrls[v.id]} />)}

          {/* 이전 승인 */}
          {earlier.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 pt-3">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                <p className="text-[13px] font-bold text-gray-400">이전 승인 {earlier.length}건</p>
              </div>
              {earlier.map((v, i) => {
                const prev = earlier[i - 1]
                const showDay = !prev || kstDateStr(prev.reviewed_at) !== kstDateStr(v.reviewed_at)
                return (
                  <div key={v.id} className="space-y-2.5">
                    {showDay && <p className="text-[11px] font-semibold text-gray-400 pt-1 pl-0.5">{fmtDay(v.reviewed_at)}</p>}
                    <ApprovedCard v={v} url={imageUrls[v.id]} />
                  </div>
                )
              })}
            </>
          )}
        </>
      )}
    </div>
  )
}

// ── 인증 심사 → 「오늘 거절」 드릴다운 (읽기 전용 · 반려 사유 · 오늘/이전 구분) ──────────────
function RejectedCard({ v, url }) {
  const hasReason = !!v.rejection_reason && v.rejection_reason.trim().length > 0
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-3.5">
      <div className="flex items-start gap-3">
        <UserAvatar avatarPath={v.user?.avatar_path} nickname={v.user?.nickname} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-gray-900 truncate">{v.user?.nickname || '(?)'}</p>
          <p className="text-[12.5px] font-semibold text-gray-600 truncate">{v.missions?.title || '(미션)'}</p>
        </div>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-red-500 flex-shrink-0">
          <X className="w-3.5 h-3.5" />{fmtTime(v.reviewed_at)}
        </span>
      </div>
      {hasReason && (
        <div className="mt-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2">
          <p className="text-[11px] font-bold text-red-500 mb-0.5">반려 사유</p>
          <p className="text-[12.5px] text-gray-700 whitespace-pre-wrap break-words leading-snug">{v.rejection_reason}</p>
        </div>
      )}
      {v.image_path && url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
          <img src={url} alt="인증 사진" className="w-full max-h-56 object-contain rounded-xl bg-gray-50 border border-gray-100" />
        </a>
      )}
    </div>
  )
}

function RejectedList({ programId }) {
  const { data: items = [], isLoading, isError, error } = useQuery({
    queryKey: queryKeys.programRejected(programId),
    queryFn: () => fetchProgramRejected(programId),
    enabled: !!programId,
  })

  const [imageUrls, setImageUrls] = useState({})
  useEffect(() => {
    const targets = items.filter(v => v.image_path)
    if (targets.length === 0) { setImageUrls({}); return }
    let cancelled = false
    Promise.all(targets.map(v =>
      supabase.storage.from('verification-images').createSignedUrl(v.image_path, 3600)
        .then(({ data }) => ({ id: v.id, url: data?.signedUrl || null }))
        .catch(() => ({ id: v.id, url: null }))
    )).then(results => {
      if (cancelled) return
      const map = {}
      for (const r of results) if (r.url) map[r.id] = r.url
      setImageUrls(map)
    })
    return () => { cancelled = true }
  }, [items.length])

  const { today, earlier } = useMemo(() => {
    const todayStr = kstDateStr(new Date())
    const today = [], earlier = []
    for (const v of items) (kstDateStr(v.reviewed_at) === todayStr ? today : earlier).push(v)
    return { today, earlier }
  }, [items])

  return (
    <div className="space-y-2.5 pt-1">
      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <p className="text-[12px] text-red-500 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">불러오기 실패: {error?.message || '알 수 없는 오류'}</p>
      ) : items.length === 0 ? (
        <EmptyState icon="🗂️" title="거절한 인증이 없어요" />
      ) : (
        <>
          {/* 오늘 거절 */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <p className="text-[13px] font-bold text-red-500">오늘 거절 {today.length}건</p>
          </div>
          {today.length === 0 ? (
            <p className="text-[12px] text-gray-400 bg-white rounded-xl border border-gray-100 px-3.5 py-3">오늘 거절한 인증이 없어요</p>
          ) : today.map(v => <RejectedCard key={v.id} v={v} url={imageUrls[v.id]} />)}

          {/* 이전 거절 */}
          {earlier.length > 0 && (
            <>
              <div className="flex items-center gap-1.5 pt-3">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                <p className="text-[13px] font-bold text-gray-400">이전 거절 {earlier.length}건</p>
              </div>
              {earlier.map((v, i) => {
                const prev = earlier[i - 1]
                const showDay = !prev || kstDateStr(prev.reviewed_at) !== kstDateStr(v.reviewed_at)
                return (
                  <div key={v.id} className="space-y-2.5">
                    {showDay && <p className="text-[11px] font-semibold text-gray-400 pt-1 pl-0.5">{fmtDay(v.reviewed_at)}</p>}
                    <RejectedCard v={v} url={imageUrls[v.id]} />
                  </div>
                )
              })}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default OperatorTodayPage
