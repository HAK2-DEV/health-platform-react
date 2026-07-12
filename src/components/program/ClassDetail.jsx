import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, MapPin, Users, Loader2 } from 'lucide-react'
import { fetchSession, fetchMyRegistrations, registerSession, cancelSessionRegistration } from '../../lib/queries'
import { catOf } from '../../lib/classCategories'

// 참가자 클래스 상세 — 히어로·강사·정보·안내 + 신청/취소(RSVP).
//   참가자는 정원·본인 상태만(명단은 RLS 로 비공개). 운영자는 「클래스 관리」에서 명단 확인.
const WD = ['일', '월', '화', '수', '목', '금', '토']
const dLabel = (iso) => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})` }
const tLabel = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

export default function ClassDetail({ sessionId, programId, userId, isOwner = false }) {
  const qc = useQueryClient()
  const { data: s, isLoading } = useQuery({ queryKey: ['session', sessionId], queryFn: () => fetchSession(sessionId), enabled: !!sessionId })
  const { data: myRegs = {} } = useQuery({
    queryKey: ['my-registrations', programId, userId], queryFn: () => fetchMyRegistrations({ programId, userId }), enabled: !!programId && !!userId,
  })
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['session', sessionId] })
    qc.invalidateQueries({ queryKey: ['sessions', programId] })
    qc.invalidateQueries({ queryKey: ['my-registrations', programId, userId] })
  }
  const mReg = useMutation({ mutationFn: () => registerSession({ sessionId, userId }), onSuccess: invalidate })
  const mCancel = useMutation({ mutationFn: () => cancelSessionRegistration({ sessionId, userId }), onSuccess: invalidate })
  const busy = mReg.isPending || mCancel.isPending

  if (isLoading) return <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
  if (!s) return <p className="text-[13px] text-gray-500 py-16 text-center">클래스를 찾을 수 없어요.</p>

  const c = catOf(s.category)
  const mine = myRegs[s.id] === 'registered'
  const full = s.capacity != null && (s.joined ?? 0) >= s.capacity && !mine
  const isRsvp = s.signup_mode === 'rsvp'

  return (
    <div className="space-y-[9px]">
      {/* 히어로 */}
      <div className={`rounded-2xl overflow-hidden shadow-elevated bg-gradient-to-br ${c.grad} p-5 min-h-[120px] flex flex-col justify-end`}>
        <span className="inline-flex w-fit items-center gap-1 px-2 h-6 rounded-lg text-[11px] font-bold bg-white/90 text-gray-700 mb-1.5">{c.emoji} {c.label}</span>
        <h2 className="text-xl font-extrabold text-white leading-tight break-keep">{s.title}</h2>
      </div>

      {/* 강사 카드 */}
      {s.instructor && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4 flex items-center gap-3">
          <span className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 text-lg font-bold flex items-center justify-center flex-shrink-0">{(s.instructor.name || '?')[0]}</span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-gray-900">{s.instructor.name} 강사</p>
            {s.instructor.specialty && <p className="text-[12px] text-gray-500">{s.instructor.specialty}</p>}
            {s.instructor.bio && <p className="text-[12px] text-gray-500 mt-0.5 break-keep leading-snug">{s.instructor.bio}</p>}
          </div>
        </div>
      )}

      {/* 정보 */}
      <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4 space-y-2.5">
        <p className="flex items-center gap-2 text-[13px] text-gray-700"><Calendar className="w-4 h-4 text-emerald-500 flex-shrink-0" />{dLabel(s.starts_at)} {tLabel(s.starts_at)}{s.ends_at ? `~${tLabel(s.ends_at)}` : ''}</p>
        {(s.place_name || s.place_address) && (
          <p className="flex items-center gap-2 text-[13px] text-gray-700"><MapPin className="w-4 h-4 text-emerald-500 flex-shrink-0" />{[s.place_name, s.place_address].filter(Boolean).join(' · ')}</p>
        )}
        <p className="flex items-center gap-2 text-[13px] text-gray-700"><Users className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          {isRsvp ? `정원 ${s.joined ?? 0}/${s.capacity ?? '∞'}명 · 사전 신청` : '자유 참여'}{s.points ? ` · 출석 +${s.points}P` : ''}
        </p>
      </div>

      {/* 안내 */}
      {s.description && (
        <div className="rounded-2xl bg-white border border-gray-100 shadow-soft p-4">
          <p className="text-[13px] font-bold text-gray-800 mb-1">안내 · 준비물</p>
          <p className="text-[12px] text-gray-500 leading-relaxed break-keep">{s.description}</p>
        </div>
      )}

      {/* CTA — 운영자는 관리 안내, 참가자는 신청 */}
      {isOwner ? (
        <div className="w-full h-12 rounded-2xl bg-gray-50 text-gray-500 text-[13px] font-semibold flex items-center justify-center">운영자는 「클래스 관리」에서 명단·출석을 관리해요</div>
      ) : !isRsvp ? (
        <div className="w-full h-12 rounded-2xl bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center">자유 참여 · 신청 없이 참석하세요</div>
      ) : mine ? (
        <button type="button" onClick={() => mCancel.mutate()} disabled={busy}
          className="w-full h-12 rounded-2xl bg-emerald-50 text-emerald-600 font-bold border border-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}신청 취소 (신청됨 ✓)
        </button>
      ) : full ? (
        <div className="w-full h-12 rounded-2xl bg-gray-100 text-gray-400 font-bold flex items-center justify-center">정원 마감</div>
      ) : (
        <button type="button" onClick={() => mReg.mutate()} disabled={busy}
          className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}신청하기
        </button>
      )}
    </div>
  )
}
