import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { supabase } from '../../supabaseClient'
import { Check, FileText, Heart, MessageCircle, Plus, X, GripVertical, MoreVertical, Trash2, ChevronDown } from 'lucide-react'

// 커뮤니티 관리자 — 운영자 패널(커뮤니티) 클릭 시 커뮤니티 탭 자리에 인라인 표시.
//   ① 레이아웃(community_layout) ② 게시판 ③ 승인·노출 ④ 신고 정책 ⑤ 미리보기.
//   ②③④ 설정은 programs.community_settings(095, JSONB)에 저장.
//   ⚠ 설정 저장만 — 실제 작동(승인 흐름·신고 자동숨김·자유게시판 글쓰기)은 후속 단계.
//   저장 바는 부모(ProgramDetailPage)가 ref.save() 로 호출.

const LAYOUTS = [
  { key: 'feed', label: '기본형', desc: '인스타 스타일 풀 카드' },
  { key: 'list', label: '리스트형', desc: '썸네일+글 가로 행' },
  { key: 'grid', label: '그리드형', desc: '2열 카드 갤러리' },
  { key: 'magazine', label: '매거진형', desc: '대/소 혼합 · 오버레이' },
]
const DEFAULT_BOARDS = [
  { id: 'all', name: '전체', system: true, desc: '모든 게시글을 한눈에 확인할 수 있어요.', writePerm: 'free', commentPerm: 'free', manageMode: 'default' },
  { id: 'cert', name: '인증', system: true, desc: '운동 인증이나 기록을 공유하는 공간이에요.', writePerm: 'approval', commentPerm: 'free', manageMode: 'review', feedVisibility: 'public' },
  { id: 'free', name: '자유', system: true, desc: '주제에 구애받지 않고 자유롭게 이야기해요.', writePerm: 'free', commentPerm: 'free', manageMode: 'instant' },
  { id: 'notice', name: '공지', system: true, desc: '운영진이 작성하는 공지사항 게시판이에요.', writePerm: 'readonly', commentPerm: 'readonly', manageMode: 'owner' },
]
const BOARD_META = {
  all: { emoji: '📋', bg: 'bg-emerald-100' },
  cert: { emoji: '📷', bg: 'bg-amber-100' },
  free: { emoji: '💬', bg: 'bg-violet-100' },
  notice: { emoji: '📢', bg: 'bg-sky-100' },
}
const WRITE_OPTS = [{ v: 'free', l: '자유 작성' }, { v: 'approval', l: '승인 필요' }, { v: 'readonly', l: '읽기 전용' }]
const COMMENT_OPTS = [{ v: 'free', l: '자유 작성' }, { v: 'readonly', l: '읽기 전용' }]
const FEED_VIS_OPTS = [
  { v: 'public', l: '항상 공개' },
  { v: 'optin_public', l: '기본 공개 · 개인 선택' },
  { v: 'optin_private', l: '기본 비공개 · 개인 선택' },
  { v: 'private', l: '항상 비공개' },
]

const PERM_PILL = { free: 'bg-emerald-100 text-emerald-700', approval: 'bg-amber-100 text-amber-700', readonly: 'bg-gray-100 text-gray-500' }
// 글/댓글 권한 — 색 pill, 탭하면 다음 값으로 순환
function PermPill({ value, opts, onChange }) {
  const cur = opts.find(o => o.v === value) || opts[0]
  const next = () => { const i = opts.findIndex(o => o.v === value); onChange(opts[(i + 1) % opts.length].v) }
  return <button type="button" onClick={next} title="탭하여 변경" className={`w-full px-1.5 py-1.5 rounded-full text-[11px] font-semibold transition ${PERM_PILL[value] || PERM_PILL.free}`}>{cur.l}</button>
}
const CHIP_COLORS = [
  'bg-emerald-50 text-emerald-700',
  'bg-violet-50 text-violet-700',
  'bg-sky-50 text-sky-700',
  'bg-amber-50 text-amber-700',
  'bg-rose-50 text-rose-700',
]
const REPORT_OPTIONS = [
  { key: 'auto', label: '자동 숨김', desc: '신고 즉시 검토 대기' },
  { key: '3', label: '신고 3회', desc: '3회 누적 시 숨김' },
  { key: '5', label: '신고 5회', desc: '5회 누적 시 숨김' },
]

