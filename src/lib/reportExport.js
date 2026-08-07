// 종료 리포트 → 다중 시트 엑셀(.xlsx) 내보내기.
//   요약 / 랭킹 / (팀 랭킹) / 참여자(딥) / 미션별 / 퀴즈별 / 일자별 활동 / 문항별 / (신고 상세) / 일자별 인증표
//   ExcelJS(동적 import → 내보내기 클릭 시에만 로드)로 브랜드 스타일(제목 밴드·헤더·줄무늬·상태 배지) 입힘.
import { formatKstDate } from './queries'
import { getKstHour, TIME_BUCKETS, bucketOfHour } from './formatters'
import { catOf } from './classCategories'

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
const CLR = {
  title: 'FF1E5C3F', head: 'FF2F855A', headFg: 'FFFFFFFF',
  zebra: 'FFF4F8F5', border: 'FFD9E2DC',
  accent: 'FF2F855A',
  done: { bg: 'FFD6EFDF', fg: 'FF1B5E3A' },
  part: { bg: 'FFFBEECB', fg: 'FF8A6A12' },
  dorm: { bg: 'FFEDEDED', fg: 'FF707070' },
}
const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const thin = () => ({ style: 'thin', color: { argb: CLR.border } })
const box = () => ({ top: thin(), left: thin(), bottom: thin(), right: thin() })
const medal = (rank) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank)

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

export async function exportEndReportXlsx({ program, report, quizStats = [], community = null, perUser = null, raw = [], scoreBreakdown = {}, teamRanking = [], distanceByUser = null, metricsByUser = null, reportGroups = [], scoreLedger = [], classRoster = [], commentsDetail = null, quizAnswersDetail = null }) {
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

  // ── 시트 1: 요약 (카드형) ──
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
      ...metricDefs.map(m => {
        let total = 0
        for (const uid in mBy) total += Number(mBy[uid]?.[m.key]) || 0
        return [`${m.label}${m.unit ? `(${m.unit})` : ''}`, Math.round(total * 10) / 10, { bold: true, numFmt: '#,##0.0' }]
      }))
  }
  if (community) {
    sumItems.push(null, { section: '커뮤니티' },
      ['참여자 글', community.participantPosts ?? 0],
      ['댓글', community.totalComments ?? 0],
      ['좋아요', community.totalLikes ?? 0],
      ['글 쓴 사람', community.posterCount ?? 0])
  }
  addKeyValueSheet(wb, '요약', `${program.name} — 종료 리포트`, sumItems)

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

  await saveWorkbook(wb, `${sanitizeName(program.name)}_종료리포트.xlsx`)
}

// 워크북 저장 — 모바일은 공유 시트로 파일 내보내기(파일앱·카톡·메일 저장),
//   데스크톱/미지원은 blob 다운로드. iOS 사파리·인앱 브라우저의 다운로드 제약 회피.
async function saveWorkbook(wb, filename) {
  const buf = await wb.xlsx.writeBuffer()
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
