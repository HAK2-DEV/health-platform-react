// 종료 리포트 → 다중 시트 엑셀(.xlsx) 내보내기.
//   요약 / 랭킹 / (팀 랭킹) / 참여자(딥) / 미션별 / 퀴즈별 / 일자별 활동 / 문항별 / (신고 상세) / 일자별 인증표
//   SheetJS(xlsx)는 동적 import → 내보내기 클릭 시에만 로드(코드 스플릿).
import { formatKstDate } from './queries'
import { getKstHour, TIME_BUCKETS, bucketOfHour } from './formatters'

function sanitizeName(name) {
  return (name || 'report').replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 40) || 'report'
}
const fmtMD = (ds) => { const p = String(ds || '').split('-'); return p.length === 3 ? `${+p[1]}/${+p[2]}` : ds }

export async function exportEndReportXlsx({ program, report, quizStats = [], community = null, perUser = null, raw = [], scoreBreakdown = {}, teamRanking = [], distanceByUser = null, reportGroups = [], scoreLedger = [] }) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const hasDist = !!distanceByUser
  const km = (uid) => (hasDist ? Math.round((distanceByUser[uid] || 0) * 10) / 10 : null)

  const roster = [
    ...report.completedUsers.map(u => [u, '완주']),
    ...report.participatedUsers.map(u => [u, '참여']),
    ...report.dormantUsers.map(u => [u, '휴면']),
  ]

  // ── 시트 1: 요약 ──
  const summary = [
    [`${program.name} — 종료 리포트`],
    [],
    ['기간', (program.start_date && program.end_date) ? `${program.start_date} ~ ${program.end_date}` : '-'],
    ['일수', report.programDays ? `${report.programDays}일` : '-'],
    ['참여자', report.totalParticipants],
    ['완주', report.completedUsers.length],
    ['참여', report.participatedUsers.length],
    ['휴면', report.dormantUsers.length],
    ['완주율(%)', report.completionRate ?? ''],
    ['누적 인증', report.totalVerifications],
    [],
    ['참여 여정'],
    ...report.funnel.map(f => [f.label, f.count]),
  ]
  if (community) {
    summary.push([], ['커뮤니티'],
      ['참여자 글', community.participantPosts ?? 0],
      ['댓글', community.totalComments ?? 0],
      ['좋아요', community.totalLikes ?? 0],
      ['글 쓴 사람', community.posterCount ?? 0])
  }
  const wsSummary = XLSX.utils.aoa_to_sheet(summary)
  wsSummary['!cols'] = [{ wch: 16 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, '요약')

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
  const rHeader = ['순위', '닉네임', '상태', '총점', '미션 점수', '퀴즈 점수', ...(hasOther ? ['기타 점수'] : []), ...(hasDist ? ['누적 거리(km)'] : []), '활동일', '인증 수']
  const wsR = XLSX.utils.aoa_to_sheet([
    rHeader,
    ...rankRows.map(r => [r.rank, r.u.nickname, r.status, r.total, r.missionPts, r.quizPts, ...(hasOther ? [r.otherPts] : []), ...(hasDist ? [km(r.u.user_id)] : []), r.u.activeDays, r.u.totalCount]),
  ])
  wsR['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 6 }, { wch: 7 }, { wch: 9 }, { wch: 9 }, ...(hasOther ? [{ wch: 9 }] : []), ...(hasDist ? [{ wch: 12 }] : []), { wch: 7 }, { wch: 7 }]
  XLSX.utils.book_append_sheet(wb, wsR, '랭킹')

  // ── 시트: 팀 랭킹 (팀이 있을 때) ── 팀 점수 = 멤버 점수 집계(get_team_ranking)
  if (teamRanking && teamRanking.length) {
    const sorted = [...teamRanking].sort((a, b) => (a.rank == null ? 1 : 0) - (b.rank == null ? 1 : 0) || (a.rank || 0) - (b.rank || 0))
    const tRows = sorted.map(t => {
      const members = t.members || []
      let mPts = 0, qPts = 0
      for (const m of members) { const s = scoreBreakdown[m.user_id]; if (s) { mPts += s.missionPts; qPts += s.quizPts } }
      const names = members.map(m => `${m.nickname}(${m.score})`).join(', ')
      return [t.rank ?? '모집중', `${t.emoji || ''} ${t.team_name}`.trim(), t.total_score, Math.round((Number(t.avg_score) || 0) * 10) / 10, mPts, qPts, t.member_count, names]
    })
    const wsT = XLSX.utils.aoa_to_sheet([
      ['순위', '팀', '합계 점수', '인당 평균', '미션 점수', '퀴즈 점수', '인원', '멤버(점수)'],
      ...tRows,
    ])
    wsT['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 10 }, { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 6 }, { wch: 44 }]
    XLSX.utils.book_append_sheet(wb, wsT, '팀 랭킹')
  }

  // ── 시트: 참여자(딥) ── 개인별 미션·퀴즈·커뮤니티
  const missionByUser = {}
  for (const r of raw) {
    if (!r.user_id) continue
    const m = (missionByUser[r.user_id] ||= { titles: new Set(), verifs: 0 })
    m.titles.add(r.missions?.title || '(미션)')
    m.verifs += 1
  }
  const pHeader = ['닉네임', '상태', '활동일', '총 인증', ...(hasDist ? ['누적 거리(km)'] : []), '미션 종류', '제출 미션', '참여 퀴즈', '퀴즈 정답률(%)', '커뮤니티 글', '댓글', '점수']
  const pRows = roster.map(([u, status]) => {
    const mi = missionByUser[u.user_id] || { titles: new Set(), verifs: 0 }
    const qz = perUser?.quizByUser?.[u.user_id] || { quizCount: 0, correctRate: null }
    const cmu = perUser?.communityByUser?.[u.user_id] || { posts: 0, comments: 0 }
    return [u.nickname, status, u.activeDays, u.totalCount, ...(hasDist ? [km(u.user_id)] : []), mi.titles.size, [...mi.titles].join(', '), qz.quizCount, qz.correctRate ?? '', cmu.posts, cmu.comments, u.totalScore]
  })
  const wsP = XLSX.utils.aoa_to_sheet([pHeader, ...pRows])
  wsP['!cols'] = [{ wch: 14 }, { wch: 6 }, { wch: 7 }, { wch: 7 }, ...(hasDist ? [{ wch: 12 }] : []), { wch: 8 }, { wch: 36 }, { wch: 9 }, { wch: 13 }, { wch: 11 }, { wch: 7 }, { wch: 7 }]
  XLSX.utils.book_append_sheet(wb, wsP, '참여자')

  // ── 시트 3: 미션별 ──
  const wsM = XLSX.utils.aoa_to_sheet([
    ['미션', '인증 건수', '참여 인원', '참여율(%)'],
    ...report.missionPerf.map(m => [m.title, m.count, m.users, m.rate]),
  ])
  wsM['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, wsM, '미션별')

  // ── 시트 4: 퀴즈별 (있을 때) ──
  if (quizStats.length) {
    const wsQ = XLSX.utils.aoa_to_sheet([
      ['퀴즈', '문항 수', '제출', '참여율(%)', '정답률(%)'],
      ...quizStats.map(q => [q.title, q.questionCount, q.submissionCount, q.participationRate, q.correctRate ?? '']),
    ])
    wsQ['!cols'] = [{ wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, wsQ, '퀴즈별')
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
    const wsD = XLSX.utils.aoa_to_sheet([
      ['날짜', '인증 수', '참여 인원'],
      ...(report.trend || []).map(t => [fmtMD(t.date), t.count, (dayUsers[t.date] || new Set()).size]),
    ])
    wsD['!cols'] = [{ wch: 10 }, { wch: 9 }, { wch: 9 }]
    XLSX.utils.book_append_sheet(wb, wsD, '일자별 활동')
  }

  // ── 시트: 퀴즈 문항별 (정답률) ──
  const qRows = []
  for (const q of quizStats) {
    for (const qs of (q.questionStats || [])) {
      qRows.push([q.title, qs.text || '', qs.total, qs.correct, qs.correctRate ?? ''])
    }
  }
  if (qRows.length) {
    const wsQQ = XLSX.utils.aoa_to_sheet([['퀴즈', '문항', '응답 수', '정답 수', '정답률(%)'], ...qRows])
    wsQQ['!cols'] = [{ wch: 22 }, { wch: 44 }, { wch: 8 }, { wch: 8 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, wsQQ, '문항별')
  }

  // ── 시트: 신고 상세 (있을 때) ──
  if (reportGroups && reportGroups.length) {
    const desc = (g) => (g.targetType === 'verification'
      ? `미션 「${g.target?.missions?.title || '삭제된 미션'}」 인증`
      : `커뮤니티 글${g.target?.title ? ` 「${g.target.title}」` : ''}`)
    const st = (g) => (g.unresolved > 0 ? '미처리' : g.deleted ? '삭제됨' : g.hidden ? '숨김' : '처리 완료')
    const wsRep = XLSX.utils.aoa_to_sheet([
      ['대상', '유형', '신고 수', '미처리', '상태', '대표 사유'],
      ...reportGroups.map(g => [desc(g), g.targetType === 'post' ? '글' : '인증', g.reporters.length, g.unresolved, st(g), g.reporters.find(r => r.reason)?.reason || '']),
    ])
    wsRep['!cols'] = [{ wch: 26 }, { wch: 6 }, { wch: 8 }, { wch: 7 }, { wch: 9 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, wsRep, '신고 상세')
  }

  // ── 시트: 일자별 인증표 (참여자 × 날짜, O 표시 + 합계) ──
  if (dates.length) {
    const mHead = ['참여자', ...dates.map(fmtMD), '합계']
    const mData = roster.map(([u]) => [u.nickname, ...dates.map(d => (userDay[u.user_id]?.has(d) ? 'O' : '')), u.totalCount])
    const wsMx = XLSX.utils.aoa_to_sheet([mHead, ...mData])
    wsMx['!cols'] = [{ wch: 14 }, ...dates.map(() => ({ wch: 5 })), { wch: 6 }]
    XLSX.utils.book_append_sheet(wb, wsMx, '일자별 인증표')
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
    const head = ['미션', ...TIME_BUCKETS.map(b => `${b.label}(${b.range[0]}-${b.range[1]}시)`), '피크 시간대', '총']
    const rows = Object.entries(byMission).map(([title, m]) => {
      const peak = TIME_BUCKETS.reduce((best, b) => ((m.buckets[b.key] || 0) > (best ? (m.buckets[best.key] || 0) : -1) ? b : best), null)
      return [title, ...TIME_BUCKETS.map(b => m.buckets[b.key] || 0), (peak && (m.buckets[peak.key] || 0) > 0) ? peak.label : '-', m.total]
    })
    const wsH = XLSX.utils.aoa_to_sheet([head, ...rows])
    wsH['!cols'] = [{ wch: 22 }, ...TIME_BUCKETS.map(() => ({ wch: 12 })), { wch: 12 }, { wch: 7 }]
    XLSX.utils.book_append_sheet(wb, wsH, '미션별 시간대')
  }

  // ── 시트: 팀별 멤버 상세 (팀이 있을 때) ──
  if (teamRanking && teamRanking.length) {
    const rows = []
    for (const t of teamRanking) {
      for (const m of (t.members || [])) {
        const s = scoreBreakdown[m.user_id] || { missionPts: 0, quizPts: 0 }
        rows.push([t.rank ?? '모집중', `${t.emoji || ''} ${t.team_name}`.trim(), m.nickname, m.score, s.missionPts, s.quizPts])
      }
    }
    if (rows.length) {
      const wsTM = XLSX.utils.aoa_to_sheet([['순위', '팀', '멤버', '멤버 점수', '미션 점수', '퀴즈 점수'], ...rows])
      wsTM['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 14 }, { wch: 9 }, { wch: 9 }, { wch: 9 }]
      XLSX.utils.book_append_sheet(wb, wsTM, '팀별 멤버')
    }
  }

  // ── 시트: 점수 내역 (누가·언제·어디서 몇 점 — 점수 하나하나의 출처) ──
  if (scoreLedger && scoreLedger.length) {
    const wsL = XLSX.utils.aoa_to_sheet([
      ['일자', '닉네임', '점수', '출처', '항목', '사유'],
      ...scoreLedger.map(l => [formatKstDate(new Date(l.created_at)), l.nickname, l.point, l.source, l.item, l.reason]),
    ])
    wsL['!cols'] = [{ wch: 11 }, { wch: 14 }, { wch: 7 }, { wch: 7 }, { wch: 24 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, wsL, '점수 내역')
  }

  XLSX.writeFile(wb, `${sanitizeName(program.name)}_종료리포트.xlsx`)
}
