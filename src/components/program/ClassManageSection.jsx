import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchInstructors, createInstructor, updateInstructor, deleteInstructor,
  fetchSessions, createSession, createSessions, updateSession, deleteSession, copySessionCover,
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
  // 「클래스 복사」로 만든 경우 _copyCoverFrom 이 붙어 온다 → 사진 파일을 실제 복제한 뒤 cover_path 로 채운다.
  //   경로를 공유하면 원본에서 커버를 교체할 때 사본이 깨진다(queries.copySessionCover 주석 참고).
  //   복제가 실패해도 클래스 생성 자체는 진행한다 — 사진 하나 때문에 등록을 막을 이유는 없다.
  const withCopiedCover = async (x) => {
    const { _copyCoverFrom, ...rest } = x
    if (!_copyCoverFrom) return rest
    const cover = await copySessionCover(_copyCoverFrom, userId)
    return cover ? { ...rest, cover_path: cover } : rest
  }
  const mCreateSess = useMutation({
    mutationFn: async (p) => {
      if (Array.isArray(p)) {
        const prepared = await Promise.all(p.map(withCopiedCover))   // 매주 반복 배치
        return createSessions(prepared.map(x => ({ program_id: programId, ...x })))
      }
      return createSession({ program_id: programId, ...(await withCopiedCover(p)) })
    },
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
