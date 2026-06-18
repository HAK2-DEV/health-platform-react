import ProgramCover from '../common/ProgramCover'
import Badge from '../common/Badge'
import { Users, Calendar, Pencil, Trash2 } from 'lucide-react'
import { CATEGORY_COLORS, calcProgress, progressUrgency } from '../../lib/programVisuals'
import { formatKoreanDate, isUpcomingByStartDate } from '../../lib/formatters'

// 상세 프로그램 카드 (표지 + 이름 + 진행률/상태). 홈·프로그램탭 공용.
//   variant 'active' — 참여중: 진행률 바 + 참여자 수
//   variant 'mine'   — 운영중: 상태 뱃지 + 기간 (+ onDelete 시 휴지통)
function ProgramListCard({ program, variant = 'active', count, onClick, onDelete, deletePending }) {
  const catKey = program.categories?.[0] || 'ETC'
  const catColors = CATEGORY_COLORS[catKey] || CATEGORY_COLORS.ETC

  if (variant === 'mine') {
    const isDraft = program.status === 'DRAFT'
    const isUpcoming = !isDraft && isUpcomingByStartDate(program.start_date)
    const badgeVariant = isDraft ? 'draft' : isUpcoming ? 'upcoming' : 'progress'
    const statusLabel = isDraft ? '임시저장' : isUpcoming ? '예정' : '진행중'
    return (
      <div
        onClick={onClick}
        className="bg-white border border-gray-100 rounded-card p-3 shadow-soft hover:shadow-elevated transition cursor-pointer"
      >
        <div className="flex gap-3 items-start">
          <ProgramCover
            imagePath={program.cover_image_path}
            categories={program.categories}
            name={program.name}
            variant="thumb"
            className="w-16 h-16 rounded-xl flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-gray-800 truncate">{program.name}</h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Badge variant={badgeVariant} size="sm">{statusLabel}</Badge>
                {onDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(program) }}
                    disabled={deletePending}
                    className="p-1 text-gray-300 hover:text-red-500 transition disabled:opacity-40"
                    title="삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {program.description && program.description.trim() !== program.name?.trim() && (
              <p className="text-xs font-semibold text-gray-600 mb-1 line-clamp-1">{program.description}</p>
            )}
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3 flex-shrink-0 text-gray-400" />
              <span>{formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}</span>
            </p>
            {isDraft && (
              <p className="text-[11px] text-emerald-600 mt-1.5 flex items-center gap-1">
                <Pencil className="w-3 h-3 flex-shrink-0" />
                <span>클릭하면 이어서 작성할 수 있어요</span>
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // variant 'active' — 참여중
  const progress = calcProgress(program.start_date, program.end_date)
  const urgency = progressUrgency(progress)
  const isEnded = urgency.urgency === 'ended'
  const isUpcoming = !isEnded && isUpcomingByStartDate(program.start_date)
  const colors = isEnded
    ? { bg: 'bg-gray-100', border: 'border-gray-200', accent: 'bg-gray-400' }
    : catColors
  const barAccentCls = urgency.barCls || colors.accent
  const catPercentCls = catKey === 'MINDCARE' ? 'text-orange-600'
    : catKey === 'EMPATHY' ? 'text-pink-600'
    : catKey === 'SLEEP' ? 'text-purple-600'
    : catKey === 'NO_SMOKING' ? 'text-yellow-600'
    : catKey === 'ETC' ? 'text-gray-600'
    : 'text-emerald-600'
  const percentTextCls = urgency.textCls || catPercentCls
  const countPillCls = catKey === 'MINDCARE' ? 'bg-orange-100/80 text-orange-700'
    : catKey === 'EMPATHY' ? 'bg-pink-100/80 text-pink-700'
    : catKey === 'SLEEP' ? 'bg-purple-100/80 text-purple-700'
    : catKey === 'NO_SMOKING' ? 'bg-yellow-100/80 text-yellow-700'
    : catKey === 'ETC' ? 'bg-gray-100/80 text-gray-700'
    : 'bg-emerald-100/80 text-emerald-700'

  return (
    <div
      onClick={onClick}
      className={`${colors.bg} ${colors.border} border rounded-card p-3 shadow-soft hover:shadow-elevated transition cursor-pointer flex items-center gap-3`}
    >
      <div className="relative flex-shrink-0">
        <ProgramCover
          imagePath={program.cover_image_path}
          categories={program.categories}
          name={program.name}
          variant="thumb"
          className="w-20 h-20 rounded-card"
        />
        <Badge variant={isEnded ? 'ended' : isUpcoming ? 'upcoming' : 'progress'} size="sm" className="absolute top-1.5 left-1.5 shadow-sm">
          {isEnded ? '종료' : isUpcoming ? '예정' : '진행중'}
        </Badge>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-base text-gray-800 truncate">{program.name}</h3>
        {program.description && (
          <p className="text-xs font-semibold text-gray-600 truncate mt-0.5">{program.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-2 bg-white/90 rounded-full overflow-hidden">
            <div className={`${barAccentCls} h-full rounded-full transition-all`} style={{ width: `${progress}%` }} />
          </div>
          <span className={`text-base font-bold flex-shrink-0 ${percentTextCls}`}>{progress}%</span>
        </div>
        {urgency.label && (
          <p className={`text-[11px] font-medium mt-1 ${percentTextCls}`}>
            {urgency.urgency === 'ended' ? '🏁' : urgency.urgency === 'imminent' ? '🔥' : '⏳'} {urgency.label}
          </p>
        )}
        {count != null && (
          <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-pill text-[11px] font-medium w-fit ${countPillCls}`}>
            <Users className="w-3 h-3 flex-shrink-0" />
            <span>{count.toLocaleString()}명이 함께 참여 중</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default ProgramListCard
