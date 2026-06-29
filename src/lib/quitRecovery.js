// 금연 회복 단계 — 연속 금연 일수 기반 신체 회복 마일스톤(공개 보건 정보).
//   히어로 「회복 단계」 지표 + 개요 「금연 회복」 카드에서 사용.
//   ※ 일반적 건강 정보이며 의학적 진단이 아님.
export const RECOVERY_MILESTONES = [
  { days: 0,   title: '금연 시작',          desc: '결심한 지금부터 몸이 회복을 시작해요.' },
  { days: 1,   title: '일산화탄소 정상화',  desc: '혈중 일산화탄소가 정상 수준으로 돌아와요.' },
  { days: 2,   title: '감각이 살아나요',    desc: '후각과 미각이 다시 또렷해지기 시작해요.' },
  { days: 3,   title: '호흡이 편해져요',    desc: '기관지가 이완되어 숨쉬기가 한결 수월해져요.' },
  { days: 14,  title: '혈액순환 개선',      desc: '혈액순환과 폐 기능이 좋아지기 시작해요.' },
  { days: 30,  title: '기침·숨참 감소',     desc: '기침과 숨참이 눈에 띄게 줄어들어요.' },
  { days: 90,  title: '폐 기능 향상',       desc: '폐 기능이 뚜렷하게 회복돼요.' },
  { days: 180, title: '컨디션 회복',        desc: '활력과 스트레스 대처력이 올라와요.' },
  { days: 365, title: '심장 위험 ↓',        desc: '심장질환 위험이 크게 줄어들어요.' },
]

// days(연속 금연 일수) → 현재/다음 마일스톤
export function quitRecovery(days) {
  const d = Math.max(0, Number(days) || 0)
  let idx = 0
  for (let i = 0; i < RECOVERY_MILESTONES.length; i++) if (d >= RECOVERY_MILESTONES[i].days) idx = i
  const cur = RECOVERY_MILESTONES[idx]
  const next = RECOVERY_MILESTONES[idx + 1] || null
  return {
    stage: idx + 1,
    total: RECOVERY_MILESTONES.length,
    title: cur.title,
    desc: cur.desc,
    next,
    daysToNext: next ? Math.max(0, next.days - d) : null,
  }
}
