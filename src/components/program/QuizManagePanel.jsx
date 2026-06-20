import { useState } from 'react'
import { ClipboardList, CalendarClock, BarChart3, HelpCircle, Pencil, Copy, Eye, Trash2, Plus } from 'lucide-react'

// 퀴즈 관리자 작업 페이지 — 운영자 패널(퀴즈) 클릭 시 퀴즈 탭 자리에 인라인 표시.
//   통계(진행중/예약/응답률) + 칩(전체/주간/상시/종료) + 퀴즈 카드(편집/복제/미리보기/삭제).
//   props: quizzes, participantCount, onEdit, onPreview, onDelete, onDuplicate, onAdd, isBusy

const _df = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
const _tf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
const fmtDT = (ts) => { if (!ts) return null; const d = new Date(ts); return `${_df.format(d).replaceAll('-', '.')} ${_tf.format(d)}` }

const quizStatus = (q, now) => {
  const start = q.start_at ? new Date(q.start_at).getTime() : null
  const due = q.due_at ? new Date(q.due_at).getTime() : null
  if (start && now < start) return 'scheduled' // 예약
  if (due && now > due) return 'ended'          // 종료
  if (!due) return 'always'                     // 상시
  return 'active'                               // 진행중
}
const STATUS_META = {
  active: { label: '진행중', cls: 'bg-emerald-100 text-emerald-700' },
  scheduled: { label: '예약', cls: 'bg-amber-100 text-amber-700' },
  always: { label: '상시', cls: 'bg-sky-100 text-sky-700' },
  ended: { label: '종료', cls: 'bg-gray-100 text-gray-500' },
}
const CHIPS = [
  { key: 'all', label: '전체' },
  { key: 'weekly', label: '주간' },
  { key: 'always', label: '상시' },
  { key: 'ended', label: '종료' },
]

function StatCell({ icon: Icon, color, label, value, sub }) {
  const ring = color === 'emerald' ? 'bg-emerald-100 text-emerald-600'
    : color === 'sky' ? 'bg-sky-100 text-sky-600' : 'bg-gray-100 text-gray-500'
  return (
    <div className="flex items-center gap-1.5 px-1.5">
      <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0 ${ring}`}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 leading-tight truncate">{label}</p>
        <p className="text-[16px] font-bold text-gray-800 leading-none">{value}</p>
        <p className="text-[9px] text-gray-400 leading-tight truncate">{sub}</p>
      </div>
    </div>
  )
}

function ActionCell({ icon: Icon, label, onClick, disabled, danger, title }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`flex items-center justify-center gap-1 py-2.5 text-[12px] font-medium transition
        ${danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-500 hover:bg-gray-50'}
        ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  )
}

function QuizCard({ q, now, onEdit, onPreview, onDelete, onDuplicate, isBusy }) {
  const s = quizStatus(q, now)
  const meta = STATUS_META[s]
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-soft overflow-hidden">
      <div className="flex items-start gap-2.5 p-3">
        <span className="inline-flex items-center justify-center w-11 h-11 flex-shrink-0 rounded-xl bg-emerald-50 text-emerald-500">
          <HelpCircle className="w-6 h-6" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[14px] font-bold text-gray-800 truncate">{q.title}</h4>
            <span className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
          </div>
          {q.description?.trim() && <p className="text-[12px] text-gray-500 truncate mt-0.5">{q.description}</p>}
          <p className="text-[11px] text-gray-400 mt-1 break-keep">
            문항 {q.questionCount}문항 · 배점 {q.totalPoint || 0}점
            {q.start_at && <> · 공개 {fmtDT(q.start_at)}</>}
            {q.due_at ? <> · 마감 {fmtDT(q.due_at)}</> : <> · 마감 없음</>}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-4 border-t border-gray-100 divide-x divide-gray-100">
        <ActionCell icon={Pencil} label="편집" onClick={() => onEdit(q)} />
        <ActionCell icon={Copy} label="복제" onClick={() => onDuplicate?.(q)} disabled title="복제는 곧 추가됩니다" />
        <ActionCell icon={Eye} label="미리보기" onClick={() => onPreview(q)} />
        <ActionCell icon={Trash2} label="삭제" danger onClick={() => onDelete(q)} disabled={isBusy} />
      </div>
    </div>
  )
}

function QuizManagePanel({ quizzes = [], participantCount = 0, onEdit, onPreview, onDelete, onDuplicate, onAdd, isBusy }) {
  const [chip, setChip] = useState('all')
  const now = Date.now()

  let active = 0, scheduled = 0, rateSum = 0, rateN = 0
  for (const q of quizzes) {
    const s = quizStatus(q, now)
    if (s === 'scheduled') scheduled++
    else if (s !== 'ended') active++
    if (participantCount > 0) { rateSum += Math.min(q.submissionCount / participantCount, 1); rateN++ }
  }
  const responseRate = rateN > 0 ? Math.round((rateSum / rateN) * 100) : 0

  const filtered = quizzes.filter(q => {
    const s = quizStatus(q, now)
    if (chip === 'all') return true
    if (chip === 'weekly') return q.due_at && s !== 'ended'
    if (chip === 'always') return !q.due_at && s !== 'ended'
    if (chip === 'ended') return s === 'ended'
    return true
  })

  return (
    <div className="-mx-4">
    <div className="w-[366px] max-w-full mx-auto space-y-[9px] pb-2">
      {/* 통계 */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 bg-white border border-gray-100 rounded-2xl shadow-soft p-3">
        <StatCell icon={ClipboardList} color="emerald" label="진행중 퀴즈" value={`${active}개`} sub="진행 중인 퀴즈" />
        <StatCell icon={CalendarClock} color="sky" label="예약 퀴즈" value={`${scheduled}개`} sub="예약된 퀴즈" />
        <StatCell icon={BarChart3} color="gray" label="응답률" value={`${responseRate}%`} sub="전체 평균 응답률" />
      </div>

      {/* 칩 */}
      <div className="flex gap-1.5 flex-wrap">
        {CHIPS.map(c => (
          <button key={c.key} type="button" onClick={() => setChip(c.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition
              ${chip === c.key ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* 새 퀴즈 추가 */}
      {onAdd && (
        <button type="button" onClick={onAdd} className="w-full flex items-center justify-center gap-1.5 h-11 rounded-2xl border border-dashed border-emerald-300 text-emerald-600 text-sm font-bold hover:bg-emerald-50 transition">
          <Plus className="w-4 h-4" /> 새 퀴즈 추가
        </button>
      )}

      {/* 목록 */}
      {filtered.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          {quizzes.length === 0 ? '아직 퀴즈가 없어요. 「새 퀴즈 추가」로 시작해보세요.' : '해당 조건의 퀴즈가 없어요.'}
        </p>
      ) : (
        <div className="space-y-[9px]">
          {filtered.map(q => (
            <QuizCard key={q.id} q={q} now={now} onEdit={onEdit} onPreview={onPreview} onDelete={onDelete} onDuplicate={onDuplicate} isBusy={isBusy} />
          ))}
        </div>
      )}
    </div>
    </div>
  )
}

export default QuizManagePanel
