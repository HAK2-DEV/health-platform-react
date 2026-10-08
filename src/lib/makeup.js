// 만회 인증(마이그 283)의 «규칙» 한 벌 — 반려 시각부터 24시간 안에 다시 올리면 원래 날로 인정.
//   최종 판정은 서버(a_verification_makeup_guard). 화면은 같은 규칙으로 미리 보여 줄 뿐이다.
//   악용 방지(본인 정의 2026-10-06): 같은 인증(첫 인증 + 그 만회들 = 묶음)이 운영자에게 3번 반려되면 그날은 마감.
//
// ⚠️ 이 숫자와 계산을 화면마다 복사하지 말 것. 인증 화면(MissionVerifyPage)·오늘 할 일(ProgramDetailPage)이
//    서로 다른 말을 하면 「화면마다 남은 시간이 다르다」가 된다. 바꿀 일이 있으면 여기만 바꾼다.
import { formatKstDate } from './queries'

export const MAKEUP_HOURS = 24
export const MAKEUP_MAX_REJECTS = 3

// KST 기준 «며칠째»인지 — 날짜 비교에만 쓴다(시각 비교가 아니다)
export const kstDayNum = (d) => {
  const [y, m, dd] = formatKstDate(d).split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, dd) / 86400000)
}

// 오늘 기준 날 이름 — 「오늘」·「어제」·「3일 전」. 시계는 이 안에서만 읽는다.
export const makeupDayWord = (iso) => {
  const n = kstDayNum(new Date()) - kstDayNum(new Date(iso))
  return n <= 0 ? '오늘' : n === 1 ? '어제' : `${n}일 전`
}

// 원래 날 — 「10월 5일(어제)」
export function makeupDayLabel(iso) {
  const [, m, dd] = formatKstDate(new Date(iso)).split('-').map(Number)
  return `${m}월 ${dd}일(${makeupDayWord(iso)})`
}

// 남은 시간 — 「20시간」·「35분」. 지났으면 null(= 더는 만회할 수 없다).
export function makeupLeftText(reviewedAt) {
  const ms = new Date(reviewedAt).getTime() + MAKEUP_HOURS * 3600000 - Date.now()
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600000)
  return h >= 1 ? `${h}시간` : `${Math.max(1, Math.floor(ms / 60000))}분`
}
