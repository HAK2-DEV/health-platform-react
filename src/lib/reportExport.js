// 종료 리포트 → 다중 시트 엑셀(.xlsx) 내보내기.
//   요약 / 랭킹 / (팀 랭킹) / 참여자(딥) / 미션별 / 퀴즈별 / 일자별 활동 / 문항별 / (신고 상세) / 일자별 인증표
//   ExcelJS(동적 import → 내보내기 클릭 시에만 로드)로 브랜드 스타일(제목 밴드·헤더·줄무늬·상태 배지) 입힘.
import { formatKstDate } from './queries'
import { getKstHour, TIME_BUCKETS, bucketOfHour } from './formatters'
import { catOf } from './classCategories'
import { injectLineCharts } from './xlsxChart'

function sanitizeName(name) {
  return (name || 'report').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 40) || 'report'
}
const fmtMD = (ds) => { const p = String(ds || '').split('-'); return p.length === 3 ? `${+p[1]}/${+p[2]}` : ds }
// KST 날짜+시간 "M/D HH:MM" (없으면 '-')
const kstDT = (iso) => { if (!iso) return '-'; const d = new Date(new Date(iso).getTime() + 9 * 3600e3); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
const kstT = (iso) => { if (!iso) return ''; const d = new Date(new Date(iso).getTime() + 9 * 3600e3); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
const ATT_LABEL = { confirmed: '출석', pending: '승인대기', rejected: '미인정' }
const METHOD_LABEL = { operator_roll: '운영자 호명', venue_code: '현장 코드', self_approve: '자가출석' }

// ── 브랜드 스타일 상수/헬퍼 (ExcelJS) ──
const FONT = 'Malgun Gothic'   // 한글 지원 폰트(없으면 Excel이 대체)
// 앱 테마(emerald)에 맞춘 팔레트.
//   ⚠️ 흰 글자를 얹는 배경엔 brand-primary(#10B981)를 쓰지 않는다 — 흰 글자 대비 2.5:1 로 WCAG AA 미달.
//      배경/텍스트엔 deep(#047857, 대비 5.2:1) 이상만 쓰고, #10B981 은 «막대·차트 채우기» 에만 쓴다.
const CLR = {
  title: 'FF065F46', head: 'FF047857', headFg: 'FFFFFFFF',
  zebra: 'FFF0F9F4', border: 'FFD5E6DD',
  accent: 'FF047857',
  done: { bg: 'FFD1FAE5', fg: 'FF065F46' },
  part: { bg: 'FFFBEECB', fg: 'FF8A6A12' },
  dorm: { bg: 'FFEDEDED', fg: 'FF707070' },
}
const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const thin = () => ({ style: 'thin', color: { argb: CLR.border } })
const box = () => ({ top: thin(), left: thin(), bottom: thin(), right: thin() })
const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank)
// 열 번호 → 엑셀 열 문자. 26열을 넘으면 AA·AB… 로 이어진다(추이 시트는 하루가 한 열이라 금방 넘는다).
function colLetter(n) {
  let s = ''
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26) }
  return s || 'A'
}

// 헤더가 한 줄에 들어가도록 최소 열 너비 추정(한글/전각 ≈ 2, 그 외 ≈ 1.15) + 여백.
//   지정 width 와 max → 데이터가 넓은 열은 유지, 헤더가 긴 열(참여율(%) 등)은 안 잘리게 넓힘.
function isWideChar(code) {
  return (code >= 0xAC00 && code <= 0xD7A3)   // 한글 음절
    || (code >= 0x3130 && code <= 0x318F)     // 한글 호환 자모
    || (code >= 0x4E00 && code <= 0x9FFF)     // CJK
    || (code >= 0xFF00 && code <= 0xFFEF)     // 전각
}
function headerMinWidth(text) {
  let w = 0
  const s = String(text || '')
  for (let i = 0; i < s.length; i++) w += isWideChar(s.charCodeAt(i)) ? 2 : 1.15
  return Math.ceil(w + 2.5)
}

function statusStyle(cell, status) {
  const m = status === '완주' ? CLR.done : status === '참여' ? CLR.part : status === '휴면' ? CLR.dorm : null
  if (!m) return
  cell.fill = solid(m.bg)
  cell.font = { name: FONT, size: 10, bold: true, color: { argb: m.fg } }
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
}

// 제목 밴드 + 헤더(고정) + 데이터(줄무늬·테두리·상태 배지·O 강조) 일괄 스타일 표.
//   columns: [{ header, width, align, numFmt }], opts: { statusCol }
function addTable(wb, name, title, columns, rows, { statusCol } = {}) {
  const ws = wb.addWorksheet(name)
  const n = columns.length
  // 제목 밴드(행1, 병합)
  ws.mergeCells(1, 1, 1, n)
  for (let i = 1; i <= n; i++) {
    const c = ws.getRow(1).getCell(i)
    c.fill = solid(CLR.title)
    if (i === 1) {
      c.value = title
      c.font = { name: FONT, bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
      c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    }
  }
  ws.getRow(1).height = 26
  // 헤더(행2)
  const hr = ws.getRow(2)
  columns.forEach((c, i) => {
    const cell = hr.getCell(i + 1)
    cell.value = c.header
    cell.font = { name: FONT, bold: true, size: 11, color: { argb: CLR.headFg } }
    cell.fill = solid(CLR.head)
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border = box()
  })
  hr.height = 34   // 2줄로 접히는 헤더(예: "운동 시간(분)")도 안 잘리게 넉넉히
  // 데이터(행3~)
  rows.forEach((r, ri) => {
    const dr = ws.getRow(3 + ri)
    columns.forEach((c, i) => {
      const cell = dr.getCell(i + 1)
      const v = r[i]
      cell.value = (v === undefined || v === null) ? '' : v
      cell.font = { name: FONT, size: 10 }
      cell.alignment = { horizontal: c.align || 'left', vertical: 'middle' }
      cell.border = box()
      if (c.numFmt && typeof v === 'number') cell.numFmt = c.numFmt
      if (ri % 2 === 1) cell.fill = solid(CLR.zebra)
      if (v === 'O') { cell.font = { name: FONT, size: 10, bold: true, color: { argb: CLR.accent } }; cell.alignment = { horizontal: 'center', vertical: 'middle' } }
      if (statusCol === i + 1) statusStyle(cell, v)
    })
  })
  columns.forEach((c, i) => { ws.getColumn(i + 1).width = Math.max(c.width || 12, headerMinWidth(c.header)) })
  ws.views = [{ state: 'frozen', ySplit: 2 }]
  return ws
}

// 요약 시트 — 제목 밴드 + 섹션 헤더 + 라벨/값 (표가 아닌 카드형 레이아웃).
//   items: ['라벨', 값] | ['라벨', 값, { bold, big, color, numFmt }] | { section } | null(빈 줄)
function addKeyValueSheet(wb, name, title, items) {
  const ws = wb.addWorksheet(name)
  ws.mergeCells(1, 1, 1, 2)
  ws.getRow(1).getCell(1).value = title
  ws.getRow(1).getCell(1).font = { name: FONT, bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  ws.getRow(1).getCell(1).fill = solid(CLR.title)
  ws.getRow(1).getCell(2).fill = solid(CLR.title)
  ws.getRow(1).height = 30
  let r = 2
  for (const it of items) {
    if (it == null) { r++; continue }
    const row = ws.getRow(r)
    if (it.section) {
      ws.mergeCells(r, 1, r, 2)
      row.getCell(1).value = it.section
      row.getCell(1).font = { name: FONT, bold: true, size: 11, color: { argb: CLR.headFg } }
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      row.getCell(1).fill = solid(CLR.head)
      row.getCell(2).fill = solid(CLR.head)
      row.height = 20
      r++; continue
    }
    const [label, value, opt = {}] = it
    const lc = row.getCell(1)
    lc.value = label
    lc.font = { name: FONT, size: 10, color: { argb: 'FF555555' } }
    lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    const vc = row.getCell(2)
    vc.value = value
    vc.font = { name: FONT, size: opt.big ? 15 : 11, bold: !!opt.bold || !!opt.big, color: opt.color ? { argb: opt.color } : { argb: 'FF222222' } }
    vc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    if (opt.numFmt && typeof value === 'number') vc.numFmt = opt.numFmt
    row.height = opt.big ? 24 : 18
    r++
  }
  ws.getColumn(1).width = 22
  ws.getColumn(2).width = 32
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  return ws
}

// ── 「제출용 요약」 시트 (A4 1장) ───────────────────────────
//   나머지 시트가 raw 데이터라면 이 시트는 «문서» 다. 운영자가 상사·기관 보고서에
//   그대로 붙여넣거나 인쇄해서 낼 수 있어야 한다(가치 3층의 '보고' 레이어).
//   그래서 앱의 해요체가 아니라 «보고서 문어체(~다)» 로 쓴다 — 붙여넣고 안 고쳐도 되게.

// 은/는 조사 — 프로그램 이름이 무엇이든 비문이 안 나오게 받침을 판정한다.
//   한글 음절은 종성 유무로, 숫자는 읽는 소리로. 그 외(영문 등)는 '는' 으로 둔다.
const DIGIT_JONG = { 0: true, 1: true, 3: true, 6: true, 7: true, 8: true, 2: false, 4: false, 5: false, 9: false }
function topicParticle(word) {
  const s = String(word || '').trim()
  if (!s) return '는'
  const ch = s[s.length - 1]
  const code = ch.charCodeAt(0)
  if (code >= 0xAC00 && code <= 0xD7A3) return ((code - 0xAC00) % 28) !== 0 ? '은' : '는'
  if (ch >= '0' && ch <= '9') return DIGIT_JONG[Number(ch)] ? '은' : '는'
  return '는'
}
const nf = (n) => Number(n || 0).toLocaleString('ko-KR')
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0)
// 셀 안 «진짜» 그래프 — 엑셀 네이티브 데이터 막대(조건부 서식).
//   문자 █ 반복과 달리 열 너비에 맞춰 늘어나고 인쇄·확대에도 깨지지 않는다.
//   값 셀이 병합돼 있어도 좌상단 셀에 값이 있으면 병합 폭 전체에 막대가 그려진다.
let cfPriority = 0
// 컬러 스케일 — 값이 클수록 진해지는 «히트맵». 날짜 격자처럼 칸이 많을 때 막대보다 잘 읽힌다.
function colorScale(ws, ref, colors = ['FFF7FAF8', 'FF9CCFB0', 'FF1E5C3F']) {
  cfPriority += 1
  ws.addConditionalFormatting({
    ref,
    rules: [{
      type: 'colorScale', priority: cfPriority,
      cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }],
      color: colors.map(argb => ({ argb })),
    }],
  })
}

// 아이콘 세트 — 숫자 옆 신호등. 「좋다/보통/나쁘다」 판정을 한눈에 준다.
function iconSet(ws, ref, thresholds = [0, 40, 70]) {
  cfPriority += 1
  ws.addConditionalFormatting({
    ref,
    rules: [{
      type: 'iconSet', priority: cfPriority, iconSet: '3TrafficLights1', showValue: true,
      cfvo: thresholds.map(value => ({ type: 'num', value })),
    }],
  })
}

function dataBar(ws, ref, color, max = 100) {
  cfPriority += 1   // 한 시트에 막대가 여러 벌 — 우선순위가 겹치면 엑셀이 규칙을 합쳐버린다
  ws.addConditionalFormatting({
    ref,
    rules: [{
      type: 'dataBar', priority: cfPriority, gradient: false, showValue: true,
      minLength: 0, maxLength: 100,
      cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: max }],
      color: { argb: color },
    }],
  })
}

// 화면의 진단·처방은 앱 톤(해요체)이라 제출 문서에 그대로 못 쓴다.
//   같은 병목 판정을 «보고서 문어체» 로 다시 쓴다. 정규식 변환은 깨지기 쉬워 문장을 따로 둔다.
function bottleneckProse(report) {
  const c = (k) => report.funnel?.find(f => f.key === k)?.count ?? 0
  const key = report.bottleneck?.toKey
  if (!report.bottleneck) {
    return { finding: '단계별로 두드러진 이탈 구간은 관찰되지 않았다.', fix: '현행 구성을 다음 기수에도 유지하는 것이 적절하다.' }
  }
  if (key === 'first') {
    return {
      finding: `참여자 ${nf(report.totalParticipants)}명 중 ${nf(report.bottleneck.lost)}명이 첫 인증에 도달하지 않아, 시작 단계가 주요 이탈 구간으로 나타났다.`,
      fix: '초기 진입 장벽을 낮추고 시작 안내 및 리마인드를 강화할 필요가 있다.',
    }
  }
  if (key === 'return') {
    return {
      finding: `첫 인증에 도달한 ${nf(c('first'))}명 중 재참여자는 ${nf(c('return'))}명으로, 재참여 단계가 주요 이탈 구간으로 나타났다.`,
      fix: '익일 리마인드 발송과 미션 난이도 조정을 검토할 필요가 있다.',
    }
  }
  return {
    finding: `재참여자 ${nf(c('return'))}명 중 완주자는 ${nf(c('done'))}명으로, 운영 중반 이후가 주요 이탈 구간으로 나타났다.`,
    fix: '운영 기간 조정 또는 중반 응원·보상 설계를 검토할 필요가 있다.',
  }
}

