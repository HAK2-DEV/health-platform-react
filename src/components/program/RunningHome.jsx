import { useState, useRef, useEffect } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useBackButtonClose } from '../../hooks/useBackButtonClose'
import { motion, AnimatePresence } from 'framer-motion'
import { Timer, Flame, Megaphone, Footprints, Star, ClipboardList, HelpCircle, MessageSquare, Trophy, ChevronRight, Check, Pencil, X } from 'lucide-react'
import WeeklyStreak from './WeeklyStreak'
import FlameIcon from '../common/FlameIcon'
import RunningCourseMini from './RunningCourseMini'
import CountUp from '../common/CountUp'
import { Reveal } from './statsAnim'
import TapRunner from './TapRunner'
import { NavCard, Icon3D } from './ProgramHome'

// 달리기 테마 전용 홈(대시보드) — 목업 기준 UI (2026-06-30, v2).
//   변경: 히어로에 추천페이스+주간스트릭 통합(층층이), 회복점수→칼로리, 운영자 설정 페이스, 일러스트 연결.
//   에셋 경로(파일 넣으면 자동 적용, 없으면 폴백):
//     /illustrations/themes/running/{runner,banner,course-map}.png
//     /icons/running/{shoe,stopwatch,star,flame}.png
const RUN = '/illustrations/themes/running'
const RICON = '/icons/running'
const wd = (label, done) => ({ label, done })

// 이미지 — 없거나 로드 실패 시 fallback 렌더
function AssetImg({ src, fallback, className }) {
  const [err, setErr] = useState(false)
  if (err || !src) return fallback
  return <img src={src} alt="" aria-hidden="true" className={className} onError={() => setErr(true)} />
}

// 하단 격려 배너 — 배경 일러스트 + 문구가 함께 5초마다 옆으로 슬라이드(무한 루프).
//   화분 아이콘만 고정(원형 흰 배경) + 컨테이너 높이를 정의해 원래 크기(≈78px) 유지.
const BANNER_SLIDES = [
  { img: `${RUN}/banner.png`,  title: '오늘도 한 걸음 더, 가볍게 달려봐요', sub: '작은 습관이 큰 변화를 만들어요!' },
  { img: `${RUN}/banner2.jpg`, title: '멈추지 않으면, 결국 도착해요',        sub: '어제의 나보다 딱 1분 더!' },
]
function BottomBanner() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % BANNER_SLIDES.length), 5000)
    return () => clearInterval(t)
  }, [])
  const s = BANNER_SLIDES[idx]
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 shadow-soft bg-gradient-to-r from-sky-50 to-emerald-50 h-[78px]">
      {/* 배경 + 화분 + 문구 — 한 덩어리로 5초마다 좌측 슬라이드 인/아웃(원래 크기 유지 위해 컨테이너 높이 고정) */}
      <AnimatePresence initial={false}>
        <motion.div
          key={idx}
          className="absolute inset-0"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '-100%' }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <AssetImg src={s.img} className="absolute inset-0 w-full h-full object-cover" fallback={<span />} />
          <div className="relative z-10 flex items-center gap-3 p-4 h-full">
            <span className="w-11 h-11 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0">
              <AssetImg src={`${RUN}/plant.png`} className="w-9 h-9 object-contain" fallback={<span className="text-xl">🌱</span>} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold text-gray-800 truncate">{s.title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">{s.sub}</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// 미션/퀴즈/커뮤니티 진입 카드 — 비활성 메뉴는 호출부에서 제외(여기선 항상 활성 박스만 렌더).
//   sized=true(박스 2개 이하): 170×133 고정 / false(3개): 그리드 셀에 맞춤.
// ── 히어로 편집 (운영자) ──────────────────────────────
const HERO_TITLE_SIZES = [
  { key: 'sm', label: '작게', px: 16 },
  { key: 'md', label: '보통', px: 20 },
  { key: 'lg', label: '크게', px: 24 },
  { key: 'xl', label: '아주', px: 28 },
]
const HERO_SUB_SIZES = [
  { key: 'sm', label: '작게', px: 11 },
  { key: 'md', label: '보통', px: 13 },
  { key: 'lg', label: '크게', px: 15 },
]
const HERO_PALETTE = ['#111827', '#374151', '#6B7280', '#059669', '#0EA5E9', '#D97706', '#E11D48', '#7C3AED']
const HERO_DEFAULT_HTML = {
  titleHtml: '오늘도 한 걸음,<br><span style="color:#059669">더 건강한 나를 향해</span>',
  subtitleHtml: '지속 가능한 러닝 습관을 만들어가요.',
}
const sizePx = (list, key, fb) => (list.find((s) => s.key === key)?.px ?? fb)

