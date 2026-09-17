// 입력 중이던 내용을 «세션 저장소» 에 잠시 보관했다가, 화면이 다시 그려지면 되살린다.
//
// 배경 (2026-09-17 「피지컬:16전비」 자유게시판 제보):
//   갤럭시 + 홈화면 PWA 에서 「사진 추가」를 누르면 갤러리가 «별도 앱» 으로 뜬다. 그동안 안드로이드가
//   메모리를 회수하면 PWA 프로세스가 죽고, 돌아올 때 페이지가 «처음부터 다시 로드» 된다.
//   그러면 React state 가 전부 초기값으로 돌아가 글쓰기 모달이 사라지고 쓰던 글도 날아간다.
//   사용자 눈에는 「사진을 첨부하면 창이 아예 사라진다」로 보이고, 오류 문구는 «뜨지 않는다»
//   — 실패한 코드가 실행된 적이 없기 때문이다.
//
//   같은 원인을 2026-09-16 마법사(「대표 사진 고르면 1단계로 초기화」)에서 이미 겪었고
//   lib/wizardDraft 로 막았다. 이 파일은 그 방식을 여러 화면이 함께 쓰도록 일반화한 것이다.
//   [[lib/wizardDraft]] · [[components/program/CommunityPostModal]]
//
// ⚠️ 한계 — 사진 자체는 되살릴 수 없다.
//   File·objectURL 은 직렬화가 안 되므로 보관 대상이 아니다. 글·선택값까지만 복원되고
//   사진은 다시 골라야 한다. 메모리 회수 자체를 웹에서 막을 방법은 없다 — 피해를 줄이는 장치다.
//
// 사용:
//   const KEY = `compose:${programId}`
//   const [body, setBody] = useState(() => readDraft(KEY)?.body ?? '')
//   useEffect(() => { writeDraft(KEY, { body }) }, [KEY, body])
//   // 저장 성공·사용자가 직접 닫음 → clearDraft(KEY)
//
// 왜 sessionStorage 인가: 탭(앱)을 완전히 닫으면 사라져야 하는 «작성 중» 데이터다.
//   localStorage 면 며칠 뒤에도 옛 초안이 되살아나 더 혼란스럽다.

const PREFIX = 'draft:'
const DEFAULT_TTL_MS = 30 * 60_000   // 30분 — 마법사(wizardDraft)와 같은 값

// 보관본 읽기. 없거나·손상됐거나·TTL 지났으면 null.
export function readDraft(key, ttlMs = DEFAULT_TTL_MS) {
  if (!key) return null
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d?.savedAt || Date.now() - d.savedAt > ttlMs) {
      sessionStorage.removeItem(PREFIX + key)
      return null
    }
    return d
  } catch {
    return null   // 저장소 미지원·손상값 — 보관은 어디까지나 보조 수단
  }
}

export function writeDraft(key, data) {
  if (!key) return
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ ...data, savedAt: Date.now() }))
  } catch {
    /* 용량 초과·미지원 무시 */
  }
}

export function clearDraft(key) {
  if (!key) return
  try {
    sessionStorage.removeItem(PREFIX + key)
  } catch {
    /* 무시 */
  }
}
