import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trash2, Pencil, Check } from 'lucide-react'
import { formatKoreanDate, formatKoreanDateTime, toKSTDateString, checkMissionToday } from '../../lib/formatters'
import { resolveMissionIcon } from '../../lib/missionIcons'

// 달리기 전용 미션 카드 — 레퍼런스 디자인(번호·신발·심사·포인트·인증/완료·수정/삭제).
//   동작(인증 진입·완료 판정·수정/삭제)은 MissionCard 와 동일 규칙.
const SHOE_FALLBACK = '/icons/running/shoe.png'

function RunningMissionCard({
  mission, index = 0, todayCounts = {}, isOwner, showOwnerActions = true,
  isDeletePending, onDelete, onEdit, programId, viewerMode, onViewerAction, onToggleMain,
}) {
  const isMain = mission.is_main !== false
  const navigate = useNavigate()

  const types = []
  if (mission.requires_image) types.push('업로드')
  if (mission.requires_numeric) types.push('기록')
  if (mission.requires_note) types.push('소감')
  const isSupported = types.length > 0
  const buttonLabel = types.length === 1 ? types[0] : (isSupported ? '인증' : null)

  const todayCount = todayCounts[mission.id]?.total || 0
  const pendingCount = todayCounts[mission.id]?.pending || 0
  const limit = mission.daily_limit
  const reachedLimit = limit != null && todayCount >= limit
  const hasPending = pendingCount > 0

  const now = new Date()
  const activeFrom = mission.active_from ? new Date(mission.active_from) : null
  const activeUntil = mission.active_until ? new Date(mission.active_until) : null
  const isBeforeStart = activeFrom && now < activeFrom
  const isAfterEnd = activeUntil && now > activeUntil
  const todayCheck = checkMissionToday(mission)
  const isInactive = isBeforeStart || isAfterEnd || !todayCheck.active

  const lockedUpcoming = isBeforeStart && !isOwner
  const [shake, setShake] = useState(false)
  const triggerShake = () => { setShake(true); setTimeout(() => setShake(false), 600) }

  const inactiveLabel = isBeforeStart
    ? `${formatKoreanDate(toKSTDateString(activeFrom))} 시작`
    : isAfterEnd ? '운영 종료'
    : !todayCheck.active ? todayCheck.reason : null

  const iconSrc = mission.icon_path ? resolveMissionIcon(mission.icon_path) : SHOE_FALLBACK

  // 완료(reachedLimit) 아닐 때 우측 컴팩트 액션
  const renderAction = () => {
    if (!isSupported) return <span className="text-[11px] text-gray-400 whitespace-nowrap">준비 중</span>
    if (isBeforeStart) return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[11px] rounded-md font-bold whitespace-nowrap">🔒 예정</span>
    if (isInactive) return <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[11px] rounded-md font-bold whitespace-nowrap" title={inactiveLabel || ''}>🚫 {inactiveLabel}</span>
    if (viewerMode) return <button type="button" onClick={onViewerAction} className="px-2.5 py-1 bg-gray-100 text-gray-500 hover:bg-gray-200 text-[11px] rounded-md font-bold whitespace-nowrap transition">🔒 참여</button>
    return (
      <button type="button"
        onClick={() => navigate(`/programs/${programId}/missions/${mission.id}`)}
        className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[12px] font-bold rounded-lg whitespace-nowrap transition">
        {buttonLabel}
      </button>
    )
  }

  return (
    <motion.div
      animate={shake ? { x: [0, -8, 8, -7, 7, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.5 }}
      onClick={lockedUpcoming ? triggerShake : undefined}
      className={`bg-white rounded-2xl shadow-soft border p-3.5 ${lockedUpcoming ? 'border-amber-200 cursor-not-allowed' : 'border-gray-100'}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 text-[13px] font-extrabold flex items-center justify-center flex-shrink-0">{index + 1}</span>
        <img
          src={iconSrc}
          alt=""
          aria-hidden="true"
          className="w-12 h-12 flex-shrink-0 object-contain"
          loading="lazy"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = SHOE_FALLBACK }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[14px] font-bold text-gray-800 break-keep leading-snug truncate">{mission.title}</h3>
            {isOwner && onToggleMain ? (
              <button type="button" onClick={() => onToggleMain(mission)} title="메인/서브 전환"
                className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold flex-shrink-0 transition ${isMain ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200' : 'bg-amber-100 text-amber-600 hover:bg-amber-200'}`}>
                {isMain ? '메인' : '서브'}
              </button>
            ) : (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold flex-shrink-0 ${isMain ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                {isMain ? '메인' : '서브'}
              </span>
            )}
          </div>
          <p className={`text-[11px] mt-0.5 ${isBeforeStart ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
            {isBeforeStart
              ? <>예정중 · {formatKoreanDateTime(mission.active_from)}부터</>
              : `${mission.verification_type === 'AUTO' ? '자동 승인' : '운영자 심사'}${limit ? ` · 하루 ${limit}회` : ' · 무제한'}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[12px] rounded-md font-bold whitespace-nowrap">{mission.point}P</span>
          {!reachedLimit && renderAction()}
        </div>
      </div>

      {/* 완료 상태 — 전체폭 바 */}
      {reachedLimit && (
        <div className="mt-3">
          {hasPending ? (
            <div className="w-full h-9 rounded-lg bg-amber-50 text-amber-700 text-[12px] font-bold flex items-center justify-center gap-1">
              ⏳ 심사 대기 중{limit > 1 ? ` (${todayCount}/${limit})` : ''}
            </div>
          ) : (
            <div className="w-full h-9 rounded-lg bg-emerald-50 text-emerald-600 text-[12px] font-bold flex items-center justify-center gap-1">
              <Check className="w-4 h-4" strokeWidth={3} /> 오늘 인증 완료{limit > 1 ? ` (${todayCount}/${limit})` : ''}
            </div>
          )}
        </div>
      )}

      {/* 운영자 — 수정/삭제 */}
      {isOwner && showOwnerActions && (
        <div className="flex items-center justify-end gap-0.5 mt-2.5 pt-2 border-t border-gray-100">
          {onEdit && (
            <button type="button" onClick={() => onEdit(mission)} disabled={isDeletePending}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition disabled:opacity-40" title="미션 수정">
              <Pencil className="w-3.5 h-3.5" /> 수정
            </button>
          )}
          <button type="button" onClick={() => onDelete(mission)} disabled={isDeletePending}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition disabled:opacity-40" title="미션 삭제">
            <Trash2 className="w-3.5 h-3.5" /> 삭제
          </button>
        </div>
      )}
    </motion.div>
  )
}

export default RunningMissionCard
