import { useNavigate } from 'react-router-dom'
import { Trash2, Pencil } from 'lucide-react'
import { formatKoreanDate, toKSTDateString, checkMissionToday } from '../../lib/formatters'
import { resolveMissionIcon } from '../../lib/missionIcons'

// 미션 카드 1장 — ProgramDetailPage / BundleDetailPage 등 여러 곳에서 재사용
// props:
//   mission       — DB row (bundle_title 포함)
//   todayCounts   — { [mission_id]: { total, pending } } (queries.js)
//   isOwner       — 운영자 권한
//   isDeletePending — 부모 mutation 진행 중 여부
//   onDelete(m)   — 부모 핸들러
//   onEdit(m)     — 부모 핸들러 (선택, 있으면 ✏️ 노출)
//   programId     — 인증 페이지 navigate 용 (URL 파라미터)
//   navigateState — 미션 카드 인증 클릭 시 location.state 로 전달 (예: returnPath)
function MissionCard({
  mission,
  todayCounts,
  isOwner,
  showOwnerActions = true,   // 일반(깔끔) 뷰에서 운영자 편집/삭제 버튼 숨김 → 작업 페이지에서만 노출
  isDeletePending,
  onDelete,
  onEdit,
  programId,
  navigateState,
  viewerMode,        // 공개 프로그램 비참여자 열람 — 인증 버튼 대신 '참여 필요'
  onViewerAction,    // 열람자가 인증 시도 시 (참여 모달 열기)
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
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      {/* 1행 — 참여자/운영자 공통: [썸네일] 제목 + 5P + 인증 액션 */}
      <div className="flex items-center justify-between gap-3">
      {/* 좌측 썸네일 — 라이브러리 사전 제작 아이콘. 없으면 미표시 (절약된 공간만큼 제목 확장) */}
      {mission.icon_path && (
        <img
          src={resolveMissionIcon(mission.icon_path)}
          alt=""
          className="w-14 h-14 flex-shrink-0 rounded-xl object-contain bg-gray-50"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-800 mb-1">{mission.title}</h3>
        <p className="text-xs text-gray-500">
          {mission.verification_type === 'AUTO' ? '자동 승인' : '운영자 심사'}
          {mission.daily_limit ? ` · 하루 ${mission.daily_limit}회` : ' · 무제한'}
        </p>
      </div>

      {/* 5P + 인증 액션 column — 본인 결정 (Day 65): 좁은 화면에서 글자 세로 배열 방지 위해 stack */}
      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-sm rounded font-medium whitespace-nowrap">
        {mission.point}P
      </span>

      {!isSupported ? (
        <span className="text-xs text-gray-400 whitespace-nowrap">
          준비 중
        </span>
      ) : isInactive ? (
        <span
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-500 text-xs rounded font-medium whitespace-nowrap"
          title={inactiveLabel}
        >
          🚫 {inactiveLabel}
        </span>
      ) : viewerMode ? (
        <button
          type="button"
          onClick={onViewerAction}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs rounded font-medium whitespace-nowrap transition"
          title="참여하면 인증할 수 있어요"
        >
          🔒 참여 필요
        </button>
      ) : reachedLimit ? (
        <div className="text-right">
          {hasPending ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 text-xs rounded font-medium whitespace-nowrap">
              ⏳ 심사 대기
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 text-xs rounded font-medium whitespace-nowrap">
              ✓ 오늘 인증 완료
            </span>
          )}
          {limit > 1 && (
            <p className="text-[11px] text-gray-500 mt-1 whitespace-nowrap">
              {todayCount}/{limit}회
            </p>
          )}
        </div>
      ) : (
        <div className="text-right">
          <button
            type="button"
            onClick={() => navigate(`/programs/${programId}/missions/${mission.id}`, {
              state: navigateState ?? null,
            })}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm rounded transition whitespace-nowrap"
          >
            {buttonLabel}
          </button>
          {limit > 1 && todayCount > 0 && (
            <p className="text-[11px] text-gray-500 mt-1 whitespace-nowrap">
              {todayCount}/{limit}회
            </p>
          )}
        </div>
      )}

      </div>{/* /5P + 인증 column */}
      </div>

      {/* 2행 — 운영자 액션 (제목 공간 압박 방지 위해 별도 행) */}
      {isOwner && showOwnerActions && (
        <div className="flex items-center justify-end gap-0.5 mt-3 pt-2 border-t border-gray-100">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(mission)}
              disabled={isDeletePending}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition disabled:opacity-40"
              title="미션 수정"
            >
              <Pencil className="w-3.5 h-3.5" />
              수정
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(mission)}
            disabled={isDeletePending}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition disabled:opacity-40"
            title="미션 삭제"
          >
            <Trash2 className="w-3.5 h-3.5" />
            삭제
          </button>
        </div>
      )}
    </div>
  )
}

export default MissionCard
