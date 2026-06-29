import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, CalendarCheck, Flame, Award, ClipboardCheck } from 'lucide-react'

// 참여자 완주 축하 (2026-06-28 본인 결정: 첫 진입 자동 축하 + 재진입 배너).
//   종료된 프로그램에서 내 성적을 축하 톤으로 요약. 운영자 리포트와 동일 완주 기준(활동일 ≥ 기간 50%).
//   이중 표현 — 기준 달성자는 「완주 배지」, 미만은 「끝까지 수고했어요」(패자 없음).
//   props: isOpen, onClose, program, activeDays, totalCount, streak, points
const DAY_MS = 86_400_000

function ProgramCompletionCelebration({ isOpen, onClose, program, activeDays = 0, totalCount = 0, streak = 0, points = 0 }) {
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

  const stats = [
    { icon: CalendarCheck, label: '활동일', value: activeDays, unit: programDays ? `/${programDays}일` : '일', color: 'text-emerald-600' },
    { icon: ClipboardCheck, label: '인증', value: totalCount, unit: '건', color: 'text-sky-600' },
    { icon: Flame, label: '최고 연속', value: streak, unit: '일', color: 'text-orange-500' },
    { icon: Award, label: '획득 점수', value: points, unit: 'P', color: 'text-amber-600' },
  ]

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-elevated"
          initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 260 }} onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 — 축하 그라데이션 */}
          <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-6 pt-7 pb-6 text-center">
            <button type="button" onClick={onClose} className="absolute top-3 right-3 p-1 text-white/80 hover:text-white" aria-label="닫기">
              <X className="w-5 h-5" />
            </button>
            <motion.div
              initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 14 }}
              className="text-5xl mb-2"
            >
              {completed ? '🎉' : '👏'}
            </motion.div>
            <h2 className="text-xl font-extrabold leading-tight">{completed ? '완주를 축하해요!' : '끝까지 수고했어요!'}</h2>
            <p className="text-sm text-white/90 mt-1 break-keep">{program.name}</p>
            {completed && (
              <span className="inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full bg-white/20 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" /> 완주 배지 획득
              </span>
            )}
          </div>

          {/* 본문 — 내 성적 */}
          <div className="p-5">
            {rate != null && (
              <p className="text-center text-[13px] text-gray-600 mb-4">
                전체 {programDays}일 중 <b className="text-emerald-700">{activeDays}일</b> 함께했어요 ({rate}%)
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {stats.map(s => {
                const Icon = s.icon
                return (
                  <div key={s.label} className="rounded-xl bg-gray-50 p-3 text-center">
                    <Icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                    <p className="text-lg font-extrabold text-gray-900 leading-none">
                      {s.value}<span className="text-xs text-gray-500 font-bold ml-0.5">{s.unit}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">{s.label}</p>
                  </div>
                )
              })}
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