function LayoutPreview({ type }) {
  const box = 'bg-gray-300 rounded-[2px]'
  if (type === 'feed') return (
    <div className="w-full h-[44px] flex flex-col gap-[2px] p-1">
      <div className="flex items-center gap-1">
        <div className="w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0" />
        <div className="flex-1 space-y-[2px]">
          <div className="w-1/2 h-[3px] rounded-full bg-gray-300" />
          <div className="w-3/4 h-[3px] rounded-full bg-gray-200" />
        </div>
      </div>
      <div className={`flex-1 ${box}`} />
      <div className="flex items-center gap-1.5 text-gray-300"><Heart className="w-2.5 h-2.5" /><MessageCircle className="w-2.5 h-2.5" /></div>
    </div>
  )
  if (type === 'list') return (
    <div className="w-full h-[44px] flex flex-col gap-1 p-1">
      {[0, 1, 2].map(i => <div key={i} className="flex-1 flex gap-1"><div className={`w-[30%] ${box}`} /><div className="flex-1 bg-gray-200 rounded-[2px]" /></div>)}
    </div>
  )
  if (type === 'grid') return (
    <div className="w-full h-[44px] grid grid-cols-2 gap-1 p-1">{[0, 1, 2, 3].map(i => <div key={i} className={box} />)}</div>
  )
  return (
    <div className="w-full h-[44px] flex flex-col gap-1 p-1">
      <div className={`flex-[1.4] ${box}`} />
      <div className="flex-1 grid grid-cols-2 gap-1">{[0, 1].map(i => <div key={i} className={box} />)}</div>
    </div>
  )
}