// 색 화이트리스트 + HTML 새니타이즈 — 참여자에게도 렌더되므로 XSS 방지: span[color]/br/텍스트만 허용
const _HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const _RGB = /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i
function safeColor(v) {
  const c = String(v || '').trim().toLowerCase()
  return _HEX.test(c) || _RGB.test(c) ? c : null
}
function safeFontSize(v) {
  const s = String(v || '').trim().toLowerCase()
  return /^\d{1,3}px$/.test(s) ? s : null
}
function safeFontWeight(v) {
  const s = String(v || '').trim().toLowerCase()
  if (s === 'bold') return '800'
  if (s === 'normal') return '400'
  return /^[1-9]00$/.test(s) ? s : null
}
const _esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function sanitizeHeroHtml(html) {
  if (!html || typeof document === 'undefined') return ''
  const tpl = document.createElement('template')
  tpl.innerHTML = String(html).slice(0, 4000)
  let out = ''
  const walk = (node) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) out += _esc(n.nodeValue)
      else if (n.nodeType === 1) {
        const tag = n.tagName.toLowerCase()
        if (tag === 'br') { out += '<br>'; return }
        if (tag === 'div') { if (out && !out.endsWith('<br>')) out += '<br>'; walk(n); return }
        if (tag === 'span' || tag === 'font') {
          const st = []
          const col = safeColor(n.style?.color || n.getAttribute('color'))
          if (col) st.push(`color:${col}`)
          const fs = safeFontSize(n.style?.fontSize)
          if (fs) st.push(`font-size:${fs}`)
          const fw = safeFontWeight(n.style?.fontWeight)
          if (fw) st.push(`font-weight:${fw}`)
          if (st.length) { out += `<span style="${st.join(';')}">`; walk(n); out += '</span>'; return }
          walk(n); return
        }
        if (tag === 'b' || tag === 'strong') { out += '<span style="font-weight:800">'; walk(n); out += '</span>'; return }
        walk(n)
      }
    })
  }
  walk(tpl.content)
  return out
}
function plainToHtml(text, color) {
  const h = _esc(text).replace(/\n/g, '<br>')
  const col = safeColor(color)
  return col ? `<span style="color:${col}">${h}</span>` : h
}

