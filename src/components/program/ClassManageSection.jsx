import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchInstructors, createInstructor, updateInstructor, deleteInstructor,
  fetchSessions, createSession, createSessions, updateSession, deleteSession,
} from '../../lib/queries'
import ClassManageView from './ClassManageView'
import AttendanceRosterModal from './AttendanceRosterModal'

// 운영자 「클래스 관리」 컨테이너 — 실쿼리 배선. class_feature_enabled && isOwner 일 때 노출.
export default function ClassManageSection({ programId, userId = null, attendanceMode = 'operator_roll', programLeadDays = null, programOpenTime = null }) {
  const qc = useQueryClient()
  const { data: instructors = [] } = useQuery({
    queryKey: ['instructors', programId], queryFn: () => fetchInstructors(programId), enabled: !!programId,
  })
  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', programId], queryFn: () => fetchSessions(programId), enabled: !!programId,
  })
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['instructors', programId] })
    qc.invalidateQueries({ queryKey: ['sessions', programId] })
  }
  const mCreateInstr = useMutation({ mutationFn: (p) => createInstructor({ programId, ...p }), onSuccess: invalidate })
  const mUpdateInstr = useMutation({ mutationFn: ({ id, patch }) => updateInstructor(id, patch), onSuccess: invalidate })
  const mDeleteInstr = useMutation({ mutationFn: (id) => deleteInstructor(id), onSuccess: invalidate })
  const mCreateSess = useMutation({
    mutationFn: (p) => Array.isArray(p)
      ? createSessions(p.map(x => ({ program_id: programId, ...x })))   // 매주 반복 배치
      : createSession({ program_id: programId, ...p }),
    onSuccess: invalidate,
  })
  const mUpdateSess = useMutation({ mutationFn: ({ id, patch }) => updateSession(id, patch), onSuccess: invalidate })
  const mDeleteSess = useMutation({ mutationFn: (id) => deleteSession(id), onSuccess: invalidate })
  const busy = [mCreateInstr, mUpdateInstr, mDeleteInstr, mCreateSess, mUpdateSess, mDeleteSess].some(m => m.isPending)

  return (
    <ClassManageView
      instructors={instructors}
      sessions={sessions}
      busy={busy}
      programLeadDays={programLeadDays}
      programOpenTime={programOpenTime}
      onCreateInstructor={(p) => mCreateInstr.mutate(p)}
      onUpdateInstructor={(id, patch) => mUpdateInstr.mutate({ id, patch })}
      onDeleteInstructor={(id) => mDeleteInstr.mutate(id)}
      onCreateSession={(p) => mCreateSess.mutate(p)}
      onUpdateSession={(id, patch) => mUpdateSess.mutate({ id, patch })}
      onDeleteSession={(id) => mDeleteSess.mutate(id)}
      renderRoster={(session, onClose) => (
        <AttendanceRosterModal session={{ ...session, program_id: programId }} confirmedBy={userId} attendanceMode={attendanceMode} onClose={onClose} />
      )}
    />
  )
}
