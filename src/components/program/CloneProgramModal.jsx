import { useState, useMemo } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Calendar, Loader2 } from 'lucide-react'
import { cloneProgram, formatKstDate, queryKeys } from '../../lib/queries'
import { formatKoreanDate } from '../../lib/formatters'
import { useAuth } from '../../hooks/useAuth'

// 다음 기수 열기 — 프로그램 복제 모달 (2026-06-28 본인 결정: 새 시작일만 입력 → 평행 이동).
//   설정·미션·퀴즈만 복사한 DRAFT 새 프로그램 생성. 참여자·인증·점수는 초기화.
//   props: isOpen, onClose, program { id, name, start_date, end_date }
const DAY_MS = 86_400_000

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00+09:00`)
  d.setDate(d.getDate() + days)
  return formatKstDate(d)
}

function CloneProgramModal({ isOpen, onClose, program }) {
  useBodyScrollLock(isOpen)  // iOS 배경 스크롤 방지
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const userId = session?.user?.id

  // 기간(일수) — 원본 start~end 포함 일수
  const durationDays = useMemo(() => {
    if (!program?.start_date || !program?.end_date) return null
    const s = new Date(`${program.start_date}T00:00:00+09:00`)
    const e = new Date(`${program.end_date}T00:00:00+09:00`)
    return Math.max(1, Math.round((e - s) / DAY_MS) + 1)
  }, [program?.start_date, program?.end_date])

  // 기본 새 시작일 — 원본 종료 다음날 또는 오늘 중 더 늦은 날
  const today = formatKstDate(new Date())
  const defaultStart = useMemo(() => {
    if (program?.end_date) {
      const next = addDays(program.end_date, 1)
      return next > today ? next : today
    }
    return today
  }, [program?.end_date, today])

  const [newStart, setNewStart] = useState(defaultStart)
  const newEnd = (durationDays && newStart) ? addDays(newStart, durationDays - 1) : null

  const mutation = useMutation({
    mutationFn: () => cloneProgram({ sourceId: program.id, newStart }),
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myPrograms(userId) })
      onClose()
      navigate(`/programs/${newId}`)
    },
  })

  if (!isOpen || !program) return null

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => !mutation.isPending && onClose()}
      >
        <motion.div
          className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 pb-8 sm:pb-5"
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-800">
              <Copy className="w-4 h-4 text-emerald-600" /> 다음 기수 열기
            </h2>
            <button type="button" onClick={onClose} disabled={mutation.isPending} className="p-1 -mr-1 text-gray-400 hover:text-gray-600 disabled:opacity-50">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[12px] text-gray-500 mb-4 leading-relaxed">
            「{program.name}」의 미션·퀴즈·설정을 그대로 가져와 <b className="text-gray-700">새 프로그램(임시저장)</b>으로 만들어요.
            참여자·인증·점수는 새로 시작합니다.
          </p>

          {/* 새 시작일 */}
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">새 시작일</label>
          <div className="relative mb-3">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="date"
              value={newStart}
              min={today}
              onChange={(e) => setNewStart(e.target.value)}
              className="w-full h-11 pl-9 pr-3 rounded-xl border border-gray-200 text-sm text-gray-800 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 outline-none"
            />
          </div>

          {/* 기간 미리보기 */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 mb-4">
            <p className="text-[11px] text-emerald-700 font-semibold mb-0.5">새 기수 기간</p>
            {durationDays ? (
              <p className="text-sm font-bold text-gray-800">
                {formatKoreanDate(newStart)} ~ {newEnd ? formatKoreanDate(newEnd) : '-'}
                <span className="text-xs text-gray-500 font-medium ml-1">({durationDays}일, 동일)</span>
              </p>
            ) : (
              <p className="text-sm font-bold text-gray-800">{formatKoreanDate(newStart)} 시작 · 상시</p>
            )}
            <p className="text-[11px] text-gray-500 mt-1">미션 일정도 새 시작일에 맞춰 함께 이동해요.</p>
          </div>

          {mutation.isError && (
            <p className="text-xs text-red-600 mb-3">{mutation.error?.message || '복제에 실패했어요. 다시 시도해주세요.'}</p>
          )}

          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !newStart}
            className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-60"
          >
            {mutation.isPending ? (<><Loader2 className="w-4 h-4 animate-spin" /> 복제하는 중...</>) : '다음 기수 만들기'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default CloneProgramModal
