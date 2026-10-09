/**
 * 🔧 dev 전용 — 「AI와 함께 만들기」 뼈대 와이어프레임 (/dev/ai-builder)
 *   본인 2026-10-09: 뼈대(기본 구조·와이어프레임) → 기능 → 디자인 → 점검 순. 이 화면은 «뼈대»다 — 회색 상자(디자인 전).
 *   10차(기능 단계 1, 2026-10-10): 가짜 초안·검사 → 진짜 엔진(supabase/functions/program-draft/core.ts — 서버와 «같은 파일»).
 *     아는 목표 = 자체 규칙 엔진(이 화면에서 바로, AI 없음) · 처음 보는 목표 = 서버(무료 AI 에 설계도만, 못 하면 기본 틀) ·
 *     계획서 읽기 = 구독 플랜 전용(학습에 쓰이지 않는 유료 AI 로만, 본인 2026-10-09) — 여기선 「구독 중으로 보기」(?sub=1)로 가짜 읽기를 본다.
 *   ⭐ 문화 = 신뢰와 편의(본인 2026-10-09). 묻는 건 적게(읽을 수 있는 건 읽고, 추정할 수 있는 건 추정하고 «어떻게 이해했는지» 말한다),
 *      운영자가 모르는 건 도담이 계산해서 알려 준다(예: 심사 시간), 무엇이 저장·공개되는지 늘 말한다.
 *   결정(본인): 입구 = /programs/new 세 번째 카드 · 합류 = AI 초안을 바로 DRAFT 로 만들어 라이브러리와 같은 편집 자리로.
 *   2차: 톤 = 신뢰감 + 불안하지 않게 · 계획서 받기(기업·보건소 담당자는 계획서를 이미 쓴다) · 군 용어 금지 · 검사 2단(① 도담 안전 → ② 운영 점검).
 *   3차: 「운영 분위기」를 묻고 고른 분위기에 따라 기능을 추천(경쟁형이면 시상대·불꽃).
 *   4차: 「팀형」 · 성장형도 불꽃 · 초안 = «참여자가 볼 상세 화면» 스켈레톤 + 번호 눌러 설명 · 결과 기준 순위는 운영자 계획에 따른다.
 *   5차: 시작 문구 「생각나는 대로 편하게…」 · ⑤ 성과·보고 = 지표마다 «도담이 어떻게 재는지» + 자동 / 한 가지 더 / 도담 밖.
 *   6차: 시작 화면 하나(질문 바로 아래 계획서 올리기) · 목표 「웨이트」 · 생성 중 = 같은 스켈레톤이 생겨나고 단계마다 채워짐.
 *   7·8차: 목표 직접 입력(아는 말은 그 틀로, 모르는 말은 그대로) · 마음 건강 기본값(체크·글, 인증 기본 비공개, 치료 약속 차단, 109 안내 «늘»).
 *   9차: 질문 6칸 손질 — 「운영 여력(하루 몇 분)」 → 「인원(몇 명쯤)」(시간은 묻지 않고 도담이 계산해 보여 준다) · 순서 = 목표 → 대상 → 인원 →
 *     분위기 → 기간 → 인증(인원을 알아야 「하루 약 N분」을 보여 줄 수 있어서 마지막) · 분위기 «추천» 표시 ·
 *     조직(회사·기관·학교) vs 자발적 모임을 대상에서 추정(안 되면 묻고, 추정이면 「아니에요」로 바꿀 수 있게) → 조직이면 마지막에 브랜딩(기관 이름·로고·표지).
 *   기능 단계 1에서 가짜 초안·검사를 엔진으로 바꿨다(계획서 읽기 PLAN_READ 만 가짜 — 유료 키가 붙으면 서버 read_plan 으로),
 *   디자인 단계에서 토큰(DESIGN_SYSTEM.md)을 입힌다. 구조는 여기서 정한 대로 간다.
 *
 *   3층 구조
 *     [화면] 입구 → 시작(계획서 올리기 또는 직접 적기) → (계획서 읽기) → 질문(빈칸만) → 생성 중(스켈레톤이 채워짐) → 초안 → 검사(안전→운영) → 완료(DRAFT)
 *     [서버] program-draft(설계도 → 프리셋 JSON + 안전·운영 검사) — 아는 목표는 같은 엔진을 이 화면에서 바로 돌린다
 *     [생성] createProgramFromPreset(객체) → DRAFT → /programs/new?id=… (라이브러리와 같은 자리)
 *   import.meta.env.DEV 에서만 라우트 등록 → 프로덕션 번들에 없음.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../supabaseClient'
import { QUIZ_AUDIENCES } from '../../lib/quizLibrary'
import { createProgramFromAiDraft } from '../../lib/queries'
// 엔진 — 서버(엣지 함수)와 «같은 파일». 아는 목표는 여기서 바로 돌리고, 처음 보는 목표만 서버(무료 AI)로 보낸다
import * as engine from '../../../supabase/functions/program-draft/core.ts'

// ─── 운영 분위기 → 기능 추천. 실제 프로그램 스위치에 1:1 로 대응한다 ───
//   ranking=ranking_enabled · podium=podium_enabled · flame=flame_enabled(+flame_week_days 3) · team=team_enabled(+team_score_mode) · cheer=community_enabled
//   시상대·팀은 랭킹이 켜져 있어야 동작한다(RankingSettingsModal·ProgramEditModal 규칙 그대로).
//   순위는 기본으로 인증 점수. 결과(몸무게 등)를 반영할지는 운영자 계획에 따른다 — 도담은 막지 않고, 불꽃·주간 스트릭으로
//   결과와 상관없이 꾸준함을 응원한다(본인 2026-10-09). 그래서 불꽃은 세 분위기 모두 켠다.
const FEATURES = [
  { key: 'ranking', label: '랭킹', on: '점수 순위표가 메뉴에 생겨요', off: '순위표 없이 각자 자기 기록만 봐요' },
  { key: 'podium', label: '시상대(1·2·3등)', on: '랭킹 맨 위에 1·2·3등 시상대', off: '시상대 없이 평평한 순위표', needs: 'ranking' },
  { key: 'flame', label: '불꽃', on: '한 주에 3일 활동하면 프로필 사진 뒤에 불꽃이 붙어요', off: '불꽃 표시 없음' },
  { key: 'team', label: '팀', on: '팀을 나눠 팀 순위 · 팀 점수는 평균(인원이 많아도 유리하지 않아요)', off: '개인으로만 참여', needs: 'ranking' },
  { key: 'cheer', label: '응원·커뮤니티', on: '서로 응원하고 인증을 함께 봐요', off: '커뮤니티 없음' },
]
const MOODS = {
  growth: {
    label: '🌱 성장형', sub: '남과 비교하지 않고, 내 기록이 쌓이는 재미',
    features: engine.MOOD_FEATURES.growth,   // 분위기 → 기능·이유·분위기 미션은 엔진이 정한다(단일 출처)
  },
  compete: {
    label: '🏆 경쟁형', sub: '순위와 시상대로 서로 자극하며',
    features: engine.MOOD_FEATURES.compete,
  },
  team: {
    label: '🤝 팀형', sub: '팀을 나눠 함께 점수를 모아요(부서 대항처럼)',
    features: engine.MOOD_FEATURES.team,
  },
}
const moodFeatureLine = (m) => FEATURES.filter((f) => MOODS[m].features[f.key]).map((f) => f.label).join(' · ')
// 분위기 추천 — 앞 답(목표·대상·운영 형태·인원)을 보고 하나만, 이유와 함께(운영자가 몰라도 고를 수 있게). 해당 없으면 추천하지 않는다.
function recommendMood(b) {
  if (b.goal === '마음관리') return { mood: 'growth', why: '마음 건강은 비교 없는 쪽이 편해요' }
  if (b.org === 'org' && b.target === '직원·동료' && (b.headcount || 0) >= 30) return { mood: 'team', why: '부서·팀이 있는 곳이라 팀형도 잘 맞아요' }
  if (b.target === '친구·모임') return { mood: 'compete', why: '친구끼리는 가벼운 경쟁이 재미를 더해요' }
  if (b.target === '가족') return { mood: 'growth', why: '가족끼리는 비교보다 응원이 잘 맞아요' }
  if (b.target === '주민' || b.target === '학생') return { mood: 'growth', why: '처음 하는 분이 많아 비교 부담이 적은 쪽이 편해요' }
  return null
}

// ─── 설계도(blueprint) — 계획서·카드 질문·첫 문장이 «같은 객체»를 채운다. 빈칸만 묻는다 ───
//   순서(본인 2026-10-09): 목표(무엇을) → 대상(누구와) → [운영 형태] → 인원(몇 명) → 분위기 → 기간 → 인증 → 참여 방법 → [브랜딩]
//     · 참여 방법(본인 2026-10-10): 마법사 3단계(공개 여부·참여 승인·정원)를 여기로 옮겼다 — 편집 화면은 1단계(이름·기간 확인) 뒤 바로 요약·게시.
//       질문은 하나(공개 여부와 승인을 한 번에), 정원은 묻지 않고 최대값(베타 100명), 둘러보기·입장 질문은 기본값 — 모두 설정에서 바꿀 수 있다.
//     · 목표가 먼저 — 프로그램의 정체이고 시작 질문 「어떤 프로그램을」과 이어진다. 분위기·기간이 목표에 기댄다.
//     · 분위기는 목표·대상·인원을 안 뒤 — 그래야 «추천»을 붙일 수 있다.
//     · 인증은 끝 — 인원을 알아야 「운영자가 확인하면 하루 약 N분」을 계산해 보여 줄 수 있다(운영자에게 시간을 묻지 않는다).
//     · [운영 형태] 는 대상에서 추정되면 묻지 않는다(직원·학생·주민·회원 → 기관 / 가족·친구 → 자발적 모임). [브랜딩] 은 기관일 때만.
//   대상 선택지는 중립어만(본인: 「부대원」 같은 군 용어 금지). 목표 「웨이트」는 앱 카테고리 「운동」(WALKING)으로.
const FIELDS = [
  { key: 'goal', label: '목표', q: '무엇을 꾸준히 하게 하고 싶나요?', options: ['걷기', '달리기', '웨이트', '금연', '식단', '스트레칭', '수면'], direct: '직접 입력 — 예) 명상, 정신건강, 독서' },
  { key: 'target', label: '대상', q: '누구와 함께하나요?', options: ['직원·동료', '회원·고객', '가족', '친구·모임', '학생', '주민'], direct: '직접 입력 — 예) 어르신, 신입사원' },
  { key: 'org', label: '운영 형태', q: '어디서 운영하시나요?', options: [['회사·기관·학교에서', 'org'], ['친구·가족·동호회끼리', 'casual']], hint: '기관에서 운영하시면 마지막에 기관 이름과 로고를 넣을 수 있어요' },
  { key: 'headcount', label: '인원', q: '몇 명쯤 함께하나요?', options: [['10명 안팎', 10], ['30명 안팎', 30], ['100명 안팎', 100], ['그 이상', 300]], hint: '대략이어도 괜찮아요. 심사에 드는 시간을 계산할 때 써요', direct: '직접 입력 — 예) 45명' },
  { key: 'mood', label: '분위기', q: '어떤 분위기로 운영할까요?', cards: true, options: ['growth', 'compete', 'team'], hint: '고르신 분위기에 맞춰 기능을 켜 드려요. 나중에 프로그램 설정에서 언제든 바꿀 수 있어요',
    // 금연은 묻지 않는다 — 도담 금연 프로그램은 순위·팀 대신 「내 변화」와 불꽃으로 응원한다(마법사 2단계도 순위·팀을 끈다. 리뷰 2026-10-10)
    when: (b) => b.goal !== '금연', whenLabel: '금연이 아닐 때만' },
  { key: 'durationDays', label: '기간', q: '얼마나 길게 할까요?', options: [['2주', 14], ['4주', 28], ['8주', 56]], hint: '습관은 3주쯤부터 자리 잡아요', direct: '직접 입력 — 예) 6주, 45일, 한 달' },
  { key: 'mode', label: '인증', q: '인증은 누가 확인할까요?', options: [['자동 승인 — 올리면 바로 인정', 'AUTO'], ['운영자가 확인 — 심사 뒤 인정', 'MANUAL']] },
  { key: 'join', label: '참여 방법', q: '참여자는 어떻게 들어오나요?', options: engine.JOINS.map((j) => [engine.JOIN_LABEL[j], j]), hint: `정원은 지금(베타) 프로그램 하나에 ${engine.PARTICIPANT_MAX}명까지예요. 공개 여부·승인·정원은 만든 뒤 프로그램 설정에서도 바꿀 수 있어요` },
  { key: 'brand', label: '브랜딩', q: '기관 이름과 로고를 넣을까요?', custom: 'brand', when: (b) => b.org === 'org', whenLabel: '기관일 때만' },
]
const applies = (f, b) => !f.when || f.when(b)
const ORG_OF_TARGET = { '직원·동료': 'org', '회원·고객': 'org', '학생': 'org', '주민': 'org', '가족': 'casual', '친구·모임': 'casual' }
// 대상에서 운영 형태를 추정(이미 정해졌으면 건드리지 않는다). 추정한 건 orgInferred — 화면에 「…로 이해했어요 · 아니에요」
function withInferred(b) {
  if (b.org == null && ORG_OF_TARGET[b.target]) return { ...b, org: ORG_OF_TARGET[b.target], orgInferred: true }
  return b
}
const SKIP_DEFAULT = { goal: '—', target: '—', org: 'casual', headcount: 30, mood: 'growth', durationDays: 28, mode: 'MANUAL', join: 'invite', brand: 'later' }
const fieldValue = (key, v) => (v == null ? null
  : key === 'mood' ? MOODS[v]?.label
    : key === 'durationDays' ? `${v}일`
      : key === 'mode' ? (v === 'AUTO' ? '자동 승인' : '운영자 심사')
        : key === 'headcount' ? `약 ${v}명`
          : key === 'org' ? (v === 'org' ? '기관·회사 운영' : '자발적 모임')
            : key === 'join' ? engine.JOIN_LABEL[v]
              : key === 'brand' ? (v === 'later' ? '나중에' : `${v.orgName}${v.logo ? ' · 로고' : ''}${v.cover ? ' · 표지' : ''}`) : v)
const EMPTY = { source: null, target: null, goal: null, goalRaw: null, goalNote: null, org: null, orgInferred: false, headcount: null, mood: null, durationDays: null, mode: null, join: null, brand: null, orgNameHint: null, kpi: null, freeText: '', planName: null }

// ─── 목표 «직접 입력»(본인 2026-10-09 질문: 「명상」「정신건강」을 적으면?) ───
//   ⚠️ 전엔 목록에 없는 목표가 조용히 스트레칭 미션으로 바뀌었다 — 적은 것과 다른 프로그램이 나오는, 신뢰를 가장 깎는 실수.
//   이제: 아는 말이면 그 틀로(명상·정신건강·스트레스 → 마음관리), 모르는 말이면 «적은 그대로» AI 가 처음부터 짠다(카테고리 기타).
//   말 사전·읽기는 엔진(core.ts GOAL_ALIASES·normalizeGoal) — 서버도 같은 사전으로 한 번 더 읽는다(마음 건강 판별, 리뷰 2026-10-10:
//   예전 사전은 「자살예방」「심리」「번아웃」을 놓치고 「마음 맞는 동료」를 마음 건강으로 읽었다). 카테고리도 엔진(CATEGORY_OF)이 정한다.
const { GOAL_ALIASES, normalizeGoal } = engine
// 칩 밖의 답 읽기 — 못 읽으면 null(그대로 둔다)
function parseDirect(key, t) {
  if (key === 'durationDays') {
    const w = t.match(/(\d+)\s*주/); const d = t.match(/(\d+)\s*일/); const n = t.match(/^(\d+)$/)
    if (w) return Number(w[1]) * 7
    if (d) return Number(d[1])
    if (/한\s*달/.test(t)) return 30
    if (/두\s*달/.test(t)) return 60
    return n ? Number(n[1]) : null
  }
  if (key === 'headcount') { const m = t.match(/(\d+)/); return m ? Number(m[1]) : null }
  return t   // 대상 — 적은 그대로
}

// 예시 칩 — 누르면 입력칸이 채워지고, 거기서 읽히는 칸은 묻지 않는다
const EXAMPLES = [
  { text: '직장 동료들과 4주 걷기' },
  { text: '친구들과 달리기 8주 랭킹 대결' },
  { text: '가족 아침 스트레칭' },
]
// 첫 문장에서 읽을 수 있는 것만 읽는다(가짜 — 기능 단계에선 서버가 한다)
function parseFreeText(t) {
  const out = {}
  const w = t.match(/(\d+)\s*주/); const d = t.match(/(\d+)\s*일/)
  if (w) out.durationDays = Number(w[1]) * 7; else if (d) out.durationDays = Number(d[1])
  const hc = t.match(/(\d+)\s*명/); if (hc) out.headcount = Number(hc[1])
  // 목표 — 아는 말만 읽는다(모르는 말은 질문에서 직접 받는다). 「정신건강」처럼 이름이 다르면 어떻게 이해했는지 한 줄 남긴다
  for (const [re, g] of GOAL_ALIASES) {
    if (!re.test(t)) continue
    // 맞은 글자만이 아니라 «낱말 전체»(「정신」이 아니라 「정신건강」), 끝 조사는 뗀다
    const word = (t.split(/\s+/).find((x) => re.test(x)) || '').replace(/(으로|을|를|이|가|은|는|과|와|로|도|에)$/, '')
    out.goal = g
    if (word && !g.includes(word) && !word.includes(g)) { out.goalRaw = word; out.goalNote = `「${word}」 — ${g} 프로그램으로 짤게요` }
    break
  }
  for (const [k, v] of [['직원', '직원·동료'], ['직장', '직원·동료'], ['동료', '직원·동료'], ['회원', '회원·고객'], ['고객', '회원·고객'], ['가족', '가족'], ['친구', '친구·모임'], ['모임', '친구·모임'], ['학생', '학생'], ['주민', '주민']]) if (t.includes(k)) { out.target = v; break }
  if (/경쟁|대결|대항|랭킹|순위/.test(t)) out.mood = 'compete'
  else if (/팀|부서/.test(t)) out.mood = 'team'
  return out
}

// ─── 계획서 경로(가짜) — 무거운 운영자(기업·보건소)가 올린 계획서에서 읽은 것. 성과 지표(KPI)까지 ───
//   분위기(mood)는 계획서에 보통 없다 → 비워 두고 묻는다. 기관 이름은 읽어 두고 브랜딩 질문에서 «확인»만 받는다.
//   ⚠️ 기관 이름은 가상(실제 기관·회사 이름을 쓰지 않는다).
const PLAN_FILE = '2026 하반기 임직원 걷기 프로그램 계획서.pdf'
const PLAN_READ = {
  source: 'plan', planName: PLAN_FILE,
  target: '직원·동료', goal: '걷기', mood: null, durationDays: 56, mode: 'MANUAL',
  org: 'org', orgNameHint: '새봄기획(주)',
  headcount: 200,   // 대상 인원 — 참여율의 분모이자 심사 시간 계산의 바탕. 도담은 «가입한 사람»만 알고 «대상 전체»는 모른다 → 계획서에서 읽는다
  // 마지막 지표는 도담 밖 기록(검진) — «못 재는 것도 솔직하게» 보여 주는 예시
  kpi: ['참여율 70% 이상', '주 3일 이상 활동한 참여자 50%', '종료 설문 만족도 4.0 이상', '건강검진 수치(혈압·혈당) 개선'],
  missionHints: ['하루 8,000보', '점심 산책 15분', '주말 함께 걷기'],
  // 계획서에 있던 문장 — 효과를 «보장»하는 표현이라 안전 검사에 걸린다(가짜 예시). 감량 «목표» 자체는 문제 아님.
  riskyClaim: '8주 후 체중 3kg 감량 보장',
}

// ─── 엔진 연결(기능 단계 1, 2026-10-10) — 가짜 초안·검사(fakeDraft·fakeChecks)를 걷어 내고 진짜 엔진을 쓴다 ───
//   화면의 설계도(bp) → 엔진 설계도. 건너뛴 목표는 「건강 습관」으로(조용히 다른 목표로 바꾸지 않는다 — 7차 교훈).
//   계획서 예시(구독, 가짜 읽기)의 효과 약속 문장(riskyClaim)은 claims 로 넘겨 안전 검사가 잡게 한다.
function toCoreBp(b) {
  const skipped = !b.goal || b.goal === '—'
  return {
    goal: skipped ? '건강 습관' : b.goal,
    goalRaw: skipped ? '건강 습관' : (b.goalRaw || null),
    target: b.target && b.target !== '—' ? b.target : null,
    org: b.org || null,
    headcount: b.headcount || null,
    mood: b.mood || null,
    durationDays: b.durationDays || null,
    mode: b.mode || null,
    freeText: b.freeText || null,
    orgName: b.org === 'org' && b.brand && b.brand !== 'later' ? b.brand.orgName : null,
    kpi: b.kpi || null,
    missionHints: b.missionHints || null,
    claims: b.riskyClaim ? [b.riskyClaim] : null,
    source: b.source === 'plan' ? 'plan' : 'text',
    join: b.join || null,
  }
}
// 이 화면에서 바로(서버 없이) — 아는 목표는 규칙 엔진. 계획서 예시도 미션은 규칙 엔진으로 짠다
//   (실제 구독에선 유료 AI 가 계획서의 미션 후보를 살린다. 성과 지표·효과 약속 검사는 계획서 그대로 쓴다).
function localDraft(b) {
  const cbp = toCoreBp(b)
  return { bp: cbp, draft: engine.finalizeDraft(engine.ruleDraft(cbp), cbp, 'rules') }
}
// 생성 — 아는 목표: 규칙 엔진(즉시). 처음 보는 목표: 서버(무료 AI 에 설계도만).
//   로그인 안 했거나 AI 가 답하지 못하면 기본 틀(서버와 같은 규칙) — 실패 화면 대신 「다듬어 주세요」.
async function makeDraft(b) {
  const cbp = toCoreBp(b)
  if (engine.KNOWN_GOALS.includes(cbp.goal)) return localDraft(b)
  const t0 = Date.now()
  try {
    const { data, error } = await supabase.functions.invoke('program-draft', { body: { action: 'draft', blueprint: cbp } })
    // reason — 서버가 AI 대신 기본 틀을 준 까닭(ai_locked: 출시 전 관리자만 · ai_failed: AI 가 답하지 못함)
    if (!error && data?.draft) return { bp: cbp, draft: { ...data.draft, reason: data.reason || null }, ms: Date.now() - t0, attempts: data.attempts || [] }
  } catch { /* 아래 기본 틀 */ }
  return { bp: cbp, draft: engine.finalizeDraft(engine.fallbackModel(cbp), cbp, 'fallback'), ms: Date.now() - t0, attempts: ['서버 응답 없음 → 기본 틀'] }
}
// StrictMode(dev)는 effect 를 두 번 돌린다 — 같은 설계도의 요청이 날아가는 중이면 그 요청을 같이 기다린다(AI 를 두 번 부르지 않게)
const inflight = new Map()
function makeDraftOnce(b) {
  const k = JSON.stringify(toCoreBp(b))
  if (!inflight.has(k)) inflight.set(k, makeDraft(b).finally(() => setTimeout(() => inflight.delete(k), 0)))
  return inflight.get(k)
}
// 엔진 종류는 설계도만 보고 정해진다 — 생성 중 화면이 «지금 무엇을 하는지» 미리 말할 수 있게
const engineOf = (b) => (engine.KNOWN_GOALS.includes(toCoreBp(b).goal) ? 'rules' : 'ai')
// 초안 위에 «누가 짰는지»를 한 줄로(신뢰 — AI 가 짰으면 꼭 봐 달라고 말한다)
const ENGINE_NOTE = {
  rules: '✓ 검수된 미션 목록에서 대상·분위기에 맞춰 골랐어요',
  ai: '✨ AI가 처음부터 짠 초안이에요 · 미션을 꼭 한 번 봐 주세요',
  fallback: '⚠ 지금은 AI 초안을 쓸 수 없어 기본 틀로 짰어요 · 미션 이름과 설명을 다듬어 주세요',
  locked: '🔒 AI 초안은 출시 전이라 관리자 계정만 써요 · 기본 틀로 짰어요(미션을 다듬어 주세요)',
}
// 전용 홈 — 금연·달리기는 참여자에게 표준 카드홈이 아니라 전용 홈으로 보인다(마법사 2단계가 카테고리로 테마를 정한다)
const HOME_NOTE = {
  QUIT_SMOKING: '🚭 금연 프로그램은 참여자에게 금연 전용 홈(아낀 담배·절약 금액·「내 변화」)으로 보여요. 아래 그림은 들어갈 내용을 보여 드리는 거예요.',
  RUNNING: '🏃 달리기 프로그램은 참여자에게 달리기 전용 홈(누적 거리·시간)으로 보여요. 아래 그림은 들어갈 내용을 보여 드리는 거예요.',
}
// 퀴즈에 들어갈 문항 수 — 만들 때 바로 채점되는 문항만 넣는다(주관식 운영자 채점 문항 제외, createProgramFromPreset quizAutoGradedOnly)
const quizAutoCount = (q) => (QUIZ_AUDIENCES.find((a) => a.key === q.audienceKey)?.topics.find((t) => t.key === q.topicKey)?.questions || [])
  .filter((x) => !(x.type === 'SHORT' && (x.grading_mode || 'MANUAL') !== 'AUTO')).length
