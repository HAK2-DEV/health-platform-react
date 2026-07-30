import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Lightbulb, ChevronRight } from 'lucide-react'
import Modal from '../common/Modal'
import { Icon3D } from './ProgramHome'
import { fetchMyWeeklyReport } from '../../lib/queries'

// 참여자 「이번 주 나의 기록」 — 개요 상단 배너 → 모달. 주 1회(열람 시 사라짐), dev 는 항상 노출.
//   집계: 미션 인증·퀴즈·커뮤니티 글·댓글·(클래스 출석) + 연속 스트릭 + 이번 주 포인트 + 격려.
//   props: programId, userId, classEnabled
const DEV = import.meta.env.DEV
function weekKey() { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10) }
const seenKey = (pid) => `pwr-seen:${pid}`

function encourage(d) {
  const acted = (d.missionCount + d.quizCount + d.postCount + d.commentCount + d.classCount) > 0
  if (!acted) return '이번 주는 잠깐 쉬어갔네요. 내일 가볍게 다시 시작해봐요 🌱'
  if (d.streak >= 3) return `${d.streak}일 연속 이어가고 있어요 🔥 이 흐름 좋아요!`
  if (d.missionCount > 0) return `이번 주 ${d.missionCount}번 인증했어요. 꾸준함이 쌓이고 있어요 👍`
  return '조금씩이라도 함께하고 있어요, 응원해요 💪'
}

function Row({ src, emoji, label, n, unit }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5">
      <Icon3D src={src} emoji={emoji} className="w-6 h-6 flex-shrink-0" />
      <span className="flex-1 text-[13px] text-gray-600">{label}</span>
      <span className={`text-[14px] font-extrabold tabular-nums ${n > 0 ? 'text-gray-800' : 'text-gray-300'}`}>{n}<span className="text-[11px] font-bold text-gray-400 ml-0.5">{unit}</span></span>
    </div>
  )
}

export default function ParticipantWeeklyReport({ programId, userId, classEnabled = false, placement = 'overview' }) {
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState(true)
  useEffect(() => {
    if (DEV) { setSeen(false); return }
    try { setSeen(localStorage.getItem(seenKey(programId)) === weekKey()) } catch { setSeen(true) }
  }, [programId])

  const { data } = useQuery({
    queryKey: ['my-weekly-report', programId, userId],
    queryFn: () => fetchMyWeeklyReport(programId, userId),
    enabled: open && !!userId && !!programId,
  })

  // 개요: 이번 주 미열람 배너(열람 시 사라짐). 마이페이지: 상시 「이번 주 기록 보기」 진입.
  const openFromBanner = () => {
    if (!DEV) { try { localStorage.setItem(seenKey(programId), weekKey()) } catch { /* 무시 */ } ; setSeen(true) }
    setOpen(true)
  }

  return (
    <>
      {placement === 'overview' && !seen && (
        <button type="button" onClick={openFromBanner}
          className="mb-3 w-full flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left hover:bg-amber-100/60 transition">
          <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <span className="flex-1 text-[13px] font-bold text-gray-700">이번 주 내 기록이 도착했어요 · 보기</span>
          <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
        </button>
      )}
      {placement === 'mypage' && (
        <button type="button" onClick={() => setOpen(true)}
          className="mb-3 w-full flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-left hover:bg-amber-100/60 transition">
          <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <span className="flex-1 text-[13px] font-bold text-gray-700">이번 주 기록 보기</span>
          <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
        </button>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-gray-800">이번 주 나의 기록</h2>
          </div>

          {!data ? (
            <p className="text-sm text-gray-400 py-8 text-center">불러오는 중…</p>
          ) : (
            <>
              {/* 스트릭 + 포인트 */}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div className="rounded-xl bg-orange-50 px-3 py-2.5">
                  <p className="text-[11px] text-orange-700/80 font-semibold">🔥 연속</p>
                  <p className="text-[19px] font-extrabold text-orange-600 leading-tight">{data.streak}<span className="text-[12px] font-bold">일</span></p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
                  <p className="text-[11px] text-emerald-700/80 font-semibold">이번 주 포인트</p>
                  <p className="text-[19px] font-extrabold text-emerald-700 leading-tight">+{data.weekPoints}<span className="text-[12px] font-bold">P</span></p>
                </div>
              </div>

              {/* 카테고리 집계 */}
              <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 mb-3">
                <Row src="/icons/feature/mission.png" emoji="🌱" label="미션 인증" n={data.missionCount} unit="건" />
                <Row src="/icons/feature/quiz.png" emoji="❓" label="퀴즈 참여" n={data.quizCount} unit="개" />
                <Row src="/icons/feature/community.png" emoji="💬" label="커뮤니티 글" n={data.postCount} unit="개" />
                <Row src="/icons/mypage/comments.png" emoji="✍️" label="댓글" n={data.commentCount} unit="개" />
                {classEnabled && <Row src="/icons/feature/attendance.png" emoji="📅" label="클래스 출석" n={data.classCount} unit="회" />}
              </div>

              {/* 격려 */}
              <p className="text-[12.5px] text-gray-600 leading-relaxed bg-gray-50 rounded-lg px-3 py-2.5 break-keep">{encourage(data)}</p>

              {placement === 'overview' && (
                <p className="mt-3 text-[11.5px] font-semibold text-gray-500 text-center">마이페이지 → 내 기록에서 다시 볼 수 있어요</p>
              )}
              <button type="button" onClick={() => setOpen(false)}
                className="mt-2.5 w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition">
                확인
              </button>
            </>
          )}
        </div>
      </Modal>
    </>
  )
}
