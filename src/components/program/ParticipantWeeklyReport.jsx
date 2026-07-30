import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Lightbulb, ChevronRight, Check } from 'lucide-react'
import Modal from '../common/Modal'
import { Icon3D } from './ProgramHome'
import { fetchMyWeeklyReport } from '../../lib/queries'

// 참여자 「지난 주 나의 기록」 — 개요 상단 배너 → 모달. 주 1회(열람 시 사라짐), dev 는 항상 노출.
//   완료된 지난 주(월~일) 집계: 미션·퀴즈·커뮤니티 글·댓글·(클래스) + 활동 일수(요일 도장) + 획득 포인트.
//   톤: 지난 주 회고 + 이번 주 응원. props: programId, userId, classEnabled, placement('overview'|'mypage')
const DEV = import.meta.env.DEV
function weekKey() { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return d.toISOString().slice(0, 10) }
const seenKey = (pid) => `pwr-seen:${pid}`

function encourage(d) {
  const acted = d.missionCount + d.quizCount + d.postCount + d.commentCount + d.classCount
  if (acted === 0) return '지난 주는 잠깐 쉬어갔네요. 이번 주 가볍게 다시 시작해봐요 🌱'
  if (d.activeDays >= 5) return `지난 주 ${d.activeDays}일이나 함께했어요 🔥 이번 주도 화이팅!`
  if (d.missionCount > 0) return `지난 주 ${d.missionCount}번 인증했어요 👍 이번 주도 힘내요!`
  return '지난 주도 함께해줘서 고마워요. 이번 주도 응원해요 💪'
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

  const openFromBanner = () => {
    if (!DEV) { try { localStorage.setItem(seenKey(programId), weekKey()) } catch { /* 무시 */ } ; setSeen(true) }
    setOpen(true)
  }

  return (
    <>
      {placement === 'overview' && !seen && (
        <button type="button" onClick={openFromBanner}
          className="mb-3 w-full flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-left hover:bg-emerald-100/60 transition">
          <Lightbulb className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <span className="flex-1 text-[13px] font-bold text-gray-700">지난 주 리포트가 도착했어요</span>
          <ChevronRight className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        </button>
      )}
      {placement === 'mypage' && (
        <button type="button" onClick={() => setOpen(true)}
          className="mb-3 w-full flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-left hover:bg-emerald-100/60 transition">
          <Lightbulb className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <span className="flex-1 text-[13px] font-bold text-gray-700">지난 주 기록 보기</span>
          <ChevronRight className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        </button>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-gray-800">지난 주 나의 기록</h2>
          </div>

          {!data ? (
            <p className="text-sm text-gray-400 py-8 text-center">불러오는 중…</p>
          ) : (
            <>
              {/* 지난 주 활동 + 포인트 — 개요처럼 한 줄에 2개 */}
              <div className="grid grid-cols-2 gap-2.5 mb-3 items-stretch">
                {/* 지난 주 활동 (요일 도장) */}
                <div className="rounded-xl bg-orange-50 px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <Icon3D src="/icons/feature/streak.png" emoji="🔥" className="w-5 h-5" />
                    <span className="text-[11px] font-semibold text-orange-700/80">지난 주 활동</span>
                  </div>
                  <p className="text-[17px] font-extrabold text-orange-600 leading-tight mt-0.5">{data.activeDays}<span className="text-[11px] font-bold">일</span><span className="text-[10px] font-bold text-orange-400 ml-0.5">/7</span></p>
                  <div className="flex items-center justify-between gap-0.5 mt-1.5">
                    {data.weekDays.map((d, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center ${d.done ? 'bg-emerald-500 text-white' : 'bg-white text-gray-300 ring-1 ring-gray-200'}`}>
                          <Check className="w-2.5 h-2.5" />
                        </span>
                        <span className="text-[8px] text-gray-400 leading-none">{d.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* 지난 주 포인트 */}
                <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    <Icon3D src="/icons/feature/point.png" emoji="⭐" className="w-5 h-5" />
                    <span className="text-[11px] font-semibold text-emerald-700/80">지난 주 포인트</span>
                  </div>
                  <p className="text-[17px] font-extrabold text-emerald-700 leading-tight mt-0.5">+{data.weekPoints}<span className="text-[11px] font-bold">P</span></p>
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

              {/* 격려 (지난 주 회고 + 이번 주 응원) */}
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