const Toggle = ({ on, onClick }) => (
  <button type="button" onClick={onClick} className={`relative w-11 h-6 rounded-full transition flex-shrink-0 ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}>
    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
  </button>
)
const numBadge = (n) => <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">{n}</span>
const headCls = 'flex items-center gap-1.5 text-[15px] font-bold text-gray-800 mb-3'

const CommunityManagePanel = forwardRef(function CommunityManagePanel({ program, onSaved, onGoPosts }, ref) {
  const [layout, setLayout] = useState('feed')
  const [boards, setBoards] = useState(DEFAULT_BOARDS)
  const [postApproval, setPostApproval] = useState(false)
  const [noticeEnabled, setNoticeEnabled] = useState(true)
  const [reactionAuto, setReactionAuto] = useState(true)
  const [previewCard, setPreviewCard] = useState(true)
  const [reportPolicy, setReportPolicy] = useState('auto')

  useEffect(() => {
    if (!program) return
    setLayout(program.community_layout || 'feed')
    const s = program.community_settings || {}
    setBoards(Array.isArray(s.boards) && s.boards.length ? s.boards : DEFAULT_BOARDS)
    setPostApproval(!!s.postApproval)
    setNoticeEnabled(s.noticeEnabled !== false)
    setReactionAuto(s.reactionAuto !== false)
    setPreviewCard(s.previewCard !== false)
    setReportPolicy(s.reportPolicy || 'auto')
  }, [program])

  const addBoard = () => {
    const name = window.prompt('새 게시판 이름 (최대 8자)')
    if (!name || !name.trim()) return
    setBoards(prev => [...prev, { id: `b_${prev.length}_${Math.random().toString(36).slice(2, 7)}`, name: name.trim().slice(0, 8), system: false, writePerm: 'free', commentPerm: 'free' }])
  }
  const removeBoard = (bid) => {
    if (!window.confirm('이 게시판을 삭제하시겠습니까?')) return
    setBoards(prev => prev.filter(b => b.id !== bid))
  }
  const updateBoard = (bid, patch) => setBoards(prev => prev.map(b => b.id === bid ? { ...b, ...patch } : b))
  const renameBoard = (b) => {
    const name = window.prompt('게시판 이름 (최대 8자)', b.name)
    if (name && name.trim()) updateBoard(b.id, { name: name.trim().slice(0, 8) })
  }
  const [dragId, setDragId] = useState(null)      // 드래그 순서 변경
  const [menuOpenId, setMenuOpenId] = useState(null) // ⋮ 메뉴
  const dropOnBoard = (targetId) => {
    setBoards(prev => {
      if (!dragId || dragId === targetId) return prev
      const arr = [...prev]
      const from = arr.findIndex(b => b.id === dragId)
      const to = arr.findIndex(b => b.id === targetId)
      if (from < 0 || to < 0) return prev
      const [m] = arr.splice(from, 1)
      arr.splice(to, 0, m)
      return arr
    })
    setDragId(null)
  }

  useImperativeHandle(ref, () => ({
    save: async () => {
      const payload = { community_layout: layout }
      if (program && Object.prototype.hasOwnProperty.call(program, 'community_settings')) {
        payload.community_settings = { boards, postApproval, noticeEnabled, reactionAuto, previewCard, reportPolicy }
      } else if (program && !Object.prototype.hasOwnProperty.call(program, 'community_layout')) {
        return '커뮤니티 컬럼(마이그레이션 094/095)이 아직 적용되지 않았어요'
      }
      const { error } = await supabase.from('programs').update(payload).eq('id', program.id)
      if (error) return error.message
      onSaved?.()
      return null
    },
  }), [layout, boards, postApproval, noticeEnabled, reactionAuto, previewCard, reportPolicy, program, onSaved])

  const selLayout = LAYOUTS.find(l => l.key === layout) || LAYOUTS[0]

  return (
    <div className="-mx-4">
    <div className="mission-fields w-[366px] max-w-full mx-auto space-y-[9px] pb-2">
      {/* 1) 레이아웃 */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <h3 className={headCls}>{numBadge(1)} 레이아웃 선택</h3>
        <p className="text-[11px] text-gray-400 mb-3 -mt-2">선택한 형태로 게시글 배치가 바뀝니다. <span className="text-gray-300">(옆으로 밀어 선택)</span></p>
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pt-1 pb-1 scrollbar-hide">
          {LAYOUTS.map(l => {
            const on = layout === l.key
            return (
              <button key={l.key} type="button" onClick={() => setLayout(l.key)}
                className={`relative flex-shrink-0 w-[104px] flex flex-col items-center text-center rounded-xl border-2 p-2 transition ${on ? 'border-emerald-400 bg-emerald-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                {on && <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm"><Check className="w-2.5 h-2.5 text-white" /></span>}
                <div className="w-full rounded-md bg-gray-50 border border-gray-100 mb-1.5"><LayoutPreview type={l.key} /></div>
                <span className={`text-[12px] font-bold ${on ? 'text-emerald-700' : 'text-gray-700'}`}>{l.label}</span>
                <span className="text-[9px] text-gray-400 leading-tight mt-0.5">{l.desc}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* 2) 게시판 카테고리 — 칩 */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-gray-800">{numBadge(2)} 게시판 카테고리</h3>
          <span className="text-[10px] text-gray-400">ⓘ 이름 탭=수정 · X=삭제</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-hide">
          {boards.map((b, i) => {
            const isAll = b.id === 'all'
            return (
              <span key={b.id} className={`flex-shrink-0 inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-[13px] font-semibold ${isAll ? 'bg-emerald-500 text-white' : CHIP_COLORS[i % CHIP_COLORS.length]}`}>
                <button type="button" onClick={() => renameBoard(b)} className="hover:underline max-w-[72px] truncate">{b.name}</button>
                <button type="button" onClick={() => removeBoard(b.id)} className="opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
              </span>
            )
          })}
          <button type="button" onClick={addBoard}
            className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-gray-300 text-gray-500 text-[13px] font-semibold hover:border-emerald-400 hover:text-emerald-600 transition whitespace-nowrap">
            <Plus className="w-3.5 h-3.5" /> 새 게시판
          </button>
        </div>

        {/* 게시판별 상세 설정 — 헤더 행 + 열 정렬 (컴팩트 표) */}
        <div className="mt-4">
          {/* 헤더 */}
          <div className="grid grid-cols-[1.7fr_1fr_0.9fr_18px] gap-1.5 items-end px-0.5 pb-2 mb-1 border-b border-gray-100 text-[10px] font-semibold text-gray-400 leading-tight">
            <span>게시판</span>
            <span className="text-center">참여자 글 작성</span>
            <span className="text-center">댓글 작성</span>
            <span />
          </div>
          {/* 행 */}
          {boards.map(b => {
            const meta = BOARD_META[b.id] || { emoji: '📝', bg: 'bg-gray-100' }
            return (
              <div
                key={b.id}
                draggable
                onDragStart={() => setDragId(b.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropOnBoard(b.id)}
                className={`grid grid-cols-[1.7fr_1fr_0.9fr_18px] gap-1.5 items-center py-2 border-b border-gray-50 transition ${dragId === b.id ? 'opacity-50' : ''}`}
              >
                {/* 게시판 */}
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-gray-300 flex-shrink-0 cursor-grab active:cursor-grabbing" title="드래그하여 순서 변경"><GripVertical className="w-3.5 h-3.5" /></span>
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${meta.bg}`}>{meta.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-gray-800 truncate">{b.name}</p>
                    {b.desc && <p className="text-[9px] text-gray-400 leading-tight">{b.desc}</p>}
                  </div>
                </div>
                {/* 참여자 글 */}
                <PermPill value={b.writePerm || 'free'} opts={WRITE_OPTS} onChange={(v) => updateBoard(b.id, { writePerm: v })} />
                {/* 댓글 */}
                <PermPill value={b.commentPerm || 'free'} opts={COMMENT_OPTS} onChange={(v) => updateBoard(b.id, { commentPerm: v })} />
                {/* ⋮ 메뉴 */}
                <div className="relative flex justify-center">
                  <button type="button" onClick={() => setMenuOpenId(menuOpenId === b.id ? null : b.id)} className="text-gray-400 hover:text-gray-700">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {menuOpenId === b.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                      <div className="absolute right-0 top-6 z-20 w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                        <button type="button" onClick={() => { removeBoard(b.id); setMenuOpenId(null) }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left text-[12px] text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" /> 게시판 삭제
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}

          {/* 인증 게시판 — 피드 공개 정책 */}
          {(() => {
            const cert = boards.find(b => b.id === 'cert')
            if (!cert) return null
            const fv = cert.feedVisibility || 'public'
            const privateDefault = fv === 'optin_private' || fv === 'private'
            return (
              <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <p className="text-[12px] font-bold text-gray-800 mb-2">📷 인증 피드 공개 <span className="text-[10px] font-normal text-gray-400">미션 인증 글이 커뮤니티에 보이는 방식</span></p>
                <div className="grid grid-cols-2 gap-2">
                  {FEED_VIS_OPTS.map(o => {
                    const on = fv === o.v
                    return (
                      <button key={o.v} type="button" onClick={() => updateBoard('cert', { feedVisibility: o.v })}
                        className={`rounded-lg border-2 px-2 py-2 text-[12px] font-semibold transition ${on ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}>
                        {o.l}
                      </button>
                    )
                  })}
                </div>
                {privateDefault ? (
                  <p style={{ marginTop: '9px' }} className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 leading-relaxed">
                    ⚠️ 비공개 기본은 참여자가 서로의 인증을 보지 못해 <b>참여·동기부여가 줄 수 있어요.</b> 다만 <b>마음건강·정신건강 등 민감한 프로그램</b>에는 권장합니다.
                  </p>
                ) : (
                  <p style={{ marginTop: '9px' }} className="text-[11px] text-gray-400">공개 인증은 서로 응원하며 참여를 높여요.</p>
                )}
              </div>
            )
          })()}
        </div>
      </section>

      {/* 3) 승인 및 노출 */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <h3 className={headCls}>{numBadge(3)} 승인 및 노출 <span className="text-[11px] font-normal text-gray-400 ml-1">설정 저장</span></h3>
        <div className="space-y-3">
          {[
            { label: '공지 게시판 사용', desc: '상단 고정 공지를 노출', on: noticeEnabled, set: setNoticeEnabled },
            { label: '반응(좋아요·댓글) 허용', desc: '참여자 상호작용 켜기', on: reactionAuto, set: setReactionAuto },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-800">{row.label}</p>
                <p className="text-[11px] text-gray-500">{row.desc}</p>
              </div>
              <Toggle on={row.on} onClick={() => row.set(v => !v)} />
            </div>
          ))}
        </div>
      </section>

      {/* 4) 신고/숨김 정책 */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <h3 className={headCls}>{numBadge(4)} 신고 / 숨김 정책 <span className="text-[11px] font-normal text-gray-400 ml-1">설정 저장</span></h3>
        <div className="grid grid-cols-3 gap-2">
          {REPORT_OPTIONS.map(o => {
            const on = reportPolicy === o.key
            return (
              <button key={o.key} type="button" onClick={() => setReportPolicy(o.key)}
                className={`rounded-xl border-2 p-2 text-center transition ${on ? 'border-emerald-400 bg-emerald-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                <p className={`text-[12px] font-bold ${on ? 'text-emerald-700' : 'text-gray-700'}`}>{o.label}</p>
                <p className="text-[9px] text-gray-400 leading-tight mt-0.5">{o.desc}</p>
              </button>
            )
          })}
        </div>
      </section>

      {/* 5) 미리보기 */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <h3 className={headCls}>{numBadge(5)} 미리보기</h3>
        <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
          <div className="w-[104px] rounded-md bg-white border border-gray-100 flex-shrink-0"><LayoutPreview type={layout} /></div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-gray-800">{selLayout.label}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{selLayout.desc}</p>
            <p className="text-[11px] text-gray-400 mt-1">저장하면 참여자 커뮤니티에 적용돼요.</p>
          </div>
        </div>
      </section>

      {/* 게시물 관리 (가려진 글 등) */}
      {onGoPosts && (
        <button type="button" onClick={onGoPosts}
          className="w-full flex items-center justify-center gap-1.5 h-11 rounded-2xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition">
          <FileText className="w-4 h-4" /> 게시물 관리 (가려진 글 · 신고)
        </button>
      )}
    </div>
    </div>
  )
})

export default CommunityManagePanel
