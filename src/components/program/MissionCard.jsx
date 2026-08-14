import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trash2, Pencil } from 'lucide-react'
import { formatKoreanDate, formatKoreanDateTime, toKSTDateString, checkMissionToday } from '../../lib/formatters'
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
  navigateSearch,    // 인증 URL 에 붙일 쿼리 (예: '?from=record') — 새로고침에도 출처 생존
  viewerMode,        // 공개 프로그램 비참여자 열람 — 인증 버튼 대신 '참여 필요'
  onViewerAction,    // 열람자가 인증 시도 시 (참여 모달 열기)
  isNew = false,     // 마지막으로 본 이후 추가된 새 미션 — NEW 배지
}) {
  const navigate = useNavigate()

  const isMeditation = mission.verify_style === 'meditation'   // 명상(타이머) — 입력 없이 완료로 인증
  const isMeal = mission.verify_style === 'meal'               // 식단(검색·AI사진) — 입력 없이 음식 기록으로 인증
  const types = []
  if (isMeditation) types.push('명상')
  if (isMeal) types.push('식단')
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

  // 예정(미시작) 미션 — 참여자/열람자 입장 차단, 클릭 시 좌우로 흔들기 (예정 퀴즈와 동일 UX)
  const lockedUpcoming = isBeforeStart && !isOwner
  const [shake, setShake] = useState(false)
  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  const inactiveLabel = isBeforeStart
    ? `${formatKoreanDate(toKSTDateString(activeFrom))} 시작`
    : isAfterEnd
    ? '운영 종료'
    : !todayCheck.active
    ? todayCheck.reason
    : null

  return (
    <motion.div
      animate={shake ? { x: [0, -8, 8, -7, 7, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.5 }}
      onClick={lockedUpcoming ? triggerShake : undefined}
      className={`bg-white rounded-2xl shadow-elevated p-4 ${lockedUpcoming ? 'border border-amber-200 cursor-not-allowed' : ''}`}
    >
      {/* 1행 — 참여자/운영자 공통: [썸네일] 제목 + 5P + 인증 액션 */}
      <div className="flex items-center justify-between gap-3">
      {/* 좌측 썸네일 — 커스텀 아이콘. 없으면 명상 미션은 3D 명상 아이콘 기본, 그 외엔 미표시 */}
      {(mission.icon_path || isMeditation) && (
        <img
          src={mission.icon_path ? resolveMissionIcon(mission.icon_path) : '/icons/meditation/meditate.png'}
          alt=""
          className="w-14 h-14 flex-shrink-0 rounded-xl object-contain bg-gray-50"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-gray-800 mb-1 flex items-center gap-1.5 flex-wrap">
          {mission.title}
          {isNew && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-extrabold leading-none tracking-wide">NEW</span>
          )}
        </h3>
       <p className={`text-xs ${isBeforeStart ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
  {isBeforeStart ? (
    <>
      예정중<br />
      {formatKoreanDateTime(mission.active_from)}부터 열려요
    </>
  ) : (
    `${mission.verification_type === 'AUTO' ? '자동 승인' : '운영자 심사'}${
      mission.daily_limit ? ` · 하루 ${mission.daily_limit}회` : ' · 무제한'
    }`
  )}
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
      ) : isBeforeStart ? (
        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 text-xs rounded font-medium whitespace-nowrap">
          🔒 예정
        </span>
      ) : isInactive ? (
        <span
          className="inline-block align-middle px-3 py-1.5 bg-gray-100 text-gray-500 text-xs rounded font-medium whitespace-nowrap max-w-[130px] truncate"
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
            onClick={() => navigate(`/programs/${programId}/missions/${mission.id}${navigateSearch || ''}`, {
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
    </motion.div>
  )
}

export default MissionCard