// 퀴즈 주제 키 → 이름(검수된 퀴즈 라이브러리)
const quizTopicLabel = (q) => QUIZ_AUDIENCES.find((a) => a.key === q.audienceKey)?.topics.find((t) => t.key === q.topicKey)?.title || q.topicKey

// 엔진 초안 → 화면 모양. 화면 부품(스켈레톤·시트)은 뼈대 그대로 두고 여기서만 맞춘다
function toView(d, b) {
  return {
    name: d.nameSuggestion, description: d.description,
    target: d.target, headcount: d.headcount, durationDays: d.durationDays, mode: d.mode,
    org: d.org, brand: b.org === 'org' && b.brand && b.brand !== 'later' ? b.brand : null,   // 로고·표지를 올렸는지는 화면 쪽 값
    goal: d.goal, custom: d.custom, category: d.categoryLabel,
    feedVisibility: d.certFeedVisibility, crisisLine: d.crisisLine, join: d.join || null,
    mood: d.mood, features: d.features,
    missions: d.missions.map((m) => ({ title: m.title, instruction: m.instruction, days: m.display.days, proof: m.display.proof, manual: m.verification_type === 'MANUAL', fromMood: m.fromMood, aligned: m.aligned })),
    quiz: { topic: quizTopicLabel(d.quiz), count: quizAutoCount(d.quiz) },
    kpi: d.kpi,
    why: d.why, engine: d.engine, reason: d.reason || null, checks: d.checks, reviewMinutes: d.reviewMinutesPerDay,
    manualCount: d.manualCount ?? d.missions.filter((m) => m.verification_type === 'MANUAL').length, homeTheme: d.homeTheme || null,
  }
}
// 옆 메모용 — 엔진 출력에서 볼 것만
const slimDraft = (d) => ({
  engine: d.engine, name: d.nameSuggestion, description: d.description, category: d.category, org: d.org, brand: d.brand,
  cert_feed_visibility: d.certFeedVisibility, crisis_line: d.crisisLine ? '109 안내(늘)' : null,
  headcount: d.headcount, durationDays: d.durationDays, mode: d.mode, review_min_per_day: d.reviewMinutesPerDay,
  missions: d.missions.map((m) => `${m.title} · ${m.display.days} · ${m.display.proof} · ${m.verification_type}${m.aligned ? ' · 맞춤' : ''}`),
  quiz: d.quiz, features: d.features, team_score_mode: d.teamScoreMode,
  kpi: d.kpi.map((k) => `${k.label} → ${k.status}`),
})
// 성과 지표 — 엔진이 지표마다 «어떻게 재는지»를 정한다(auto 자동 / setup 한 가지 더 / outside 도담 밖). 「한 가지 더」를 하면 done
//   ⚠️ 지금 앱: 종료 리포트 + 엑셀은 있다. «목표 대비» 카드 · 주 3일 활동 비율 · 만족도 문항 자동 추가 · 대상 인원 저장은 기능 단계 2.
const kpiMeasures = (d) => d.kpi.map((m) => ({ k: m.label, how: m.how, setup: m.setup, need: m.need, done: !!m.done, state: m.status }))