// 서술형 요약 — 보고서에 그대로 옮겨 쓸 수 있는 문장. 규칙 기반이라 단정하지 않는다.
function buildNarrative({ program, report, quizStats, community }) {
  const N = report.totalParticipants || 0
  const done = report.completedUsers?.length || 0
  const V = report.totalVerifications || 0
  const days = report.programDays || 0
  const per = N > 0 ? Math.round((V / N) * 10) / 10 : 0
  const lines = []

  const period = (program.start_date && program.end_date)
    ? `${program.start_date}부터 ${program.end_date}까지`
    : '운영 기간 동안'
  lines.push(`「${program.name}」${topicParticle(program.name)} ${period} ${days ? `${days}일간 ` : ''}운영되었으며, 총 ${nf(N)}명이 참여하였다.`)

  if (N > 0) {
    lines.push(`기간 중 누적 인증은 ${nf(V)}건으로 참여자 1인당 평균 ${per}건이었으며, 활동일이 운영 기간의 50% 이상인 완주자는 ${nf(done)}명(${report.completionRate ?? 0}%)으로 집계되었다.`)
  }

  // 여정 병목 — 문어체 진단 + 처방(같은 판정을 제출 문서 톤으로).
  if (N > 0) {
    const b = bottleneckProse(report)
    lines.push(b.finding)
    if (b.fix) lines.push(b.fix)
  }

  // 영역별 — 있는 채널만. 각 조각을 «완성된 문장» 으로 만들어 이어 붙인다
  //   (조각에 어미를 붙여 잇는 방식은 "42%되었고" 같은 비문이 난다).
  const mp = report.missionPerf || []
  const seg = []
  if (mp.length) {
    const avg = Math.round(mp.reduce((s, m) => s + (m.rate || 0), 0) / mp.length)
    seg.push(`미션 ${mp.length}개의 평균 참여율은 ${avg}%였다.`)
  }
  if (quizStats?.length) {
    const rates = quizStats.map(q => Number(q.correctRate)).filter(n => Number.isFinite(n))
    seg.push(rates.length
      ? `퀴즈 ${quizStats.length}회의 평균 정답률은 ${Math.round(rates.reduce((a, c) => a + c, 0) / rates.length)}%였다.`
      : `퀴즈는 ${quizStats.length}회 실시되었다.`)
  }
  if (community && (community.participantPosts || community.totalComments)) {
    seg.push(`커뮤니티에는 글 ${nf(community.participantPosts || 0)}건과 댓글 ${nf(community.totalComments || 0)}건이 등록되었다.`)
  }
  if (seg.length) lines.push(seg.join(' '))

  const peak = report.peakDay
  if (peak?.count > 0) lines.push(`일자별로는 ${fmtMD(peak.date)}에 인증이 ${nf(peak.count)}건으로 가장 많았다.`)

  return lines.join(' ')
}

// 앱 테마(index.css --color-brand-*)를 엑셀 팔레트로 그대로 가져온다 — 문서와 앱의 색이 어긋나면 남의 것처럼 보인다.
const THEME = {
  deep: 'FF047857', deepHex: '047857',        // brand-deep (emerald-700)
  primary: 'FF10B981', primaryHex: '10B981',  // brand-primary (emerald-500)
  sageHex: 'A7F3D0',                          // brand-sage
  mintHex: 'D1FAE5',                          // brand-mint
  amberHex: 'F59E0B',                         // 보조 강조(참여)
  bg: 'FFF3F7F5',                             // 대시보드 바탕 — 카드가 뜨게 하는 연회색
}

const MIN_GROUP = 5   // 형평성 분해 최소 인원 — 미만이면 숫자를 숨긴다(무의미 + 역식별 위험)
const MIN_OBS = 10    // 지표 변화 최소 관측 수 — 미만이면 «증가/감소»로 단정하지 않는다.
//   실측에서 뒤 구간 8건짜리 평균이 «+7.7% 증가» 로 찍혔다. 노이즈를 성과로 쓰면 보고서 신뢰가 깨진다.
const TAIL_RATIO = 0.25   // 「후반」 구간 = 운영 기간의 마지막 25% (기간 길이에 비례)

// 초반/후반 구간의 인증을 갈라 «지속 변화» 를 잰다. 기간 비율이라 29일이든 92일이든 같은 의미다.
function splitPeriod(rows, startDate, days, getDate) {
  const t0 = new Date(`${startDate}T00:00:00Z`).getTime()
  const span = Math.max(1, Math.round(days * TAIL_RATIO))
  const idx = (r) => Math.round((new Date(`${getDate(r)}T00:00:00Z`).getTime() - t0) / 864e5)
  const inP = rows.filter(r => { const i = idx(r); return i >= 0 && i < days })
  return {
    span,
    head: inP.filter(r => idx(r) < span),
    tail: inP.filter(r => idx(r) >= days - span),
    inPeriod: inP,
  }
}

