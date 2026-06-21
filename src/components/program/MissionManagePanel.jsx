import { Flag, CalendarClock, CheckCircle2, Pencil, Copy, ChevronUp, ChevronDown, Trash2, Plus } from 'lucide-react'
import { resolveMissionIcon } from '../../lib/missionIcons'
import { SCHEDULE_MODES } from '../../lib/constants'

// 미션 작업 페이지 — 운영자 패널(미션 관리자) 클릭 시 미션 탭 자리에 인라인 표시.
//   통계 박스 + 진행중/예약/완료 그룹 + 각 미션 편집/복제/순서/삭제.
//   props: missions, onEdit, onDelete, onDuplicate, onAdd, isBusy
//   (순서/정렬은 다음 단계 — sort 컬럼 필요)

const scheduleChip = (m) => {
  if (m.active_from || m.active_until) return '특별'
  const mode = SCHEDULE_MODES.find(s => s.key === (m.schedule_mode || 'ALL_DAYS'))
  return mode ? mode.label.replace(/\s*\(.*\)/, '') : '매일'
}

const COLOR = {
  emerald: { ring: 'bg-emerald-100 text-emerald-600', badge: 'bg-emerald-50 text-emerald-600', dot: 'text-emerald-500' },
  sky: { ring: 'bg-sky-100 text-sky-600', badge: 'bg-sky-50 text-sky-600', dot: 'text-sky-500' },
  gray: { ring: 'bg-gray-100 text-gray-500', badge: 'bg-gray-100 text-gray-500', dot: 'text-gray-400' },
}