// 심사 시간 — 운영자에게 묻지 않고 도담이 계산해서 알려 준다(본인 2026-10-09). 초안은 엔진이 실제 미션으로 계산하고,
//   질문 단계(미션을 짜기 전)는 «매일 올리는 심사 미션 하나» 기준 어림. 가정은 엔진과 같다(1건 20초 · 하루 절반)
const reviewEstimate = (headcount) => Math.max(1, Math.ceil((headcount || 0) * engine.ACTIVE_RATE * engine.REVIEW_SEC / 60))

// 「미션 추가」(초안 다듬기 예시) — 엔진 미션 모양 그대로
const ADDED_MISSION = {
  key: 'added', title: '물 2L 마시기', instruction: '오늘 물 2L를 마셨다면 눌러요.', icon: 'water.png', point: 5,
  verification_type: 'AUTO', verify_style: 'standard', requires_image: false, requires_numeric: false, requires_note: true,
  image_required: true, numeric_required: true, note_required: false, metrics: [], schedule_mode: 'ALL_DAYS', active_days: [], daily_limit: 1,
  // 「누르기만」 — 입력별 점수 없이 미션 점수 하나(single_point). 입력별로 두면 글 없이 누를 때 0점이 된다(리뷰 2026-10-10)
  single_point: true, image_point: null, numeric_point: null, note_point: null, metric_aggregate: false,
  fromMood: false, display: { days: '매일', proof: '누르기만(글은 선택)' }, aligned: false,
}

const STATES = ['입구', '시작', '계획서 읽기', '질문', '생성 중', '초안', '검사', '완료']
// 생성 중 단계 — 단계 하나가 끝날 때마다 스켈레톤의 한 층이 채워진다(1=이름·기간, 2=미션, 3=꾸준함·메뉴, 4=검사 끝)
const GEN_STEPS = ['설계도 읽는 중', '미션 짜는 중', '분위기에 맞춰 기능 고르는 중', '안전·운영 검사 중', '다 됐어요']
// ?state=5 이상으로 바로 열면(사진·검토용) 초안이 없다 → 계획서 예시 + 경쟁형 + 브랜딩으로 채운다(안전 검사 «걸리는» 경우까지 보이게)
const EXAMPLE_BP = { ...EMPTY, ...PLAN_READ, mood: 'compete', join: 'invite', brand: { orgName: '새봄기획(주)', logo: true, cover: false }, freeText: '' }

