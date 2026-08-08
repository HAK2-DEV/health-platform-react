import { useState } from 'react'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, Check } from 'lucide-react'
import { fetchSessionRoster, setSessionAttendance, fetchSessionCode, setSessionCode } from '../../lib/queries'
import UserAvatar from '../common/UserAvatar'

// 운영자 출석부 — 신청자 명단 + 출석 확정(operator_roll). self_approve 대기건도 여기서 승인.
//   venue_code 모드면 상단에 현장 출석 코드 설정.
//   출석 토글: 켜면 confirmed(포인트 부여), 끄면 rejected(적립 회수).
// venue_code — 현장 출석 코드 설정(운영자)
function CodeEditor({ sessionId }) {
  const qc = useQueryClient()
  const { data: code = '' } = useQuery({ queryKey: ['session-code', sessionId], queryFn: () => fetchSessionCode(sessionId), enabled: !!sessionId })
  const [input, setInput] = useState(null)
  const val = input ?? code
  const m = useMutation({
    mutationFn: (c) => setSessionCode({ sessionId, code: c }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['session-code', sessionId] }); setInput(null) },
  })
  return (
    <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 mb-3">
      <p className="text-[12px] font-bold text-emerald-800 mb-1.5">현장 출석 코드</p>
      <div className="flex gap-2">
        <input value={val} onChange={e => setInput(e.target.value)} placeholder="예: 4821" maxLength={12}
          className="flex-1 h-9 px-2.5 rounded-lg border border-emerald-200 text-[14px] font-bold tracking-widest text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-400" />
        <button type="button" onClick={() => m.mutate((val || '').trim())} disabled={m.isPending || !(val || '').trim()}
          className="h-9 px-4 rounded-lg bg-emerald-500 text-white text-[13px] font-bold disabled:opacity-50 flex-shrink-0 whitespace-nowrap">저장</button>
      </div>
      <p className="text-[11px] text-emerald-700/80 mt-1.5 leading-relaxed break-keep">이 코드를 현장에서 참가자에게 알려주세요. 참가자가 입력하면 자동 출석돼요.</p>
    </div>
  )
}

export default function AttendanceRosterModal({ session, confirmedBy = null, attendanceMode = 'operator_roll', onClose }) {
  useBodyScrollLock(true)  // 마운트=열림 → iOS 배경 스크롤 방지
  const kbInset = useKeyboardInset()   // iOS 키보드 높이 — 현장코드 입력 시 카드 위로
  const qc = useQueryClient()
  const { data: roster = [], isLoading } = useQuery({
    queryKey: ['roster', session.id], queryFn: () => fetchSessionRoster(session.id), enabled: !!session.id,
  })
  const m = useMutation({
    mutationFn: ({ userId, attended }) => setSessionAttendance({ sessionId: session.id, userId, attended, confirmedBy }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster', session.id] })
      qc.invalidateQueries({ queryKey: ['sessions', session.program_id] })
    },
  })
  const present = roster.filter(r => r.attStatus === 'confirmed').length

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45" style={{ paddingBottom: kbInset ? kbInset + 16 : undefined, transition: 'padding-bottom .2s ease' }} onClick={onClose}>
      <div className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[16px] font-bold text-gray-900 truncate pr-2">출석부</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-[12px] text-gray-500 mb-3 truncate">{session.title} · 출석 <b className="text-emerald-600">{present}</b>/{roster.length}명</p>

        {attendanceMode === 'venue_code' && <CodeEditor sessionId={session.id} />}

        {isLoading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
        ) : roster.length === 0 ? (
          <p className="text-[13px] text-gray-400 py-10 text-center">신청한 참가자가 없어요.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {roster.map(r => {
              const on = r.attStatus === 'confirmed'
              return (
                <li key={r.user_id} className="flex items-center gap-2.5 py-2.5">
                  <UserAvatar avatarPath={r.avatar_path} nickname={r.nickname} size="sm" viewable />
                  <span className="flex-1 min-w-0 text-[14px] font-medium text-gray-800 truncate">{r.nickname}</span>
                  {r.attStatus === 'pending' && <span className="text-[11px] font-bold text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 flex-shrink-0">신청</span>}
                  {attendanceMode === 'venue_code' ? (
                    // 현장 코드: 참가자가 코드로 스스로 출석 → 운영자는 상태만 확인(읽기 전용)
                    <span className={`inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] font-bold flex-shrink-0 ${on ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 bg-gray-100'}`}>
                      {on ? <><Check className="w-3.5 h-3.5" /> 출석</> : '미출석'}
                    </span>
                  ) : (
                    <button type="button" disabled={m.isPending}
                      onClick={() => m.mutate({ userId: r.user_id, attended: !on })}
                      className={`inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] font-bold transition disabled:opacity-50 flex-shrink-0 ${on ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {on ? <><Check className="w-3.5 h-3.5" /> 출석</> : '미출석'}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-[11px] text-gray-400 mt-3 leading-relaxed break-keep">
          {attendanceMode === 'venue_code'
            ? '참가자가 현장 코드를 입력하면 자동으로 출석 처리돼요. 여기선 현황만 확인해요.'
            : '출석으로 체크하면 참가자에게 클래스 포인트가 부여돼요. 해제하면 회수됩니다.'}
        </p>
      </div>
    </div>
  )
}
