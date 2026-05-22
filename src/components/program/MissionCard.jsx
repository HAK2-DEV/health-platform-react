import { useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { formatKoreanDate, toKSTDateString, checkMissionToday } from '../../lib/formatters'

// 미션 카드 1장 — ProgramDetailPage / BundleDetailPage 등 여러 곳에서 재사용
// props:
//   mission       — DB row (bundle_title 포함)
//   todayCounts   — { [mission_id]: { total, pending } } (queries.js)
//   isOwner       — 운영자 권한
//   isDeletePending — 부모 mutation 진행 중 여부
//   onDelete(m)   — 부모 핸들러
//   programId     — 인증 페이지 navigate 용 (URL 파라미터)
//   navigateState — 미션 카드 인증 클릭 시 location.state 로 전달 (예: returnPath)
function MissionCard({
  mission,
  todayCounts,
  isOwner,
  isDeletePending,
  onDelete,
  programId,
  navigateState,
}) {
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
  // 점수 트리거 033 의 클라이언트 미러 — schedule_mode + 제외 기간 검사
  const todayCheck = checkMissionToday(mission)
  const isInactive = isBeforeStart || isAfterEnd || !todayCheck.active

  const inactiveLabel = isBeforeStart
    ? `${formatKoreanDate(toKSTDateString(activeFrom))} 시작`
    : isAfterEnd
    ? '운영 종료'
    : !todayCheck.active
    ? todayCheck.reason
    : null

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-800 mb-1">{mission.title}</h3>
        <p className="text-xs text-gray-500">
          {mission.verification_type === 'AUTO' ? '자동 승인' : '운영자 심사'}
          {mission.daily_limit ? ` · 하루 ${mission.daily_limit}회` : ' · 무제한'}
        </p>
      </div>

      <span className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded font-medium flex-shrink-0">
        {mission.point}P
      </span>

      {!isSupported ? (
        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
          준비 중
        </span>
      ) : isInactive ? (
        <span
          className="inline-flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-500 text-sm rounded font-medium whitespace-nowrap flex-shrink-0"
          title={inactiveLabel}
        >
          🚫 {inactiveLabel}
        </span>
      ) : reachedLimit ? (
        <div className="text-right flex-shrink-0">
          {hasPending ? (
            <span className="inline-flex items-center gap-1 px-3 py-2 bg-amber-50 text-amber-700 text-sm rounded font-medium whitespace-nowrap">
              ⏳ 심사 대기
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-50 text-emerald-600 text-sm rounded font-medium whitespace-nowrap">
              ✓ 오늘 인증 완료
            </span>
          )}
          {limit > 1 && (
            <p className="text-xs text-gray-500 mt-1 whitespace-nowrap">
              {todayCount}/{limit}회
            </p>
          )}
        </div>
      ) : (
        <div className="text-right flex-shrink-0">
          <button
            type="button"
            onClick={() => navigate(`/programs/${programId}/missions/${mission.id}`, {
              state: navigateState ?? null,
            })}
            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded transition whitespace-nowrap"
          >
            {buttonLabel}
          </button>
          {limit > 1 && todayCount > 0 && (
            <p className="text-xs text-gray-500 mt-1 whitespace-nowrap">
              {todayCount}/{limit}회
            </p>
          )}
        </div>
      )}

      {isOwner && (
        <button
          type="button"
          onClick={() => onDelete(mission)}
          disabled={isDeletePending}
          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition flex-shrink-0 disabled:opacity-40"
          title="미션 삭제"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

export default MissionCard
