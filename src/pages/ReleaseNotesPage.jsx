import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { queryKeys, fetchMyPrograms } from '../lib/queries'
import { isNativeApp } from '../lib/installPrompt'
import { releaseNotesFor, releaseDateLabel, markReleaseSeen } from '../lib/releaseNotes'
import ReleaseNotes from '../components/common/ReleaseNotes'
import StickyBackBar from '../components/common/StickyBackBar'
import ProfileMenuItem from '../components/common/ProfileMenuItem'
import { Reveal } from '../components/program/statsAnim'

// 업데이트 사항 목록 (/profile/updates) — 마이페이지 「업데이트 사항」 상자 → 여기(날짜별 상자: 제목 + 날짜) → 누르면 그 날의 전체 내용.
//   본인 2026-10-09: 마이페이지에 날짜별 상자를 늘어놓으면 아래 메뉴(알림·계정 설정)를 누르기 어려워진다 → 한 단계 안으로.
//   내용은 lib/releaseNotes.js(코드 상수), 창은 대시보드 공지와 같은 ReleaseNotes(popup). 운영자 전용 항목은 운영자에게만(같은 필터).
//   닫으면 읽음으로 표시하되 «앞으로만»(markReleaseSeen) — 옛 공지를 다시 봤다고 최신 공지가 대시보드에 또 뜨지 않는다.
export default function ReleaseNotesPage() {
  const { session } = useAuth()
  const userId = session?.user?.id || null
  // 운영자 여부 — 대시보드·마이페이지가 쓰는 같은 캐시(요청 추가 없음)
  const { data: myPrograms = [] } = useQuery({
    queryKey: queryKeys.myPrograms(userId),
    queryFn: () => fetchMyPrograms(userId),
    enabled: !!userId,
    staleTime: 60_000,
  })
  const list = releaseNotesFor({ isNative: isNativeApp(), isOperator: myPrograms.length > 0 })
  const [note, setNote] = useState(null)        // 열어 본 노트 — 닫은 뒤에도 남겨 둔다(닫힘 애니메이션 동안 내용 유지)
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-screen bg-surface-app">
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-6">
        <StickyBackBar fallbackPath="/profile" title="뒤로" />

        <div className="mt-2 mb-5">
          <h1 className="text-2xl font-bold text-gray-800">✨ 업데이트 사항</h1>
          <p className="text-sm text-gray-500 mt-1.5">달라진 점을 날짜별로 다시 볼 수 있어요</p>
        </div>

        <div className="space-y-2">
          {list.map((n, i) => (
            <Reveal key={n.id} index={Math.min(i, 5)}>
              <ProfileMenuItem
                tone="amber"
                icon={<Sparkles className="w-5 h-5" />}
                title={n.title}
                description={`${releaseDateLabel(n)} 업데이트`}
                onClick={() => { setNote(n); setOpen(true) }}
              />
            </Reveal>
          ))}
        </div>
      </div>

      {note && (
        <ReleaseNotes
          note={note}
          variant="popup"
          isOpen={open}
          onClose={() => { markReleaseSeen(note.id); setOpen(false) }}
        />
      )}
    </div>
  )
}