// 글자(선택 영역) 단위로 크기·볼드·색을 지정하는 편집 필드 (contentEditable).
//   선택 영역을 style span 으로 감싸는 방식 → 크기/볼드/색 모두 동일 메커니즘.
function RichField({ initialHtml, baseFontSize, baseFontWeight, baseColor, sizes, onChange }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.innerHTML = initialHtml || '' }, [])
  const emit = () => onChange?.(sanitizeHeroHtml(ref.current?.innerHTML || ''))
  const applyStyle = (styleObj) => {
    const el = ref.current
    if (!el) return
    if (document.activeElement !== el) el.focus()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return // 선택 없으면 무시
    const range = sel.getRangeAt(0)
    if (!el.contains(range.commonAncestorContainer)) return
    const span = document.createElement('span')
    Object.assign(span.style, styleObj)
    try { range.surroundContents(span) }
    catch {
      // 선택이 여러 요소에 걸쳐 surroundContents 실패 시 — 추출 후 감싸기
      const frag = range.extractContents()
      span.appendChild(frag)
      range.insertNode(span)
    }
    sel.removeAllRanges()
    const r = document.createRange()
    r.selectNodeContents(span)
    sel.addRange(r)
    emit()
  }
  const toggleBold = () => {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    let node = sel.anchorNode
    if (node && node.nodeType === 3) node = node.parentElement
    const cur = node ? parseInt(window.getComputedStyle(node).fontWeight, 10) || 400 : 400
    applyStyle({ fontWeight: cur >= 600 ? '400' : '800' })
  }
  const md = (fn) => (e) => { e.preventDefault(); fn() } // 선택 유지(blur 방지)
  return (
    <>
      <div ref={ref} contentEditable suppressContentEditableWarning onInput={emit} onBlur={emit}
        className="mt-1 w-full px-2 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-400 leading-snug break-keep"
        style={{ fontSize: baseFontSize, fontWeight: baseFontWeight, color: baseColor, whiteSpace: 'pre-wrap', minHeight: 34 }} />
      <p className="text-[10px] text-gray-400 mt-1">🎨 글자를 드래그로 선택한 뒤 크기·B·색을 누르면 그 부분만 적용돼요</p>
      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
        <div className="flex rounded-md border border-gray-200 overflow-hidden">
          {sizes.map((s) => (
            <button key={s.key} type="button" onMouseDown={md(() => applyStyle({ fontSize: `${s.px}px` }))}
              className="px-2 h-7 text-[11px] font-bold bg-white text-gray-500 hover:bg-gray-50">{s.label}</button>
          ))}
        </div>
        <button type="button" onMouseDown={md(toggleBold)}
          className="w-7 h-7 rounded-md border border-gray-200 bg-white text-gray-600 text-[13px] font-extrabold hover:bg-gray-50">B</button>
        <div className="flex items-center gap-1">
          {HERO_PALETTE.map((c) => (
            <button key={c} type="button" onMouseDown={md(() => applyStyle({ color: c }))} aria-label={c}
              className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
    </>
  )
}

function RunningHeroBlock({ hero, editable, onHeroChange }) {
  const [editing, setEditing] = useState(false)
  useBodyScrollLock(editing)  // 히어로 편집 오버레이 — iOS 배경 스크롤 방지
  useBackButtonClose(editing, () => setEditing(false))  // 하드웨어 뒤로가기 = 닫기
  const [draft, setDraft] = useState(HERO_DEFAULT_HTML)
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }))
  const open = () => {
    const seed = { ...HERO_DEFAULT_HTML }
    if (hero) {
      seed.titleHtml = hero.titleHtml != null ? hero.titleHtml
        : (hero.title != null ? plainToHtml(hero.title, hero.titleColor) : HERO_DEFAULT_HTML.titleHtml)
      seed.subtitleHtml = hero.subtitleHtml != null ? hero.subtitleHtml
        : (hero.subtitle != null ? plainToHtml(hero.subtitle, hero.subtitleColor) : '')
    }
    setDraft(seed)
    setEditing(true)
  }
  const save = () => {
    onHeroChange?.({
      titleHtml: sanitizeHeroHtml(draft.titleHtml),
      subtitleHtml: sanitizeHeroHtml(draft.subtitleHtml),
    })
    setEditing(false)
  }

  const titleHtml = hero?.titleHtml != null ? hero.titleHtml
    : (hero?.title != null ? plainToHtml(hero.title, hero.titleColor) : null)
  const subHtml = hero?.subtitleHtml != null ? hero.subtitleHtml
    : (hero?.subtitle != null ? plainToHtml(hero.subtitle, hero.subtitleColor) : null)

  return (
    <>
      <div className="relative rounded-2xl px-4 pt-[11px] pb-4 bg-white border border-gray-100 shadow-soft">
        {editable && (
          <button type="button" onClick={open} className="absolute top-3 right-3 text-gray-300 hover:text-emerald-500 transition" aria-label="홈 문구 편집">
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {titleHtml != null ? (
          <>
            <h1 className="leading-snug break-keep"
              style={{ fontSize: sizePx(HERO_TITLE_SIZES, hero.titleSize, 24), fontWeight: hero.titleBold === false ? 600 : 800, color: '#111827' }}
              dangerouslySetInnerHTML={{ __html: sanitizeHeroHtml(titleHtml) }} />
            {subHtml && (
              <p className="break-keep" style={{ fontSize: sizePx(HERO_SUB_SIZES, hero.subtitleSize, 14), color: '#6B7280', marginTop: 6 }}
                dangerouslySetInnerHTML={{ __html: sanitizeHeroHtml(subHtml) }} />
            )}
          </>
        ) : (
          <>
            <h1 className="text-[24px] font-extrabold text-gray-900 leading-snug">
              오늘도 한 걸음,<br />
              <span className="text-emerald-600">더 건강한 나를 향해</span>
            </h1>
            <p className="text-[14px] text-gray-500 mt-1.5">지속 가능한 러닝 습관을 만들어가요.</p>
          </>
        )}
      </div>

      {/* 히어로 편집 — 화면 중앙 모달 */}
      {editing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-5" style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={() => setEditing(false)}>
          <div className="w-full max-w-[340px] max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-gray-800">홈 문구 편집</h3>
            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-0.5">제목</label>
              <RichField initialHtml={draft.titleHtml} baseFontSize={24} baseFontWeight={800} baseColor="#111827"
                sizes={HERO_TITLE_SIZES} onChange={(h) => set('titleHtml', h)} />
            </div>
            <div>
              <label className="block text-[13px] font-bold text-gray-700 mb-0.5">부제</label>
              <RichField initialHtml={draft.subtitleHtml} baseFontSize={14} baseFontWeight={500} baseColor="#6B7280"
                sizes={HERO_SUB_SIZES} onChange={(h) => set('subtitleHtml', h)} />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setEditing(false)} className="flex-1 h-10 rounded-lg border border-gray-200 text-gray-500 text-[14px] font-bold">취소</button>
              <button type="button" onClick={save} className="flex-[1.4] h-10 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition">저장</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// 달리기 개요 커스터마이즈 박스 — 순서·숨김 편집 대상(메뉴는 내비라 숨김 불가).
export const RUN_BOX_ORDER = ['summary', 'notice', 'dailyLog', 'course', 'menu', 'classes', 'todayMissions', 'recent', 'banner']
export const RUN_BOX_LABELS = {
  summary: '추천 페이스 · 주간',
  notice: '공지사항',
  dailyLog: '주요 기록 요약',
  course: '프로그램 진행률',
  todayMissions: '오늘의 미션',
  recent: '최근 인증',
  menu: '메뉴',
  classes: '클래스',
  banner: '격려 배너',
}

function RunningHome({
  programName = '러닝 프로그램',
  startDate = '2026.06.29',
  endDate = '2026.07.26',
  progress = 3,
  pace = "6'20",                 // 운영자 설정값
  weekStreak = { count: 4, days: [wd('월', true), wd('화', true), wd('수', true), wd('목', true), { label: '금', done: false, today: true }] },
  notice = '챌린지 인증 시 GPS 기록을 꼭 확인해주세요!',
  daily = { distanceKm: 42.195, timeHours: 23.3, streakDays: 7, calories: 409 },
  onOpenTab = () => {},
  onRecord = () => {},
  newMissionCount = 0,           // 새 미션/퀴즈 NEW 배지
  newQuizCount = 0,
  onNotice = null,               // 공지 클릭 동작(미지정 시 커뮤니티 탭으로)
  noticeUnread = false,          // 새 공지 미열람 → 공지 아이콘에 빨간 점(콩닥)
  classSlot = null,              // 강사 클래스 개요 진입 카드 (기능 ON 시 주입)
  topSlot = null,                // 상단 배너 슬롯 (임시저장 완성 안내·시작 설문 칩 등)
  quizEnabled = true,            // 마법사 「퀴즈」 토글
  communityEnabled = true,       // 마법사 「커뮤니티」 토글
  rankingEnabled = false,        // 랭킹 메뉴 표시 (달리기도 랭킹 카드 노출)
  paceEditable = false,          // 운영자 — 추천 페이스 수정 가능
  onPaceChange = null,           // (newPace) => void
  showStampTest = false,         // 주간 스트릭 도장 데모 트리거 노출
  streakRef = null,              // WeeklyStreak ref (playStamp 외부 호출용)
  hero = null,                   // 운영자 커스텀 히어로(run_hero) — null이면 기본 디자인
  heroEditable = false,          // 운영자 — 히어로 편집 가능
  onHeroChange = null,           // (heroConfig) => void
  boxOrder = null,               // 개요 박스 순서(null=기본)
  hiddenBoxes = [],              // 숨긴 박스 키
  onEditLayout = () => {},       // 개요 편집 열기
  editable = false,              // 운영자
  todayMissions = [],            // 오늘의 미션 미리보기
  recentItems = [],              // 최근 인증
}) {
  const fmt = (n) => Number(n || 0).toLocaleString('ko-KR', { maximumFractionDigits: 3 })
  // 연도 4자리 → 2자리 (2026.06.29 → 26.06.29)
  const yy = (d) => String(d || '').replace(/^\d{2}(\d{2})/, '$1')
  // 추천 페이스 인라인 수정 (운영자)
  const [editingPace, setEditingPace] = useState(false)
  useBodyScrollLock(editingPace)  // 페이스 목표 편집 오버레이 — iOS 배경 스크롤 방지
  useBackButtonClose(editingPace, () => setEditingPace(false))  // 하드웨어 뒤로가기 = 닫기
  const [paceInput, setPaceInput] = useState(pace)
  const savePace = () => {
    const v = paceInput.trim()
    if (v && v !== pace) onPaceChange?.(v)
    setEditingPace(false)
  }

  // 박스 레지스트리 — 순서·숨김 커스터마이즈 대상(ProgramHome 과 동일 패턴). 히어로는 고정(제외).
  const BOXES = {
    summary: () => (
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-3.5 bg-white border border-gray-100 shadow-soft">
          <div className="flex items-start gap-2.5">
            <span className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <AssetImg src={`${RICON}/stopwatch.png`} className="w-10 h-10 object-contain" fallback={<Timer className="w-8 h-8 text-emerald-500" />} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="text-[13px] font-bold text-gray-800">추천 페이스</span>
                {paceEditable && !editingPace && (
                  <button type="button" onClick={() => { setPaceInput(pace); setEditingPace(true) }}
                    className="text-gray-300 hover:text-emerald-500 transition" aria-label="추천 페이스 수정">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="font-extrabold text-emerald-600 leading-none whitespace-nowrap" style={{ marginTop: '15px', fontSize: 'clamp(16px, 5.8vw, 24px)' }}>{pace}<span className="text-[12px] font-bold text-gray-400 ml-1">/km</span></p>
              <p className="text-[11px] text-gray-400" style={{ marginTop: '6px' }}>편안하게 유지해요!</p>
            </div>
          </div>
        </div>
        <WeeklyStreak ref={streakRef} count={weekStreak.count} days={weekStreak.days} icon={<FlameIcon />} showTest={showStampTest} />
      </div>
    ),
    notice: () => (
      <button type="button" onClick={onNotice || (() => onOpenTab('community'))}
        className="w-full flex items-center gap-3 rounded-2xl p-3.5 bg-white border border-gray-100 shadow-soft text-left hover:bg-gray-50 transition">
        <span className="relative inline-flex flex-shrink-0">
          <Icon3D src="/icons/feature/notice.png" emoji="📢" className="w-8 h-8" />
          {noticeUnread && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white notice-dot-pulse" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-gray-800">공지사항</p>
          <p className="text-[12px] text-gray-500 truncate">{notice}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
      </button>
    ),
    dailyLog: () => (
      <div className="rounded-2xl p-4 bg-white border border-gray-100 shadow-soft">
        <h3 className="text-[13px] font-bold text-gray-800 mb-3">주요 기록 요약</h3>
        <div className="flex">
          {[
            { img: `${RICON}/shoe.png`,      fb: <Footprints className="w-5 h-5 text-emerald-500" />, label: '누적 거리', num: daily.distanceKm, fmtFn: (v) => Number(v || 0).toLocaleString('ko-KR', { maximumFractionDigits: 1 }), unit: 'km' },
            { img: `${RICON}/stopwatch.png`, fb: <Timer className="w-5 h-5 text-sky-500" />,           label: '러닝 시간', num: daily.timeHours, fmtFn: (v) => Number(v || 0).toLocaleString('ko-KR', { maximumFractionDigits: 1 }), unit: '시간' },
            { img: `${RICON}/star.png`,      fb: <Star className="w-5 h-5 text-violet-500" />,         label: '연속 인증', num: daily.streakDays, fmtFn: (v) => Number(v || 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 }), unit: '일' },
            { img: `${RICON}/flame.png`,     fb: <Flame className="w-5 h-5 text-rose-500" />,          label: '칼로리',   num: daily.calories, fmtFn: (v) => Number(v || 0).toLocaleString('ko-KR', { maximumFractionDigits: 0 }), unit: 'kcal' },
          ].map((c, i) => (
            <div key={i} className={`flex-1 min-w-0 flex flex-col items-center text-center px-1 ${i !== 0 ? 'border-l border-gray-100' : ''}`}>
              <div className="flex items-center gap-1 mb-1 min-w-0">
                <AssetImg src={c.img} className="w-5 h-5 object-contain flex-shrink-0" fallback={c.fb} />
                <span className="text-[10px] font-semibold text-gray-500 truncate min-w-0">{c.label}</span>
              </div>
              <span className="block w-full truncate tabular-nums text-[17px] font-extrabold text-gray-900 leading-tight"><CountUp value={c.num} format={c.fmtFn} duration={1100} /><span className="text-[11px] font-semibold text-gray-400 ml-0.5">{c.unit}</span></span>
            </div>
          ))}
        </div>
      </div>
    ),
    course: () => (
      <div className="rounded-2xl bg-white border border-gray-100 shadow-soft overflow-hidden flex items-stretch">
        <div className="w-[42%] flex-shrink-0 px-4 py-3 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-0.5">
            <TapRunner size={16} />
            <h3 className="text-[13px] font-bold text-gray-800 truncate">프로그램 진행률</h3>
          </div>
          <p className="text-[11px] text-gray-400 leading-snug">{yy(startDate)} ~ {yy(endDate)}</p>
        </div>
        <div className="flex-1 relative bg-gradient-to-br from-emerald-50 to-sky-50">
          <AssetImg src={`${RUN}/course-map.jpg`} className="absolute inset-0 w-full h-full object-cover object-top" fallback={<CourseRoute progress={progress} />} />
          <RunningCourseMini progress={progress} showTest={showStampTest} />
        </div>
      </div>
    ),
    // 오늘의 미션 (최대 3개) — ProgramHome 과 동일
    todayMissions: () => !(todayMissions?.length) ? null : (
      <div>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <p className="text-[13px] font-bold text-gray-700">오늘의 미션</p>
          <button type="button" onClick={onRecord} className="text-[11px] text-gray-400">전체 보기 ›</button>
        </div>
        <div className="space-y-2">
          {todayMissions.slice(0, 3).map((m) => (
            <div key={m.id} className="bg-white rounded-2xl shadow-soft border border-gray-100 p-3 flex items-center gap-3">
              {m.thumb ? <img src={m.thumb} alt="" className="w-11 h-11 rounded-xl object-contain bg-gray-50 flex-shrink-0" /> : <span className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-xl flex-shrink-0">📋</span>}
              <div className="flex-1 min-w-0"><p className="text-[13px] font-bold text-gray-800 truncate">{m.title}</p><p className="text-[10px] text-emerald-600 font-bold mt-0.5">+{m.pt}P</p></div>
              {m.done
                ? <span className="text-[11px] font-bold text-emerald-600 flex-shrink-0">✓ 완료</span>
                : <button type="button" onClick={onRecord} className="text-[11px] font-bold text-white bg-emerald-500 rounded px-3 py-1.5 flex-shrink-0">인증</button>}
            </div>
          ))}
        </div>
      </div>
    ),
    // 최근 인증 (최대 3개)
    recent: () => !(recentItems?.length) ? null : (
      <div>
        <p className="text-[13px] font-bold text-gray-700 mb-1.5 px-0.5">최근 인증 기록</p>
        <div className="bg-white rounded-2xl shadow-soft border border-gray-100 divide-y divide-gray-50">
          {recentItems.slice(0, 3).map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-base flex-shrink-0">✅</span>
              <div className="flex-1 min-w-0"><p className="text-[12px] font-bold text-gray-700 truncate">{r.title}</p><p className="text-[10px] text-gray-400">{r.time}</p></div>
              <span className="text-[11px] font-bold text-emerald-600 flex-shrink-0">+{r.point}P</span>
            </div>
          ))}
        </div>
      </div>
    ),
    menu: () => {
      const cards = [
        { key: 'mission', iconSrc: '/icons/feature/mission.png', iconEmoji: '📋', title: '미션', desc: '목표를 달성해요', actionLabel: '기록하기', onClick: onRecord, newCount: newMissionCount },
        quizEnabled && { key: 'quiz', iconSrc: '/icons/feature/quiz.png', iconEmoji: '❓', title: '퀴즈', desc: '건강 지식을 배워요', actionLabel: '풀어보기', onClick: () => onOpenTab('quizzes'), newCount: newQuizCount },
        communityEnabled && { key: 'community', iconSrc: '/icons/feature/community.png', iconEmoji: '💬', title: '커뮤니티', desc: '함께 응원해요', actionLabel: '바로가기', onClick: () => onOpenTab('community') },
        rankingEnabled && { key: 'ranking', iconSrc: '/icons/reward/ranking.png', iconEmoji: '🏆', title: '랭킹', desc: '순위를 확인해요', actionLabel: '확인하기', onClick: () => onOpenTab('ranking') },
      ].filter(Boolean)
      return (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cards.length}, minmax(0,1fr))` }}>
          {cards.map((c) => (
            <NavCard key={c.key} iconSrc={c.iconSrc} iconEmoji={c.iconEmoji} title={c.title} desc={c.desc} actionLabel={c.actionLabel} onClick={c.onClick} newCount={c.newCount} />
          ))}
        </div>
      )
    },
    classes: () => classSlot || null,
    banner: () => <BottomBanner />,
  }

  const savedOrder = (boxOrder && boxOrder.length ? boxOrder : RUN_BOX_ORDER).filter((k) => BOXES[k])
  RUN_BOX_ORDER.forEach((k) => { if (BOXES[k] && !savedOrder.includes(k)) savedOrder.push(k) })  // 신규 박스 append
  const order = savedOrder.filter((k) => k !== 'classes' || classSlot)  // 클래스는 기능 ON 일 때만
  const hidden = new Set(hiddenBoxes)
  const visibleKeys = order.filter((k) => !hidden.has(k))
  // 격려 배너는 항상 최하단
  const orderedKeys = visibleKeys.includes('banner')
    ? [...visibleKeys.filter((k) => k !== 'banner'), 'banner']
    : visibleKeys

  return (
    <div className="-mx-[11px] px-4 pb-6 space-y-[9px]">
      {topSlot}
      {/* [고정] 히어로 — 운영자 편집(텍스트/크기/볼드/색) */}
      <Reveal index={0}><RunningHeroBlock hero={hero} editable={heroEditable} onHeroChange={onHeroChange} /></Reveal>

      {/* [커스터마이즈] 운영자 순서·숨김 반영 */}
      {orderedKeys.map((k, i) => {
        const content = BOXES[k]()
        return content ? <Reveal key={k} index={Math.min(i + 1, 5)}>{content}</Reveal> : null
      })}

      {/* [운영자] 개요 화면 편집 — 가장 아래·중앙·옅은 회색 */}
      {editable && (
        <div className="flex justify-center pt-1">
          <button type="button" onClick={onEditLayout}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-gray-100 text-gray-500 text-[13px] font-semibold hover:bg-gray-200 transition">
            ✏️ 개요 화면 편집
          </button>
        </div>
      )}
      {/* 추천 페이스 편집 — 화면 중앙 모달 */}
      {editingPace && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: 'rgba(15,23,42,0.45)' }}
          onClick={() => setEditingPace(false)}>
          <div className="w-full max-w-[300px] rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-gray-800">추천 페이스 설정</h3>
            <p className="text-[12px] text-gray-400 mt-0.5 mb-3">분&apos;초 /km — 예: 6&apos;20</p>
            <input
              value={paceInput}
              onChange={(e) => setPaceInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') savePace(); if (e.key === 'Escape') setEditingPace(false) }}
              autoFocus
              maxLength={8}
              placeholder="6'20"
              className="w-full h-12 px-3 text-center text-[22px] font-extrabold text-emerald-600 border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setEditingPace(false)} className="flex-1 h-10 rounded-lg border border-gray-200 text-gray-500 text-[14px] font-bold">취소</button>
              <button type="button" onClick={savePace} className="flex-[1.4] h-10 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[14px] font-bold transition">저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 코스 맵 폴백 — 진행률만큼 초록 경로 채움. 출발🚩 → 결승🏁.
function CourseRoute({ progress = 0 }) {
  const pct = Math.max(0, Math.min(100, progress))
  const D = 'M16,70 C 70,70 70,28 120,40 S 210,72 250,46 L 300,30'
  return (
    <svg viewBox="0 0 320 92" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <path d="M0,82 C 80,70 160,90 320,72" fill="none" stroke="#bae6fd" strokeWidth="10" strokeLinecap="round" opacity="0.5" />
      <path d={D} fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 7" />
      <path d={D} fill="none" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" pathLength="100" strokeDasharray="100" strokeDashoffset={100 - pct} />
    </svg>
  )
}

export default RunningHome