function addSummarySheet(wb, { program, report, quizStats = [], community = null, metricDefs = [], metricTotals = {}, metricSeries = [], demographics = {} }) {
  const ws = wb.addWorksheet('요약')
  const COLS = 8
  const W = [13, 12, 12, 12, 12, 12, 12, 12]
  W.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  let r = 1
  const merge = (row, from = 1, to = COLS) => { ws.mergeCells(row, from, row, to); return ws.getRow(row).getCell(from) }
  const band = (text, sub) => {
    const c = merge(r)
    c.value = text
    c.font = { name: FONT, bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
    c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    for (let i = 1; i <= COLS; i++) ws.getRow(r).getCell(i).fill = solid(CLR.title)
    ws.getRow(r).height = 34; r++
    if (sub) {
      const s = merge(r)
      s.value = sub
      s.font = { name: FONT, size: 10, color: { argb: 'FF666666' } }
      s.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      ws.getRow(r).height = 20; r++
    }
  }
  const section = (text) => {
    const c = merge(r)
    c.value = text
    c.font = { name: FONT, bold: true, size: 11, color: { argb: CLR.headFg } }
    c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    for (let i = 1; i <= COLS; i++) ws.getRow(r).getCell(i).fill = solid(CLR.head)
    ws.getRow(r).height = 20; r++
  }
  const spacer = (h = 7) => { ws.getRow(r).height = h; r++ }
  const paragraph = (text, height) => {
    const c = merge(r)
    c.value = text
    c.font = { name: FONT, size: 10.5, color: { argb: 'FF222222' } }
    c.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 }
    c.border = box()
    ws.getRow(r).height = height; r++
  }

  const period = (program.start_date && program.end_date) ? `${program.start_date} ~ ${program.end_date}` : '기간 미설정'
  const today = formatKstDate(new Date())
  band(`${program.name} 성과 보고`, `${period}${report.programDays ? ` · ${report.programDays}일` : ''} · 작성일 ${today}`)
  spacer()

  // ── 핵심 지표 4칸 (2열씩) ──
  const N = report.totalParticipants || 0
  const V = report.totalVerifications || 0
  const tiles = [
    [`${nf(N)}명`, '참여자'],
    [`${report.completionRate ?? 0}%`, `완주율 (${nf(report.completedUsers?.length || 0)}명)`],
    [nf(V), '누적 인증'],
    [`${N > 0 ? Math.round((V / N) * 10) / 10 : 0}건`, '1인 평균 인증'],
  ]
  const vRow = ws.getRow(r), lRow = ws.getRow(r + 1)
  tiles.forEach(([val, label], i) => {
    const from = i * 2 + 1, to = from + 1
    ws.mergeCells(r, from, r, to); ws.mergeCells(r + 1, from, r + 1, to)
    const vc = vRow.getCell(from)
    vc.value = val
    vc.font = { name: FONT, bold: true, size: 18, color: { argb: CLR.accent } }
    vc.alignment = { horizontal: 'center', vertical: 'bottom' }
    const lc = lRow.getCell(from)
    lc.value = label
    lc.font = { name: FONT, size: 9.5, color: { argb: 'FF777777' } }
    lc.alignment = { horizontal: 'center', vertical: 'top' }
    for (const cell of [vc, lc]) cell.fill = solid(CLR.zebra)
  })
  vRow.height = 30; lRow.height = 16; r += 2
  spacer()

  // ── 요약 (서술형 — 보고서에 그대로 옮겨 쓰는 부분) ──
  section('요약')
  const narrative = buildNarrative({ program, report, quizStats, community })
  paragraph(narrative, Math.max(60, Math.ceil(narrative.length / 46) * 15))
  spacer()

  // ── 참여 여정 ──
  if ((report.funnel || []).length) {
    section('참여 여정')
    const base = report.funnel[0]?.count || 0
    const hRow = ws.getRow(r)
    ;['단계', '인원', '비율 (전체 대비)'].forEach((h, i) => {
      const col = i === 0 ? 1 : i === 1 ? 3 : 4
      const c = hRow.getCell(col)
      c.value = h
      c.font = { name: FONT, size: 9, bold: true, color: { argb: 'FF777777' } }
      c.alignment = { horizontal: i === 1 ? 'center' : 'left', vertical: 'middle', indent: i === 1 ? 0 : 1 }
    })
    ws.mergeCells(r, 1, r, 2); ws.mergeCells(r, 4, r, COLS)
    hRow.height = 16; r++
    const barFrom = r
    for (const f of report.funnel) {
      const p = pct(f.count, base)
      const row = ws.getRow(r)
      ws.mergeCells(r, 1, r, 2)
      const lc = row.getCell(1)
      lc.value = f.label
      lc.font = { name: FONT, size: 10, color: { argb: 'FF333333' } }
      lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      const cc = row.getCell(3); cc.value = f.count
      cc.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF222222' } }
      cc.alignment = { horizontal: 'center', vertical: 'middle' }
      // 값 셀(D)에 숫자를 넣고 D:H 를 병합 → 데이터 막대가 병합 폭 전체에 그려진다.
      ws.mergeCells(r, 4, r, COLS)
      const bc = row.getCell(4)
      bc.value = p
      bc.numFmt = '0"%"'
      bc.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF333333' } }
      bc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      row.height = 18; r++
    }
    dataBar(ws, `D${barFrom}:D${r - 1}`, 'FF8FC7A8')
    if (report.bottleneck) {
      const label = report.funnel.find(f => f.key === report.bottleneck.toKey)?.label || ''
      const c = merge(r)
      c.value = `가장 큰 이탈 구간: ${label} (-${nf(report.bottleneck.lost)}명)`
      c.font = { name: FONT, size: 9.5, bold: true, color: { argb: 'FF8A6A12' } }
      c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      c.fill = solid(CLR.part.bg)
      ws.getRow(r).height = 18; r++
    }
    spacer()
  }

  // ── A. 무엇이 달라졌나 (참여 지속 변화) ────────────────────
  //   보고의 핵심. 「얼마나 했나」가 아니라 「끝까지 갔나」에 답한다.
  //   기간 앞 25% 대비 뒤 25% 를 비교 — 기간 길이와 무관하게 같은 뜻이 된다.
  const kstDate = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10)
  if (N > 0 && program.start_date && report.programDays >= 8 && (report.trend || []).length) {
    const sp = splitPeriod(report.trend.filter(t => t.count > 0), program.start_date, report.programDays, t => t.date)
    const headCnt = sp.head.reduce((s, t) => s + t.count, 0)
    const tailCnt = sp.tail.reduce((s, t) => s + t.count, 0)
    // 활동 인원은 인증 원본에서 (추이엔 사람 정보가 없다)
    const vs = splitPeriod(metricSeries.length ? metricSeries : [], program.start_date, report.programDays, v => kstDate(v.submitted_at))
    const headU = new Set(vs.head.map(v => v.user_id)).size
    const tailU = new Set(vs.tail.map(v => v.user_id)).size
    const settle = pct(tailU, N)

    section('무엇이 달라졌나')
    const rows = [
      [`인증 건수 (앞 ${sp.span}일 → 뒤 ${sp.span}일)`, `${nf(headCnt)}건 → ${nf(tailCnt)}건`,
        headCnt > 0 ? `${tailCnt >= headCnt ? '+' : ''}${Math.round((tailCnt - headCnt) / headCnt * 100)}%` : '-'],
    ]
    if (metricSeries.length) {
      rows.push([`활동 인원 (앞 → 뒤)`, `${nf(headU)}명 → ${nf(tailU)}명`, ''])
      rows.push([`후반 정착률`, `참여자 ${nf(N)}명 중 ${nf(tailU)}명`, `${settle}%`])
    }
    for (const [label, val, delta] of rows) {
      const row = ws.getRow(r)
      ws.mergeCells(r, 1, r, 3)
      const lc = row.getCell(1)
      lc.value = label
      lc.font = { name: FONT, size: 10, color: { argb: 'FF333333' } }
      lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      ws.mergeCells(r, 4, r, 6)
      const vc = row.getCell(4)
      vc.value = val
      vc.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF222222' } }
      vc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      ws.mergeCells(r, 7, r, COLS)
      const dc = row.getCell(7)
      dc.value = delta
      dc.font = { name: FONT, size: 10, bold: true, color: { argb: String(delta).startsWith('-') ? 'FFC0392B' : CLR.accent } }
      dc.alignment = { horizontal: 'center', vertical: 'middle' }
      row.height = 17; r++
    }

    // A2. 기록 지표 변화 — «있을 때만». 짧은 기간엔 안 움직이는 게 정상이라 «개선» 단정을 피한다.
    if (metricDefs.length && vs.head.length && vs.tail.length) {
      const numsOf = (arr, key) => arr.map(v => Number(v.metric_values?.[key])).filter(Number.isFinite)
      const avgOf = (nums) => (nums.length ? nums.reduce((a, c) => a + c, 0) / nums.length : null)
      for (const m of metricDefs) {
        const hn = numsOf(vs.head, m.key), tn = numsOf(vs.tail, m.key)
        const h = avgOf(hn), t = avgOf(tn)
        if (h == null || t == null || h === 0) continue
        const d = (t - h) / h * 100
        // 표본이 얇으면 방향을 단정하지 않는다 — 몇 건짜리 평균 차이는 대개 우연이다.
        const thin = hn.length < MIN_OBS || tn.length < MIN_OBS
        const verdict = thin ? `표본 부족 (${hn.length}→${tn.length}건)`
          : Math.abs(d) < 5 ? '변화 없음' : d > 0 ? '증가' : '감소'
        const row = ws.getRow(r)
        ws.mergeCells(r, 1, r, 3)
        const lc = row.getCell(1)
        lc.value = `1회 평균 ${m.label}`
        lc.font = { name: FONT, size: 10, color: { argb: 'FF333333' } }
        lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
        ws.mergeCells(r, 4, r, 6)
        const vc = row.getCell(4)
        vc.value = `${Math.round(h * 10) / 10}${m.unit || ''} → ${Math.round(t * 10) / 10}${m.unit || ''}`
        vc.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF222222' } }
        vc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
        ws.mergeCells(r, 7, r, COLS)
        const dc = row.getCell(7)
        dc.value = thin ? verdict : `${verdict} (${d >= 0 ? '+' : ''}${d.toFixed(1)}%)`
        dc.font = { name: FONT, size: 9.5, bold: !thin, color: { argb: thin || verdict === '변화 없음' ? 'FF999999' : verdict === '증가' ? CLR.accent : 'FFC0392B' } }
        dc.alignment = { horizontal: 'center', vertical: 'middle' }
        row.height = 17; r++
      }
      const note = merge(r)
      note.value = '※ 기록 지표는 운영 기간이 짧으면 잘 움직이지 않는다. 변화 없음도 정상 결과로 본다.'
      note.font = { name: FONT, size: 8.5, color: { argb: 'FF999999' } }
      note.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      ws.getRow(r).height = 14; r++
    }
    spacer()
  }

  // ── B. 누가 소외됐나 (형평성) ────────────────────────────
  //   HP2030 보고가 요구하는 항목. n<5 는 숫자를 숨긴다 — 통계적으로 무의미하고,
  //   소수 그룹이면 "그 사람이 누군지" 역식별될 수 있어서다.
  const allUsers = [...(report.completedUsers || []), ...(report.participatedUsers || []), ...(report.dormantUsers || [])]
  if (allUsers.length && Object.keys(demographics).length) {
    const AGE_LABEL = { '10s': '10대', '20s': '20대', '30s': '30대', '40s': '40대', '50s': '50대', '60s': '60대 이상' }
    const buckets = []
    const add = (axis, label, test) => {
      const mem = allUsers.filter(test)
      if (mem.length) buckets.push({ axis, label, n: mem.length, mem })
    }
    add('성별', '남성', u => demographics[u.user_id]?.gender === 'M')
    add('성별', '여성', u => demographics[u.user_id]?.gender === 'F')
    for (const [k, lab] of Object.entries(AGE_LABEL)) add('연령', lab, u => demographics[u.user_id]?.age_range === k)
    // 프로필 미입력자는 «분모에서 제외» — 한 그룹으로 묶으면 "미입력 집단은 완주 0%" 같은 오독을 부른다.
    const noProfile = allUsers.filter(u => !demographics[u.user_id]?.gender && !demographics[u.user_id]?.age_range).length

    if (buckets.length) {
      section('누가 소외됐나 (형평성)')
      const hRow = ws.getRow(r)
      ;[[1, '구분'], [4, '인원'], [5, '인증 시작'], [7, '완주율']].forEach(([col, h]) => {
        const c = hRow.getCell(col)
        c.value = h
        c.font = { name: FONT, size: 9, bold: true, color: { argb: 'FF777777' } }
        c.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle', indent: col === 1 ? 1 : 0 }
      })
      ws.mergeCells(r, 1, r, 3); ws.mergeCells(r, 5, r, 6); ws.mergeCells(r, 7, r, COLS)
      hRow.height = 16; r++
      const from = r
      let hidden = 0
      for (const b of buckets) {
        const row = ws.getRow(r)
        ws.mergeCells(r, 1, r, 3)
        const lc = row.getCell(1)
        lc.value = `${b.axis} · ${b.label}`
        lc.font = { name: FONT, size: 10, color: { argb: 'FF333333' } }
        lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
        const nc = row.getCell(4)
        nc.value = `${b.n}명`
        nc.font = { name: FONT, size: 10, color: { argb: 'FF555555' } }
        nc.alignment = { horizontal: 'center', vertical: 'middle' }
        ws.mergeCells(r, 5, r, 6); ws.mergeCells(r, 7, r, COLS)
        if (b.n < MIN_GROUP) {
          hidden += 1
          const c = row.getCell(5)
          c.value = `n<${MIN_GROUP} · 표시 생략`
          c.font = { name: FONT, size: 9, italic: true, color: { argb: 'FF999999' } }
          c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
        } else {
          const started = b.mem.filter(u => (u.activeDays || 0) >= 1).length
          const done = b.mem.filter(u => (u.activeDays || 0) >= (report.threshold || 1)).length
          const sc = row.getCell(5)
          sc.value = pct(started, b.n); sc.numFmt = '0"%"'
          sc.font = { name: FONT, size: 10, color: { argb: 'FF333333' } }
          sc.alignment = { horizontal: 'center', vertical: 'middle' }
          const dc = row.getCell(7)
          dc.value = pct(done, b.n); dc.numFmt = '0"%"'
          dc.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF333333' } }
          dc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
        }
        row.height = 17; r++
      }
      dataBar(ws, `G${from}:G${r - 1}`, 'FFC9A8E8')
      const note = merge(r)
      note.value = `※ 인원 ${MIN_GROUP}명 미만 구분은 표시하지 않음(통계적 의미 없음·개인 식별 방지)`
        + (noProfile ? ` · 성별·연령 미입력 ${nf(noProfile)}명은 분모에서 제외` : '')
        + (hidden ? ` · 생략 ${hidden}개 구분` : '')
      note.font = { name: FONT, size: 8.5, color: { argb: 'FF999999' } }
      note.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 }
      ws.getRow(r).height = 22; r++
      spacer()
    }
  }

  // ── 지표 점검 (아이콘 세트) — 신호등으로 «잘 됐나»를 즉시 판정. ──
  //   막대·히트맵이 «얼마나/언제»라면 이건 «괜찮은 수준인가»에 답한다.
  if (N > 0 && (report.funnel || []).length) {
    const c = (k) => report.funnel.find(f => f.key === k)?.count ?? 0
    const checks = [
      ['첫 인증률', pct(c('first'), N), '가입자 중 한 번이라도 인증한 비율'],
      ['재참여율', pct(c('return'), N), '이틀 이상 인증한 비율 (습관 형성 신호)'],
    ]
    if (report.funnel.some(f => f.key === 'done')) {
      checks.push(['완주율', pct(c('done'), N), `활동일이 기간의 50% 이상`])
    }
    section('지표 점검')
    const from = r
    for (const [label, value, desc] of checks) {
      const row = ws.getRow(r)
      ws.mergeCells(r, 1, r, 2)
      const lc = row.getCell(1)
      lc.value = label
      lc.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF333333' } }
      lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      const vc = row.getCell(3)
      vc.value = value
      vc.numFmt = '0"%"'
      vc.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF222222' } }
      vc.alignment = { horizontal: 'center', vertical: 'middle' }
      ws.mergeCells(r, 4, r, COLS)
      const dc = row.getCell(4)
      dc.value = desc
      dc.font = { name: FONT, size: 9, color: { argb: 'FF888888' } }
      dc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      row.height = 17; r++
    }
    iconSet(ws, `C${from}:C${r - 1}`, [0, 40, 70])   // 40% 미만 빨강 · 70% 이상 초록
    spacer()
  }

  // ── 핵심 진단 (문어체 — 시트 전체가 제출용이라 톤을 통일한다) ──
  if (N > 0) {
    section('핵심 진단')
    const b = bottleneckProse(report)
    paragraph(`${b.finding}\n▶ 개선 제안: ${b.fix}`, 48)
    spacer()
  }

  // ── 영역별 성과 ──
  const segRows = []
  const mp = report.missionPerf || []
  if (mp.length) {
    const avg = Math.round(mp.reduce((s, m) => s + (m.rate || 0), 0) / mp.length)
    const best = mp[0]
    segRows.push(['미션', `${mp.length}개`, `평균 참여율 ${avg}%`, best ? `최고: ${best.title} (${best.rate}%)` : ''])
  }
  if (quizStats?.length) {
    const rates = quizStats.map(q => Number(q.correctRate)).filter(n => Number.isFinite(n))
    const avgC = rates.length ? Math.round(rates.reduce((a, c) => a + c, 0) / rates.length) : null
    segRows.push(['퀴즈', `${quizStats.length}회`, avgC != null ? `평균 정답률 ${avgC}%` : '정답률 집계 없음', ''])
  }
  if (community) {
    segRows.push(['커뮤니티', `글 ${nf(community.participantPosts || 0)}건`, `댓글 ${nf(community.totalComments || 0)}건`, `글 쓴 사람 ${nf(community.posterCount || 0)}명`])
  }
  for (const m of metricDefs) {
    const total = Math.round((metricTotals[m.key] || 0) * 10) / 10
    if (!total) continue   // 합계 0 이면 줄을 만들지 않는다 — "0km 전체 합계"는 정보가 아니라 잡음이다
    segRows.push([m.label, `${nf(total)}${m.unit || ''}`, '전체 합계', ''])
  }
  if (segRows.length) {
    section('영역별 성과')
    for (const [a, b, c2, d] of segRows) {
      const row = ws.getRow(r)
      ws.mergeCells(r, 1, r, 2); ws.mergeCells(r, 3, r, 4); ws.mergeCells(r, 5, r, 6); ws.mergeCells(r, 7, r, COLS)
      const cells = [[1, a, true], [3, b, false], [5, c2, false], [7, d, false]]
      for (const [ci, val, bold] of cells) {
        const c = row.getCell(ci)
        c.value = val
        c.font = { name: FONT, size: 10, bold, color: { argb: bold ? 'FF222222' : 'FF555555' } }
        c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      }
      row.height = 17; r++
    }
    spacer()
  }

  // ── 미션별 참여율 (그래프) — 어떤 미션이 먹혔는지 한눈에. 상위 6개만. ──
  const mpTop = mp.filter(m => m.rate > 0).slice(0, 6)
  if (mpTop.length) {
    section('미션별 참여율')
    const from = r
    for (const m of mpTop) {
      const row = ws.getRow(r)
      ws.mergeCells(r, 1, r, 3)
      const lc = row.getCell(1)
      lc.value = m.title
      lc.font = { name: FONT, size: 10, color: { argb: 'FF333333' } }
      lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      ws.mergeCells(r, 4, r, COLS)
      const bc = row.getCell(4)
      bc.value = m.rate
      bc.numFmt = '0"%"'
      bc.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF333333' } }
      bc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      row.height = 18; r++
    }
    dataBar(ws, `D${from}:D${r - 1}`, 'FF9CC9E8')
    spacer()
  }

  // ── 주차별 인증 추이 (그래프) — 언제 힘이 빠졌는지. 일자별은 92칸이라 주 단위로 묶는다. ──
  const trend = report.trend || []
  // 추이 시각화는 «둘 중 하나»만 — 한 장을 지키려고 기간에 따라 고른다.
  //   짧으면(≤9주) 일자 히트맵이 요일 패턴까지 주고, 길면 주차 막대가 읽기 쉽다.
  if (trend.length > 63) {
    // 한 장에 들어가도록 최대 14칸. 긴 프로그램은 2주·3주 묶음으로 자동 확대한다.
    const span = Math.max(7, Math.ceil(trend.length / 14 / 7) * 7)
    const buckets = []
    for (let i = 0; i < trend.length; i += span) {
      const chunk = trend.slice(i, i + span)
      buckets.push({
        idx: buckets.length + 1, days: chunk.length, from: chunk[0]?.date,
        sum: chunk.reduce((s, t) => s + (t.count || 0), 0),
      })
    }
    // 마지막 조각이 반토막이면 앞 구간에 합친다 — 1일짜리 막대가 한 주처럼 보이면 오해를 산다.
    if (buckets.length > 1 && buckets[buckets.length - 1].days < span / 2) {
      const tail = buckets.pop()
      const last = buckets[buckets.length - 1]
      last.sum += tail.sum
      last.days += tail.days
    }
    const unit = span === 7 ? '주차' : `구간(${span / 7}주)`
    const wMax = Math.max(1, ...buckets.map(b => b.sum))
    section(`${span === 7 ? '주차별' : '기간별'} 인증 추이`)
    const from = r
    for (const b of buckets) {
      const row = ws.getRow(r)
      ws.mergeCells(r, 1, r, 3)
      const lc = row.getCell(1)
      // 길이가 다른 구간은 일수를 밝혀야 막대 비교가 정직해진다.
      lc.value = `${b.idx}${unit} (${fmtMD(b.from)}~)${b.days !== span ? ` · ${b.days}일` : ''}`
      lc.font = { name: FONT, size: 9.5, color: { argb: 'FF555555' } }
      lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      ws.mergeCells(r, 4, r, COLS)
      const bc = row.getCell(4)
      bc.value = b.sum
      bc.numFmt = '#,##0"건"'
      bc.font = { name: FONT, size: 9.5, bold: true, color: { argb: 'FF333333' } }
      bc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      row.height = 16; r++
    }
    dataBar(ws, `D${from}:D${r - 1}`, 'FFF2C879', wMax)
    spacer()
  }

  // ── 일자별 인증 히트맵 (컬러 스케일) — 주 × 요일 격자. ──
  //   막대는 "얼마나"를 주지만 이건 "언제"를 준다. 주말 공백·중반 침체가 눈에 바로 띈다.
  //   레이아웃이 8열이라 라벨 1칸 + 월~일 7칸이 딱 맞는다.
  if (trend.length >= 7 && trend.length <= 63) {
    section('일자별 인증 히트맵')
    const DOW = ['월', '화', '수', '목', '금', '토', '일']
    const hRow = ws.getRow(r)
    hRow.getCell(1).value = ''
    DOW.forEach((d, i) => {
      const c = hRow.getCell(i + 2)
      c.value = d
      c.font = { name: FONT, size: 9, bold: true, color: { argb: 'FF777777' } }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
    })
    hRow.height = 15; r++

    // 첫 주는 시작 요일까지 빈칸을 둬서 달력처럼 요일이 세로로 정렬되게 한다.
    const firstDow = (new Date(`${trend[0].date}T00:00:00Z`).getUTCDay() + 6) % 7   // 0=월
    const cells = [...Array(firstDow).fill(null), ...trend]
    const gridFrom = r
    for (let i = 0; i < cells.length; i += 7) {
      const week = cells.slice(i, i + 7)
      const row = ws.getRow(r)
      const label = week.find(x => x)?.date
      const lc = row.getCell(1)
      lc.value = label ? fmtMD(label) : ''
      lc.font = { name: FONT, size: 8.5, color: { argb: 'FF999999' } }
      lc.alignment = { horizontal: 'right', vertical: 'middle' }
      for (let d = 0; d < 7; d++) {
        const cell = row.getCell(d + 2)
        const t = week[d]
        if (!t) { cell.value = null; continue }
        cell.value = t.count
        cell.font = { name: FONT, size: 9, color: { argb: 'FF333333' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = box()
      }
      row.height = 16; r++
    }
    colorScale(ws, `B${gridFrom}:H${r - 1}`)
    // 격자 합계를 밝힌다 — 추이는 운영 기간만 덮어서 위의 「누적 인증」보다 작을 수 있다.
    // 숫자가 안 맞아 보이면 보고서 신뢰가 깨지므로 이유를 각주로 남긴다.
    const inPeriod = trend.reduce((s, t) => s + (t.count || 0), 0)
    const note = merge(r)
    note.value = `※ 색이 진할수록 그날 인증이 많았음 · 운영 기간 ${report.programDays}일 합계 ${nf(inPeriod)}건`
      + (inPeriod !== V ? ` (누적 ${nf(V)}건 중 기간 외 ${nf(V - inPeriod)}건 제외)` : '')
    note.font = { name: FONT, size: 8.5, color: { argb: 'FF999999' } }
    note.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    ws.getRow(r).height = 14; r++
    spacer()
  }

  // ── 상위 참여자 ──
  const top = report.topUsers || []
  if (top.length) {
    section('상위 참여자')
    const hdr = ['순위', '닉네임', '', '활동일', '인증 수', '점수', '', '']
    const hRow = ws.getRow(r)
    ws.mergeCells(r, 2, r, 3); ws.mergeCells(r, 6, r, COLS)
    hdr.forEach((h, i) => {
      if (!h) return
      const c = hRow.getCell(i + 1)
      c.value = h
      c.font = { name: FONT, size: 9, bold: true, color: { argb: 'FF777777' } }
      c.alignment = { horizontal: i === 1 ? 'left' : 'center', vertical: 'middle', indent: i === 1 ? 1 : 0 }
    })
    hRow.height = 16; r++
    top.forEach((u, i) => {
      const row = ws.getRow(r)
      ws.mergeCells(r, 2, r, 3); ws.mergeCells(r, 6, r, COLS)
      const vals = [[1, medal(i + 1), 'center'], [2, u.nickname || '(알 수 없음)', 'left'], [4, u.activeDays ?? 0, 'center'], [5, u.totalCount ?? 0, 'center'], [6, u.totalScore ?? 0, 'center']]
      for (const [ci, val, al] of vals) {
        const c = row.getCell(ci)
        c.value = val
        c.font = { name: FONT, size: 10, color: { argb: 'FF333333' } }
        c.alignment = { horizontal: al, vertical: 'middle', indent: al === 'left' ? 1 : 0 }
      }
      if (i % 2 === 1) for (let ci = 1; ci <= COLS; ci++) row.getCell(ci).fill = solid(CLR.zebra)
      row.height = 17; r++
    })
    spacer()
  }

  // ── 각주 — 정의를 밝혀야 보고서로 신뢰받는다 ──
  const foot = merge(r)
  foot.value = `※ 완주 기준: 활동일이 운영 기간의 50%(${report.threshold ?? '-'}일) 이상. 참여자별 상세·미션별·퀴즈별 데이터는 다음 시트를 참조.`
  foot.font = { name: FONT, size: 9, color: { argb: 'FF888888' } }
  foot.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 }
  ws.getRow(r).height = 26; r++

  // A4 세로 1장에 맞춰 인쇄 — 운영자가 이 시트만 인쇄/PDF 로 제출할 수 있게.
  ws.pageSetup = {
    paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
    horizontalCentered: true,
    printArea: `A1:H${r - 1}`,   // ws.printArea 로 넣으면 저장되지 않는다 — pageSetup 안이어야 한다
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  }
  ws.views = [{ showGridLines: false }]
  return ws
}