// ─── 와이어프레임 부품 — 회색 상자만. 색·아이콘은 디자인 단계에서 ───
const Box = ({ children, className = '', dashed = false, onClick }) => (
  <div onClick={onClick} className={`rounded-xl border ${dashed ? 'border-dashed border-gray-400' : 'border-gray-300'} bg-white px-3 py-3 ${onClick ? 'cursor-pointer hover:bg-gray-50' : ''} ${className}`}>{children}</div>
)
const Chip = ({ children, active = false, onClick }) => (
  <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1.5 text-[13px] ${active ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-400 bg-white text-gray-700'}`}>{children}</button>
)
const Btn = ({ children, onClick, primary = false, disabled = false }) => (
  <button type="button" onClick={onClick} disabled={disabled} className={`w-full rounded-xl py-3 text-[15px] font-bold ${primary ? 'bg-gray-800 text-white' : 'border border-gray-400 bg-white text-gray-700'} disabled:opacity-40`}>{children}</button>
)
// 안심 한 줄 — 톤의 핵심(본인: 신뢰감 + 불안하지 않게). 매 화면 아래에 «지금 무슨 일이 일어나고 무엇이 안 일어나는지».
const Calm = ({ children }) => <p className="rounded-lg bg-gray-100 px-3 py-2 text-[12px] leading-snug text-gray-600">🔒 {children}</p>
const FeatureRow = ({ f, on, onClick, flashing = false }) => (
  <button type="button" onClick={onClick} className={`flex w-full items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-left ${flashing ? 'bg-yellow-50' : ''}`}>
    <span className={`mt-0.5 flex h-4 w-7 flex-shrink-0 items-center rounded-full px-0.5 ${on ? 'justify-end bg-gray-800' : 'justify-start bg-gray-300'}`}><span className="h-3 w-3 rounded-full bg-white" /></span>
    <span className="min-w-0">
      <span className={`block text-[13px] font-bold ${on ? 'text-gray-800' : 'text-gray-400'}`}>{f.label}</span>
      <span className="block text-[11px] leading-snug text-gray-500">{on ? f.on : f.off}</span>
    </span>
  </button>
)
// 스켈레톤의 한 자리 — 초안에선 번호를 달고 누르면 시트(tag·onClick), 생성 중엔 그냥 화면. inside 면 번호를 안쪽 위(잘리는 자리용)
const Region = ({ tag, onClick, className = '', style, inside = false, children }) => (
  <div role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} onClick={onClick} style={style}
    className={`relative ${onClick ? 'cursor-pointer outline-none transition hover:ring-2 hover:ring-gray-800' : ''} ${className}`}>
    {children}
    {tag && <span className={`pointer-events-none absolute z-[1] rounded-full bg-gray-800 px-1.5 py-0.5 text-[9px] font-bold text-white ${inside ? 'left-2 top-2' : '-top-2 right-1.5'}`}>{tag}</span>}
  </div>
)
// 아직 채워지지 않은 자리 — 회색 막대가 숨 쉬듯 깜빡인다
const Bar = ({ className = '' }) => <span className={`block animate-pulse rounded ${className.includes('bg-') ? '' : 'bg-gray-200'} ${className}`} />
// 자리가 «생겨나는» 순서 — 위에서 아래로 차례로(생성 중에만. 초안에선 initial=false 라 움직이지 않는다)
const Appear = ({ i, building, children }) => (
  <motion.div initial={building ? { opacity: 0, y: 10 } : false} animate={{ opacity: 1, y: 0 }} transition={{ delay: building ? i * 0.12 : 0, duration: 0.3, ease: 'easeOut' }}>{children}</motion.div>
)
// 자리가 «채워지는» 순간 — 회색 막대 대신 내용이 살짝 떠오르며 나타난다(생성 중에만)
const Fade = ({ building, className = '', children }) => (
  <motion.div className={className} initial={building ? { opacity: 0, y: 4 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>{children}</motion.div>
)
// 폰 프레임 안에서 아래로 올라오는 시트
const Sheet = ({ title, onClose, footer, children }) => (
  <div className="absolute inset-0 z-20 flex flex-col justify-end">
    <div className="absolute inset-0 bg-black/30" onClick={onClose} />
    <div className="relative max-h-[78%] overflow-y-auto rounded-t-2xl bg-white px-4 pb-4 pt-3 shadow-xl">
      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-300" />
      <p className="mb-1.5 text-[16px] font-extrabold">{title}</p>
      {children}
      <div className="mt-3">{footer || <Btn onClick={onClose}>확인</Btn>}</div>
    </div>
  </div>
)

// ─── 참여자가 볼 프로그램 상세 화면(표준 카드홈) 스켈레톤 — 생성 중과 초안이 «같은 틀»을 쓴다 ───
//   배치는 실제 카드홈 순서(표지 → 오늘 할 일 → 내 활동 → 공지 → 목표·주간 스트릭 → 메뉴 → 배너).
//   level: 0=빈 틀만 / 1=이름·기간 / 2=오늘 할 일·내 활동·공지 / 3=목표·꾸준함·메뉴 (초안은 전부 채운 9).
//   building: 생성 중 — 자리가 위에서부터 생겨나고, level 이 오를 때마다 그 층이 채워진다. 끝나면 같은 자리 그대로 초안이 된다.
//   onOpen: 초안 — 번호 붙은 자리를 누르면 시트.
//   브랜딩(기관일 때) — 표지에 기관 로고·이름, 「운영 ○○」. 도담 이름은 나오지 않는다(무대 앞엔 기관, 도담은 뒤).
function ProgramSkeleton({ draft, level = 9, building = false, onOpen = null, flash = null }) {
  const f = draft.features
  const brand = draft.brand
  const weeks = Math.max(1, Math.round(draft.durationDays / 7))
  const menu = ['미션', '퀴즈', f.cheer && '커뮤니티', f.ranking && (f.team ? '랭킹·팀' : '랭킹')].filter(Boolean)
  const first = draft.missions[0]
  const R = (tag, key) => (onOpen ? { tag, onClick: () => onOpen(key) } : {})
  return (
    <div className="mx-3 mt-2.5 overflow-hidden rounded-2xl border border-gray-300 bg-[#fdfbf7]">
      <Appear i={0} building={building}>
        <Region inside {...R('① 이름·기간', 'basic')} className={`h-[112px] bg-gradient-to-br ${brand?.logo ? 'from-gray-400 to-gray-300' : 'from-gray-300 to-gray-200'}`}>
          <div className="absolute bottom-2.5 left-3 right-3">
            {level >= 1 ? (
              <Fade building={building}>
                <div className="flex items-center gap-1.5">
                  {brand?.logo && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[6px] font-bold text-gray-500">로고</span>}
                  <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-bold text-gray-700">{brand?.orgName || '시작 전'}</span>
                </div>
                <p className={`mt-1 line-clamp-2 text-[14px] font-extrabold leading-tight text-gray-800 ${flash === 'minus-week' || flash === 'plus-week' ? 'bg-yellow-50' : ''}`}>{draft.name}</p>
                <p className="mt-0.5 text-[10px] text-gray-600">{weeks}주 여정 · 운영 {brand?.orgName || '나'}</p>
              </Fade>
            ) : (
              <><Bar className="h-3 w-10 bg-white/60" /><Bar className="mt-2 h-4 w-48 bg-white/60" /><Bar className="mt-1.5 h-2.5 w-20 bg-white/60" /></>
            )}
          </div>
        </Region>
      </Appear>
      <div className="space-y-2 p-2 pt-3">
        <Appear i={1} building={building}>
          <Region {...R(`② 미션 ${draft.missions.length}개`, 'missions')} className="rounded-xl border border-gray-300 bg-white p-2">
            {level >= 2 ? (
              <Fade building={building}>
                <div className="flex items-center gap-1.5"><span className="text-[11px] font-extrabold">오늘 할 일</span><span className="rounded-full bg-gray-100 px-1.5 text-[9px] font-bold text-gray-600">{Math.min(3, draft.missions.length)}건</span></div>
                {first && (
                  <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-gray-50 p-1.5">
                    <span className="h-6 w-6 flex-shrink-0 rounded-md bg-gray-300" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-bold">{first.title}</p>
                      <div className="mt-1 flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-gray-700" /><span className="h-0.5 flex-1 rounded bg-gray-200" /><span className="h-1 w-1 rounded-full bg-gray-300" /><span className="h-0.5 flex-1 rounded bg-gray-200" /><span className="h-1 w-1 rounded-full bg-gray-300" /></div>
                    </div>
                    <span className="flex-shrink-0 rounded-full bg-gray-700 px-2 py-0.5 text-[9px] font-bold text-white">인증</span>
                  </div>
                )}
              </Fade>
            ) : (
              <>
                <Bar className="h-3 w-16" />
                <div className="mt-1.5 flex items-center gap-2 rounded-lg bg-gray-50 p-1.5">
                  <Bar className="h-6 w-6 flex-shrink-0" />
                  <div className="min-w-0 flex-1"><Bar className="h-2.5 w-28" /><Bar className="mt-1.5 h-1 w-full" /></div>
                  <Bar className="h-4 w-9 flex-shrink-0 rounded-full" />
                </div>
              </>
            )}
          </Region>
        </Appear>
        <Appear i={2} building={building}>
          <div className="flex h-7 items-center rounded-lg border border-gray-200 bg-white px-2 text-[10px] font-bold text-gray-500">{level >= 2 ? <Fade building={building}>내 활동</Fade> : <Bar className="h-2.5 w-12" />}</div>
        </Appear>
        <Appear i={3} building={building}>
          <div className="flex h-7 items-center rounded-lg border border-gray-200 bg-white px-2 text-[10px] font-bold text-gray-500">{level >= 2 ? <Fade building={building}>공지사항</Fade> : <Bar className="h-2.5 w-14" />}</div>
        </Appear>
        <Appear i={4} building={building}>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-[54px] rounded-lg border border-gray-200 bg-white p-1.5">
              {level >= 3
                ? <Fade building={building}><p className="text-[9px] font-bold text-gray-500">오늘의 목표</p><div className="mt-1.5 h-2 w-12 rounded bg-gray-200" /></Fade>
                : <><Bar className="h-2.5 w-14" /><Bar className="mt-2 h-2 w-10" /></>}
            </div>
            <Region {...R('③ 꾸준함', 'streak')} className={`h-[54px] rounded-lg border border-gray-300 bg-white p-1.5 ${flash === 'f-flame' ? 'bg-yellow-50' : ''}`}>
              {level >= 3 ? (
                <Fade building={building}>
                  <p className="text-[9px] font-bold text-gray-600">주간 스트릭{f.flame ? ' 🔥' : ''}</p>
                  <div className="mt-1.5 flex gap-0.5">{[0, 1, 2, 3, 4, 5, 6].map((i) => <span key={i} className={`h-3 w-3 rounded-full ${i < 3 ? 'bg-gray-500' : 'bg-gray-200'}`} />)}</div>
                </Fade>
              ) : (
                <><Bar className="h-2.5 w-14" /><div className="mt-2 flex gap-0.5">{[0, 1, 2, 3, 4, 5, 6].map((i) => <Bar key={i} className="h-3 w-3 rounded-full" />)}</div></>
              )}
            </Region>
          </div>
        </Appear>
        <Appear i={5} building={building}>
          {level >= 3 ? (
            <Region {...R('④ 메뉴·분위기', 'menu')} className="grid gap-1.5 rounded-lg" style={{ gridTemplateColumns: `repeat(${menu.length}, minmax(0, 1fr))` }}>
              {menu.map((c) => (
                <Fade key={c} building={building} className="flex h-[48px] flex-col items-center justify-center rounded-lg border border-gray-200 bg-white">
                  <span className="h-4 w-4 rounded bg-gray-300" /><span className="mt-1 text-[9px] font-bold text-gray-600">{c}</span>
                </Fade>
              ))}
            </Region>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 1, 2, 3].map((i) => <div key={i} className="flex h-[48px] flex-col items-center justify-center rounded-lg border border-gray-200 bg-white"><Bar className="h-4 w-4" /><Bar className="mt-1.5 h-2 w-8" /></div>)}
            </div>
          )}
        </Appear>
        <Appear i={6} building={building}><div className="h-6 rounded-lg bg-gray-100" /></Appear>
      </div>
    </div>
  )
}

// ─── 초안 = 위 스켈레톤(다 채운 것) + 번호 눌러 설명 ───
//   본인 2026-10-09: 아래로 긴 목록 대신 «완성될 화면» 그대로 보여 주고, 번호를 누르면 그 자리의 내용·이유·바꾸기. 바꾸면 스켈레톤도 즉시 바뀐다.
function DraftPreview({ draft, isPlan, flash, onTweak, onToggleFeature, onKpiSetup, onMake }) {
  const [sheet, setSheet] = useState(null)
  const close = () => setSheet(null)
  const f = draft.features
  const weeks = Math.max(1, Math.round(draft.durationDays / 7))
  const kpiM = kpiMeasures(draft)
  const kpiAuto = kpiM.filter((m) => m.state === 'auto').length
  const rm = draft.reviewMinutes
  const basicRows = [
    ['이름', draft.name],
    ...(draft.org === 'org' ? [['운영 기관', draft.brand?.orgName || '아직 없어요 · 편집 화면에서 넣을 수 있어요'], ['표지', draft.brand?.cover ? '올린 사진' : draft.brand?.logo ? '로고 색으로 맞춘 기본 표지' : '카테고리 기본 표지']] : []),
    ['대상', `${draft.target} · 약 ${draft.headcount}명`],
    ['카테고리', draft.category],
    ['기간', `${draft.durationDays}일 (${weeks}주)`],
    ['인증', draft.mode === 'AUTO' ? '자동 승인' : draft.manualCount ? `운영자 심사 · 심사 미션 ${draft.manualCount}개` : '운영자 심사 · 지금 미션은 볼 것이 없어 바로 인정돼요'],
    ['예상 심사 시간', draft.mode === 'AUTO' ? '거의 없어요(자동 승인)' : `많은 날 하루 약 ${rm}분`],
    ['참여 방법', engine.JOIN_LABEL[draft.join?.mode] || '-'],
    ['정원', `${draft.join?.maxParticipants ?? engine.PARTICIPANT_MAX}명 · 참여 전 둘러보기 꺼짐`],
  ]
  return (
    <div className="relative -mx-4 -my-5 flex min-h-[660px] flex-col">
      <div className="px-4 pt-3">
        <p className="text-[16px] font-extrabold">참여자에게 이렇게 보여요</p>
        <p className="text-[12px] text-gray-500">번호를 누르면 내용과 이유를 볼 수 있어요{isPlan ? ' · 📄 계획서 기반' : ''}</p>
        {ENGINE_NOTE[draft.reason === 'ai_locked' ? 'locked' : draft.engine] && <p className="mt-1 text-[11px] font-bold leading-snug text-gray-600">{ENGINE_NOTE[draft.reason === 'ai_locked' ? 'locked' : draft.engine]}</p>}
        {draft.homeTheme && HOME_NOTE[draft.homeTheme] && <p className="mt-1 text-[11px] leading-snug text-gray-500">{HOME_NOTE[draft.homeTheme]}</p>}
      </div>

      <ProgramSkeleton draft={draft} onOpen={setSheet} flash={flash} />

      {/* 화면엔 없지만 알아야 할 것 — 성과·보고, 이유 */}
      <div className="mx-3 mt-2.5 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setSheet('kpi')} className={`rounded-xl border border-dashed border-gray-400 bg-white p-2 text-left ${flash?.startsWith('kpi-') ? 'bg-yellow-50' : ''}`}><p className="text-[12px] font-bold">⑤ 성과·보고</p><p className="text-[10px] text-gray-500">지표 {kpiM.length}개 · 자동으로 재는 것 {kpiAuto}개</p></button>
        <button type="button" onClick={() => setSheet('why')} className="rounded-xl border border-dashed border-gray-400 bg-white p-2 text-left"><p className="text-[12px] font-bold">왜 이렇게 짰나요?</p><p className="text-[10px] text-gray-500">이유를 하나씩 보여 드려요</p></button>
      </div>
      <div className="mt-auto space-y-2 px-4 pb-4 pt-3">
        <Btn primary onClick={onMake}>이대로 만들기</Btn>
        <Calm>아직 저장 전이에요. 만든 뒤에도 발행하기 전까진 참여자에게 보이지 않아요.</Calm>
      </div>

      {sheet === 'basic' && (
        <Sheet title="① 이름·기간" onClose={close}>
          <p className="text-[12px] text-gray-500">참여자가 프로그램을 열면 맨 위에 보이는 자리예요.</p>
          <div className="mt-1.5 divide-y divide-gray-100 text-[13px]">
            {basicRows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-1.5"><span className="flex-shrink-0 text-gray-500">{k}</span><span className="text-right font-bold">{v}</span></div>
            ))}
          </div>
          {draft.mode !== 'AUTO' && <p className="mt-1 text-[11px] text-gray-400">심사 미션이 가장 많이 열리는 날 기준이에요. 그날 미션마다 참여자 절반이 올리고, 1건에 20초로 계산했어요.</p>}
          {draft.crisisLine && (
            <div className="mt-2 rounded-lg bg-gray-50 px-2.5 py-2">
              <p className="text-[11px] font-bold text-gray-500">소개에 늘 들어가는 안내 · 마음 건강 프로그램</p>
              <p className="mt-0.5 text-[12px] leading-snug text-gray-700">☎ {draft.crisisLine}</p>
            </div>
          )}
          <div className={`mt-2 flex gap-2 ${flash === 'minus-week' || flash === 'plus-week' ? 'rounded-lg bg-yellow-50 p-1' : ''}`}><Chip onClick={() => onTweak('minus-week')}>기간 −1주</Chip><Chip onClick={() => onTweak('plus-week')}>기간 +1주</Chip></div>
          <p className="mt-2 text-[11px] text-gray-500">이름·기관 이름·로고는 만든 뒤 편집 화면에서 바꿀 수 있어요.</p>
        </Sheet>
      )}
      {sheet === 'missions' && (
        <Sheet title={`② 미션 ${draft.missions.length}개`} onClose={close}>
          <p className="text-[12px] text-gray-500">참여자 홈 맨 위 「오늘 할 일」에 그날 열린 미션이 모여요.</p>
          <div className="mt-2 space-y-1.5">
            {draft.missions.map((m, i) => (
              <div key={m.title + i} className={`rounded-lg border border-gray-200 px-2.5 py-2 ${flash === 'add' && i === draft.missions.length - 1 ? 'bg-yellow-50' : ''}`}>
                <p className="text-[13px] font-bold">{m.title}{m.fromMood && <span className="ml-1.5 rounded bg-gray-200 px-1.5 py-0.5 align-middle text-[10px] font-bold text-gray-600">분위기 추천</span>}</p>
                <p className="text-[11px] text-gray-500">{m.days} · {m.proof} · {m.manual ? '심사' : '자동'}</p>
                {m.instruction && <p className="mt-0.5 text-[12px] leading-snug text-gray-700">{m.instruction}</p>}
                {m.aligned && <p className="mt-0.5 text-[10px] text-gray-400">설명과 인증 칸이 서로 맞도록 맞췄어요</p>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-gray-600">+ 퀴즈 1세트 · {draft.quiz.topic} 주제 · {draft.quiz.count}문항 · 바로 채점돼요 · 검수된 라이브러리에서</p>
          <div className="mt-2 flex gap-2"><Chip onClick={() => onTweak('add')}>미션 추가</Chip><Chip onClick={() => onTweak('remove')}>미션 빼기</Chip></div>
          <Box dashed className="mt-2 text-[13px] text-gray-400">💬 말로 고치기 — 예) 주말 미션은 빼 줘</Box>
        </Sheet>
      )}
      {sheet === 'streak' && (
        <Sheet title="③ 꾸준함" onClose={close}>
          <p className="text-[12px] leading-snug text-gray-600">결과와 상관없이, 꾸준히 하는 사람을 뒤에서 응원하는 자리예요. 주간 스트릭 도장은 늘 있고, 불꽃은 고를 수 있어요.</p>
          <div className="mt-2"><FeatureRow f={FEATURES.find((x) => x.key === 'flame')} on={f.flame} onClick={() => onToggleFeature('flame')} flashing={flash === 'f-flame'} /></div>
        </Sheet>
      )}
      {sheet === 'menu' && (
        <Sheet title={`④ 메뉴 · ${MOODS[draft.mood].label}`} onClose={close}>
          <p className="text-[12px] leading-snug text-gray-500">고르신 분위기에 맞춰 켰어요. 눌러서 바꿀 수 있고, 발행 뒤에도 프로그램 설정에서 언제든 바꿔요.</p>
          <div className="mt-2 space-y-0.5">
            {FEATURES.filter((x) => x.key !== 'flame').map((x) => <FeatureRow key={x.key} f={x} on={f[x.key]} onClick={() => onToggleFeature(x.key)} flashing={flash === `f-${x.key}`} />)}
          </div>
          <p className="mt-1.5 text-[11px] text-gray-500">시상대·팀은 랭킹이 있어야 동작해요.</p>
          {draft.feedVisibility !== 'public' && (
            <p className="mt-2 rounded-lg bg-gray-50 px-2.5 py-2 text-[12px] leading-snug text-gray-600">🔒 인증 글은 «기본 비공개 · 개인 선택» — 마음 건강 프로그램이라, 본인이 고를 때만 커뮤니티에 보여요.</p>
          )}
        </Sheet>
      )}
      {/* ⑤ 성과·보고 — 지표마다 «도담이 어떻게 재는지» + 지금 되는지(자동) / 한 가지 더(버튼) / 도담 밖(못 잼)을 솔직하게(본인 2026-10-09) */}
      {sheet === 'kpi' && (
        <Sheet title="⑤ 성과·보고" onClose={close}>
          <p className="text-[12px] leading-snug text-gray-600">끝났을 때 이 지표로 결과를 받아요. 도담이 어떻게 재는지 미리 보여 드릴게요.</p>
          <div className="mt-2 space-y-1.5">
            {kpiM.map((m) => (
              <div key={m.k} className={`rounded-lg border px-2.5 py-2 ${m.state === 'outside' ? 'border-dashed border-gray-300' : 'border-gray-200'} ${flash === `kpi-${m.k}` ? 'bg-yellow-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-bold leading-snug">{m.k}</p>
                  <span className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${m.state === 'auto' ? 'bg-gray-800 text-white' : m.state === 'setup' ? 'bg-gray-200 text-gray-700' : 'bg-gray-100 text-gray-500'}`}>
                    {m.state === 'auto' ? (m.done ? '✓ 넣었어요' : '✓ 자동으로 재요') : m.state === 'setup' ? '한 가지 더' : '도담 밖 기록'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-gray-500">{m.how}</p>
                {m.state === 'setup' && <div className="mt-1.5"><Chip onClick={() => onKpiSetup(m.k)}>{m.setup}</Chip></div>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12px] leading-snug text-gray-500">끝나면 종료 리포트 맨 위에 「목표 대비」로 보여 드려요. 리포트는 엑셀로 내려받아 기관 보고에 쓸 수 있어요.</p>
        </Sheet>
      )}
      {sheet === 'why' && (
        <Sheet title="왜 이렇게 짰나요?" onClose={close}>
          <ul className="list-disc space-y-1 pl-4 text-[13px] text-gray-700">{draft.why.map((w) => <li key={w}>{w}</li>)}</ul>
        </Sheet>
      )}
    </div>
  )
}

export default function AiBuilderDemo() {
  const [params] = useSearchParams()
  const initState = Math.min(7, Math.max(0, Number(params.get('state') || 0)))
  const [state, setState] = useState(initState)
  const [bp, setBp] = useState(initState >= 5 ? EXAMPLE_BP : EMPTY)
  // 구독 — 계획서 읽기는 구독 플랜 전용(본인 2026-10-09). 구독 기능이 생기기 전이라 dev 토글(?sub=1)로 두 화면을 다 본다
  const [subscribed, setSubscribed] = useState(params.get('sub') === '1')
  // 기능 2(2026-10-10): 「만들기」를 진짜로 — 켜면 로그인한 계정으로 DRAFT 프로그램을 실제로 만든다(DB 쓰기, 마이그 287 필요). 기본은 꺼짐(?real=1)
  const [realCreate, setRealCreate] = useState(params.get('real') === '1')
  const [making, setMaking] = useState(false)
  const [madeId, setMadeId] = useState(null)
  const [makeError, setMakeError] = useState(null)
  const navigate = useNavigate()
  const [planStep, setPlanStep] = useState('reading')  // 계획서 읽기: reading → read
  const [qi, setQi] = useState(0)                      // 질문 인덱스(빈칸 목록 기준)
  const [genStep, setGenStep] = useState(0)
  const [gen, setGen] = useState(null)                 // 생성 중에 받은 초안 — 도착 전엔 null(빈 틀만 생겨난다)
  const [genKey, setGenKey] = useState(0)              // 생성 다시 하기 — 같은 설계도로 다시 들어와도 생성 효과가 다시 돌게(리뷰 2026-10-10: 4번 점프로 멈춤)
  const [cd, setCd] = useState(() => (initState >= 5 ? localDraft(EXAMPLE_BP) : null))   // 엔진 초안 { bp, draft } — 다듬기·검사가 이걸 바꾼다
  const [flash, setFlash] = useState(null)             // 다듬기로 바뀐 자리 하이라이트
  const [resolved, setResolved] = useState({})         // 검사 응답 — 안전: 'fixed' / 운영: 'ok' | 'fix'
  const draft = useMemo(() => (cd ? toView(cd.draft, bp) : null), [cd, bp])

  // 빈칸만 묻는다 — 첫 문장·계획서에서 읽힌 칸, 대상에서 추정한 운영 형태, 해당 없는 칸(자발적 모임의 브랜딩)은 건너뛴다
  const empties = useMemo(() => FIELDS.filter((f) => applies(f, bp) && bp[f.key] == null), [bp])
  // 생성 중 화면 — 초안이 오기 전엔 빈 틀(분위기 기능만 안다), 오면 같은 값이 그대로 초안이 된다(화면이 바뀌어도 내용이 튀지 않게)
  const genView = useMemo(() => (gen ? toView(gen.draft, bp)
    : { name: '', durationDays: bp.durationDays || 28, missions: [], features: (MOODS[bp.mood] || MOODS.growth).features, brand: null }), [gen, bp])
  const genEngine = engineOf(bp)
  const goGenerate = () => { setGenStep(0); setGen(null); setGenKey((k) => k + 1); setState(4) }
  const askRemaining = (next0) => {
    const next = withInferred(next0)
    setBp(next); setQi(0)
    if (FIELDS.every((f) => !applies(f, next) || next[f.key] != null)) goGenerate(); else setState(3)
  }
  const start = (text) => askRemaining({ ...EMPTY, ...parseFreeText(text), source: 'text', freeText: text })
  const openPlan = () => { setPlanStep('reading'); setState(2) }
  const answer = (key, val) => askRemaining({ ...bp, [key]: val })
  // 직접 입력 — 목표는 아는 말이면 그 틀로, 모르는 말이면 그대로(normalizeGoal). 그 밖은 읽을 수 있을 때만 받는다
  const answerDirect = (key, raw) => {
    if (key === 'goal') { askRemaining({ ...bp, ...normalizeGoal(raw) }); return }
    const v = parseDirect(key, raw)
    if (v != null) answer(key, v)
  }
  // 추정한 운영 형태가 틀렸을 때 — 「아니에요」 한 번으로 뒤집는다(기관 → 자발적 모임이면 브랜딩 질문도 빠진다)
  const flipOrg = () => askRemaining({ ...bp, org: bp.org === 'org' ? 'casual' : 'org', orgInferred: false, brand: null })
  const skip = () => { const f = empties[qi]; answer(f.key, SKIP_DEFAULT[f.key]) }
  const jump = (i) => {   // 상단 점프(검토용)
    setResolved({})
    if (i >= 5 && !cd) { setBp(EXAMPLE_BP); setCd(localDraft(EXAMPLE_BP)) }
    if (i === 4) {
      // 설계도가 비어 있으면 예시로 — 빈 설계도로 들어가면 「건강 습관」(처음 보는 목표)으로 실제 AI 를 부르게 된다
      if (!bp.goal) setBp(EXAMPLE_BP)
      setGenStep(0); setGen(null); setGenKey((k) => k + 1)
    }
    if (i === 2) setPlanStep('reading')
    setState(i)
  }

  // 계획서 읽는 중(가짜 1.5초 — 구독 플랜에선 서버 read_plan 이 유료 AI 로 읽는다) — 상태는 타이머 안에서만 바꾼다
  useEffect(() => {
    if (state !== 2 || planStep !== 'reading') return
    const t = setTimeout(() => setPlanStep('read'), 1500)
    return () => clearTimeout(t)
  }, [state, planStep])
  // 생성 — 아는 목표는 규칙 엔진(즉시), 처음 보는 목표는 서버(무료 AI). 상태는 응답·타이머 안에서만 바꾼다
  useEffect(() => {
    if (state !== 4) return
    let alive = true
    makeDraftOnce(bp).then((r) => { if (alive) setGen(r) })
    return () => { alive = false }
  }, [state, bp, genKey])
  useEffect(() => {
    if (state !== 4 || !gen) return
    // 빈 틀이 생겨나는 데 ~0.9초(AI 를 기다렸으면 이미 다 생겨 있다) → 단계마다 한 층씩 채운다 → 다 채우고 잠깐 보여 준 뒤 초안으로
    const lead = gen.ms > 900 ? 200 : 900
    const t = [0, 600, 1200, 1800].map((ms, i) => setTimeout(() => setGenStep(i + 1), lead + ms))
    t.push(setTimeout(() => { setCd(gen); setState(5) }, lead + 2400))
    return () => t.forEach(clearTimeout)
  }, [state, gen])

  const flashOnce = (k) => { setFlash(k); setTimeout(() => setFlash(null), 1500) }
  // 초안 다듬기 — 엔진 초안을 바꾸고, 심사 시간·검사를 같은 규칙으로 다시(engine.recheck)
  const update = (fn, flashKey) => {
    if (!cd) return
    const d = fn({ ...cd.draft, missions: [...cd.draft.missions], features: { ...cd.draft.features }, kpi: [...cd.draft.kpi] })
    d.reviewMinutesPerDay = d.mode === 'AUTO' ? 0 : engine.reviewMinutes(d.headcount, d.missions)
    setCd({ ...cd, draft: engine.recheck(d, cd.bp) }); flashOnce(flashKey)
  }
  const tweak = (what) => update((d) => {
    if (what === 'minus-week') d.durationDays = Math.max(7, d.durationDays - 7)
    if (what === 'plus-week') d.durationDays += 7
    if (what === 'add') d.missions.push(ADDED_MISSION)
    if (what === 'remove') d.missions.pop()
    d.nameSuggestion = d.nameSuggestion.replace(/(\d+)주/, `${Math.max(1, Math.round(d.durationDays / 7))}주`)
    d.description = d.description.replace(/^(\d+)일 동안/, `${d.durationDays}일 동안`)
    return d
  }, what)
  // 기능 켜고 끄기 — 시상대·팀은 랭킹에 딸려 있다(랭킹을 끄면 같이 꺼지고, 켜면 랭킹도 켜진다)
  const toggleFeature = (key) => update((d) => {
    const f = d.features
    f[key] = !f[key]
    if (key === 'ranking' && !f.ranking) { f.podium = false; f.team = false }
    if ((key === 'podium' || key === 'team') && f[key]) f.ranking = true
    d.teamScoreMode = f.team ? 'average' : null
    return d
  }, `f-${key}`)
  // 성과 지표 «한 가지 더» — 예: 종료 설문에 만족도 문항 넣기(기능 단계 2: 실제로 설문 문항을 추가한다)
  const kpiSetup = (k) => update((d) => { d.kpi = d.kpi.map((m) => (m.label === k ? { ...m, status: 'auto', done: true } : m)); return d }, `kpi-${k}`)
  const checks = draft ? draft.checks : { safety: [], ops: [] }
  const safetyOk = checks.safety.every((c) => c.status === 'pass' || resolved[c.key] === 'fixed')
  const opsOk = checks.ops.every((c) => resolved[c.key])
  // 만들기 — 꺼져 있으면 완료 화면만(가짜). 켜져 있으면 createProgramFromAiDraft → DRAFT(라이브러리와 같은 길)
  //   ⚠️ 검사에서 고른 «고치기»는 아직 초안에 반영하지 않는다(기능 3 실제 화면에서). 지금은 초안 그대로 만든다.
  const make = async () => {
    if (!realCreate) { setMadeId(null); setState(7); return }
    if (!cd || making) return
    setMaking(true); setMakeError(null)
    try {
      const { data } = await supabase.auth.getSession()
      const userId = data?.session?.user?.id
      if (!userId) throw new Error('로그인이 필요해요')
      const id = await createProgramFromAiDraft({ draft: cd.draft, blueprint: cd.bp, userId })
      setMadeId(id); setState(7)
    } catch (e) {
      setMakeError(e?.message || '만들지 못했어요')
    } finally {
      setMaking(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      {/* dev 상단 — 상태 점프(검토용) */}
      <div className="sticky top-0 z-10 border-b border-gray-300 bg-white/95 px-4 py-2 text-[12px]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <span className="font-bold">🔧 뼈대 와이어프레임 — AI와 함께 만들기 (10차 · 진짜 엔진)</span>
          <span className="text-gray-500">아는 목표 = 규칙 엔진(바로) · 처음 보는 목표 = 서버 AI(로그인 필요) · 회색 = 디자인 전</span>
          <span className="ml-auto flex flex-wrap gap-1">
            <Chip active={subscribed} onClick={() => setSubscribed((v) => !v)}>{subscribed ? '✓ 구독 중으로 보는 중' : '구독 중으로 보기'}</Chip>
            <Chip active={realCreate} onClick={() => setRealCreate((v) => !v)}>{realCreate ? '⚠ 실제로 만들기(DB)' : '만들기 = 가짜'}</Chip>
            {STATES.map((s, i) => <Chip key={s} active={state === i} onClick={() => jump(i)}>{i} {s}</Chip>)}
          </span>
        </div>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start">
        {/* ─── 폰 프레임 360px ─── */}
        <div className="relative mx-auto w-[360px] flex-shrink-0 overflow-hidden rounded-[28px] border-4 border-gray-800 bg-[#f8fbf9]">
          <div className="flex h-11 items-center justify-between border-b border-gray-200 px-4 text-[13px] text-gray-500">
            <span>‹</span><span className="font-bold text-gray-700">{state === 0 ? '프로그램 만들기' : 'AI와 함께 만들기'}</span><span className="w-3" />
          </div>
          <div className="min-h-[640px] px-4 py-5">

            {/* 0 입구 — ProgramCreateChooser 에 세 번째 카드 */}
            {state === 0 && (
              <div className="space-y-3">
                <h1 className="text-[20px] font-extrabold">어떻게 시작할까요?</h1>
                <Box><p className="font-bold">직접 만들기</p><p className="text-[12px] text-gray-500">빈 화면에서 내 프로그램을 자유롭게 구성해요</p></Box>
                <Box><p className="font-bold">템플릿에서 시작</p><p className="text-[12px] text-gray-500">미션까지 준비된 프로그램을 골라 바로 시작해요</p></Box>
                <Box dashed onClick={() => setState(1)}>
                  <p className="font-bold">✨ AI와 함께 만들기 <span className="ml-1 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold">새 카드</span></p>
                  <p className="text-[12px] text-gray-500">계획서가 있어도, 없어도 미션까지 짜 드려요. 다 보여 드린 뒤에 만들어요</p>
                </Box>
                <p className="text-[11px] text-gray-400">↑ 세 번째 카드가 입구(본인 결정). 누르면 아래 흐름으로.</p>
              </div>
            )}

            {/* 1 시작 — 「어떤 프로그램을 만들고 싶으세요?」 바로 아래에 계획서 올리기, 또는 직접 적기(본인 2026-10-09) */}
            {state === 1 && <StartScreen onStart={start} onPlan={openPlan} subscribed={subscribed} />}

            {/* 2 계획서 읽기 — 읽는 중 → 읽은 것 확인 */}
            {state === 2 && planStep === 'reading' && (
              <div className="space-y-4 pt-10">
                <h2 className="text-[20px] font-extrabold">계획서를 읽고 있어요</h2>
                <Box><p className="text-[13px] font-bold">📄 {PLAN_FILE}</p><p className="text-[12px] text-gray-500">12쪽 · 읽는 중…</p></Box>
                <Calm>계획서는 학습에 쓰이지 않는 유료 AI로만 읽고, 초안을 만든 뒤 지워요. 읽은 내용은 다음 화면에서 전부 보여 드려요.</Calm>
              </div>
            )}
            {state === 2 && planStep === 'read' && (
              <div className="space-y-3">
                <h2 className="text-[20px] font-extrabold">계획서에서 이렇게 읽었어요</h2>
                <p className="text-[12px] text-gray-500">📄 {PLAN_FILE}</p>
                <Box dashed>
                  {[['운영 기관', PLAN_READ.orgNameHint], ['대상', PLAN_READ.target], ['대상 인원', `${PLAN_READ.headcount}명`], ['목표', PLAN_READ.goal], ['기간', `${PLAN_READ.durationDays}일(8주)`], ['인증', '운영자 확인(심사)']].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-gray-100 py-1.5 text-[13px]"><span className="text-gray-500">{k}</span><span className="font-bold">{v}</span></div>
                  ))}
                  <div className="flex justify-between py-1.5 text-[13px]"><span className="text-gray-500">분위기</span><span className="text-gray-400">계획서에 없어요 · 다음에 여쭤볼게요</span></div>
                </Box>
                <Box><p className="text-[12px] font-bold text-gray-500">미션 후보</p><p className="text-[13px]">{PLAN_READ.missionHints.join(' · ')}</p></Box>
                <Box><p className="text-[12px] font-bold text-gray-500">성과 지표(계획서 그대로)</p><ul className="list-disc pl-4 text-[13px]">{PLAN_READ.kpi.map((k) => <li key={k}>{k}</li>)}</ul><p className="mt-1 text-[11px] text-gray-500">도담이 어떻게 재는지는 초안에서 지표마다 보여 드려요</p></Box>
                <Btn primary onClick={() => askRemaining({ ...EMPTY, ...PLAN_READ })}>맞아요, 이대로 할게요</Btn>
                <Btn onClick={() => askRemaining({ ...EMPTY, ...PLAN_READ, durationDays: null, mode: null })}>몇 가지는 고칠게요</Btn>
                <p className="text-[11px] text-gray-400">「맞아요」 → 비어 있는 분위기와 브랜딩 확인(기관 이름은 미리 채움)만 / 「고칠게요」 → 고칠 칸(여기선 기간·인증 예시)도.</p>
              </div>
            )}

            {/* 3 질문 — 빈칸만, 한 화면에 하나 */}
            {state === 3 && empties[qi] && (() => {
              const f = empties[qi]
              const applicable = FIELDS.filter((x) => applies(x, bp))
              const total = applicable.length; const done = total - empties.length
              const src = bp.source === 'plan' ? '계획서에서' : bp.freeText ? `「${bp.freeText}」에서` : null
              const rec = f.key === 'mood' ? recommendMood(bp) : null
              const autoRec = f.key === 'mode' && (bp.headcount || 0) >= 100
              // 참여 방법 추천 — 대상으로(주민 → 공개+확인하고 받기, 그 밖 → 초대 링크). 이유를 같이 보여 준다
              const joinRec = f.key === 'join' ? engine.recommendedJoin(engine.sanitizeBlueprint(toCoreBp(bp))) : null
              // 인증 — 인원으로 심사 시간을 계산해 보여 준다(운영자에게 시간을 묻지 않는다).
              //   미션을 짜기 전이라 «매일 심사할 미션 하나» 기준 어림 — 초안에선 실제 미션으로 다시 계산해 숫자가 달라질 수 있어서 그렇게 말해 둔다
              const hint = f.key === 'mode'
                ? (bp.headcount ? `운영자가 확인하면, 매일 심사할 미션 하나 기준 하루 약 ${reviewEstimate(bp.headcount)}분이에요(${bp.headcount}명 · 1건 20초). 미션을 짠 뒤 정확히 다시 알려 드려요` : '운영자가 확인하면 인원만큼 심사 시간이 들어요')
                : f.hint
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-1 text-[12px] text-gray-500">
                    {applicable.map((x) => <span key={x.key} className={`h-1.5 flex-1 rounded-full ${bp[x.key] != null ? 'bg-gray-800' : x.key === f.key ? 'bg-gray-500' : 'bg-gray-300'}`} />)}
                    <span className="ml-2">{done + 1}/{total}</span>
                  </div>
                  {src && <p className="text-[12px] text-gray-500">{src} 읽은 것은 안 물어요 · 남은 질문 {empties.length}개</p>}
                  {/* 어떻게 이해했는지 — 직접 적은 말·대상에서 추정한 운영 형태를 조용히 정하지 않고 말로 알려 준다 */}
                  {bp.goalNote && <p className="text-[12px] font-bold text-gray-700">✓ {bp.goalNote}</p>}
                  {bp.orgInferred && bp.org && (
                    <p className="text-[12px] font-bold text-gray-700">✓ {bp.target} 대상이라 «{bp.org === 'org' ? '기관·회사 운영' : '자발적 모임'}»으로 이해했어요
                      <button type="button" onClick={flipOrg} className="ml-1.5 font-normal text-gray-500 underline">아니에요</button>
                    </p>
                  )}
                  <h2 className="text-[20px] font-extrabold leading-snug">{f.q}</h2>
                  {f.custom === 'brand' ? (
                    <BrandForm initialName={bp.orgNameHint || ''} onDone={(brand) => answer('brand', brand)} onLater={() => answer('brand', 'later')} />
                  ) : f.cards ? (
                    // 분위기 — 고르기 전에 «무엇이 켜지는지»를 카드마다, 앞 답에 맞는 하나엔 «추천»과 이유
                    <div className="space-y-2">
                      {f.options.map((m) => (
                        <Box key={m} onClick={() => answer(f.key, m)} className={rec?.mood === m ? 'ring-2 ring-gray-800' : ''}>
                          <p className="font-bold">{MOODS[m].label}{rec?.mood === m && <span className="ml-1.5 rounded bg-gray-800 px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">추천</span>}</p>
                          <p className="text-[12px] text-gray-500">{MOODS[m].sub}</p>
                          {rec?.mood === m && <p className="mt-1 text-[11px] font-bold text-gray-700">{rec.why}</p>}
                          <p className="mt-1.5 text-[11px] text-gray-600">켜지는 기능 · {moodFeatureLine(m)}</p>
                        </Box>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {f.options.map((o) => { const [label, val] = Array.isArray(o) ? o : [o, o]; return <Chip key={label} onClick={() => answer(f.key, val)}>{label}{(autoRec && val === 'AUTO') || (joinRec && val === joinRec.join) ? ' · 추천' : ''}</Chip> })}
                      </div>
                      {f.direct && <DirectInput key={f.key} placeholder={f.direct} onSubmit={(raw) => answerDirect(f.key, raw)} />}
                    </>
                  )}
                  {hint && <p className="text-[12px] text-gray-500">ⓘ {hint}</p>}
                  {autoRec && <p className="text-[12px] font-bold text-gray-700">인원이 많으면 자동 승인이 편해요 — 꼭 봐야 할 미션 하나만 심사로 두는 걸 추천해요</p>}
                  {joinRec && <p className="text-[12px] font-bold text-gray-700">{joinRec.why}</p>}
                  {f.custom !== 'brand' && <div className="flex gap-2 pt-2"><Btn onClick={skip}>건너뛰기</Btn><Btn primary disabled>다음</Btn></div>}
                  <Calm>{f.custom === 'brand' ? '기관 이름·로고는 참여자에게 보여요. 만든 뒤 편집 화면에서 언제든 바꿀 수 있어요.' : '지금은 아무것도 저장되지 않아요. 만들기 전에 전부 보여 드리고, 그때도 고칠 수 있어요.'}</Calm>
                </div>
              )
            })()}

            {/* 4 생성 중 — 초안과 같은 스켈레톤이 위에서부터 생겨나고, 단계마다 한 층씩 채워진다(본인 2026-10-09). 끝나면 같은 자리 그대로 초안으로 */}
            {state === 4 && (
              <div className="relative -mx-4 -my-5 flex min-h-[660px] flex-col">
                <div className="px-4 pt-3">
                  <p className="text-[16px] font-extrabold">{genStep >= 4 ? '다 됐어요' : '프로그램을 짜고 있어요'}</p>
                  <motion.p key={`${genStep}-${!!gen}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className="text-[12px] text-gray-500">
                    {!gen && genEngine === 'ai' ? 'AI가 미션을 짜는 중…' : `${GEN_STEPS[Math.min(genStep, 4)]}${genStep < 4 ? '…' : ''}`}
                  </motion.p>
                </div>
                <ProgramSkeleton draft={genView} level={gen ? genStep : 0} building />
                <div className="mt-auto px-4 pb-4 pt-3">
                  <div className="flex gap-1.5">{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${genStep > i ? 'bg-gray-800' : 'bg-gray-300'}`} />)}</div>
                  <p className="mt-2 text-[12px] leading-snug text-gray-500">{genEngine === 'rules' ? '검수된 미션 목록에서 대상·분위기에 맞춰 바로 골라요. 다 되면 이 화면 그대로 보여 드려요.' : '처음 보는 목표라 AI가 짜요. 보통 10초 안에 끝나요. AI에는 목표·대상·인원·기간 같은 설계도만 보내고, 처음 적어 주신 문장과 기관 이름은 보내지 않아요.'}</p>
                </div>
              </div>
            )}

            {/* 5 초안 — 참여자가 볼 상세 화면 스켈레톤 + 번호 눌러 설명 */}
            {state === 5 && draft && (
              <DraftPreview draft={draft} isPlan={!!bp.planName} flash={flash} onTweak={tweak} onToggleFeature={toggleFeature} onKpiSetup={kpiSetup}
                onMake={() => { setResolved({}); setState(6) }} />
            )}

            {/* 6 검사 — ① 도담 안전 검사(막힘) ② 운영 점검(의도 확인) */}
            {state === 6 && draft && (
              <div className="space-y-3">
                <h2 className="text-[20px] font-extrabold">만들기 전에 두 가지를 봤어요</h2>
                <p className="text-[12px] text-gray-500">① 도담에서 운영해도 괜찮은지 ② 끝까지 잘 굴러갈지</p>

                <p className="pt-1 text-[12px] font-bold text-gray-500">① 도담 안전 검사</p>
                {checks.safety.map((c) => {
                  const fixed = resolved[c.key] === 'fixed'
                  if (c.status === 'pass') return <div key={c.key} className="flex items-start gap-2 px-1 text-[13px] text-gray-500"><span>✓</span><span>{c.label}</span></div>
                  return (
                    <Box key={c.key} dashed={!fixed} className={fixed ? 'opacity-70' : ''}>
                      <p className="text-[12px] font-bold text-gray-500">{fixed ? '✓ 바꿨어요' : '⚠ 바꿔야 해요'} · {c.label}</p>
                      <p className="mt-1 text-[14px] leading-snug">{c.text}</p>
                      {!fixed && <div className="mt-2"><Chip onClick={() => setResolved((r) => ({ ...r, [c.key]: 'fixed' }))}>{c.fix}</Chip></div>}
                      {!fixed && <p className="mt-1.5 text-[11px] text-gray-500">통과하지 않으면 만들 수 없어요. 대신 바꿀 문구를 같이 드려요.</p>}
                    </Box>
                  )
                })}

                <p className="pt-2 text-[12px] font-bold text-gray-500">② 운영 점검 — 틀렸다는 뜻이 아니에요. 의도하신 거면 그대로 가요.</p>
                {checks.ops.map((c) => (
                  <Box key={c.key} dashed={!resolved[c.key]} className={resolved[c.key] ? 'opacity-60' : ''}>
                    <p className="text-[14px] leading-snug">{c.text}</p>
                    {resolved[c.key]
                      ? <p className="mt-1 text-[12px] font-bold text-gray-500">{resolved[c.key] === 'ok' ? `✓ ${c.okLabel || '의도함'}` : `✓ ${c.fix}`}</p>
                      : <div className="mt-2 flex flex-wrap gap-2"><Chip onClick={() => setResolved((r) => ({ ...r, [c.key]: 'ok' }))}>{c.okLabel || '의도함'}</Chip><Chip onClick={() => setResolved((r) => ({ ...r, [c.key]: 'fix' }))}>{c.fix}</Chip></div>}
                  </Box>
                ))}
                <Btn primary disabled={!(safetyOk && opsOk) || making} onClick={make}>{making ? '만드는 중…' : '만들기'}</Btn>
                {makeError && <p className="text-[12px] font-bold text-red-600">만들지 못했어요 · {makeError}</p>}
                <p className="text-[11px] text-gray-400">{MOODS[draft.mood].label} · 약 {draft.headcount}명 · {draft.mode === 'AUTO' ? '자동 승인' : `심사 많은 날 하루 약 ${draft.reviewMinutes}분`} 기준으로 봤어요.</p>
              </div>
            )}

            {/* 7 완료 — DRAFT 로 합류 */}
            {state === 7 && (
              <div className="space-y-4 pt-10 text-center">
                <div className="mx-auto h-20 w-20 rounded-full bg-gray-200" />
                <h2 className="text-[20px] font-extrabold">임시 저장으로 만들었어요</h2>
                <p className="text-[13px] text-gray-500">이름과 기간만 확인하면 바로 요약·게시예요.<br />옵션과 참여 방법은 여기서 이미 정했어요.</p>
                <Btn primary onClick={() => (madeId ? navigate(`/programs/new?id=${madeId}`) : jump(0))}>편집 화면으로</Btn>
                {madeId && <p className="text-[11px] text-gray-400">만든 DRAFT: {madeId}</p>}
                <Calm>발행 전까지 참여자에겐 보이지 않아요.{bp.source === 'plan' ? ' 올리신 계획서는 지웠어요.' : ''}</Calm>
                <p className="text-[11px] text-gray-400">→ /programs/new?id=… 마법사 1단계(이름·기간 확인) 다음 바로 4단계 요약·게시. 2·3단계는 AI 질문에서 정해서 건너뜀(본인 2026-10-10, wizardSteps.js).</p>
              </div>
            )}
          </div>
        </div>

        {/* ─── 옆 메모 — 구조와 데이터가 «실시간»으로 보인다 ─── */}
        <aside className="w-full space-y-4 text-[12px] lg:flex-1">
          <Box>
            <p className="mb-1 font-bold">질문 목록 — 빈칸만 묻는다(지금 설계도 기준)</p>
            {FIELDS.map((f) => {
              const on = applies(f, bp)
              const v = bp[f.key]
              return (
                <div key={f.key} className="flex items-baseline justify-between gap-3 border-b border-gray-100 py-1 last:border-0">
                  <span><span className="font-bold">{f.label}</span>{f.whenLabel && <span className="text-gray-400"> ({f.whenLabel})</span>}{f.key === 'org' && <span className="text-gray-400"> (대상에서 추정, 안 되면)</span>} <span className="text-gray-400">— {f.q}</span></span>
                  <span className={`flex-shrink-0 font-bold ${!on ? 'text-gray-300' : v != null ? 'text-gray-800' : 'text-gray-400'}`}>
                    {!on ? '해당 없음' : v != null ? `✓ ${f.key === 'goal' && bp.goalRaw && bp.goalRaw !== bp.goal ? `${bp.goalRaw} → ${bp.goal}` : fieldValue(f.key, v)}${f.key === 'org' && bp.orgInferred ? '(추정)' : ''}` : '물을 것'}
                  </span>
                </div>
              )
            })}
            <p className="mt-1 text-gray-500">문화 = 신뢰와 편의(본인). 읽을 수 있는 건 읽고(계획서·첫 문장), 추정할 수 있는 건 추정해서 «어떻게 이해했는지» 말하고, 운영자가 모르는 건(심사 시간) 도담이 계산해 보여 준다.</p>
          </Box>
          <Box>
            <p className="mb-1 font-bold">조직 vs 자발적 모임</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>추정: 직원·동료·회원·고객·학생·주민 → 기관 / 가족·친구·모임 → 자발적 모임 / 계획서를 올렸으면 기관. 직접 적은 대상(예: 어르신)은 물어본다</li>
              <li>기관이면 마지막에 브랜딩 — 기관 이름(계획서에서 미리 채움)·로고·표지. 「나중에 할게요」 가능</li>
              <li>표지엔 기관 로고·이름과 「운영 ○○」 — 도담 이름은 앞에 나오지 않는다(퍼소나: 무대 앞엔 운영자, 도담은 뒤)</li>
            </ul>
          </Box>
          <Box>
            <p className="mb-1 font-bold">분위기 → 기능(실제 프로그램 스위치)</p>
            <table className="w-full text-left text-[11px]">
              <thead><tr className="text-gray-500"><th className="py-0.5 font-normal">기능</th>{Object.keys(MOODS).map((m) => <th key={m} className="py-0.5 font-normal">{MOODS[m].label}</th>)}</tr></thead>
              <tbody>{FEATURES.map((f) => <tr key={f.key} className="border-t border-gray-100"><td className="py-0.5">{f.label}</td>{Object.keys(MOODS).map((m) => <td key={m} className="py-0.5">{MOODS[m].features[f.key] ? '켬' : '—'}</td>)}</tr>)}</tbody>
            </table>
            <p className="mt-1 text-gray-500">추천: 마음 건강 → 성장형 · 기관+직원 30명 이상 → 팀형 · 친구 → 경쟁형 · 가족·주민·학생 → 성장형(이유를 카드에 같이). 순위는 기본 인증 점수, 결과 반영은 운영자 계획에 따른다.</p>
          </Box>
          <Box>
            <p className="mb-1 font-bold">3층 구조</p>
            <p>[화면] 입구 → 시작(계획서 올리기 또는 직접 적기) → (계획서 읽기) → 질문(빈칸만) → 생성 중(스켈레톤이 생겨나고 채워짐) → 초안(같은 스켈레톤 + 번호) → 검사(안전 → 운영) → 완료</p>
            <p>[서버] <code>program-draft</code> 엣지 함수 1개 — 설계도 «또는» 계획서 파일 → Gemini(responseSchema = 프리셋 형식 + 검사 결과) → JSON. 퀴즈는 라이브러리 주제 키만.</p>
            <p>[생성] <code>createProgramFromPreset(객체)</code> → DRAFT → 라이브러리와 같은 편집 자리</p>
          </Box>
          <Box>
            <p className="mb-1 font-bold">설계도(blueprint)</p>
            <pre className="overflow-auto rounded bg-gray-50 p-2 text-[11px]">{JSON.stringify(Object.fromEntries(Object.entries(bp).filter(([k]) => !['missionHints', 'riskyClaim'].includes(k))), null, 2)}</pre>
          </Box>
          <Box>
            <p className="mb-1 font-bold">초안(draft) — 엔진 출력 그대로{cd?.ms != null ? ` · 서버 ${(cd.ms / 1000).toFixed(1)}초` : ''}</p>
            {cd?.attempts?.length > 0 && <p className="mb-1 text-gray-500">시도: {cd.attempts.join(' → ')}</p>}
            <pre className="max-h-72 overflow-auto rounded bg-gray-50 p-2 text-[11px]">{cd ? JSON.stringify(slimDraft(cd.draft), null, 2) : '(생성 전)'}</pre>
          </Box>
          <Box>
            <p className="mb-1 font-bold">기능 단계에서 정할 것</p>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>✅ 계획서 읽기 = 구독 플랜 전용(10-09) — 서버 read_plan 은 유료 키(GEMINI_PAID_API_KEY) + PLAN_READ_ENABLED 일 때만 열린다. PDF·이미지만 읽음, Word·hwp 는 변환 필요(hwp 변환기 결정)</li>
              <li>파일 보관 안 함 — 「만들고 나면 지워요」 약속을 코드로(엣지 함수에서 메모리 처리, 저장소 미사용)</li>
              <li>브랜딩(새로 만들 것): 기관 이름·로고 칸 + 로고에서 색을 뽑아 표지 그라데이션. 표지·히어로 사진은 이미 있음. 무거운 화이트라벨(아이콘·도메인)은 08-18 결정대로 보류</li>
              <li>심사 시간 계산의 가정(1건 20초 · 하루 절반 참여)은 실제 심사 기록으로 보정</li>
              <li>✅ 생성 중 화면 = 응답 뒤 순차 공개(규칙 엔진은 즉시, AI 는 기다리는 동안 빈 틀 + 「AI가 미션을 짜는 중」)</li>
              <li>✅ 안전 검사 = 표현 사전(엔진 — 모델이 놓쳐도 잡힘) + 모델이 쓴 고친 문구(숫자 목표가 빠지면 규칙 문구로)</li>
              <li>결과 기준 순위(체중 변화 등) — 지금 랭킹은 점수 기준만. 계획서가 요구하면 «숫자 기록 기반 순위» 검토</li>
              <li>✅ 목표: 아는 말 → 규칙 엔진(AI 없이) · 모르는 말 → 무료 AI(설계도만, 기관 이름 제외) → 못 하면 기본 틀. 아는 말 사전(GOAL_ALIASES)은 아직 화면 쪽</li>
              <li>마음 건강 프로그램 기본값: 체크·글 인증 · 인증 피드 «기본 비공개 · 개인 선택»(optin_private) · 치료 약속 표현 차단 · 109 안내를 소개에 «늘» 넣음(소개글과 따로 저장) · 랭킹이면 부담 확인</li>
              <li>프리셋 형식 확장: 기능 스위치(podium·flame·team·team_score_mode) — 지금 createProgramFromPreset 은 rankingEnabled·quizEnabled 만 받는다 · 「몇 일차~몇 일차」</li>
              <li>성과 지표(새로 만들 것): 지표·목표치·대상 인원 저장 → 종료 리포트 맨 위 「목표 대비」 카드 · 주 3일 활동 비율 항목 · 설문 지표는 종료 설문 문항 자동 추가 · 도담 밖 지표는 «도담 밖»으로 표시</li>
              <li>성장형 트랙(정원·별자리, 06-05 결정)은 성장 탭이 출시되면 성장형에 붙인다</li>
              <li>✅ 하루 한도(AI 부르는 요청만 30회) · 실패 시 기본 틀 · 설명과 인증 칸 맞추기. 남은 것: 벤치마킹(주주) 인증 AI 검토</li>
            </ul>
          </Box>
        </aside>
      </div>
    </div>
  )
}

// 칩 밖의 답 — 적고 「이걸로」(또는 엔터). 입력창은 flex 안에서 min-w-0(갤럭시 가로 밀림 함정)
function DirectInput({ placeholder, onSubmit }) {
  const [v, setV] = useState('')
  const send = () => { if (v.trim()) onSubmit(v.trim()) }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-400 bg-white px-3 py-2">
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }} placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-gray-400" />
      <button type="button" disabled={!v.trim()} onClick={send} className="flex-shrink-0 rounded-full bg-gray-800 px-3 py-1 text-[12px] font-bold text-white disabled:opacity-30">이걸로</button>
    </div>
  )
}

// 브랜딩(기관일 때만, 마지막) — 기관 이름(계획서에서 읽었으면 미리 채움)·로고·표지. 전부 «나중에»로 넘길 수 있다.
//   참여자 화면 앞에는 기관이 서고 도담은 뒤에서 돕는다(브랜드 퍼소나 v2). 로고를 올리면 색을 뽑아 표지에 맞춘다(편의).
function BrandForm({ initialName, onDone, onLater }) {
  const [name, setName] = useState(initialName)
  const [logo, setLogo] = useState(false)
  const [cover, setCover] = useState(false)
  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-snug text-gray-600">참여자 화면 앞에는 기관이 서고, 도담은 뒤에서 도와요. 넣지 않아도 만들 수 있어요.</p>
      <div>
        <p className="mb-1 text-[12px] font-bold text-gray-500">기관·회사 이름</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 새봄기획, ○○보건소" className="w-full min-w-0 rounded-xl border border-gray-400 bg-white px-3 py-2.5 text-[15px] outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Box dashed onClick={() => setLogo((v) => !v)} className="text-center"><p className="text-[18px]">{logo ? '✓' : '🏷'}</p><p className="text-[12px] font-bold">{logo ? '로고 올렸어요' : '로고 올리기'}</p><p className="text-[10px] text-gray-400">선택</p></Box>
        <Box dashed onClick={() => setCover((v) => !v)} className="text-center"><p className="text-[18px]">{cover ? '✓' : '🖼'}</p><p className="text-[12px] font-bold">{cover ? '표지 올렸어요' : '표지 사진'}</p><p className="text-[10px] text-gray-400">선택 · 없으면 기본 표지</p></Box>
      </div>
      {logo && !cover && <p className="text-[12px] text-gray-500">로고 색으로 표지 색을 맞춰 드려요</p>}
      <Btn primary disabled={!name.trim()} onClick={() => onDone({ orgName: name.trim(), logo, cover })}>이대로 넣기</Btn>
      <Btn onClick={onLater}>나중에 할게요</Btn>
    </div>
  )
}

// 시작 — 「어떤 프로그램을 만들고 싶으세요?」 바로 아래에 계획서 올리기(본인 2026-10-09: 따로 묻는 화면 없이 한 화면에서).
//   계획서가 있는 운영자(기업·보건소)는 바로 올리고, 없는 운영자는 «또는» 아래에 생각나는 대로 적는다.
//   계획서 읽기는 구독 플랜 전용(본인 2026-10-09) — 구독 전엔 「구독」 표시, 누르면 막기만 하지 않고 «왜 구독인지»와 다른 길(적어서 시작)을 같이 말한다.
function StartScreen({ onStart, onPlan, subscribed }) {
  const [text, setText] = useState('')
  const [lock, setLock] = useState(false)
  const taRef = useRef(null)
  const writeInstead = () => { setLock(false); setTimeout(() => taRef.current?.focus(), 50) }
  return (
    <div className="space-y-4">
      <h2 className="text-[20px] font-extrabold leading-snug">어떤 프로그램을<br />만들고 싶으세요?</h2>
      <Box dashed onClick={subscribed ? onPlan : () => setLock(true)}>
        <p className="font-bold">📄 계획서가 있다면 올려 주세요{!subscribed && <span className="ml-1.5 rounded bg-gray-200 px-1.5 py-0.5 align-middle text-[10px] font-bold text-gray-600">구독</span>}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-gray-500">대상·기간·목표·성과 지표를 읽어서, 묻는 게 훨씬 줄어요</p>
        <p className="mt-1 text-[11px] text-gray-400">PDF · 사진 · Word · 한글(hwp)</p>
      </Box>
      <div className="flex items-center gap-2 text-[11px] text-gray-400"><span className="h-px flex-1 bg-gray-300" />또는<span className="h-px flex-1 bg-gray-300" /></div>
      <div className="space-y-2">
        {/* 「한 줄이면 돼요」는 짧게 쓰라는 압박처럼 읽혀 바꿨다 — 더 부드러운 쪽으로 확정(본인 2026-10-09). 길이는 운영자에게 맡긴다 */}
        <p className="text-[13px] text-gray-600">생각나는 대로 편하게 적어 주세요. 비어 있는 건 이어서 여쭤볼게요.</p>
        <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="예) 직장 동료들과 4주 동안 걷기" className="w-full rounded-xl border border-gray-400 bg-white p-3 text-[15px] outline-none" />
        <div className="flex flex-wrap gap-2">{EXAMPLES.map((e) => <Chip key={e.text} active={text === e.text} onClick={() => setText(e.text)}>{e.text}</Chip>)}</div>
      </div>
      <Btn primary disabled={!text.trim()} onClick={() => onStart(text.trim())}>시작하기</Btn>
      <Calm>지금은 아무것도 저장되지 않아요. 올린 파일은 만드는 데만 쓰고, 만들고 나면 지워요.</Calm>
      {lock && (
        <Sheet title="계획서 읽기는 구독 플랜에서 열려요" onClose={() => setLock(false)} footer={<Btn primary onClick={writeInstead}>적어서 시작할게요</Btn>}>
          <p className="text-[13px] leading-snug text-gray-700">계획서에는 기관 이름과 내부 계획이 담겨 있어요. 그래서 계획서는 학습에 쓰이지 않는 유료 AI로만 읽어요. 그 비용 때문에 구독 플랜에서 열어 드려요.</p>
          <p className="mt-2 text-[13px] leading-snug text-gray-700">읽은 계획서는 초안을 만드는 데만 쓰고, 보관하지 않아요.</p>
          <p className="mt-2 rounded-lg bg-gray-50 px-2.5 py-2 text-[12px] leading-snug text-gray-600">구독이 없어도 괜찮아요. 아래에 생각나는 대로 적어 주시면 질문 몇 개로 짜 드려요. 적어 주신 문장은 AI에 그대로 보내지 않아요.</p>
        </Sheet>
      )}
    </div>
  )
}