function ActionBtn({ icon: Icon, label, onClick, disabled, danger, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex flex-col items-center justify-center gap-0.5 w-[38px] h-[44px] rounded-lg border text-[10px] font-medium transition flex-shrink-0
        ${danger ? 'border-red-100 text-red-500 hover:bg-red-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}
        ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}

function MissionRow({ m, index, group, onEdit, onDelete, onDuplicate, onMove, reorderEnabled, isBusy }) {
  const isFirst = index === 0
  const isLast = index === group.length - 1
  return (
    <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-2.5">
      {m.icon_path ? (
        <img src={resolveMissionIcon(m.icon_path)} alt="" className="w-11 h-11 flex-shrink-0 rounded-xl object-contain bg-gray-50" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />
      ) : (
        <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300 text-lg">🎯</div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h4 className="text-[13px] font-semibold text-gray-800 truncate">{m.title}</h4>
          <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px]">{scheduleChip(m)}</span>
        </div>
        <p className="text-[11px] text-gray-500 truncate mt-0.5">{m.description?.trim() || `${m.point}P · ${m.verification_type === 'AUTO' ? '자동 승인' : '운영자 심사'}`}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <ActionBtn icon={Pencil} label="편집" onClick={() => onEdit(m)} />
        <ActionBtn icon={Copy} label="복제" onClick={() => onDuplicate(m)} disabled={isBusy} />
        {/* 순서 — 위/아래 이동 (sort_order). 컬럼 미적용 시 비활성 */}
        <div className="flex flex-col w-[34px] h-[44px] rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
          <button type="button" onClick={() => onMove(m, group, 'up')} disabled={!reorderEnabled || isFirst}
            title={reorderEnabled ? '위로' : '정렬 기능(마이그레이션 092) 적용 필요'}
            className="flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-25 disabled:hover:bg-transparent border-b border-gray-100">
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => onMove(m, group, 'down')} disabled={!reorderEnabled || isLast}
            title={reorderEnabled ? '아래로' : '정렬 기능(마이그레이션 092) 적용 필요'}
            className="flex-1 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-25 disabled:hover:bg-transparent">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
        <ActionBtn icon={Trash2} label="삭제" danger onClick={() => onDelete(m)} disabled={isBusy} />
      </div>
    </div>
  )
}

function StatCell({ icon: Icon, color, label, count, sub }) {
  const c = COLOR[color]
  return (
    <div className="flex items-center gap-1.5 px-1.5">
      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 ${c.ring}`}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 leading-tight truncate">{label}</p>
        <p className="text-[16px] font-bold text-gray-800 leading-none">{count}개</p>
        <p className="text-[9px] text-gray-400 leading-tight truncate">{sub}</p>
      </div>
    </div>
  )
}

function Section({ icon: Icon, color, title, missions, ...rowProps }) {
  if (missions.length === 0) return null
  const c = COLOR[color]
  return (
    <section>
      <div className="flex items-center gap-1.5 mb-2 px-0.5">
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${c.ring}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <h3 className="text-[15px] font-bold text-gray-800">{title}</h3>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.badge}`}>{missions.length}개</span>
      </div>
      <div className="space-y-[9px]">
        {missions.map((m, i) => <MissionRow key={m.id} m={m} index={i} group={missions} {...rowProps} />)}
      </div>
    </section>
  )
}

function MissionManagePanel({ missions = [], onEdit, onDelete, onDuplicate, onReorder, onAdd, isBusy }) {
  const now = Date.now()
  const groups = { active: [], scheduled: [], completed: [] }
  for (const m of missions) {
    const af = m.active_from ? new Date(m.active_from).getTime() : null
    const au = m.active_until ? new Date(m.active_until).getTime() : null
    if (af && now < af) groups.scheduled.push(m)
    else if (au && now > au) groups.completed.push(m)
    else groups.active.push(m)
  }

  // 정렬 가능 여부 — sort_order 컬럼(092)이 적용돼 있어야 함
  const reorderEnabled = missions.length > 0 && Object.prototype.hasOwnProperty.call(missions[0], 'sort_order')
  // 같은 그룹 내 위/아래 이동 — 전체 미션 배열에서 두 미션 위치 교환 후 새 순서 전달
  const moveMission = (m, group, dir) => {
    if (!onReorder) return
    const gi = group.findIndex(x => x.id === m.id)
    const ni = dir === 'up' ? gi - 1 : gi + 1
    if (ni < 0 || ni >= group.length) return
    const neighbor = group[ni]
    const full = [...missions]
    const a = full.findIndex(x => x.id === m.id)
    const b = full.findIndex(x => x.id === neighbor.id)
    ;[full[a], full[b]] = [full[b], full[a]]
    onReorder(full.map(x => x.id))
  }

  const rowProps = { onEdit, onDelete, onDuplicate, onMove: moveMission, reorderEnabled, isBusy }

  return (
    <div className="-mx-[11px]">
    <div className="w-[366px] max-w-full mx-auto space-y-[9px] pb-2">
      {/* 통계 박스 */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 bg-white border border-gray-100 rounded-2xl shadow-soft p-3">
        <StatCell icon={Flag} color="emerald" label="진행중 미션" count={groups.active.length} sub="참여 중인 미션" />
        <StatCell icon={CalendarClock} color="sky" label="예약 미션" count={groups.scheduled.length} sub="예정된 미션" />
        <StatCell icon={CheckCircle2} color="gray" label="완료 미션" count={groups.completed.length} sub="완료된 미션" />
      </div>

      {/* 미션 추가 */}
      {onAdd && (
        <button type="button" onClick={onAdd} className="w-full flex items-center justify-center gap-1.5 h-11 rounded-2xl border border-dashed border-emerald-300 text-emerald-600 text-sm font-bold hover:bg-emerald-50 transition">
          <Plus className="w-4 h-4" /> 미션 추가
        </button>
      )}

      {missions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">아직 미션이 없어요. 「미션 추가」로 시작해보세요.</p>
      ) : (
        <div className="space-y-[9px]">
          <Section icon={Flag} color="emerald" title="진행중 미션" missions={groups.active} {...rowProps} />
          <Section icon={CalendarClock} color="sky" title="예약 미션" missions={groups.scheduled} {...rowProps} />
          <Section icon={CheckCircle2} color="gray" title="완료 미션" missions={groups.completed} {...rowProps} />
        </div>
      )}
    </div>
    </div>
  )
}

export default MissionManagePanel
