// 「AI와 함께 만들기」 초안 → 프로그램 만들기 입력 — 순수 함수(검사 스크립트가 직접 부른다. DB 를 건드리지 않는다).
//   초안 = supabase/functions/program-draft/core.ts finalizeDraft 의 출력(서버와 화면이 같은 모양).
//   만들기는 createProgramFromAiDraft(queries.js) → createProgramFromPreset 과 같은 길(DRAFT → 마법사에서 마무리).
import { DEFAULT_BOARD_SETTINGS } from './communityBoards'

// programs.source_preset_key — 출처 표시 + 마법사 1단계의 카테고리 고르기 건너뛰기(Step1Basic: 출처와 카테고리가 있으면)
export const AI_PRESET_KEY = 'ai_builder'

// 초안 → 프리셋 객체. 미션은 엔진이 이미 «프리셋 미션 모양»으로 만든다(expandPresetMission 이 받는 모양, 입력별 점수 포함)
export function aiDraftToPreset(draft) {
  return {
    key: AI_PRESET_KEY,
    name: draft.nameSuggestion || '',
    description: draft.description || null,
    categories: draft.category ? [draft.category] : [],
    durationDays: draft.durationDays,
    quizTopicKey: draft.quiz?.topicKey || null,
    // 퀴즈는 바로 채점되는 문항만 — 주관식(운영자 채점) 문항이 섞이면 제출이 «채점 대기»로 남아 점수가 묶인다(리뷰 2026-10-10)
    quizAutoGradedOnly: true,
    // 금연·달리기는 전용 홈 — 마법사 2단계도 카테고리로 같은 테마를 정한다(Step2Type). 만들 때부터 맞춰 둔다
    theme: draft.homeTheme || null,
    bundleTitle: null,
    missions: Array.isArray(draft.missions) ? draft.missions : [],
  }
}

// 참여 방법 → 마법사 3단계가 저장하던 칸(Step3JoinConditions collectData 와 같은 모양). 초대 코드는 withInviteCode 가 붙인다
//   비공개 = INVITE_CODE(+ 바로 참여), 공개 = APPROVAL 또는 FREE. 둘러보기·입장 질문은 마법사 기본값(꺼짐·없음), 정원은 최대값.
export function aiJoinFields(join = {}) {
  const max = Math.min(100, Math.max(1, Math.round(Number(join.maxParticipants)) || 100))
  const base = { preview_enabled: !!join.preview, max_participants: max, entry_question: null }
  if (join.mode === 'public_approval') return { ...base, is_public: true, join_type: 'APPROVAL', invite_code: null, invite_requires_approval: false }
  if (join.mode === 'public_free') return { ...base, is_public: true, join_type: 'FREE', invite_code: null, invite_requires_approval: false }
  return { ...base, is_public: false, join_type: 'INVITE_CODE', invite_requires_approval: false }
}
// 비공개(초대 코드)면 코드를 붙인다 — 마법사 3단계가 만들던 것. 3단계를 건너뛰므로 여기서 만들지 않으면 아무도 참여하지 못한다
export function withInviteCode(fields, generate) {
  return fields.join_type === 'INVITE_CODE' && !fields.invite_code ? { ...fields, invite_code: generate() } : fields
}

// 초안 → 프로그램 칸(프리셋 밖). createProgramFromPreset 의 programExtras — 기본값을 덮는다.
//   AI 초안은 마법사 2·3단계를 건너뛴다(본인 2026-10-10) → 두 단계가 저장하던 칸을 여기서 모두 채운다.
//   bp = 엔진 설계도(초안을 만든 그 설계도). 대상 인원은 계획서에서 읽은 것만 저장한다
//   — 질문의 「몇 명쯤」은 심사 시간 어림용이고(건너뛰면 30), 참여율의 분모로 쓰기엔 대략이라서.
export function aiDraftProgramFields(draft, bp = {}) {
  const f = draft.features || {}
  const ranking = !!f.ranking
  const team = ranking && !!f.team
  const community = f.cheer !== false
  const fv = draft.certFeedVisibility || 'public'
  const headcount = Math.round(Number(bp.headcount))
  return {
    name: draft.nameSuggestion || '',   // 제안 이름을 미리 채운다 — 중복은 마법사 1단계가 검사(내 프로그램 + 남의 공개 프로그램만 센다, 마이그 163)
    // 분위기 → 기능 스위치(마법사 2단계 대신). 시상대·팀은 랭킹에 딸림. 팀 크기는 마법사 2단계 기본값(2~4명 범위)
    ranking_enabled: ranking,
    podium_enabled: ranking && !!f.podium,
    team_enabled: team,
    team_score_mode: team ? (draft.teamScoreMode === 'sum' ? 'sum' : 'average') : null,
    ...(team ? { team_size_type: 'range', team_size_min: 2, team_size_max: 4 } : {}),
    flame_enabled: f.flame !== false,
    community_enabled: community,
    // 커뮤니티 피드는 아직 옛 칸 feed_enabled 도 본다(FeedContent·JoinFaq) — 마법사 2단계처럼 같이 켠다. 안 켜면 피드가 비어 보인다
    feed_enabled: community,
    // 참여 방법(마법사 3단계 대신) — 공개 여부·참여 방식·승인·정원·둘러보기·입장 질문
    ...aiJoinFields(draft.join),
    // 금연 — 「내 변화」 탭(순위·팀 대신). 라이브러리 금연 프리셋·마법사와 같다
    ...(draft.changeTabEnabled ? { change_tab_enabled: true } : {}),
    // 시작·종료 설문 — 직접 만들기(마법사)처럼 기본 켬. DB 기본값은 꺼짐이라 그대로 두면 종료 리포트 변화·HP2030 자료가 빈다(리뷰 2026-10-10)
    survey_enabled: true,
    // 마음 건강 — 인증 게시판 «기본 비공개 · 개인 선택». 게시판 목록은 전체를 저장해야 한다(communityBoards.js)
    ...(fv !== 'public' ? { community_settings: { boards: DEFAULT_BOARD_SETTINGS.map((b) => (b.id === 'cert' ? { ...b, feedVisibility: fv } : b)) } } : {}),
    // 마이그 287
    org_name: draft.brand?.orgName ? String(draft.brand.orgName).slice(0, 40) : null,
    crisis_line_enabled: !!draft.crisisLine,
    target_headcount: bp.source === 'plan' && headcount >= 1 ? Math.min(1000000, headcount) : null,
    kpis: (draft.kpi || []).map((k) => ({ label: k.label, status: k.status, ...(k.done ? { done: true } : {}) })),
  }
}
