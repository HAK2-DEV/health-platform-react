// 배포 변경사항 — 사용자에게 보여 줄 「이번에 뭐가 달라졌는지」.
//
// 본인 결정(2026-10-06): **코드 상수**로 둔다. 노트는 «그 빌드가 무엇을 바꿨는지»를 설명하는 것이라
//   그 빌드와 같이 커밋되는 게 자연스럽고, 「노트는 올라갔는데 기능은 아직」이 구조적으로 불가능하다.
//   (DB 에 두면 배포 없이 오타를 고칠 수 있지만, 거짓말할 여지가 생긴다.)
//
// ⭐ 성격 — 개발자용 변경 목록이 아니다. 어느 날 갑자기 화면이 달라졌을 때 생기는
//   「왜 바뀌었지? 내 기록은 괜찮나? 쓰던 버튼은 어디 갔지?」를 그 자리에서 푸는 창이다.
//
// 문구 규칙
//   · 내부 용어·기능 이름 금지. 「무엇이 눈에 달라지는지」를 사용자 말로.
//   · 화면이 크게 바뀐 항목에는 `safe` 로 안심 문장을 같이 — 두려움의 핵심은 «내 기록»이다.
//   · 참여자가 보는 항목은 5개를 넘기지 않는다(운영자 전용 항목은 따로 센다). 다 읽지 않는다.
//
// ⚠️ 웹과 네이티브(Play)는 배포 시점이 다르다. 웹만 바뀐 것을 앱 사용자에게 「새로 생겼어요」라고
//    하면 거짓이 된다 → `platform: 'web' | 'native' | 'all'` 로 구분하고, 화면이 자기 플랫폼에 맞는
//    항목만 보여 준다.
//
// 새 배포를 할 때: 맨 «앞»에 새 항목을 추가한다. id 는 다시 쓰지 않는다(읽음 표시의 열쇠).

export const RELEASE_NOTES = [
  {
    id: '2026-10-07',
    date: '2026-10-07',
    title: '꾸준함이 보이기 시작했어요',
    platform: 'all',
    // ⭐ 한 항목의 순서는 **제목(text) → 사진(image) → 설명(detail)** (본인 2026-10-06).
    //    text   — 무엇이 바뀌었는지 한 줄
    //    image  — 그 화면. 사진으로 보여 줄 수 없는 변화라면 생략해도 된다(본인).
    //    detail — 그래서 내가 뭘 하면 되는지 한두 줄. 사진만 두고 글을 다 빼면 불친절해진다(본인).
    //    사진 속 이름은 전부 가상 인물. 실제 사용자 이름을 쓰지 않는다(공지는 모두가 본다).
    items: [
      {
        // 283·285. 가장 앞에 둔다 — 「반려 = 그날 기록이 영영 사라짐」이 가장 억울한 지점이었다.
        //   3번 반려되면 그날은 마감되는 규칙은 넣지 않았다. 해당되는 사람에게 화면에서 미리 알려 준다.
        kind: 'new',
        text: '인증이 반려돼도 다시 올릴 수 있어요',
        // 「다시 올린 건 늘 운영자 심사」(283 규칙 3)를 빼면, 자동 승인 미션 쓰던 사람이
        //   다시 올리고 「왜 점수가 안 들어오지」가 된다.
        // 사진은 «발견 지점»인 프로그램 홈 줄로 둔다 — 알림을 열어 보는 사람은 40% 뿐이라,
        //   「여기서 누르면 된다」를 보여 주는 게 다시 올리는 화면을 보여 주는 것보다 낫다.
        detail: '반려된 뒤 24시간 안에 다시 올리면 원래 날짜 인증으로 인정돼요. 알림이나 프로그램 홈 맨 위에서 바로 갈 수 있어요. 다시 올린 인증은 운영자가 한 번 더 확인해요.',
        image: '/release/makeup-redo.png',
        safe: '연속 기록도 원래 날짜로 이어져요',
      },
      {
        // 불꽃(280) — 「붙는 조건」과 「어디서 보이는지」는 같은 기능의 한 이야기라 한 항목으로 둔다(본인 2026-10-07).
        //   사진은 시상대 — 1·2·3단계가 한 화면에 나란히 있어 «이어질수록 커진다»를 한 번에 보여 준다.
        //   커뮤니티 자리로 사진을 바꾸고 싶으면 /dev/release?shot=community 를 찍으면 된다(찍는 자리는 남겨 뒀다).
        //   ⚠️ 「프로필 사진이 나오는 곳이면 어디나」로 적지 않는다 — 내 프로필(ProfilePage)·팀 상세·퀴즈 결과엔
        //      불꽃이 없다. 보편 약속으로 읽히면 자기 프로필에서 못 찾은 사람이 고장으로 오해한다. 자리를 «열거»만 한다.
        //   주간 스트릭 도장(HEAT 램프·8일부터 도장 뒤 불)도 같은 「꾸준함」 이야기라 여기 합쳤다(본인 2026-10-08).
        kind: 'new',
        text: '꾸준히 하면 불꽃이 붙어요',
        detail: '한 주에 3일 활동하면 프로필 사진 뒤에 불꽃이 생기고, 이어질수록 커져요(인증·퀴즈·클래스 참석). 랭킹, 커뮤니티 글과 댓글, 응원, 참여자 목록에서 볼 수 있어요. 주간 스트릭 도장도 이어 갈수록 초록에서 빨강으로 짙어지고, 8일째부터는 도장 뒤에 불이 붙어요.',
        image: '/release/flame-podium.png',
      },
      {
        // 068a759 종료 여운. ⚠️ end_date 기준이라 배포 즉시 «소급» 적용된다 — 이미 7일 넘게 지난
        //   프로그램의 참여자는 홈을 열자마자 카드가 없어진 것을 본다. 앱 안의 종료 안내는 「막 끝난」
        //   사람만 보므로, 그 집단에는 이 공지가 유일한 설명이다. safe 문장이 가장 절실한 자리.
        kind: 'changed',
        text: '끝난 프로그램은 한 줄로 접혀요',
        detail: '종료하고 7일이 지나면 홈과 프로그램 목록에서 「종료된 프로그램 N개」 한 줄로 접혀요. 그 줄을 누르면 그대로 열려요.',
        image: '/release/ended-fold.png',
        safe: '인증·점수·완주 기록은 하나도 지워지지 않아요',
      },
      {
        kind: 'new',
        text: '운영자 이름을 누르면 어떤 분인지 보여요',
        detail: '운영한 기수, 함께한 참여자 수, 보통 답장 시간과 한 줄 소개를 볼 수 있어요.',
        image: '/release/operator-profile.png',
      },
      {
        kind: 'changed',
        text: '참여하기 전에 무엇을 하는지 미리 볼 수 있어요',
        detail: '어떤 미션을 하는지, 내 인증을 누가 보는지, 점수가 공개되는지를 신청 화면에서 먼저 확인할 수 있어요.',
        // safe 를 두지 않는다 — 참여 «신청» 화면은 아직 이 프로그램에 기록이 없는 사람이 보는 곳이라
        //   안심시킬 두려움이 없다. 그 문장은 「끝난 프로그램 접기」로 옮겼다(거기가 진짜 필요한 자리).
        image: '/release/join-faq.png',
      },
      {
        // 참여자에게도 보인다(본인 2026-10-07). 참여자에겐 「왜 이 프로그램엔 불꽃이 없지?」의 답이 되고,
        //   운영자에겐 끄는 자리를 알려 준다 → 문구는 한쪽 말투가 아니라 «둘 다 읽는 말»로 썼다.
        //   끄는 자리는 글이 아니라 «그 화면 사진»으로.
        kind: 'new',
        text: '불꽃은 프로그램마다 켜고 끌 수 있어요',
        detail: '운영자가 프로그램 설정에서 「꾸준한 참여자에게 불꽃」을 끄면 그 프로그램에서는 불꽃이 보이지 않아요. 며칠을 채워야 할지(기본 주 3일)도 여기서 정해요.',
        image: '/release/flame-toggle.png',
      },
    ],
  },
]

