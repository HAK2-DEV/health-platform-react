// 종료 리포트 「목표 대비」 — AI 초안이 저장한 성과 지표(programs.kpis, 마이그 287)를 실제 숫자와 맞춰 본다. 순수 함수(검사 스크립트가 직접 부른다).
//   지표 모양: { label, status: 'auto' | 'setup' | 'outside', done? }  — status 는 엔진(program-draft core.ts measureOf)이 정한 «재는 방법».
//   재는 기준은 엔진이 초안에서 운영자에게 보여 준 문장과 같아야 한다(약속 = 실제):
//     참여율   — 대상 인원(계획서, target_headcount) 중 가입해서 한 번이라도 인증한 비율. 대상 인원이 없으면 가입자 중 비율.
//     주 3일   — 한 주(월~일, KST)에 3일 이상 활동한 적이 있는 사람의 비율 — 불꽃과 같은 기준.
//     끝까지·완주 — 활동일이 기간의 절반 이상인 사람 — 종료 리포트의 완주와 같은 기준(completedCount 를 그대로 받는다).
//     만족도   — 종료 설문의 만족도 문항(문항 글에 「만족」이 있는 척도 문항) 평균. 없으면 «설정 필요».
//     검진 수치 등 도담 밖 기록 — 재지 않는다(outside).
//   목표치는 지표 글에서 읽는다: 「70% 이상」 → 70(%), 「4.0 이상」 → 4.0(점). 읽을 수 없으면 달성 판정 없이 숫자만.

const DAY_MS = 86400000
const kstDate = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
// 'YYYY-MM-DD' → 그 주 월요일 'YYYY-MM-DD'(KST 는 DST 없음 → UTC 자정 기준 계산이 안전)
export const mondayOf = (ds) => {
  const d = new Date(`${ds}T00:00:00Z`)
  const dow = (d.getUTCDay() + 6) % 7   // 0=월
  return new Date(d.getTime() - dow * DAY_MS).toISOString().slice(0, 10)
}

// 지표 글에서 목표치 읽기 — { kind: 'percent' | 'score', value } | null
export function parseTarget(label) {
  // 괄호 안은 설명이지 목표가 아니다 — 「끝까지 함께한 참여자(활동일 50% 이상)」의 50% 는 완주 기준
  const s = String(label || '').replace(/\([^)]*\)/g, ' ')
  const pct = s.match(/(\d+(?:\.\d+)?)\s*%/)
  if (pct) return { kind: 'percent', value: Number(pct[1]) }
  const score = s.match(/(\d(?:\.\d+)?)\s*(점|이상|점 이상)/)
  if (score) return { kind: 'score', value: Number(score[1]) }
  return null
}

// 한 주에 N일 이상 활동한 적이 있는 사람 수 — raw: [{ user_id, submitted_at }]
export function usersWithWeekOf(raw, days = 3) {
  const perUserWeek = new Map()   // user → Map(monday → Set(dates))
  for (const r of raw || []) {
    if (!r?.user_id || !r?.submitted_at) continue
    const ds = kstDate(r.submitted_at)
    const wk = mondayOf(ds)
    const weeks = perUserWeek.get(r.user_id) || new Map()
    const set = weeks.get(wk) || new Set()
    set.add(ds); weeks.set(wk, set); perUserWeek.set(r.user_id, weeks)
  }
  let n = 0
  for (const weeks of perUserWeek.values()) if ([...weeks.values()].some((set) => set.size >= days)) n += 1
  return n
}

// 종료 설문의 만족도 평균 — questions: [{ id, type, q }], responses: [{ user_id, answers }]
export function satisfactionAverage(questions, responses) {
  const q = (questions || []).find((x) => x?.type === 'scale' && /만족/.test(String(x.q || '')))
  if (!q) return { found: false, average: null, count: 0, max: null }
  const vals = (responses || []).map((r) => r?.answers?.[q.id]).filter((v) => typeof v === 'number' && Number.isFinite(v))
  const average = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null
  return { found: true, average, count: vals.length, max: q.max ?? 5 }
}

const pct = (num, den) => (den > 0 ? Math.round((num / den) * 100) : null)

// 지표 하나 → 결과 한 줄
//   { label, status, value(숫자|null), display(글), base(분모 설명), target, achieved: true|false|null, note }
export function computeKpiResults({ kpis, targetHeadcount, totalParticipants, activatedCount, completedCount, raw, endQuestions, endResponses, ended }) {
  const list = Array.isArray(kpis) ? kpis.filter((k) => k && k.label) : []
  if (!list.length) return []
  const target = Number.isFinite(Number(targetHeadcount)) && Number(targetHeadcount) > 0 ? Number(targetHeadcount) : null
  const weekUsers = usersWithWeekOf(raw, 3)
  const sat = satisfactionAverage(endQuestions, endResponses)
  return list.map((k) => {
    const label = String(k.label)
    const t = parseTarget(label)
    const row = { label, status: k.status, value: null, display: '-', base: '', target: t, achieved: null, note: '' }
    const judge = (value, kind) => {
      row.value = value
      if (value == null) { row.display = '-'; return }
      row.display = kind === 'percent' ? `${value}%` : `${value}점`
      if (t && t.kind === kind) row.achieved = value >= t.value
    }
    if (k.status === 'outside' || /검진|혈압|혈당|콜레스테롤|체성분|인바디/.test(label)) {
      row.status = 'outside'
      row.note = '도담 밖 기록이라 여기서 재지 못해요. 기관 보고서에 직접 적어 주세요'
      return row
    }
    if (/만족도/.test(label)) {
      if (!sat.found) { row.status = 'setup'; row.note = '종료 설문에 만족도 문항이 없어서 재지 못했어요'; return row }
      row.status = 'auto'
      judge(sat.average, 'score')
      row.base = sat.count ? `종료 설문 ${sat.count}명 평균(${sat.max}점 만점)` : '종료 설문 응답이 아직 없어요'
      return row
    }
    if (/주\s*3일/.test(label)) {
      row.status = 'auto'
      judge(pct(weekUsers, totalParticipants), 'percent')
      row.base = `${totalParticipants}명 중 ${weekUsers}명 — 한 주에 3일 이상 활동한 적이 있는 사람`
      return row
    }
    if (/끝까지|완주/.test(label)) {
      row.status = 'auto'
      judge(pct(completedCount, totalParticipants), 'percent')
      row.base = `${totalParticipants}명 중 ${completedCount}명 — 활동일이 기간의 절반 이상`
      return row
    }
    if (/참여율/.test(label)) {
      row.status = 'auto'
      const den = target || totalParticipants
      judge(pct(activatedCount, den), 'percent')
      row.base = target ? `대상 ${target}명 중 ${activatedCount}명 — 가입해서 한 번이라도 인증` : `가입 ${totalParticipants}명 중 ${activatedCount}명 — 한 번이라도 인증`
      return row
    }
    row.status = 'setup'
    row.note = '재는 방법이 아직 정해지지 않은 지표예요'
    return row
  }).map((row) => (ended || row.status !== 'auto' ? row : { ...row, note: row.note || '진행 중이라 지금까지의 숫자예요' }))
}
