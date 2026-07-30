import { useState, useEffect, lazy, Suspense } from 'react'
import { Lightbulb, ChevronRight } from 'lucide-react'
import Modal from '../common/Modal'
import WeeklyHighlightCard from './WeeklyHighlightCard'

const CheerModal = lazy(() => import('./CheerModal'))

// 주간 하이라이트 진입 — 캡슐화(배너/통계엔트리 + 모달 + 응원 + 주간 열람 추적).
//   placement:
//     'overview' — 개요 상단 「보고 도착」 배너. 이번 주 열람 전 + 보고할 데이터 있을 때만 노출.
//                  탭 → 모달 열람 + 열람 표시(이후 배너 사라짐, 통계에서 다시 봄).
//     'stats'    — 통계 상단 상시 엔트리(운영자가 다시 볼 수 있는 자리).
//   props: stats(fetchProgramStats), programId, pendingCount, onReview(선택 — 심사 열기)

function weekKey() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7 // 월=0
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10) // 이번 주 월요일
}
const seenKey = (pid) => `whl-seen:${pid}`

export default function WeeklyHighlight({ stats, programId, pendingCount = 0, onReview, placement = 'overview' }) {
  const [open, setOpen] = useState(false)
  const [cheerUser, setCheerUser] = useState(null)
  const [seen, setSeen] = useState(true)  // 기본 true(깜빡임 방지) → 마운트 후 확인

  useEffect(() => {
    try { setSeen(localStorage.getItem(seenKey(programId)) === weekKey()) } catch { setSeen(true) }
  }, [programId])

  const markSeen = () => {
    try { localStorage.setItem(seenKey(programId), weekKey()) } catch { /* 무시 */ }
    setSeen(true)
  }
  const openReport = () => { setOpen(true); markSeen() }

  const hasData = !!stats && (stats.participantsCount || 0) > 0
  if (!hasData) return null

  return (
    <>
      {/* 개요 배너 — 이번 주 미열람일 때만 */}
      {placement === 'overview' && !seen && (
        <button type="button" onClick={openReport}
          className="mb-3 w-full flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 text-white text-left shadow-elevated active:scale-[0.99] transition">
          <span className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="w-5 h-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">이번 주 하이라이트 보고가 도착했어요!</p>
            <p className="text-[12px] text-white/85 leading-snug mt-0.5">활발한 참여자·챙길 참여자 한눈에 보기</p>
          </div>
          <ChevronRight className="w-5 h-5 flex-shrink-0 text-white/90" />
        </button>
      )}

      {/* 통계 상단 엔트리 — 상시 (다시 보기) */}
      {placement === 'stats' && (
        <button type="button" onClick={() => setOpen(true)}
          className="mb-4 w-full flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left hover:bg-amber-100/60 transition">
          <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <span className="flex-1 text-[13px] font-bold text-gray-700">이번 주 하이라이트 보기</span>
          <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
        </button>
      )}

      {/* 열람 모달 */}
      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-gray-800">이번 주 하이라이트</h2>
          </div>
          <WeeklyHighlightCard
            stats={stats}
            pendingCount={pendingCount}
            onReview={onReview ? () => { setOpen(false); onReview() } : undefined}
            onCheerUser={(u) => setCheerUser(u)}
            plain
          />
        </div>
      </Modal>

      {cheerUser && (
        <Suspense fallback={null}>
          <CheerModal
            programId={programId}
            targetUserId={cheerUser.user_id}
            targetNickname={cheerUser.nickname}
            variant="cheer"
            onClose={() => setCheerUser(null)}
          />
        </Suspense>
      )}
    </>
  )
}
