import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import { useKeyboardInset } from '../../hooks/useKeyboardInset'
import { supabase } from '../../supabaseClient'
import { Check, Heart, MessageCircle, Plus, X, ChevronUp, ChevronDown, MoreVertical, Trash2, LayoutGrid } from 'lucide-react'
import ConfirmModal from '../common/ConfirmModal'

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
  { key: '2', label: '신고 2회', desc: '서로 다른 2명 신고 시 (권장)' },
  { key: '3', label: '신고 3회', desc: '3명 누적 시 숨김' },
  { key: '5', label: '신고 5회', desc: '5명 누적 시 숨김' },
  { key: 'auto', label: '즉시 숨김', desc: '신고 1회로 바로 숨김' },
]
// 설정을 3개 탭으로 그룹화 — 세로 스크롤 대신 탭 전환
const TABS = [
  { key: 'look', label: '스타일' },    // 레이아웃 + 미리보기
  { key: 'boards', label: '게시판' },  // 게시판 카테고리 + 인증 피드 공개
  { key: 'rules', label: '규칙' },     // 승인·노출 + 댓글 점수 + 신고 정책
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

// ⑤ 미리보기 — 게시글이 없어도 레이아웃 감을 주도록 예시(더미) 게시글을 실제 참여자 화면 스타일로 렌더
const SAMPLE_POSTS = [
  { id: 1, name: '김건강', note: '오늘 아침 5km 러닝 완료! 상쾌하게 하루 시작 🏃', likes: 12, comments: 3, grad: 'from-emerald-200 to-teal-300' },
  { id: 2, name: '이활력', note: '물 2L 챌린지 인증합니다 💧 꾸준함이 답!', likes: 8, comments: 1, grad: 'from-sky-200 to-indigo-300' },
  { id: 3, name: '박미소', note: '홈트 30분 끝! 같이 으쌰으쌰 💪', likes: 5, comments: 0, grad: 'from-amber-200 to-orange-300' },
  { id: 4, name: '최정원', note: '점심은 샐러드로 가볍게 🥗', likes: 9, comments: 2, grad: 'from-rose-200 to-pink-300' },
]
const AVA_COLORS = ['bg-emerald-400', 'bg-sky-400', 'bg-violet-400', 'bg-amber-400', 'bg-rose-400']
function PreviewAvatar({ name, sizeCls = 'w-6 h-6' }) {
  const c = AVA_COLORS[name.charCodeAt(0) % AVA_COLORS.length]
  return <div className={`${sizeCls} rounded-full ${c} text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0`}>{name[0]}</div>
}
function PreviewReacts({ on, p, light }) {
  if (!on) return null
  const cls = light ? 'text-white/90' : 'text-gray-500'
  return (
    <div className={`flex items-center gap-2.5 text-[10px] ${cls}`}>
      <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" /> {p.likes}</span>
      <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" /> {p.comments}</span>
    </div>
  )
}
function CommunityPreview({ layout, reactionsEnabled, boards }) {
  const list = boards && boards.length ? boards : [{ id: '_', name: '게시판' }]
  const [sel, setSel] = useState(0)
  const selIdx = Math.min(sel, list.length - 1)
  const selBoard = list[selIdx]
  // 각 칩(게시판)의 적용 레이아웃 — 게시판별 설정(b.layout)이 있으면 그걸, 없으면 전체 설정(layout) 따름
  const effLayout = selBoard?.layout || layout
  const effLabel = LAYOUTS.find(l => l.key === effLayout)?.label || effLayout
  const custom = !!selBoard?.layout
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      {/* 상단 — 게시판 칩(탭하면 그 게시판 레이아웃으로 전환) + 예시 배지 */}
      <div className="flex items-center justify-between gap-2 px-2.5 pt-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {list.map((b, i) => (
            <button
              key={b.id ?? i}
              type="button"
              onClick={() => setSel(i)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition flex-shrink-0 ${i === selIdx ? 'bg-emerald-500 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
            >
              {b.name}
            </button>
          ))}
        </div>
        <span className="px-1.5 py-0.5 rounded bg-gray-800/80 text-white text-[9px] font-bold flex-shrink-0">예시</span>
      </div>

      {/* 선택한 게시판의 적용 레이아웃 표시 */}
      <div className="px-2.5 pt-1.5">
        <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
          <LayoutGrid className="w-2.5 h-2.5 flex-shrink-0" />
          <b className="text-gray-700">{selBoard?.name}</b> · {effLabel}
          {!custom && <span className="text-gray-400">(전체 설정)</span>}
        </span>
      </div>

      <div className="p-2.5">
        {effLayout === 'feed' && (
          <div className="space-y-2">
            {SAMPLE_POSTS.slice(0, 2).map(p => (
              <div key={p.id} className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-1.5 p-2">
                  <PreviewAvatar name={p.name} />
                  <span className="text-[11px] font-bold text-gray-800">{p.name}</span>
                  <span className="text-[9px] text-gray-400 ml-auto">방금</span>
                </div>
                <div className={`h-20 bg-gradient-to-br ${p.grad}`} />
                <div className="p-2 space-y-1">
                  <PreviewReacts on={reactionsEnabled} p={p} />
                  <p className="text-[11px] text-gray-700 leading-snug">{p.note}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {effLayout === 'list' && (
          <div className="space-y-1.5">
            {SAMPLE_POSTS.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 p-1.5">
                <div className={`w-10 h-10 rounded-md bg-gradient-to-br ${p.grad} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-gray-800">{p.name}</span>
                    <span className="text-[9px] text-gray-400">방금</span>
                  </div>
                  <p className="text-[10px] text-gray-600 truncate">{p.note}</p>
                  <PreviewReacts on={reactionsEnabled} p={p} />
                </div>
              </div>
            ))}
          </div>
        )}

        {effLayout === 'grid' && (
          <div className="grid grid-cols-2 gap-1.5">
            {SAMPLE_POSTS.map(p => (
              <div key={p.id} className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                <div className={`h-16 bg-gradient-to-br ${p.grad}`} />
                <div className="p-1.5 space-y-0.5">
                  <div className="flex items-center gap-1">
                    <PreviewAvatar name={p.name} sizeCls="w-4 h-4" />
                    <span className="text-[10px] font-semibold text-gray-700 truncate">{p.name}</span>
                  </div>
                  <p className="text-[10px] text-gray-600 line-clamp-2 leading-snug">{p.note}</p>
                  <PreviewReacts on={reactionsEnabled} p={p} />
                </div>
              </div>
            ))}
          </div>
        )}

        {effLayout === 'magazine' && (
          <div className="space-y-1.5">
            <div className={`relative h-24 rounded-lg overflow-hidden bg-gradient-to-br ${SAMPLE_POSTS[0].grad}`}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                <p className="text-[11px] font-bold drop-shadow line-clamp-1">{SAMPLE_POSTS[0].note}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px]">{SAMPLE_POSTS[0].name}</span>
                  <span className="ml-auto"><PreviewReacts on={reactionsEnabled} p={SAMPLE_POSTS[0]} light /></span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SAMPLE_POSTS.slice(1, 3).map(p => (
                <div key={p.id} className={`relative h-16 rounded-lg overflow-hidden bg-gradient-to-br ${p.grad}`}>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 text-white">
                    <p className="text-[10px] font-bold drop-shadow line-clamp-1">{p.note}</p>
                    <span className="text-[9px]">{p.name}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* 중 1 — 가로 행 */}
            <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 p-1.5">
              <div className={`w-10 h-10 rounded-md bg-gradient-to-br ${SAMPLE_POSTS[3].grad} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-gray-800">{SAMPLE_POSTS[3].name}</span>
                <p className="text-[9px] text-gray-600 truncate">{SAMPLE_POSTS[3].note}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const Toggle = ({ on, onClick }) => (
  <button type="button" onClick={onClick} className={`relative w-11 h-6 rounded-full transition flex-shrink-0 ${on ? 'bg-emerald-500' : 'bg-gray-300'}`}>
    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
  </button>
)
const headCls = 'flex items-center gap-1.5 text-[15px] font-bold text-gray-800 mb-3'

const CommunityManagePanel = forwardRef(function CommunityManagePanel({ program, onSaved }, ref) {
  const [layout, setLayout] = useState('feed')
  const [boards, setBoards] = useState(DEFAULT_BOARDS)
  const [postApproval, setPostApproval] = useState(false)
  const [noticeEnabled, setNoticeEnabled] = useState(true)
  const [reactionAuto, setReactionAuto] = useState(true)
  const [previewCard, setPreviewCard] = useState(true)
  const [reportPolicy, setReportPolicy] = useState('2')
  // 댓글 활동 점수 (마이그 187 — programs 전용 컬럼). 기본 OFF.
  const [commentPointsEnabled, setCommentPointsEnabled] = useState(false)
  const [commentPoints, setCommentPoints] = useState(2)
  const [commentDailyLimit, setCommentDailyLimit] = useState(1)
  const [tab, setTab] = useState('look')   // 모양 / 게시판 / 규칙

  useEffect(() => {
    if (!program) return
    setLayout(program.community_layout || 'feed')
    const s = program.community_settings || {}
    setBoards(Array.isArray(s.boards) && s.boards.length ? s.boards : DEFAULT_BOARDS)
    setPostApproval(!!s.postApproval)
    setNoticeEnabled(s.noticeEnabled !== false)
    setReactionAuto(s.reactionAuto !== false)
    setPreviewCard(s.previewCard !== false)
    setReportPolicy(s.reportPolicy || '2')
    setCommentPointsEnabled(!!program.comment_points_enabled)
    setCommentPoints(program.comment_points ?? 2)
    setCommentDailyLimit(program.comment_points_daily_limit ?? 1)
  }, [program])

  const [boardToDelete, setBoardToDelete] = useState(null)  // 게시판 삭제 확인 (board id)
  const removeBoard = (bid) => setBoardToDelete(bid)
  const confirmRemoveBoard = () => {
    setBoards(prev => prev.filter(b => b.id !== boardToDelete))
    setBoardToDelete(null)
  }
  const updateBoard = (bid, patch) => setBoards(prev => prev.map(b => b.id === bid ? { ...b, ...patch } : b))
  const moveBoard = (idx, dir) => {
    setBoards(prev => {
      const ni = idx + dir
      if (ni < 0 || ni >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[ni]] = [arr[ni], arr[idx]]
      return arr
    })
  }
  const [menuOpenId, setMenuOpenId] = useState(null)  // ⋮ 메뉴
  const [layoutModal, setLayoutModal] = useState(null)  // 게시판별 레이아웃 선택 { boardId }
  const [nameModal, setNameModal] = useState(null)    // 게시판 이름 입력 모달 { mode:'add'|'rename', boardId, value }
  useBodyScrollLock(!!layoutModal || !!nameModal)  // 레이아웃/이름 오버레이 — iOS 배경 스크롤 방지
  useBackButtonClose(!!layoutModal, () => setLayoutModal(null))  // 하드웨어 뒤로가기 = 닫기(스택 최상단)
  useBackButtonClose(!!nameModal, () => setNameModal(null))
  const kbInset = useKeyboardInset()   // iOS 키보드 높이 — 게시판 이름 입력 시 카드 위로
  const confirmName = () => {
    const v = (nameModal?.value || '').trim().slice(0, 8)
    if (!v) { setNameModal(null); return }
    if (nameModal.mode === 'add') {
      setBoards(prev => [...prev, { id: `b_${prev.length}_${Math.random().toString(36).slice(2, 7)}`, name: v, system: false, writePerm: 'free', commentPerm: 'free' }])
    } else {
      updateBoard(nameModal.boardId, { name: v })
    }
    setNameModal(null)
  }

  useImperativeHandle(ref, () => ({
    save: async () => {
      const payload = { community_layout: layout }
      if (program && Object.prototype.hasOwnProperty.call(program, 'community_settings')) {
        payload.community_settings = { boards, postApproval, noticeEnabled, reactionAuto, previewCard, reportPolicy }
      } else if (program && !Object.prototype.hasOwnProperty.call(program, 'community_layout')) {
        return '커뮤니티 컬럼(마이그레이션 094/095)이 아직 적용되지 않았어요'
      }
      // 댓글 활동 점수 — 전용 컬럼(마이그 187)이 적용된 경우에만 포함
      if (program && Object.prototype.hasOwnProperty.call(program, 'comment_points_enabled')) {
        payload.comment_points_enabled = commentPointsEnabled
        payload.comment_points = Math.max(1, Math.min(100, Math.round(Number(commentPoints)) || 1))
        payload.comment_points_daily_limit = Math.max(1, Math.min(10, Math.round(Number(commentDailyLimit)) || 1))
      }
      const { error } = await supabase.from('programs').update(payload).eq('id', program.id)
      if (error) return error.message
      onSaved?.()
      return null
    },
  }), [layout, boards, postApproval, noticeEnabled, reactionAuto, previewCard, reportPolicy, commentPointsEnabled, commentPoints, commentDailyLimit, program, onSaved])

  const selLayout = LAYOUTS.find(l => l.key === layout) || LAYOUTS[0]

  return (
    <div className="-mx-[11px]">
    <div className="mission-fields w-[366px] max-w-full mx-auto pb-2">
      {/* 탭 바 — 3그룹으로 묶어 세로 스크롤 제거 */}
      <div className="flex gap-1.5 mb-3">
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl text-[13px] font-bold transition ${tab === t.key ? 'bg-emerald-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-[9px]">
      {tab === 'look' && (<>
      {/* 레이아웃 */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <h3 className={headCls}>스타일 선택</h3>
        <p className="text-[11px] text-gray-400 mb-3 -mt-2">선택한 형태로 게시글 배치가 바뀝니다.</p>
        <div className="grid grid-cols-2 gap-2">
          {LAYOUTS.map(l => {
            const on = layout === l.key
            return (
              <button key={l.key} type="button" onClick={() => setLayout(l.key)}
                className={`relative flex flex-col items-center text-center rounded-xl border-2 p-2 transition ${on ? 'border-emerald-400 bg-emerald-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                {on && <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm"><Check className="w-2.5 h-2.5 text-white" /></span>}
                <div className="w-full rounded-md bg-gray-50 border border-gray-100 mb-1.5"><LayoutPreview type={l.key} /></div>
                <span className={`text-[12px] font-bold ${on ? 'text-emerald-700' : 'text-gray-700'}`}>{l.label}</span>
                <span className="text-[9px] text-gray-400 leading-tight mt-0.5">{l.desc}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* 미리보기 — 모양 탭에 함께 (레이아웃 고르며 바로 확인) */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <h3 className={headCls}>미리보기</h3>
        <div className="flex items-baseline gap-2 mb-2">
          <p className="text-[13px] font-bold text-gray-800">{selLayout.label}</p>
          <p className="text-[11px] text-gray-500">{selLayout.desc}</p>
        </div>
        <CommunityPreview layout={layout} reactionsEnabled={reactionAuto} boards={boards} />
        <p className="text-[11px] text-gray-400 mt-2">예시 게시글로 보여드려요. 저장하면 선택한 스타일이 참여자 커뮤니티에 적용돼요.</p>
      </section>
      </>)}

      {tab === 'boards' && (<>
      {/* 게시판 카테고리 — 칩 */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-gray-800">게시판 카테고리</h3>
          <span className="text-[10px] text-gray-400">ⓘ 이름 탭=수정 · X=삭제</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-hide">
          {boards.map((b, i) => {
            const isAll = b.id === 'all'
            return (
              <span key={b.id} className={`flex-shrink-0 inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-[13px] font-semibold ${isAll ? 'bg-emerald-500 text-white' : CHIP_COLORS[i % CHIP_COLORS.length]}`}>
                <button type="button" onClick={() => setNameModal({ mode: 'rename', boardId: b.id, value: b.name })} className="hover:underline max-w-[72px] truncate">{b.name}</button>
                <button type="button" onClick={() => removeBoard(b.id)} className="opacity-70 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
              </span>
            )
          })}
          <button type="button" onClick={() => setNameModal({ mode: 'add', value: '' })}
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
          {boards.map((b, idx) => {
            const meta = BOARD_META[b.id] || { emoji: '📝', bg: 'bg-gray-100' }
            return (
              <div
                key={b.id}
                className="grid grid-cols-[1.7fr_1fr_0.9fr_18px] gap-1.5 items-center py-2 border-b border-gray-50"
              >
                {/* 게시판 */}
                <div className="flex items-center gap-1 min-w-0">
                  {/* 순서 ▲▼ */}
                  <div className="flex flex-col flex-shrink-0 text-gray-400">
                    <button type="button" onClick={() => moveBoard(idx, -1)} disabled={idx === 0} title="위로"
                      className="hover:text-emerald-600 disabled:opacity-20 disabled:hover:text-gray-400 leading-none"><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => moveBoard(idx, 1)} disabled={idx === boards.length - 1} title="아래로"
                      className="hover:text-emerald-600 disabled:opacity-20 disabled:hover:text-gray-400 leading-none"><ChevronDown className="w-3.5 h-3.5" /></button>
                  </div>
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${meta.bg}`}>{meta.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-gray-800 truncate">{b.name}</p>
                    {b.layout ? (
                      <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 text-[9px] font-semibold leading-none">
                        <LayoutGrid className="w-2.5 h-2.5" /> {LAYOUTS.find(l => l.key === b.layout)?.label || b.layout}
                      </span>
                    ) : (
                      b.desc && <p className="text-[9px] text-gray-400 leading-tight">{b.desc}</p>
                    )}
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
                      <div className="absolute right-0 top-6 z-20 w-36 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                        <button type="button" onClick={() => { setLayoutModal({ boardId: b.id }); setMenuOpenId(null) }} className="w-full flex items-center gap-1.5 px-3 py-1.5 text-left text-[12px] text-gray-700 hover:bg-gray-50">
                          <LayoutGrid className="w-3.5 h-3.5" /> 스타일 선택
                        </button>
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

      </>)}

      {tab === 'rules' && (<>
      {/* 승인 및 노출 */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <h3 className={headCls}>승인 및 노출 <span className="text-[11px] font-normal text-gray-400 ml-1">설정 저장</span></h3>
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

      {/* 4) 댓글 활동 점수 (마이그 187) — 소통 유도. 기본 OFF */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-gray-800">댓글 활동 점수</h3>
            <p className="text-[11px] text-gray-500 mt-1 break-keep">다른 참여자의 글·인증에 댓글을 달면 점수를 줘서 소통을 유도해요.</p>
          </div>
          <Toggle on={commentPointsEnabled} onClick={() => setCommentPointsEnabled(v => !v)} />
        </div>
        {commentPointsEnabled && (
          <div className="mt-3.5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-800">댓글 1개당 점수</p>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" min={1} max={100} value={commentPoints}
                  onChange={(e) => setCommentPoints(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-16 px-2 py-1.5 text-[13px] text-right border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400" />
                <span className="text-[13px] text-gray-500">P</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-gray-800">하루 인정 개수</p>
                <p className="text-[11px] text-gray-500">이 개수까지만 하루에 점수를 줘요</p>
              </div>
              <div className="flex items-center gap-1">
                <input type="number" min={1} max={10} value={commentDailyLimit}
                  onChange={(e) => setCommentDailyLimit(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-16 px-2 py-1.5 text-[13px] text-right border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400" />
                <span className="text-[13px] text-gray-500">개</span>
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1.5">
              <p className="text-[11px] text-amber-800 font-bold break-keep">📢 공지 게시판 댓글은 점수에서 제외돼요.</p>
              <p className="text-[11px] text-amber-700 leading-relaxed break-keep">참여자끼리 소통을 유도하는 게 목적이라, 공지에 단 댓글은 점수를 주지 않아요. 본인 글에 단 댓글과 공백 제외 3글자 미만도 제외돼요.</p>
            </div>
          </div>
        )}
      </section>

      {/* 5) 신고/숨김 정책 — 자동 숨김 토글(off=직접 관리). off 면 임계값 버튼 숨김 */}
      <section className="bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-gray-800">신고 / 숨김 정책</h3>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-500">자동 숨김</span>
            <Toggle on={reportPolicy !== 'off'} onClick={() => setReportPolicy(p => p === 'off' ? '2' : 'off')} />
          </div>
        </div>
        {reportPolicy === 'off' ? (
          <p className="text-[11px] text-gray-400 leading-relaxed bg-gray-50 rounded-xl p-3">
            신고가 쌓여도 자동으로 숨기지 않아요. 운영자가 「가려진 글 · 신고 관리」에서 직접 확인하고 처리합니다.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
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
        )}
      </section>
      </>)}
      </div>

      {/* 신고·숨김 관리(신고 관리 + 가려진 인증)는 운영자 메뉴로 이동됨 */}

      {/* 게시판별 레이아웃 선택 모달 — 기본값(전체 설정 따름) + 4종 */}
      {layoutModal && (() => {
        const b = boards.find(x => x.id === layoutModal.boardId)
        if (!b) return null
        const cur = b.layout || ''   // '' = 전체 설정 따름
        const choose = (key) => { updateBoard(b.id, { layout: key || undefined }); setLayoutModal(null) }
        return (
          <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-5" onClick={() => setLayoutModal(null)}>
            <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <h4 className="text-[15px] font-bold text-gray-800 mb-0.5">“{b.name}” 스타일</h4>
              <p className="text-[11px] text-gray-400 mb-3">이 게시판만 다른 스타일로. 기본은 전체 설정({LAYOUTS.find(l => l.key === layout)?.label})을 따라요.</p>
              <div className="grid grid-cols-2 gap-2">
                {/* 전체 설정 따름 */}
                <button type="button" onClick={() => choose('')}
                  className={`relative flex flex-col items-center text-center rounded-xl border-2 p-2 transition ${cur === '' ? 'border-emerald-400 bg-emerald-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  {cur === '' && <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></span>}
                  <div className="w-full h-[44px] rounded-md bg-gray-50 border border-gray-100 mb-1.5 flex items-center justify-center text-[10px] text-gray-400 font-semibold">전체 설정</div>
                  <span className={`text-[12px] font-bold ${cur === '' ? 'text-emerald-700' : 'text-gray-700'}`}>기본값 따름</span>
                </button>
                {LAYOUTS.map(l => {
                  const on = cur === l.key
                  return (
                    <button key={l.key} type="button" onClick={() => choose(l.key)}
                      className={`relative flex flex-col items-center text-center rounded-xl border-2 p-2 transition ${on ? 'border-emerald-400 bg-emerald-50/50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                      {on && <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></span>}
                      <div className="w-full rounded-md bg-gray-50 border border-gray-100 mb-1.5"><LayoutPreview type={l.key} /></div>
                      <span className={`text-[12px] font-bold ${on ? 'text-emerald-700' : 'text-gray-700'}`}>{l.label}</span>
                    </button>
                  )
                })}
              </div>
              <button type="button" onClick={() => setLayoutModal(null)} className="mt-3 w-full h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition">닫기</button>
            </div>
          </div>
        )
      })()}

      {/* 게시판 이름 입력 모달 (한줄 설명 모달과 동일 스타일) */}
      {nameModal && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-5" style={{ paddingBottom: kbInset ? kbInset + 20 : undefined, transition: 'padding-bottom .2s ease' }} onClick={() => setNameModal(null)}>
          <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-[15px] font-bold text-gray-800 mb-2">{nameModal.mode === 'add' ? '새 게시판 이름' : '게시판 이름 수정'}</h4>
            <input
              value={nameModal.value}
              onChange={(e) => setNameModal(m => ({ ...m, value: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmName() }}
              maxLength={8}
              autoFocus
              placeholder="게시판 이름 (최대 8자)"
              style={{ fontSize: '14px' }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-emerald-400"
            />
            <p className="text-[11px] text-gray-400 text-right mt-0.5">{(nameModal.value || '').length}/8</p>
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setNameModal(null)} className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition">취소</button>
              <button type="button" onClick={confirmName} className="flex-[1.4] h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold transition">확인</button>
            </div>
          </div>
        </div>
      )}

      {/* 게시판 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={boardToDelete != null}
        onClose={() => setBoardToDelete(null)}
        onConfirm={confirmRemoveBoard}
        title="게시판을 삭제할까요?"
        message={`"${boards.find(b => b.id === boardToDelete)?.name || ''}" 게시판을 목록에서 제거해요. 저장해야 실제로 반영됩니다.`}
        confirmLabel="삭제"
        danger
      />
    </div>
    </div>
  )
})

export default CommunityManagePanel