// ── 「설문」 시트 — 시작 ↔ 종료 비교 ─────────────────────────
//   보고에서 가장 세게 먹히는 장면. 「참여했다」가 아니라 「이렇게 달라졌다」를 말한다.
//   종료 설문이 아직 없으면 빈 표 대신 «미실시» 를 분명히 적는다(빈칸은 오해를 부른다).
function addSurveySheet(wb, { program, startQuestions = [], endQuestions = [], startResponses = [], endResponses = [], partCount = 0 }) {
  const ws = wb.addWorksheet('설문')
  const COLS = 8
  ;[26, 11, 11, 11, 9, 9, 9, 9].forEach((w, i) => { ws.getColumn(i + 1).width = w })
  let r = 1
  const merge = (row, from = 1, to = COLS) => { ws.mergeCells(row, from, row, to); return ws.getRow(row).getCell(from) }
  const section = (text) => {
    const c = merge(r)
    c.value = text
    c.font = { name: FONT, bold: true, size: 11, color: { argb: CLR.headFg } }
    c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    for (let i = 1; i <= COLS; i++) ws.getRow(r).getCell(i).fill = solid(CLR.head)
    ws.getRow(r).height = 20; r++
  }

  const band = merge(r)
  band.value = `${program.name} — 시작·종료 설문 비교`
  band.font = { name: FONT, bold: true, size: 15, color: { argb: 'FFFFFFFF' } }
  band.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  for (let i = 1; i <= COLS; i++) ws.getRow(r).getCell(i).fill = solid(CLR.title)
  ws.getRow(r).height = 32; r++

  const sN = new Set(startResponses.map(x => x.user_id)).size
  const eN = new Set(endResponses.map(x => x.user_id)).size
  const sub = merge(r)
  sub.value = `시작 응답 ${nf(sN)}명 (${pct(sN, partCount)}%) · 종료 응답 ${nf(eN)}명 (${pct(eN, partCount)}%) · 참여자 ${nf(partCount)}명`
  sub.font = { name: FONT, size: 10, color: { argb: 'FF666666' } }
  sub.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  ws.getRow(r).height = 20; r++

  if (!eN) {
    const w = merge(r)
    w.value = eN === 0 && sN > 0
      ? '⚠ 종료 설문이 아직 실시되지 않아 «변화»는 계산할 수 없습니다. 종료 설문을 받으면 문항별 전후 비교가 이 시트에 자동으로 채워집니다.'
      : '⚠ 설문 응답이 없습니다.'
    w.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF8A6A12' } }
    w.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true }
    for (let i = 1; i <= COLS; i++) ws.getRow(r).getCell(i).fill = solid(CLR.part.bg)
    ws.getRow(r).height = 30; r++
  }
  r++

  const avgOf = (resps, qid) => {
    const nums = resps.map(x => Number(x.answers?.[qid])).filter(Number.isFinite)
    return nums.length ? { avg: nums.reduce((a, c) => a + c, 0) / nums.length, n: nums.length, nums } : null
  }
  const qs = (endQuestions.length ? endQuestions : startQuestions)
  const scales = qs.filter(q => q.type === 'scale')
  const texts = qs.filter(q => q.type !== 'scale')

  if (scales.length) {
    section('문항별 결과 (척도)')
    const hdr = [[1, '문항'], [2, '시작 평균'], [3, '종료 평균'], [4, '변화'], [5, '응답 분포 (시작)']]
    const hRow = ws.getRow(r)
    for (const [col, h] of hdr) {
      const c = hRow.getCell(col)
      c.value = h
      c.font = { name: FONT, size: 9, bold: true, color: { argb: 'FF777777' } }
      c.alignment = { horizontal: col === 1 || col === 5 ? 'left' : 'center', vertical: 'middle', indent: col === 1 || col === 5 ? 1 : 0 }
    }
    ws.mergeCells(r, 5, r, COLS)
    hRow.height = 16; r++
    const from = r
    for (const q of scales) {
      const s = avgOf(startResponses, q.id), e = avgOf(endResponses, q.id)
      const row = ws.getRow(r)
      const lc = row.getCell(1)
      lc.value = q.q
      lc.font = { name: FONT, size: 10, color: { argb: 'FF333333' } }
      lc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true }
      const put = (col, v) => {
        const c = row.getCell(col)
        c.value = v == null ? '-' : Math.round(v * 100) / 100
        c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FF222222' } }
        c.alignment = { horizontal: 'center', vertical: 'middle' }
      }
      put(2, s?.avg); put(3, e?.avg)
      const dc = row.getCell(4)
      if (s && e) {
        const d = e.avg - s.avg
        dc.value = `${d >= 0 ? '+' : ''}${(Math.round(d * 100) / 100)}`
        dc.font = { name: FONT, size: 10, bold: true, color: { argb: d > 0 ? CLR.accent : d < 0 ? 'FFC0392B' : 'FF888888' } }
      } else {
        dc.value = '측정 불가'
        dc.font = { name: FONT, size: 9, italic: true, color: { argb: 'FF999999' } }
      }
      dc.alignment = { horizontal: 'center', vertical: 'middle' }
      // 분포 — 점수별 인원을 칸에 적는다(척도 최대 5칸 가정, 넘으면 앞 4칸)
      ws.mergeCells(r, 5, r, COLS)
      const bc = row.getCell(5)
      if (s) {
        const dist = {}
        for (const n of s.nums) dist[n] = (dist[n] || 0) + 1
        bc.value = Object.keys(dist).sort((a, b) => a - b).map(k => `${k}점 ${dist[k]}명`).join(' · ')
      } else bc.value = '-'
      bc.font = { name: FONT, size: 9, color: { argb: 'FF666666' } }
      bc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
      row.height = 30; r++
    }
    // 척도 범위를 밝혀야 평균 숫자가 해석된다
    const note = merge(r)
    note.value = scales.map(q => `${q.q} — ${q.minLabel || q.min}(${q.min}) ~ ${q.maxLabel || q.max}(${q.max})`).join('  /  ')
    note.font = { name: FONT, size: 8.5, color: { argb: 'FF999999' } }
    note.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 }
    ws.getRow(r).height = 26; r++
    if (endResponses.length) dataBar(ws, `C${from}:C${r - 2}`, 'FF9CC9E8', Math.max(...scales.map(q => q.max || 5)))
    r++
  }

  if (texts.length) {
    section('자유 응답')
    // ⚠️ goal 처럼 시작/종료 문구가 다른 문항이 있다. 한 제목 아래 두 시기 답을 섞으면
    //    «문항과 답이 어긋난» 문서가 된다 — 시기별로 자기 문구를 달아 따로 싣는다.
    const byId = (arr) => Object.fromEntries(arr.map(x => [x.id, x]))
    const startById = byId(startQuestions), endById = byId(endQuestions)
    for (const q of texts) {
      for (const [tag, qDef, resps, tone] of [
        ['시작', startById[q.id] || q, startResponses, 'FF8A6A12'],
        ['종료', endById[q.id] || q, endResponses, CLR.accent],
      ]) {
        const answers = resps.map(x => String(x.answers?.[q.id] ?? '').trim()).filter(Boolean)
        if (!resps.length) continue   // 그 시기 설문 자체가 없으면 제목도 만들지 않는다
        const c = merge(r)
        c.value = `[${tag}] ${qDef.q}`
        c.font = { name: FONT, size: 10, bold: true, color: { argb: tone } }
        c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1, wrapText: true }
        ws.getRow(r).height = 20; r++
        if (!answers.length) {
          const e = merge(r)
          e.value = '   (응답 없음)'
          e.font = { name: FONT, size: 9, italic: true, color: { argb: 'FF999999' } }
          ws.getRow(r).height = 16; r++
        }
        for (const t of answers) {
          const vc = merge(r, 1, COLS)
          vc.value = `· ${t}`
          vc.font = { name: FONT, size: 9.5, color: { argb: 'FF333333' } }
          vc.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 2 }
          ws.getRow(r).height = Math.min(60, Math.max(16, Math.ceil(t.length / 75) * 14))
          r++
        }
        r++
      }
    }
  }
  ws.views = [{ state: 'frozen', ySplit: 2, showGridLines: false }]
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
  return ws
}

