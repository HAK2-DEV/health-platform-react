// 응원 콜라주의 정적 문구 풀 — 오늘의 응원 레터 + 응원 말풍선.
//   날짜 기반으로 매일 회전(코드 풀, DB 불필요). 금연 응원 탭에서 사용.

export const CHEER_LETTERS = [
  { title: '당신은 생각보다\n더 대단해요! 💚', body: '오늘도 당신의 하루를 응원합니다.' },
  { title: '한 번의 참음이\n습관이 됩니다 🌱', body: '오늘 그 선택, 정말 멋졌어요.' },
  { title: '숨이 한결\n가벼워지고 있어요 🍃', body: '몸이 당신의 노력에 답하고 있어요.' },
  { title: '어제의 나보다\n오늘이 더 강해요 💪', body: '작은 하루가 모여 큰 변화가 돼요.' },
  { title: '잠깐 흔들려도\n괜찮아요 🤍', body: '다시 시작하는 그 마음이 가장 빛나요.' },
  { title: '당신의 도전이\n누군가의 용기예요 ✨', body: '함께라서 더 멀리 갈 수 있어요.' },
  { title: '오늘도 한 개비\n덜 피웠나요? 👏', body: '그 한 개비가 미래의 건강이에요.' },
]

// 말풍선은 칸이 작아 짧게(2줄) — \n 으로 줄바꿈 고정.
export const CHEER_BUBBLES = [
  { text: '포기하지 않는\n여러분을 응원해요!', sign: '다시 시작' },
  { text: '오늘도 잘 버텼어요,\n정말 멋져요!', sign: '함께해요' },
  { text: '멈추지만 않으면\n그걸로 충분해요.', sign: '한 걸음씩' },
  { text: '폐가 매일\n맑아지고 있어요.', sign: '맑은 숨' },
  { text: '힘들 땐 우리가\n곁에 있어요.', sign: '같이 가요' },
]

// 연중 일자(day-of-year) 기준으로 매일 다른 문구. offset 으로 레터/말풍선 어긋나게.
function dayOfYear() {
  const d = new Date()
  const start = new Date(d.getFullYear(), 0, 0)
  return Math.floor((d - start) / 86400000)
}
function pickByDay(arr, offset = 0) {
  if (!arr.length) return null
  return arr[(dayOfYear() + offset) % arr.length]
}

export const todayLetter = () => pickByDay(CHEER_LETTERS, 0)
export const todayBubble = () => pickByDay(CHEER_BUBBLES, 2)
