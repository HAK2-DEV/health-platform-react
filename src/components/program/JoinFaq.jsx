// 가입 전 불안 해소 (2026-10-05 본인 결정) — 「참여하기」를 누르기 직전이 두려움을 처음 만나는 곳이다.
//   본인이 꼽은 질문: 「뭘 해야 하지?」 「내 인증을 다른 사람이 보나?」 「어떤 미션을 하는 거지?」
//   「내 점수가 다른 사람에게 보이나?」 「경쟁형인가 성장형인가?」
//
// ⭐ 답은 «운영자가 실제로 켜 둔 설정»에서 끌어온다. 일반론을 쓰면 거짓이 되고, 들어와서
//    다르면 신뢰를 잃는다. 설정을 못 읽는 항목은 아예 쓰지 않는다(모르면 침묵).
//
// 디자인: 질문-답 목록. 똑같은 카드 3~4개를 나열하지 않고(§13-2) 한 겹 안에서 여백으로 묶는다.

const CERT_BOARD = 'cert'

// 인증 공개 정책 — MissionVerifyPage 와 같은 출처를 읽는다(두 곳이 갈리면 안내가 거짓이 된다).
function feedAnswer(program) {
  if (!program?.feed_enabled) return '올린 인증은 운영자만 봐요'
  const boards = program?.community_settings?.boards
  const cert = Array.isArray(boards) ? boards.find((b) => b.id === CERT_BOARD) : null
  switch (cert?.feedVisibility || 'public') {
    case 'private': return '올린 인증은 운영자만 봐요'
    case 'optin_public':
    case 'optin_private': return '올릴 때마다 공개할지 직접 고를 수 있어요'
    default: return '같은 프로그램 참여자에게 보여요'
  }
}

// 랭킹 / 성장형 — ranking_enabled 가 꺼져 있으면 gamification_type 보다 우선(ProgramDetailPage 와 같은 규칙)
function rankAnswer(program) {
  if (program?.ranking_enabled === false) return '순위를 매기지 않아요. 내 기록만 쌓여요'
  const g = program?.gamification_type
  if (g === 'GARDEN') return '순위 대신 내 정원이 자라요'
  if (g === 'CONSTELLATION') return '순위 대신 내 별자리가 완성돼요'
  return '참여자끼리 점수 순위표가 있어요'
}

function Qa({ q, children }) {
  return (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      <p className="text-[12.5px] font-bold text-gray-800">{q}</p>
      <div className="text-[13px] text-gray-600 mt-1 leading-relaxed break-keep">{children}</div>
    </div>
  )
}

function JoinFaq({ program, missions = [] }) {
  if (!program) return null

  const main = missions.filter((m) => m.title)
  const shown = main.slice(0, 3)
  const rest = main.length - shown.length
  const anyManual = missions.some((m) => m.manual)

  return (
    <section className="mb-[9px]">
      {/* 섹션 제목 — 글자만. 이모지는 섹션 제목에 쓰지 않는다(§3·§13-4) */}
      {/* 「참여하면 이런 거예요」가 어색하다는 본인 피드백(2026-10-05) → 「프로그램 미리보기」.
          ⚠️ 앱의 preview_enabled(비참여자 둘러보기 모드)와 말이 겹친다 — 뜻이 갈리면 이 쪽을 바꾼다. */}
      <h3 className="text-lg font-bold text-gray-800 mb-2">프로그램 미리보기</h3>
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2 shadow-sm">
        {main.length > 0 && (
          <Qa q="무엇을 하나요?">
            <ul className="space-y-1">
              {shown.map((m) => (
                <li key={m.id} className="flex items-baseline gap-1.5">
                  <span className="text-gray-300 flex-shrink-0">·</span>
                  <span className="break-keep">{m.title}</span>
                  {m.requiresImage && <span className="text-[11px] text-gray-400 flex-shrink-0">사진</span>}
                </li>
              ))}
            </ul>
            {rest > 0 && <p className="text-[12px] text-gray-400 mt-1">그 밖에 {rest}개</p>}
          </Qa>
        )}

        <Qa q="내가 올린 인증은 누가 보나요?">{feedAnswer(program)}</Qa>
        <Qa q="점수와 순위가 다른 사람에게 보이나요?">{rankAnswer(program)}</Qa>
        {missions.length > 0 && (
          <Qa q="올리면 바로 인정되나요?">
            {anyManual ? '운영자가 확인한 뒤 점수가 들어가요' : '올리면 바로 인정돼요'}
          </Qa>
        )}
        <Qa q="중간에 그만둬도 되나요?">언제든 나갈 수 있어요. 지금까지 쌓인 기록은 남아요</Qa>
      </div>
    </section>
  )
}

export default JoinFaq