// ── 「활동 추이」 시트 — 셀로 그린 세로 막대 그래프 ──────────
//   네이티브 차트를 못 만드니 좁은 열 격자를 칠해 «진짜 그래프 모양» 을 만든다.
//   인쇄·확대에도 안 깨지고, 날짜가 많아도 한눈에 들어온다.
function addTrendSheet(wb, { program, report, raw = [] }) {
  const trend = report.trend || []
  if (!trend.length) return null
  const ws = wb.addWorksheet('활동 추이')
  const n = trend.length

  const kst = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10)
  const dayUsers = {}
  for (const v of raw) {
    if (!v.submitted_at || !v.user_id) continue
    ;(dayUsers[kst(v.submitted_at)] ||= new Set()).add(v.user_id)
  }

  ws.getColumn(1).width = 12
  ws.getColumn(2).width = 12
  ws.getColumn(3).width = 12
  ws.getColumn(4).width = 2

  let r = 1
  ws.mergeCells(r, 1, r, 16)
  const band = ws.getRow(r).getCell(1)
  band.value = `${program.name} — 일자별 활동 추이`
  band.font = { name: FONT, bold: true, size: 15, color: { argb: 'FFFFFFFF' } }
  band.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  for (let i = 1; i <= 16; i++) ws.getRow(r).getCell(i).fill = solid(CLR.title)
  ws.getRow(r).height = 32; r++

  ws.mergeCells(r, 1, r, 16)
  const sub = ws.getRow(r).getCell(1)
  sub.value = `기간 ${nf(n)}일 · 합계 ${nf(trend.reduce((s, t) => s + t.count, 0))}건 · 최다 ${nf(Math.max(0, ...trend.map(t => t.count)))}건`
  sub.font = { name: FONT, size: 10, color: { argb: 'FF666666' } }
  sub.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  ws.getRow(r).height = 20; r++

  // ── 전체 추이 데이터 표 ──
  const headRow = r
  ;['날짜', '인증 건수', '활동 인원'].forEach((h, i) => {
    const c = ws.getRow(r).getCell(i + 1)
    c.value = h
    c.font = { name: FONT, size: 10, bold: true, color: { argb: CLR.headFg } }
    c.fill = solid(CLR.head)
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border = box()
  })
  ws.getRow(r).height = 20; r++

  const dataFrom = r
  for (const t of trend) {
    const row = ws.getRow(r)
    const cells = [fmtMD(t.date), t.count, dayUsers[t.date]?.size || 0]
    cells.forEach((v, i) => {
      const c = row.getCell(i + 1)
      c.value = v
      c.font = { name: FONT, size: 9, color: { argb: i === 0 ? 'FF555555' : 'FF222222' } }
      c.alignment = { horizontal: 'center', vertical: 'middle' }
      c.border = box()
    })
    row.height = 15; r++
  }
  const dataTo = r - 1

  r = dataTo + 1

  ws.views = [{ state: 'frozen', ySplit: headRow, showGridLines: false }]
  ws.pageSetup = {
    paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
    printArea: `A1:${colLetter(16)}${Math.max(r, 26)}`,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  }

  return {
    sheetName: '활동 추이',
    anchor: { fromCol: 4, fromRow: headRow - 1, toCol: 16, toRow: headRow + 23 },
    series: [
      { name: `$B$${headRow}`, catFrom: `$A$${dataFrom}`, catTo: `$A$${dataTo}`, valFrom: `$B$${dataFrom}`, valTo: `$B$${dataTo}`, color: '10B981' },
      { name: `$C$${headRow}`, catFrom: `$A$${dataFrom}`, catTo: `$A$${dataTo}`, valFrom: `$C$${dataFrom}`, valTo: `$C$${dataTo}`, color: 'F59E0B' },
    ],
  }
}

// ── 「대시보드」 시트 — 네이티브 차트 4종을 한 화면에 ──────────
//   차트는 ExcelJS 로 못 만들어서, 데이터만 「차트데이터」 시트에 깔아두고
//   저장 직전 zip 에 주입한다(xlsxChart.js). 여기서는 «어디에 무엇을» 만 정한다.
// 설문 문항 → 차트 축용 짧은 라벨. 긴 문장을 축에 그대로 쓰면 3줄로 접혀 그래프를 덮는다.
const SURVEY_SHORT = {
  walk_amount: '걷는 양', walk_habit: '계단·걷기 실천', confidence: '목표 자신감',
  diet_regular: '식사 규칙성', diet_veggie: '채소·과일',
  run_freq: '운동 빈도', run_endurance: '30분 지구력',
  drink_freq: '음주 빈도', drink_control: '음주 조절',
  mind_state: '마음 상태', mind_care: '마음 돌봄',
  smoke_amount: '흡연량(적을수록↑)', smoke_try: '금연 시도', practice: '건강 실천',
}
const shortQ = (q) => SURVEY_SHORT[q.id] || (q.q.length > 12 ? q.q.slice(0, 11) + '…' : q.q)

