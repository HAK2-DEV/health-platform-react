import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { queryKeys, fetchMyPrograms } from '../../lib/queries'
import { isNativeApp } from '../../lib/installPrompt'
import { pendingRelease, markReleaseSeen } from '../../lib/releaseNotes'
import { isPolicyNoticePending } from './PolicyUpdateNotice'
import ReleaseNotes from './ReleaseNotes'

// 배포 변경사항 공지를 «언제·누구에게» 띄울지만 정하는 자리. 내용은 lib/releaseNotes.js, 생김새는 ReleaseNotes.jsx.
//   PolicyUpdateNotice(약관 개정 고지)와 같은 패턴 — 로그인 사용자에게 대시보드에서 1회.
//
// 띄우는 조건
//   1) 로그인했다 — 공지는 「쓰던 화면이 달라졌다」는 이야기다. 로그인 전 화면엔 해당 없음.
//   2) 대시보드다 — 앱을 열면 닿는 자리. 깊은 화면에서 갑자기 막아서면 하던 일을 끊는다.
//   3) 아직 안 읽었다 — 읽음 표시는 기기에 남는다(localStorage).
//   4) 이 공지 «전에» 가입했다 — 어제 가입한 사람에게 「달라졌어요」는 말이 안 된다. 비교할 «전»이 없다.
//   5) 운영자 여부를 «알고 난 뒤에» 띄운다 — 모르는 채 띄우면 참여자용으로 떴다가 운영자 항목이
//      뒤늦게 끼어든다(빈 상태 깜빡임과 같은 실수).
//   6) 약관 개정 고지가 떠 있으면 비킨다 — 실제로 띄워 보니 둘이 겹쳤다(2026-10-07 확인).
//      법적 고지가 먼저다. 변경사항은 그걸 닫고 다음에 대시보드에 올 때 뜬다(읽음 표시가 아직 없으므로).
export default function ReleaseNotesGate() {
  const { session } = useAuth()
  const { pathname } = useLocation()
  const [closed, setClosed] = useState(false)
  const userId = session?.user?.id || null
  const onDashboard = pathname === '/dashboard'

  // 대시보드가 이미 같은 키로 부르는 쿼리 — 키가 같으니 요청이 새로 나가지 않는다(캐시 공유).
  const { data: myPrograms, isLoading } = useQuery({
    queryKey: queryKeys.myPrograms(userId),
    queryFn: () => fetchMyPrograms(userId),
    enabled: !!userId && onDashboard,
    staleTime: 60_000,
  })

  if (!session || closed || !onDashboard || isLoading) return null
  if (isPolicyNoticePending()) return null

  const note = pendingRelease({
    isNative: isNativeApp(),
    isOperator: (myPrograms?.length || 0) > 0,
  })
  if (!note) return null

  // 가입 시각이 공지 날짜(KST 자정)보다 뒤면 건너뛴다
  const joinedAt = session.user?.created_at
  if (joinedAt && new Date(joinedAt) > new Date(`${note.date}T00:00:00+09:00`)) return null

  return (
    <ReleaseNotes
      note={note}
      variant="popup"
      isOpen
      onClose={() => { markReleaseSeen(note.id); setClosed(true) }}
    />
  )
}
