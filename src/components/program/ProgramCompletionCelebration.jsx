import { useMemo } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Icon3D } from './ProgramHome'

// 참여자 완주 축하 (2026-06-28 본인 결정: 첫 진입 자동 축하 + 재진입 배너).
//   종료된 프로그램에서 내 성적을 축하 톤으로 요약. 운영자 리포트와 동일 완주 기준(활동일 ≥ 기간 50%).
//   이중 표현 — 기준 달성자는 「완주 배지」, 미만은 「끝까지 수고했어요」(패자 없음).
//   props: isOpen, onClose, program, activeDays, totalCount, streak, points
const DAY_MS = 86_400_000

function ProgramCompletionCelebration({
  isOpen, onClose, program, activeDays = 0, totalCount = 0, streak = 0, points = 0,
  cheers = 0, rank = null, totalRanked = 0, teamRank = null, teamTotal = 0,
  rankingEnabled = true, teamEnabled = false,
}) {
  useBodyScrollLock(isOpen)  // iOS 배경 스크롤 방지
  const navigate = useNavigate()
  const programDays = useMemo(() => {
    if (!program?.start_date || !program?.end_date) return null
    const s = new Date(`${program.start_date}T00:00:00+09:00`)
    const e = new Date(`${program.end_date}T00:00:00+09:00`)
    return Math.max(1, Math.round((e - s) / DAY_MS) + 1)
  }, [program?.start_date, program?.end_date])

  if (!isOpen || !program) return null

  const threshold = programDays ? Math.max(1, Math.ceil(programDays * 0.5)) : null
  const completed = threshold ? activeDays >= threshold : activeDays > 0
  const rate = programDays ? Math.min(100, Math.round((activeDays / programDays) * 100)) : null

  // 3D 아이콘(폴백=이모지) — 앱 전반 아이콘 톤과 통일. 기본 4개 + 완주율·받은 응원 + (등수·팀순위 조건부)
  const stats = [
    { src: '/icons/feature/attendance.png', emoji: '📅', label: '활동일', value: activeDays, unit: programDays ? `/${programDays}일` : '일' },
    { src: '/icons/feature/mission.png', emoji: '📋', label: '인증', value: totalCount, unit: '건' },
    { src: '/icons/feature/streak.png', emoji: '🔥', label: '최고 연속', value: streak, unit: '일' },
    { src: '/icons/feature/point.png', emoji: '⭐', label: '획득 점수', value: points, unit: 'P' },
  ]
  if (rate != null) stats.push({ src: '/icons/feature/stats.png', emoji: '📈', label: '완주율', value: rate, unit: '%' })
  stats.push({ src: '/icons/feature/community.png', emoji: '❤️', label: '받은 응원', value: cheers, unit: '개' })
  if (rankingEnabled && rank != null)
    stats.push({ src: '/icons/reward/ranking.png', emoji: '🏆', label: '내 등수', value: rank, unit: totalRanked ? `/${totalRanked}등` : '등' })
  if (teamEnabled && teamRank != null)
    stats.push({ src: '/icons/reward/ranking.png', emoji: '👥', label: '팀 순위', value: teamRank, unit: teamTotal ? `/${teamTotal}팀` : '위' })

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-elevated"
          initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }} onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 — 흰 배경(본인 결정 2026-07-14). 아이콘은 3D 로 통일 */}
          <div className="relative bg-white px-6 pt-7 pb-5 text-center">
            <button type="button" onClick={onClose} className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600" aria-label="닫기">
              <X className="w-5 h-5" />
            </button>
            <motion.div
              initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 14 }}
              className="mb-2"
            >
              <Icon3D
                src={completed ? '/icons/cheer/trophy.png' : '/icons/cheer/people.png'}
                emoji={completed ? '🎉' : '👏'}
                className="w-[84px] h-[84px] mx-auto"
              />
            </motion.div>
            <h2 className="text-xl font-extrabold text-gray-900 leading-tight">{completed ? '완주를 축하해요!' : '끝까지 수고했어요!'}</h2>
            {/* 「완주 배지 획득」 배지 제거(2026-07-14 본인 결정) — 실제 배지 기능이 아직 없어
                획득했다고 안내하면 거짓이 됨. 배지 기능 생기면 여기에 다시 노출. */}
          </div>

          {/* 본문 — 내 성적 */}
          <div className="px-5 pb-5">
            {/* 프로그램 이름 + 함께한 일수를 한 박스로 묶음(본인 요청).
                주의: App.css 의 전역 `p { margin: 0 }` 이 unlayered 라 <p> 에는 마진 유틸(mt/mb,
                space-y)이 전부 무시된다 → 간격은 마진이 아닌 flex 의 gap 으로 준다. */}
            <div className="rounded-xl bg-gray-50 px-4 py-3 flex flex-col items-center gap-1 text-center">
              <p className="text-sm font-semibold text-gray-700 break-keep">{program.name}</p>
              {rate != null && (
                <p className="text-[13px] font-semibold text-gray-600">
                  전체 {programDays}일 중 <b className="text-emerald-700">{activeDays}일</b> 함께했어요 ({rate}%)
                </p>
              )}
            </div>
            {/* 지표 박스와 동일한 gap-3 리듬으로 쌓음 */}
            <div className="grid grid-cols-2 gap-3 mt-3 mb-5">
              {stats.map(s => (
                <div key={s.label} className="rounded-xl bg-gray-50 p-3 text-center">
                  <Icon3D src={s.src} emoji={s.emoji} className="w-9 h-9 mx-auto mb-1.5" />
                  <p className="text-lg font-extrabold text-gray-900 leading-none">
                    {s.value}<span className="text-xs text-gray-500 font-bold ml-0.5">{s.unit}</span>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { onClose(); navigate('/dashboard') }}
              className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition mb-2"
            >
              새로운 프로그램 찾기
            </button>
            <button type="button" onClick={onClose} className="w-full h-10 text-sm text-gray-500 hover:text-gray-700">닫기</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ProgramCompletionCelebration