function addDashboardSheet(wb, { program, report, surveyQuestions, surveyStart = [], surveyEnd = [], raw = [] }) {
  const DASH = '대시보드', DATA = '차트데이터'
  const ws = wb.addWorksheet(DASH)
  const ds = wb.addWorksheet(DATA)

  // ── 격자: 여백 열을 끼워 카드가 «붙지» 않게 한다 ──
  //   A(여백) B~I(왼쪽 카드) J(여백) K~Q(오른쪽 카드) R(여백)
  const COLS = 18
  const gapCols = new Set([1, 10, 18])
  for (let i = 1; i <= COLS; i++) ws.getColumn(i).width = gapCols.has(i) ? 2.2 : 9.6
  const L = { from: 2, to: 9 }, R = { from: 11, to: 17 }

  // ── 차트가 참조할 데이터 블록 ──
  let dr = 1
  const block = (col, headers, rows) => {
    const from = dr
    headers.forEach((h, i) => {
      const c = ds.getRow(from).getCell(col + i)
      c.value = h; c.font = { name: FONT, size: 10, bold: true }
    })
    rows.forEach((row, ri) => row.forEach((v, i) => { ds.getRow(from + 1 + ri).getCell(col + i).value = v }))
    return { head: from, first: from + 1, last: from + rows.length }
  }
  const comp = block(1, ['구분', '인원'], [
    ['완주', report.completedUsers?.length || 0],
    ['참여', report.participatedUsers?.length || 0],
    ['휴면', report.dormantUsers?.length || 0],
  ])
  const mp = (report.missionPerf || []).filter(m => m.rate > 0).slice(0, 6).reverse()
  const seenTitle = {}
  const missLabel = (t) => {
    if (mp.filter(m => m.title === t).length <= 1) return t
    seenTitle[t] = (seenTitle[t] || 0) + 1
    return `${t} (${seenTitle[t]})`
  }
  const miss = block(4, ['미션', '참여율(%)'], mp.map(m => [missLabel(m.title), m.rate]))
  const scales = ((surveyQuestions?.end?.length ? surveyQuestions.end : surveyQuestions?.start) || []).filter(q => q.type === 'scale')
  const avg = (resps, id) => {
    const ns = resps.map(x => Number(x.answers?.[id])).filter(Number.isFinite)
    return ns.length ? Math.round((ns.reduce((a, c) => a + c, 0) / ns.length) * 100) / 100 : null
  }
  const svRows = scales.map(q => [shortQ(q), avg(surveyStart, q.id) ?? 0, avg(surveyEnd, q.id) ?? 0])
  const sv = svRows.length ? block(7, ['문항', '시작', '종료'], svRows) : null
  const PICK_ROW = 8   // 드롭다운 셀(U8) — 아래 수식이 이 행을 가리키므로 먼저 고정한다

  // ── 참여자별 일자 인증 행렬 + 선택 결과 (슬라이서 패널의 원본) ──
  //   드롭다운(대시보드)이 바뀌면 MATCH/INDEX 가 다시 계산되고, 이 결과 열을 보는 차트가 따라 움직인다.
  const kstOf = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10)
  const people = [...(report.completedUsers || []), ...(report.participatedUsers || [])]
    .filter(u => (u.totalCount || 0) > 0).slice(0, 30)
  const pIdx = Object.fromEntries(people.map((u, i) => [u.user_id, i]))
  const grid = {}
  for (const v of raw) {
    if (!v.submitted_at || pIdx[v.user_id] === undefined) continue
    const d = kstOf(v.submitted_at)
    ;(grid[d] ||= {})[v.user_id] = (grid[d][v.user_id] || 0) + 1
  }
  const trendDays = report.trend || []
  let picker = null
  if (people.length && trendDays.length) {
    const MX = 12                                  // L열부터 행렬
    const mHead = 1
    ds.getRow(mHead).getCell(MX).value = '날짜'
    people.forEach((u, i) => { ds.getRow(mHead).getCell(MX + 1 + i).value = u.nickname || '(이름없음)' })
    trendDays.forEach((t, ri) => {
      const row = ds.getRow(mHead + 1 + ri)
      row.getCell(MX).value = fmtMD(t.date)
      people.forEach((u, i) => { row.getCell(MX + 1 + i).value = grid[t.date]?.[u.user_id] || 0 })
    })
    const nameFirst = colLetter(MX + 1), nameLast = colLetter(MX + people.length)
    const mFirst = mHead + 1, mLast = mHead + trendDays.length

    // 결과 블록 — I열(날짜) J열(선택 참여자 건수)
    const RX = 9
    ds.getRow(mHead).getCell(RX).value = '날짜'
    ds.getRow(mHead).getCell(RX + 1).value = '선택 참여자'
    trendDays.forEach((t, ri) => {
      const row = ds.getRow(mHead + 1 + ri)
      row.getCell(RX).value = fmtMD(t.date)
      row.getCell(RX + 1).value = {
        formula: `IFERROR(INDEX($${nameFirst}$${mFirst}:$${nameLast}$${mLast},${ri + 1},`
          + `MATCH('대시보드'!$U$${PICK_ROW},$${nameFirst}$${mHead}:$${nameLast}$${mHead},0)),0)`,
      }
    })
    picker = {
      people, nameFirst, nameLast, mHead,
      series: [{ name: `$${colLetter(RX + 1)}$${mHead}`, catFrom: `$${colLetter(RX)}$${mFirst}`, catTo: `$${colLetter(RX)}$${mLast}`,
        valFrom: `$${colLetter(RX + 1)}$${mFirst}`, valTo: `$${colLetter(RX + 1)}$${mLast}`, color: 'F59E0B' }],
    }
  }
  ds.getColumn(1).width = 10; ds.getColumn(4).width = 22; ds.getColumn(7).width = 24
  ds.state = 'hidden'

  // ── 헤더 ──
  let r = 1
  ws.getRow(r).height = 8; r++
  ws.mergeCells(r, 1, r + 1, COLS)
  const band = ws.getRow(r).getCell(1)
  band.value = `${program.name} 성과 대시보드`
  band.font = { name: FONT, bold: true, size: 20, color: { argb: 'FFFFFFFF' } }
  band.alignment = { horizontal: 'center', vertical: 'middle' }
  for (let rr = r; rr <= r + 1; rr++) for (let i = 1; i <= COLS; i++) ws.getRow(rr).getCell(i).fill = solid(THEME.deep)
  ws.getRow(r).height = 26; ws.getRow(r + 1).height = 20; r += 2
  ws.mergeCells(r, 1, r, COLS)
  const sub = ws.getRow(r).getCell(1)
  sub.value = `${program.start_date} ~ ${program.end_date} · ${report.programDays}일 · 작성 ${formatKstDate(new Date())}`
  sub.font = { name: FONT, size: 10, color: { argb: 'FF8A8A8A' } }
  sub.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(r).height = 18; r += 2

  // ── KPI ──
  const N = report.totalParticipants || 0
  const V = report.totalVerifications || 0
  const svDelta = svRows.length
    ? Math.round((svRows.reduce((acc, x) => acc + ((x[2] || 0) - (x[1] || 0)), 0) / svRows.length) * 100) / 100
    : null
  const tiles = [
    [`${nf(N)}`, '참여자(명)'],
    [`${report.completionRate ?? 0}%`, `완주율 (${nf(report.completedUsers?.length || 0)}명)`],
    [nf(V), '누적 인증(건)'],
    svDelta != null ? [`${svDelta >= 0 ? '+' : ''}${svDelta}`, '설문 평균 변화(점)'] : [`${N ? Math.round((V / N) * 10) / 10 : 0}`, '1인 평균(건)'],
  ]
  // ⚠️ KPI 는 셀이 아니라 «도형 안» 에 쓴다. 셀에 쓰면 위에 얹히는 카드 도형에 가려진다(v8 에서 실제로 겪음).
  const kpiTop = r
  for (let i = 0; i < 3; i++) ws.getRow(r + i).height = 20
  r += 4

  // ── 결론 한 줄 ──
  const headline = (() => {
    const parts = []
    parts.push(`참여자 ${nf(N)}명 중 ${nf(report.completedUsers?.length || 0)}명(${report.completionRate ?? 0}%)이 완주 기준을 채웠다.`)
    if (svDelta != null) {
      parts.push(svDelta > 0 ? `시작·종료 설문에서 실천 수준이 평균 ${svDelta}점 올랐다.`
        : svDelta < 0 ? `시작·종료 설문 평균은 ${Math.abs(svDelta)}점 낮아졌다.` : '시작·종료 설문 평균은 변화가 없었다.')
    }
    const b2 = report.bottleneck
    if (b2) parts.push(`가장 큰 이탈은 「${report.funnel?.find(f => f.key === b2.toKey)?.label || ''}」 구간(${nf(b2.lost)}명)이었다.`)
    return parts.join(' ')
  })()
  ws.mergeCells(r, 2, r, COLS - 1)
  const hl = ws.getRow(r).getCell(2)
  hl.value = headline
  hl.font = { name: FONT, size: 11, bold: true, color: { argb: THEME.deep } }
  hl.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  ws.getRow(r).height = 26; r += 2

  // ── 카드 2×2 (여백 행으로 띄운다) ──
  // ⚠️ 30pt 그림자는 아래·옆으로 약 40px(≈2.7행) 번진다. 카드 바깥에 그만큼 자리를 비워야
  //    아래 주석·다음 카드와 겹치지 않는다.
  const CARD_H = 16
  const row1 = r
  const gap1 = row1 + CARD_H            // 그림자가 번질 빈 행
  const note1 = gap1 + 2
  const row2 = note1 + 2
  const gap2 = row2 + CARD_H
  const note2 = gap2 + 2
  for (let i = row1; i <= note2; i++) ws.getRow(i).height = 15
  for (const g of [gap1, gap1 + 1, gap2, gap2 + 1]) ws.getRow(g).height = 12
  ws.getRow(note1).height = 14; ws.getRow(note2).height = 14
  ws.getRow(note1 + 1).height = 12

  const cardNote = (row, from, to, text) => {
    ws.mergeCells(row, from, row, to)
    const c = ws.getRow(row).getCell(from)
    c.value = text
    c.font = { name: FONT, size: 8.5, color: { argb: 'FF9AA8A0' } }
    c.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  }
  cardNote(note1, L.from, L.to, '※ 후반 감소는 흔한 흐름 · 폭이 클수록 중반 개입(리마인드·응원)이 필요')
  cardNote(note1, R.from, R.to, `※ 완주=활동일 ${report.threshold ?? '-'}일 이상 · 참여=1일 이상 · 휴면=인증 없음`)
  cardNote(note2, L.from, L.to, '※ 참여율 = 그 미션을 한 번이라도 인증한 참여자 비율')
  cardNote(note2, R.from, R.to, `※ 1~${Math.max(5, ...scales.map(q => q.max || 5))}점 척도 · 종료 응답 ${nf(new Set(surveyEnd.map(x => x.user_id)).size)}명 기준`)

  // ── 「슬라이서」 패널 (T~Y) — 진짜 슬라이서는 피벗 전용이라 못 만든다.
  //   모양은 슬라이서, 동작은 드롭다운. 맨 위 셀이 실제 선택이고 아래는 명단(칩)이다.
  //   닉네임(10자 안팎)에 맞춰 좁게. 넓으면 칩이 텅 빈 띠처럼 보인다.
  const P = { from: 20, to: 23 }   // T~W
  for (let i = P.from; i <= P.to; i++) ws.getColumn(i).width = 8
  ws.getColumn(P.from - 1).width = 2.2   // S열 = 본문과의 여백
  //   ⚠️ 드롭다운은 «카드 밖» 에 둔다. 카드 도형 아래에 넣으면 셀이 도형에 가려
  //      실제 조작 수단이 안 보이고, 장식용 칩을 누르게 된다(v13 에서 실제로 겪음).
  const panelTop = PICK_ROW + 2
  const chipTop = panelTop + 1
  const chipRows = picker ? picker.people.length : 0
  const panelBottom = Math.max(note2, panelTop + 4 + chipRows * 3 + 1)
  if (picker) {
    // 패널 제목 — 카드 위 셀에 둔다(카드 안에 넣으면 드롭다운과 겹친다)
    ws.mergeCells(PICK_ROW - 1, P.from, PICK_ROW - 1, P.to)
    const pt = ws.getRow(PICK_ROW - 1).getCell(P.from)
    pt.value = '👥  참여자 선택'
    pt.font = { name: FONT, size: 11, bold: true, color: { argb: THEME.deep } }
    pt.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
    ws.getRow(PICK_ROW - 1).height = 20

    const pk = ws.getRow(PICK_ROW).getCell(21)   // U8
    pk.value = picker.people[0].nickname || '(이름없음)'
    pk.font = { name: FONT, size: 11, bold: true, color: { argb: 'FF222222' } }
    pk.alignment = { horizontal: 'center', vertical: 'middle' }
    pk.fill = solid('FFFFFFFF')
    pk.border = { top: { style: 'medium', color: { argb: THEME.primary } }, bottom: { style: 'medium', color: { argb: THEME.primary } },
      left: { style: 'medium', color: { argb: THEME.primary } }, right: { style: 'medium', color: { argb: THEME.primary } } }
    const tip = ws.getRow(PICK_ROW).getCell(P.from)
    tip.value = '▼'
    tip.font = { name: FONT, size: 12, bold: true, color: { argb: THEME.primary } }
    tip.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.mergeCells(PICK_ROW, P.from + 1, PICK_ROW, P.to)
    pk.dataValidation = {
      type: 'list', allowBlank: false, showErrorMessage: true,
      errorTitle: '참여자 선택', error: '목록에서 참여자를 고르세요',
      formulae: [`=차트데이터!$${picker.nameFirst}$${picker.mHead}:$${picker.nameLast}$${picker.mHead}`],
    }
    ws.getRow(PICK_ROW).height = 22
  }

  // 5번째 카드(선택 참여자 추이) — 2×2 아래 전폭
  const row3 = note2 + 2
  const gap3 = row3 + CARD_H
  const note3 = gap3 + 2
  for (let i = row3; i <= note3; i++) ws.getRow(i).height = 15
  ws.getRow(gap3).height = 12; ws.getRow(gap3 + 1).height = 12
  cardNote(note3, L.from, R.to, '※ 오른쪽 「참여자」 패널에서 이름을 바꾸면 이 그래프가 그 사람 기록으로 바뀝니다')

  const foot = Math.max(note3, panelBottom) + 2
  ws.mergeCells(foot, 2, foot, COLS - 1)
  const fc = ws.getRow(foot).getCell(2)
  fc.value = `※ 집계 기간 ${program.start_date} ~ ${program.end_date}(${report.programDays}일) · 누적 인증 ${nf(V)}건 · 앱 인증 기록과 시작·종료 설문 응답 집계 · 상세 근거는 「요약」·「설문」·「참여자」 시트 참조`
  fc.font = { name: FONT, size: 8.5, color: { argb: 'FFA8B5AE' } }
  fc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  ws.getRow(foot).height = 16
  const LAST = foot + 1

  // 배경 — 아주 연한 민트그레이. 흰 카드가 «떠» 보인다(뉴모피즘).
  for (let rr = 1; rr <= LAST; rr++) for (let cc = 1; cc <= P.to + 1; cc++) {
    const cell = ws.getRow(rr).getCell(cc)
    if (!cell.fill) cell.fill = solid(THEME.bg)
  }

  ws.views = [{ showGridLines: false }]
  ws.pageSetup = {
    paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1,
    printArea: `A1:${colLetter(COLS)}${LAST}`,   // 패널(T~Y)은 인쇄 대상 밖 — 화면용 컨트롤이다
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  }

  // ── 카드 도형(뉴모피즘) — 제목 글자는 도형 «안» 에. 셀에 쓰면 도형에 가린다.
  //   anchor 는 0-based, 끝은 배타적.
  //   anchor 는 0-based, 끝은 배타적. PAD 만큼 안쪽으로 들여 카드끼리 붙지 않게 한다(1cm = 360000 EMU).
  const PAD = 55000
  const A = (fromCol, fromRow, toCol, toRow, pad = 0) => ({
    fromCol: fromCol - 1, fromRow: fromRow - 1, toCol, toRow,
    fromColOff: pad, toColOff: -pad, fromRowOff: pad, toRowOff: -pad,
  })
  const base = { titleColor: THEME.deepHex, shadow: THEME.deepHex, blurPt: 30, radius: 9000, fill: 'FFFFFF' }
  const cards = [
    // KPI 타일 4장 — 값(큼) + 라벨(작음)을 도형 안 두 줄로
    ...tiles.map(([val, label], i) => ({
      ...base, radius: 12000, align: 'ctr', vAnchor: 'ctr',
      anchor: A(2 + i * 4, kpiTop, 2 + i * 4 + 3, kpiTop + 3, PAD * 2),   // KPI 는 작고 촘촘해 그림자가 서로 침범한다 — 두 배로 벌린다
      lines: [
        { text: String(val), size: 2000, color: THEME.deepHex },
        { text: label, size: 900, bold: false, color: '7A8B82' },
      ],
    })),
    { ...base, anchor: A(L.from, row1, L.to, gap1, PAD), title: '📈  일자별 활동 추이' },
    { ...base, anchor: A(R.from, row1, R.to, gap1, PAD), title: '🍩  참여자 구성' },
    { ...base, anchor: A(L.from, row2, L.to, gap2, PAD), title: '📊  미션별 참여율' },
    { ...base, anchor: A(R.from, row2, R.to, gap2, PAD), title: '📋  설문 시작 → 종료' },
    ...(picker ? [
      // 슬라이서 패널 — 컨테이너 + 이름 칩(둥근 사각형)
      { ...base, anchor: A(P.from, panelTop, P.to + 1, panelBottom, PAD), title: '명단 (위 드롭다운으로 선택)', radius: 9000 },
      // ⚠️ srgbClr 은 «6자리 RGB» 만 받는다. 8자리(ARGB)를 주면 검정으로 떨어진다.
      // ⚠️ 세로 여백이 칩 높이를 넘으면 도형이 납작하게 찌그러진다 → 칩은 3행, 여백은 PAD 하나만.
      ...picker.people.map((u, i) => ({
        // 클릭으로 선택되지 않으므로 «버튼처럼» 보이면 안 된다 → 그림자 없이 평평하게.
        ...base, radius: 14000, blurPt: 0, align: 'l', vAnchor: 'ctr',
        fill: i === 0 ? THEME.mintHex : 'F8FBF9',
        anchor: A(P.from, chipTop + i * 3, P.to + 1, chipTop + i * 3 + 2, PAD),
        lines: [{ text: `${u.nickname || '(이름없음)'}   ${nf(u.totalCount || 0)}건`, size: 900, bold: false, color: '4A5A52' }],
      })),
      // 선택 참여자 추이 카드
      { ...base, anchor: A(L.from, row3, R.to, gap3, PAD), title: '🔎  선택 참여자 활동 추이' },
    ] : []),
  ]

  // ── 차트 — 카드 안쪽에 제목 줄만큼 내려서 앉힌다 ──
  const TITLE_ROWS = 3   // 2행이면 제목 아랫부분을 차트가 덮는다(11pt + 도형 여백 ≈ 32px > 30px)
  const charts = []
  if ((report.trend || []).length) {
    charts.push({
      sheetName: DASH, dataSheet: '활동 추이', type: 'line',
      anchor: A(L.from, row1 + TITLE_ROWS, L.to, gap1, PAD * 2), series: [], _wantTrend: true,
    })
  }
  charts.push({
    sheetName: DASH, dataSheet: DATA, type: 'doughnut',
    anchor: A(R.from, row1 + TITLE_ROWS, R.to, gap1, PAD * 2),
    series: [{ name: `$B$${comp.head}`, catFrom: `$A$${comp.first}`, catTo: `$A$${comp.last}`, valFrom: `$B$${comp.first}`, valTo: `$B$${comp.last}`, colors: [THEME.primaryHex, THEME.amberHex, 'CBD5D0'] }],
  })
  if (mp.length) {
    charts.push({
      sheetName: DASH, dataSheet: DATA, type: 'bar', valMax: 100,
      anchor: A(L.from, row2 + TITLE_ROWS, L.to, gap2, PAD * 2),
      series: [{ name: `$E$${miss.head}`, catFrom: `$D$${miss.first}`, catTo: `$D$${miss.last}`, valFrom: `$E$${miss.first}`, valTo: `$E$${miss.last}`, color: THEME.primaryHex }],
    })
  }
  if (sv) {
    charts.push({
      sheetName: DASH, dataSheet: DATA, type: 'col', valMax: Math.max(5, ...scales.map(q => q.max || 5)),
      anchor: A(R.from, row2 + TITLE_ROWS, R.to, gap2, PAD * 2),
      series: [
        { name: `$H$${sv.head}`, catFrom: `$G$${sv.first}`, catTo: `$G$${sv.last}`, valFrom: `$H$${sv.first}`, valTo: `$H$${sv.last}`, color: THEME.sageHex },
        { name: `$I$${sv.head}`, catFrom: `$G$${sv.first}`, catTo: `$G$${sv.last}`, valFrom: `$I$${sv.first}`, valTo: `$I$${sv.last}`, color: THEME.primaryHex },
      ],
    })
  }
  if (picker) {
    charts.push({
      sheetName: DASH, dataSheet: DATA, type: 'line',
      anchor: A(L.from, row3 + TITLE_ROWS, R.to, gap3, PAD * 2),
      series: picker.series,
    })
  }
  return { charts, cards: { [DASH]: cards } }
}

