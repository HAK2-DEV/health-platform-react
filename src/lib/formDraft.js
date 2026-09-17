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
// ⚠️ 왜 localStorage 인가 (2026-09-17 노트9 실기기 검증으로 «정정»):
//   처음엔 sessionStorage 로 만들었다. 「탭을 닫으면 사라져야 할 작성 중 데이터」라는 이유였고,
//   lib/wizardDraft 도 그렇게 돼 있었다. 그런데 노트9에서 실제로 프로세스를 죽였다 되살려보니
//   («am kill» = OS 메모리 회수와 동일한 SIGKILL) **sessionStorage 가 통째로 사라졌다**.
//   URL(?tab=community)은 복원됐는데 보관본만 증발 → 고치려던 바로 그 상황에서 무용지물이었다.
//   sessionStorage 는 탭 세션에 묶여 렌더러·브라우저 프로세스와 운명을 같이한다.
//   localStorage 는 디스크에 있어 프로세스 사망을 넘어 살아남는다 — 이 기능에는 이쪽이 맞다.
//   ⚠️ wizardDraft 도 같은 함정에 걸려 있다(마법사 대표사진 건은 «에뮬 재현 실패» 로 미검증 상태였다).
//
//   「며칠 뒤 옛 초안이 되살아나는」 부작용은 TTL 30분이 막는다. 그리고 저장 성공·사용자가 직접
//   닫았을 때 clearDraft 로 지우므로, 남는 것은 «비정상 종료로 잃을 뻔한» 것뿐이다.

const PREFIX = 'draft:'
const DEFAULT_TTL_MS = 30 * 60_000   // 30분

// 프로세스 사망을 넘어 살아남아야 하므로 localStorage. 미지원·차단 환경은 조용히 무시(보조 수단).
function store() {
  try { return window.localStorage } catch { return null }
}

// 보관본 읽기. 없거나·손상됐거나·TTL 지났으면 null.
export function readDraft(key, ttlMs = DEFAULT_TTL_MS) {
  if (!key) return null
  try {
    const s = store()
    if (!s) return null
    const raw = s.getItem(PREFIX + key)
    if (!raw) return null
    const d = JSON.parse(raw)
    if (!d?.savedAt || Date.now() - d.savedAt > ttlMs) {
      s.removeItem(PREFIX + key)
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
    store()?.setItem(PREFIX + key, JSON.stringify({ ...data, savedAt: Date.now() }))
  } catch {
    /* 용량 초과·미지원 무시 */
  }
}

export function clearDraft(key) {
  if (!key) return
  try {
    store()?.removeItem(PREFIX + key)
  } catch {
    /* 무시 */
  }
}