export const KIND_META = {
  changed: { label: '달라진 화면', emoji: '🔄' },
  new: { label: '새로 생긴 것', emoji: '✨' },
  fixed: { label: '고친 문제', emoji: '🔧' },
  // 운영자에게만 보이는 항목 — 「어디서 끄나」처럼 운영자만 할 수 있는 이야기
  operator: { label: '운영자에게', emoji: '🛠' },
}

const SEEN_KEY = 'dodam_release_seen'

// 읽음 표시는 «기기»에 둔다(본인 결정). 계정에 두려면 users 컬럼이 필요한데,
//   「폰 바꾸면 한 번 더 뜬다」는 대가가 그보다 가볍다.
export function lastSeenReleaseId() {
  try { return localStorage.getItem(SEEN_KEY) } catch { return null }
}
export function markReleaseSeen(id) {
  try { localStorage.setItem(SEEN_KEY, id) } catch { /* 사생활 보호 모드 등 — 무시 */ }
}

// 지금 보여 줄 노트. 이미 읽었으면 null.
//   isNative 가 true 면 web 전용 항목은 뺀다(그 반대도).
//   isOperator 가 false 면 운영자 전용 항목(kind:'operator')은 뺀다 — 참여자에게 「끄는 법」은 할 수 없는 이야기다.
//
// ⚠️ platform 은 «항목»과 «노트» 두 곳에 쓸 수 있고, 항목에 적힌 것이 이긴다.
//    전에는 항목만 봤다 → 노트에 platform:'web' 을 적어도 조용히 무시돼서, 웹 전용 소식이
//    앱 사용자에게 그대로 나갈 뻔했다(2026-10-08 점검에서 발견). 둘 다 보도록 고쳤다.
export function pendingRelease({ isNative = false, isOperator = false } = {}) {
  const note = RELEASE_NOTES[0]
  if (!note) return null
  if (lastSeenReleaseId() === note.id) return null
  return releaseNoteFor(note, { isNative, isOperator })
}

// 이 사람이 볼 항목만 남긴 노트 — 읽음 여부와 무관. 없으면 null.
//   대시보드 게이트(pendingRelease)와 마이페이지 「업데이트 사항」(다시 보기)이 같은 필터를 쓴다(2026-10-08).
export function releaseNoteFor(note, { isNative = false, isOperator = false } = {}) {
  if (!note) return null
  const mine = isNative ? 'native' : 'web'
  const fits = (p) => !p || p === 'all' || p === mine
  if (!fits(note.platform)) return null
  const items = (note.items || []).filter(
    (it) => fits(it.platform ?? note.platform) && (it.kind !== 'operator' || isOperator)
  )
  if (items.length === 0) return null
  return { ...note, items }
}

// 「10월 7일」 — 마이페이지 목록용 날짜 표기
export function releaseDateLabel(note) {
  const [, m, d] = (note?.date || '').split('-').map(Number)
  return m && d ? `${m}월 ${d}일` : ''
}