export async function exportEndReportXlsx({ program, report, quizStats = [], community = null, perUser = null, raw = [], scoreBreakdown = {}, teamRanking = [], distanceByUser = null, metricsByUser = null, reportGroups = [], scoreLedger = [], classRoster = [], commentsDetail = null, quizAnswersDetail = null, metricSeries = [], demographics = {}, surveyStart = [], surveyEnd = [], surveyQuestions = null }) {
  const mod = await import('exceljs')
  const ExcelJS = mod.default ?? mod
  const wb = new ExcelJS.Workbook()
  const hasDist = !!distanceByUser
  const km = (uid) => (hasDist ? Math.round((distanceByUser[uid] || 0) * 10) / 10 : null)
  // 주요 기록 지표(거리·시간·칼로리·달성 등) per-user. 있으면 참여자 시트에서 거리 대신 전량 컬럼.
  const metricDefs = (metricsByUser?.metrics) || []
  const mBy = metricsByUser?.byUser || {}
  const useMetrics = metricDefs.length > 0
  const mVal = (uid, key) => Math.round((Number(mBy[uid]?.[key]) || 0) * 10) / 10
  // 지표가 있으면 전 지표 컬럼, 없으면(레거시) 거리 단일 컬럼으로 폴백.
  const extraColDefs = useMetrics
    ? metricDefs.map(m => ({ header: `${m.label}${m.unit ? `(${m.unit})` : ''}`, width: 14, align: 'right', numFmt: '#,##0.0' }))
    : (hasDist ? [{ header: '누적 거리(km)', width: 14, align: 'right', numFmt: '#,##0.0' }] : [])
  const extraRow = (uid) => useMetrics ? metricDefs.map(m => mVal(uid, m.key)) : (hasDist ? [km(uid)] : [])

  const roster = [
    ...report.completedUsers.map(u => [u, '완주']),
    ...report.participatedUsers.map(u => [u, '참여']),
    ...report.dormantUsers.map(u => [u, '휴면']),
  ]
  const nickMap = {}
  for (const [u] of roster) nickMap[u.user_id] = u.nickname
  const nickOf = (uid) => nickMap[uid] || '(알 수 없음)'

  // ── 시트 1: 제출용 요약 (A4 1장 · 서술형 문단 포함) ──
  //   나머지 시트가 raw 데이터라면 이 시트는 «그대로 제출할 수 있는 문서» 다.
  const metricTotals = {}
  if (useMetrics) {
    for (const m of metricDefs) {
      let total = 0
      for (const uid in mBy) total += Number(mBy[uid]?.[m.key]) || 0
      metricTotals[m.key] = total
    }
  }
  addSummarySheet(wb, { program, report, quizStats, community, metricDefs: useMetrics ? metricDefs : [], metricTotals, metricSeries, demographics })

  // ── 시트: 활동 추이 (셀로 그린 막대 그래프) ──
  const trendChart = addTrendSheet(wb, { program, report, raw })

  // ── 시트: 대시보드 (네이티브 차트 4종) — 맨 앞에 오도록 나중에 순서 조정 ──
  const dash = addDashboardSheet(wb, { program, report, surveyQuestions, surveyStart, surveyEnd, raw })
  // 추이 차트는 「활동 추이」 시트의 실제 범위를 써야 한다 — 대시보드용 사본에 채워 넣는다.
  for (const c of dash.charts) {
    if (c._wantTrend && trendChart) { c.series = trendChart.series; delete c._wantTrend }
  }
  // 참여자별 추이 — 드롭다운 선택에 따라 수식이 다시 계산되고 이 차트가 따라 움직인다.
  const pickerChart = trendChart?.picker
    ? { sheetName: '활동 추이', dataSheet: '활동 추이', type: 'line',
        anchor: { fromCol: 4, fromRow: trendChart.picker.pHead - 1, toCol: 16, toRow: trendChart.picker.pHead + 20 },
        series: trendChart.picker.series }
    : null
  const allCharts = [
    ...(trendChart ? [trendChart] : []),
    ...(pickerChart ? [pickerChart] : []),
    ...dash.charts.filter(c => c.series?.length),
  ]

  // ── 시트: 설문 (시작↔종료 비교) — 설문을 켠 프로그램만 ──
  if (program.survey_enabled && (surveyStart.length || surveyEnd.length)) {
    addSurveySheet(wb, {
      program,
      startQuestions: surveyQuestions?.start || [],
      endQuestions: surveyQuestions?.end || [],
      startResponses: surveyStart, endResponses: surveyEnd,
      partCount: report.totalParticipants || 0,
    })
  }

  // ── 시트: 현황 상세 (기존 키-값 요약 — 숫자를 그대로 집어 쓰는 용도) ──
  const sumItems = [
    ['기간', (program.start_date && program.end_date) ? `${program.start_date} ~ ${program.end_date}` : '-'],
    ['일수', report.programDays ? `${report.programDays}일` : '-'],
    null,
    { section: '참여 현황' },
    ['참여자', report.totalParticipants],
    ['완주', report.completedUsers.length],
    ['참여', report.participatedUsers.length],
    ['휴면', report.dormantUsers.length],
    ['완주율', report.completionRate != null ? `${report.completionRate}%` : '-', { big: true, color: CLR.accent }],
    ['누적 인증', report.totalVerifications],
    null,
    { section: '참여 여정' },
    ...report.funnel.map(f => [f.label, f.count]),
  ]
  if (useMetrics) {
    sumItems.push(null, { section: '주요 기록 요약 (전체 합계)' },
      ...metricDefs.map(m => [`${m.label}${m.unit ? `(${m.unit})` : ''}`, Math.round((metricTotals[m.key] || 0) * 10) / 10, { bold: true, numFmt: '#,##0.0' }]))
  }
  if (community) {
    sumItems.push(null, { section: '커뮤니티' },
      ['참여자 글', community.participantPosts ?? 0],
      ['댓글', community.totalComments ?? 0],
      ['좋아요', community.totalLikes ?? 0],
      ['글 쓴 사람', community.posterCount ?? 0])
  }
  addKeyValueSheet(wb, '현황 상세', `${program.name} — 종료 리포트`, sumItems)

  // ── 시트: 랭킹 (1등~꼴등, 점수 출처 분해) ──
  const rankRows = roster.map(([u, status]) => {
    const s = scoreBreakdown[u.user_id] || { missionPts: 0, quizPts: 0, otherPts: 0, total: u.totalScore || 0 }
    return { u, status, ...s }
  })
  rankRows.sort((a, b) => b.total - a.total || b.u.activeDays - a.u.activeDays || b.u.totalCount - a.u.totalCount || (a.u.nickname || '').localeCompare(b.u.nickname || ''))
  // 동점 공동 순위(1,2,2,4)
  let rk = 0, prev = null, seen = 0
  for (const r of rankRows) { seen += 1; if (r.total !== prev) { rk = seen; prev = r.total } r.rank = rk }
  const hasOther = rankRows.some(r => r.otherPts > 0)
  const rankCols = [
    { header: '순위', width: 6, align: 'center' },
    { header: '닉네임', width: 16 },
    { header: '상태', width: 7, align: 'center' },
    { header: '총점', width: 8, align: 'right', numFmt: '#,##0' },
    { header: '미션 점수', width: 10, align: 'right', numFmt: '#,##0' },
    { header: '퀴즈 점수', width: 10, align: 'right', numFmt: '#,##0' },
    ...(hasOther ? [{ header: '기타 점수', width: 10, align: 'right', numFmt: '#,##0' }] : []),
    ...extraColDefs,
    { header: '활동일', width: 8, align: 'center' },
    { header: '인증 수', width: 8, align: 'center' },
  ]
  const rankData = rankRows.map(r => [medal(r.rank), r.u.nickname, r.status, r.total, r.missionPts, r.quizPts, ...(hasOther ? [r.otherPts] : []), ...extraRow(r.u.user_id), r.u.activeDays, r.u.totalCount])
  addTable(wb, '랭킹', '랭킹 · 참여자 점수 순위', rankCols, rankData, { statusCol: 3 })

  // ── 시트: 팀 랭킹 (팀이 있을 때) ── 팀 점수 = 멤버 점수 집계(get_team_ranking)
  if (teamRanking && teamRanking.length) {
    const sorted = [...teamRanking].sort((a, b) => (a.rank == null ? 1 : 0) - (b.rank == null ? 1 : 0) || (a.rank || 0) - (b.rank || 0))
    const tRows = sorted.map(t => {
      const members = t.members || []
      let mPts = 0, qPts = 0
      for (const m of members) { const s = scoreBreakdown[m.user_id]; if (s) { mPts += s.missionPts; qPts += s.quizPts } }
      const names = members.map(m => `${m.nickname}(${m.score})`).join(', ')
      return [t.rank != null ? medal(t.rank) : '모집중', `${t.emoji || ''} ${t.team_name}`.trim(), t.total_score, Math.round((Number(t.avg_score) || 0) * 10) / 10, mPts, qPts, t.member_count, names]
    })
    addTable(wb, '팀 랭킹', '팀 랭킹', [
      { header: '순위', width: 8, align: 'center' },
      { header: '팀', width: 18 },
      { header: '합계 점수', width: 10, align: 'right', numFmt: '#,##0' },
      { header: '인당 평균', width: 10, align: 'right', numFmt: '#,##0.0' },
      { header: '미션 점수', width: 10, align: 'right', numFmt: '#,##0' },
      { header: '퀴즈 점수', width: 10, align: 'right', numFmt: '#,##0' },
      { header: '인원', width: 6, align: 'center' },
      { header: '멤버(점수)', width: 44 },
    ], tRows)
  }

  // ── 시트: 참여자(딥) ── 개인별 미션·퀴즈·커뮤니티
  const missionByUser = {}
  for (const r of raw) {
    if (!r.user_id) continue
    const m = (missionByUser[r.user_id] ||= { titles: new Set(), verifs: 0 })
    m.titles.add(r.missions?.title || '(미션)')
    m.verifs += 1
  }
  const pCols = [
    { header: '닉네임', width: 16 },
    { header: '상태', width: 7, align: 'center' },
    { header: '활동일', width: 8, align: 'center' },
    { header: '총 인증', width: 8, align: 'center' },
    ...extraColDefs,
    { header: '미션 종류', width: 10, align: 'center' },
    { header: '제출 미션', width: 36 },
    { header: '참여 퀴즈', width: 10, align: 'center' },
    { header: '퀴즈 정답률(%)', width: 15, align: 'right', numFmt: '#,##0' },
    { header: '커뮤니티 글', width: 12, align: 'center' },
    { header: '댓글', width: 7, align: 'center' },
    { header: '점수', width: 8, align: 'right', numFmt: '#,##0' },
  ]
  const pRows = roster.map(([u, status]) => {
    const mi = missionByUser[u.user_id] || { titles: new Set(), verifs: 0 }
    const qz = perUser?.quizByUser?.[u.user_id] || { quizCount: 0, correctRate: null }
    const cmu = perUser?.communityByUser?.[u.user_id] || { posts: 0, comments: 0 }
    return [u.nickname, status, u.activeDays, u.totalCount, ...extraRow(u.user_id), mi.titles.size, [...mi.titles].join(', '), qz.quizCount, qz.correctRate ?? '', cmu.posts, cmu.comments, u.totalScore]
  })
  addTable(wb, '참여자', '참여자별 활동 상세', pCols, pRows, { statusCol: 2 })

  // ── 시트 3: 미션별 ──
  addTable(wb, '미션별', '미션별 성과', [
    { header: '미션', width: 30 },
    { header: '인증 건수', width: 10, align: 'right', numFmt: '#,##0' },
    { header: '참여 인원', width: 10, align: 'right', numFmt: '#,##0' },
    { header: '참여율(%)', width: 10, align: 'right', numFmt: '#,##0' },
  ], report.missionPerf.map(m => [m.title, m.count, m.users, m.rate]))

  // ── 시트 4: 퀴즈별 (있을 때) ──
  if (quizStats.length) {
    addTable(wb, '퀴즈별', '퀴즈별 성과', [
      { header: '퀴즈', width: 30 },
      { header: '문항 수', width: 8, align: 'center' },
      { header: '제출', width: 8, align: 'center' },
      { header: '참여율(%)', width: 10, align: 'right', numFmt: '#,##0' },
      { header: '정답률(%)', width: 10, align: 'right', numFmt: '#,##0' },
    ], quizStats.map(q => [q.title, q.questionCount, q.submissionCount, q.participationRate, q.correctRate ?? '']))
  }

  // 일자별 사용자·거리 집계(raw 기준)
  const dates = (report.trend || []).map(t => t.date)
  const dayUsers = {}, userDay = {}
  for (const r of raw) {
    if (!r.user_id) continue
    const d = formatKstDate(new Date(r.submitted_at))
    ;(dayUsers[d] ||= new Set()).add(r.user_id)
    ;(userDay[r.user_id] ||= new Set()).add(d)
  }

  // ── 시트: 일자별 활동 ──
  if (dates.length) {
    addTable(wb, '일자별 활동', '일자별 활동 추이', [
      { header: '날짜', width: 10, align: 'center' },
      { header: '인증 수', width: 9, align: 'right', numFmt: '#,##0' },
      { header: '참여 인원', width: 9, align: 'right', numFmt: '#,##0' },
    ], (report.trend || []).map(t => [fmtMD(t.date), t.count, (dayUsers[t.date] || new Set()).size]))
  }

  // ── 시트: 퀴즈 문항별 (정답률) ──
  const qRows = []
  for (const q of quizStats) {
    for (const qs of (q.questionStats || [])) {
      qRows.push([q.title, qs.text || '', qs.total, qs.correct, qs.correctRate ?? ''])
    }
  }
  if (qRows.length) {
    addTable(wb, '문항별', '퀴즈 문항별 정답률', [
      { header: '퀴즈', width: 22 },
      { header: '문항', width: 44 },
      { header: '응답 수', width: 8, align: 'right', numFmt: '#,##0' },
      { header: '정답 수', width: 8, align: 'right', numFmt: '#,##0' },
      { header: '정답률(%)', width: 10, align: 'right', numFmt: '#,##0' },
    ], qRows)
  }

  // ── 시트: 신고 상세 (있을 때) ──
  if (reportGroups && reportGroups.length) {
    const desc = (g) => (g.targetType === 'verification'
      ? `미션 「${g.target?.missions?.title || '삭제된 미션'}」 인증`
      : `커뮤니티 글${g.target?.title ? ` 「${g.target.title}」` : ''}`)
    const st = (g) => (g.unresolved > 0 ? '미처리' : g.deleted ? '삭제됨' : g.hidden ? '숨김' : '처리 완료')
    addTable(wb, '신고 상세', '신고 처리 내역', [
      { header: '대상', width: 26 },
      { header: '유형', width: 6, align: 'center' },
      { header: '신고 수', width: 8, align: 'right', numFmt: '#,##0' },
      { header: '미처리', width: 7, align: 'right', numFmt: '#,##0' },
      { header: '상태', width: 9, align: 'center' },
      { header: '대표 사유', width: 18 },
    ], reportGroups.map(g => [desc(g), g.targetType === 'post' ? '글' : '인증', g.reporters.length, g.unresolved, st(g), g.reporters.find(r => r.reason)?.reason || '']))
  }

  // ── 시트: 일자별 인증표 (참여자 × 날짜, O 표시 + 합계) ──
  if (dates.length) {
    addTable(wb, '일자별 인증표', '일자별 인증 현황표', [
      { header: '참여자', width: 16 },
      ...dates.map(d => ({ header: fmtMD(d), width: 5, align: 'center' })),
      { header: '합계', width: 6, align: 'center' },
    ], roster.map(([u]) => [u.nickname, ...dates.map(d => (userDay[u.user_id]?.has(d) ? 'O' : '')), u.totalCount]))
  }

  // ── 시트: 미션별 시간대 분포 (인증이 몇 시에 몰렸나) ──
  const byMission = {}
  for (const r of raw) {
    if (!r.submitted_at) continue
    const title = r.missions?.title || '(미션)'
    const b = bucketOfHour(getKstHour(r.submitted_at))
    const m = (byMission[title] ||= { buckets: {}, total: 0 })
    const key = b ? b.key : 'etc'
    m.buckets[key] = (m.buckets[key] || 0) + 1
    m.total += 1
  }
  if (Object.keys(byMission).length) {
    const rows = Object.entries(byMission).map(([title, m]) => {
      const peak = TIME_BUCKETS.reduce((best, b) => ((m.buckets[b.key] || 0) > (best ? (m.buckets[best.key] || 0) : -1) ? b : best), null)
      return [title, ...TIME_BUCKETS.map(b => m.buckets[b.key] || 0), (peak && (m.buckets[peak.key] || 0) > 0) ? peak.label : '-', m.total]
    })
    addTable(wb, '미션별 시간대', '미션별 인증 시간대 분포', [
      { header: '미션', width: 22 },
      ...TIME_BUCKETS.map(b => ({ header: `${b.label}(${b.range[0]}-${b.range[1]}시)`, width: 14, align: 'right', numFmt: '#,##0' })),
      { header: '피크 시간대', width: 12, align: 'center' },
      { header: '총', width: 7, align: 'right', numFmt: '#,##0' },
    ], rows)
  }

  // ── 시트: 팀별 멤버 상세 (팀이 있을 때) ──
  if (teamRanking && teamRanking.length) {
    const rows = []
    for (const t of teamRanking) {
      for (const m of (t.members || [])) {
        const s = scoreBreakdown[m.user_id] || { missionPts: 0, quizPts: 0 }
        rows.push([t.rank != null ? medal(t.rank) : '모집중', `${t.emoji || ''} ${t.team_name}`.trim(), m.nickname, m.score, s.missionPts, s.quizPts])
      }
    }
    if (rows.length) {
      addTable(wb, '팀별 멤버', '팀별 멤버 상세', [
        { header: '순위', width: 6, align: 'center' },
        { header: '팀', width: 18 },
        { header: '멤버', width: 14 },
        { header: '멤버 점수', width: 10, align: 'right', numFmt: '#,##0' },
        { header: '미션 점수', width: 10, align: 'right', numFmt: '#,##0' },
        { header: '퀴즈 점수', width: 10, align: 'right', numFmt: '#,##0' },
      ], rows)
    }
  }

  // ── 시트: 점수 내역 (누가·언제·어디서 몇 점 — 점수 하나하나의 출처) ──
  if (scoreLedger && scoreLedger.length) {
    addTable(wb, '점수 내역', '점수 지급 내역', [
      { header: '일자', width: 11, align: 'center' },
      { header: '닉네임', width: 14 },
      { header: '점수', width: 7, align: 'right', numFmt: '#,##0' },
      { header: '출처', width: 8, align: 'center' },
      { header: '항목', width: 24 },
      { header: '사유', width: 20 },
    ], scoreLedger.map(l => [formatKstDate(new Date(l.created_at)), l.nickname, l.point, l.source, l.item, l.reason]))
  }

  // ── 시트: 클래스별 출석 (세션별 신청·출석 명단 — 누가·언제·어떻게) ──
  if (classRoster && classRoster.length) {
    const rows = []
    for (const s of classRoster) {
      const when = kstDT(s.starts_at) + (s.ends_at ? `~${kstT(s.ends_at)}` : '')
      const catL = catOf(s.category)?.label || s.category || ''
      const signup = s.signup_mode === 'rsvp' ? '사전신청' : '자유참여'
      const base = [s.title, catL, when, s.place_name || '', s.instructor || '', s.capacity ?? '', signup]
      if (!s.participants.length) {
        rows.push([...base, '(참가자 없음)', '', '', '', '', '', 0])
        continue
      }
      for (const p of s.participants) {
        const regTxt = p.reg ? (p.reg.status === 'registered' ? '신청' : '취소') : '미신청'
        const attTxt = p.att ? (ATT_LABEL[p.att.status] || p.att.status) : '미출석'
        const attended = p.att?.status === 'confirmed'
        rows.push([
          ...base, p.nickname,
          regTxt, p.reg ? kstDT(p.reg.created_at) : '',
          attTxt, p.att ? (METHOD_LABEL[p.att.method] || p.att.method || '') : '',
          p.att ? kstDT(p.att.created_at) : '',
          attended ? (s.points || 0) : 0,
        ])
      }
    }
    addTable(wb, '클래스별 출석', '클래스별 신청·출석 명단', [
      { header: '클래스', width: 18 },
      { header: '종목', width: 8, align: 'center' },
      { header: '일시', width: 13, align: 'center' },
      { header: '장소', width: 12 },
      { header: '강사', width: 10 },
      { header: '정원', width: 6, align: 'center' },
      { header: '신청방식', width: 9, align: 'center' },
      { header: '참가자', width: 12 },
      { header: '신청', width: 7, align: 'center' },
      { header: '신청시각', width: 12, align: 'center' },
      { header: '출석', width: 8, align: 'center' },
      { header: '출석방식', width: 11, align: 'center' },
      { header: '출석시각', width: 12, align: 'center' },
      { header: '지급P', width: 7, align: 'right', numFmt: '#,##0' },
    ], rows)
  }

  // ── 시트: 참여자 댓글 (상세 포함 옵션) ── 인증 피드 + 자유게시판 댓글 전량
  if (commentsDetail && commentsDetail.length) {
    addTable(wb, '참여자 댓글', '참여자 댓글 상세', [
      { header: '닉네임', width: 14 },
      { header: '작성일시', width: 13, align: 'center' },
      { header: '위치', width: 10, align: 'center' },
      { header: '대상', width: 24 },
      { header: '댓글 내용', width: 60 },
    ], commentsDetail.map(c => [nickOf(c.user_id), kstDT(c.created_at), c.where, c.context, c.content]))
  }

  // ── 시트: 참여자 퀴즈 답변 (상세 포함 옵션) ── 참여자 × 문항별 내 답/정답/정오
  if (quizAnswersDetail && quizAnswersDetail.length) {
    addTable(wb, '참여자 퀴즈 답변', '참여자 퀴즈 답변 상세', [
      { header: '닉네임', width: 14 },
      { header: '퀴즈', width: 22 },
      { header: '문항', width: 6, align: 'center' },
      { header: '문항 내용', width: 40 },
      { header: '내 답', width: 24 },
      { header: '정답', width: 24 },
      { header: '정오', width: 8, align: 'center' },
    ], quizAnswersDetail.map(a => [nickOf(a.user_id), a.quizTitle, a.order, a.question, a.myAnswer, a.correctAnswer, a.isCorrect === true ? '정답' : a.isCorrect === false ? '오답' : '채점대기']))
  }

  await saveWorkbook(wb, `${sanitizeName(program.name)}_종료리포트.xlsx`, allCharts, dash.cards)
}

// 워크북 저장 — 모바일은 공유 시트로 파일 내보내기(파일앱·카톡·메일 저장),
//   데스크톱/미지원은 blob 다운로드. iOS 사파리·인앱 브라우저의 다운로드 제약 회피.
async function saveWorkbook(wb, filename, charts = [], cards = {}) {
  let buf = await wb.xlsx.writeBuffer()
  // 네이티브 엑셀 차트 주입 — ExcelJS 가 손을 뗀 «뒤» 라야 파트가 살아남는다(xlsxChart.js 주석 참고).
  if (charts.length) buf = await injectLineCharts(buf, charts, cards)
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  // 1) 파일 공유(navigator.share files) — 모바일에서 안정적
  try {
    const file = new File([blob], filename, { type: blob.type })
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename })
      return
    }
  } catch (e) {
    if (e?.name === 'AbortError') return   // 사용자가 공유 시트 취소 — 조용히 종료
    // 그 외 오류는 아래 다운로드로 폴백
  }
  // 2) blob 다운로드 (데스크톱 등)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
