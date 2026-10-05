/**
 * 아바타·도장 뒤 불꽃(280) — 「사진이 곧 속불(the core)」 구조.
 *
 * 왜 이 구조인가 (앞선 3번의 실패에서 배운 것)
 *   ① 작은 SVG 배지 → 싼티·납작  ② 3D PNG 흔들기 → 움직임 과함
 *   ③ 불 한 덩이를 그려 사진 뒤에 깔기 → 제일 좋은 «속불»이 사진에 가려지고
 *      남는 건 삐뚤어진 바깥 실루엣뿐이라 «감자/가시» 가 됐다.
 *   레퍼런스(본인 공유 2026-10-05 ①②)를 뜯어보면 만화 불은
 *      «얇고 진한 바깥 테두리 + 그 안을 거의 다 채우는 밝은 속불» 이다.
 *   → 속불 자리에 사진을 넣는다. 사진을 감싸는 얇은 테두리(칼라) + 어깨에서 솟는 혀.
 *      사진이 불의 일부가 되므로 가려질 «아까운 부분»이 없다.
 *
 * 레퍼런스에서 뽑은 체크리스트
 *   1. 색은 3층 — 바깥 진한 주황, 중간 주황, 속은 훨씬 밝다. 테두리는 «얇고» 속이 넓다.
 *   2. 밑동이 넓고 밝다(불의 뿌리). 위로 갈수록 가늘어진다.
 *   3. 밑변 가운데에 뾰족한 V 홈이 있어 발이 둘로 갈린다.
 *   4. 혀는 밑동이 통통하고 끝이 «한쪽으로 말린다»(갈고리). 좌우가 다르다.
 *   5. 혀끼리 밑동에서 붙어 있고 사이 홈은 좁고 깊다. 키는 제각각, 제일 큰 혀는 가운데가 아니다.
 *   6. 테두리가 균일한 고리면 스티커가 된다 — 두께가 각도마다 달라야 한다.
 *
 * 밝은 배경 보정 ⚠️ 레퍼런스는 «검은 배경»이라 속불이 크림색(거의 흰색)이다.
 *   도담은 흰 카드 위다 — 크림색 속불은 렌더해 보니 그냥 사라졌다(scratchpad p7.png).
 *   그래서 속불을 «금색(#FFC32E→#FFE066)»으로 올렸다. 3단계 초록도 속불만은 금색인데,
 *   초록 + 끝이 뾰족한 혀 = 선인장/알로에로 읽히던 것을 금색 속불이 «불»로 돌려놓는다(p8.png 비교).
 *
 * 움직임 — 몸통 morph(<animate d>)는 폐기.
 *   ⓐ 본인 피드백이 「움직임이 과하다」였고 ⓑ 랭킹엔 수십 행이 동시에 뜨는데
 *   path 재계산은 매 프레임 비싸다. 대신 혀마다 CSS transform(scaleY + 1.8° 안쪽 회전)만
 *   서로 다른 주기로 돌린다. 칼라(사진 테두리)는 «정지» — 전체가 꿈틀대는 느낌을 없앤다.
 *   혀 밑동은 사진 «아래»에 묻혀 있어 회전해도 뜨는 곳이 안 보인다.
 *
 * 폐기한 대안
 *   · 극좌표 물결만으로 둘레를 다 두르기 → 토마토/파인애플(p2.png).
 *   · 위가 두꺼운 테두리 → 왕관. 불은 «밑동»이 두껍다.
 *   · 아래를 열어 초승달로 만들기 → 달걀에 불 얹은 꼴(p8.png). 닫는 쪽이 낫다.
 *   · 날리는 불씨(ember) → 40px 이하에서 작은따옴표 같은 점으로 보이고 움직임만 는다. 뺐다.
 *   · SVG filter 블러 → 금지(랭킹 수십 행). 3층 그라데이션으로 깊이를 낸다.
 *
 * 기하 검증: scratchpad aura-preview/ (p2~p9, sheet·sheet2·anim.png) 에서 정지 렌더로 확인.
 */
import { useId, useMemo } from 'react'

// viewBox 기준. 사진 원 = 중심 (CX, CY) 반지름 R. 혀가 위로 솟으므로 세로가 길다.
export const VW = 100, VH = 140, CX = 50, CY = 95, R = 30

const r2 = (n) => Math.round(n * 100) / 100
const RAD = Math.PI / 180

// 닫힌 곡선 — 촘촘히 뽑은 점을 Catmull-Rom 으로 이어 3차 베지어로.
function closedPath(pts) {
  const n = pts.length
  let d = `M ${r2(pts[0][0])} ${r2(pts[0][1])}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    d += ` C ${r2(p1[0] + (p2[0] - p0[0]) / 6)} ${r2(p1[1] + (p2[1] - p0[1]) / 6)}`
      + ` ${r2(p2[0] - (p3[0] - p1[0]) / 6)} ${r2(p2[1] - (p3[1] - p1[1]) / 6)}`
      + ` ${r2(p2[0])} ${r2(p2[1])}`
  }
  return `${d} Z`
}
function openPath(pts) {
  let d = ''
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)]
    d += ` C ${r2(p1[0] + (p2[0] - p0[0]) / 6)} ${r2(p1[1] + (p2[1] - p0[1]) / 6)}`
      + ` ${r2(p2[0] - (p3[0] - p1[0]) / 6)} ${r2(p2[1] - (p3[1] - p1[1]) / 6)}`
      + ` ${r2(p2[0])} ${r2(p2[1])}`
  }
  return d
}

// 칼라 두께표 — 0°가 위, 시계방향 15°씩 24칸. 위는 거의 0(혀가 대신한다), 아래가 제일 두껍다.
// 좌우가 일부러 다르다(대칭이면 과일로 읽힌다).
const TH = [0.8, 1.1, 1.7, 2.5, 3.4, 4.3, 5.2, 5.9, 6.4, 6.9, 7.2, 6.8, 6.2,
            7.0, 7.4, 6.6, 5.8, 5.0, 4.3, 3.5, 2.7, 2.0, 1.4, 1.0]
function thAt(u) {                    // 두께표 1차원 Catmull-Rom 보간
  const n = TH.length, s = u / (360 / n), i = Math.floor(s), f = s - i
  const p = (k) => TH[((k % n) + n) % n]
  const a = p(i - 1), b = p(i), c = p(i + 1), d = p(i + 2)
  return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)))
}

// 사진을 감싸는 칼라. mul = 띠별 두께 배수. 아래 두 군데 V 홈 = 레퍼런스의 «갈라진 발».
function collar(mul, swell) {
  const pts = []
  const N = 72
  for (let i = 0; i < N; i++) {
    const u = (i / N) * 360
    const d1 = Math.min(Math.abs(u - 193), 360 - Math.abs(u - 193))   // 큰 홈(가운데서 살짝 왼쪽)
    const d2 = Math.min(Math.abs(u - 148), 360 - Math.abs(u - 148))   // 작은 홈
    const th = (thAt(u) * swell - 4.6 * Math.exp(-((d1 / 8.5) ** 2)) - 2.3 * Math.exp(-((d2 / 7.5) ** 2))) * mul
    const a = (u - 90) * RAD, rr = R + Math.max(0.3, th)
    pts.push([CX + rr * Math.cos(a), CY + rr * Math.sin(a)])
  }
  return closedPath(pts)
}

// 혀 — 등뼈 spine(s) 위에 반폭 halfW(s) 를 «접선의 수직»으로 얹어 만든다.
//   삼각형 잎사귀가 되지 않게: lean 으로 중간이 옆으로 밀리고(S자),
//   curl 은 s^4.2 라 «끝 15%»에서만 확 말린다(갈고리). fat 은 배부른 정도, taper 는 가늘어지는 속도.
function tonguePath({ w, h, lean = 0, curl = 0, fat = 0.28, taper = 0.95 }) {
  const N = 14
  const sx = (s) => lean * Math.sin(Math.PI * s ** 0.9) + curl * s ** 4.2
  const sy = (s) => -h * s ** 0.93
  const hw = (s) => w * (1 - s) ** taper * (1 + fat * Math.sin(Math.PI * s ** 0.55))
  const left = [], right = []
  for (let i = 0; i <= N; i++) {
    const s = i / N, e = 0.004
    const dx = sx(Math.min(s + e, 1)) - sx(Math.max(s - e, 0))
    const dy = sy(Math.min(s + e, 1)) - sy(Math.max(s - e, 0))
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len, ny = dx / len, k = hw(s)
    left.push([sx(s) - nx * k, sy(s) - ny * k])
    right.push([sx(s) + nx * k, sy(s) + ny * k])
  }
  const pts = [...left, ...right.reverse()]
  pts.splice(N, 1)                                   // 끝점 중복 제거
  return `M ${r2(pts[0][0])} ${r2(pts[0][1])}${openPath(pts)} Z`
}

// 단계별 혀 배치. ang = 위에서 잰 각(오른쪽 +), h = 키, tilt = 기울기.
//   키가 제각각이고 제일 큰 혀가 가운데가 아니다(체크리스트 5).
//   ⚠️ h 는 「윗줄을 덮지 않는다」는 제약에서 역산한 값 — 랭킹 행 64px·아바타 40px 기준
//      제일 큰 혀 끝이 사진 위 ~17px(단계3·scale 0.8). 이웃 행의 여백 안에서 끝난다.
const LEVELS = {
  1: { swell: 0.84, tongues: [
    { ang: -36, w: 9, h: 14, lean: -2, curl: 3, tilt: -16, fat: 0.42, taper: 0.78 },
    { ang: -6, w: 11, h: 24, lean: -2, curl: 7, tilt: -2, fat: 0.26, taper: 1.02 },
    { ang: 22, w: 9, h: 16, lean: 2, curl: -4, tilt: 13, fat: 0.4, taper: 0.8 },
  ] },
  2: { swell: 1, tongues: [
    { ang: -52, w: 9, h: 16, lean: -1, curl: 3, tilt: -24, fat: 0.46, taper: 0.74 },
    { ang: -26, w: 11, h: 26, lean: -2, curl: 6, tilt: -12, fat: 0.32, taper: 0.9 },
    { ang: 3, w: 12, h: 34, lean: -3, curl: 9, tilt: 1, fat: 0.22, taper: 1.08 },
    { ang: 30, w: 10, h: 20, lean: 2, curl: -5, tilt: 17, fat: 0.44, taper: 0.76 },
  ] },
  3: { swell: 1.12, tongues: [
    { ang: -58, w: 10, h: 17, lean: -1, curl: 3, tilt: -28, fat: 0.5, taper: 0.7 },
    { ang: -32, w: 13, h: 25, lean: -2, curl: 5, tilt: -15, fat: 0.42, taper: 0.8 },
    { ang: -1, w: 14, h: 38, lean: -3, curl: 10, tilt: 1, fat: 0.26, taper: 1.02 },
    { ang: 26, w: 11, h: 23, lean: 2, curl: -6, tilt: 15, fat: 0.42, taper: 0.8 },
    { ang: 50, w: 9, h: 14, lean: 2, curl: -3, tilt: 26, fat: 0.5, taper: 0.7 },
  ] },
}

// 3층. mul = 칼라 두께 배수, w·h = 혀 축소율. 바깥 테두리를 «얇게» 두고 속불이 넓다(체크리스트 1).
const BANDS = [
  { k: 'o', mul: 1, w: 1, h: 1 },
  { k: 'm', mul: 0.72, w: 0.78, h: 0.88 },
  { k: 'c', mul: 0.4, w: 0.48, h: 0.68 },
]

// 1·2단계 주황 / 3단계 브랜드 초록. 속불(c)은 둘 다 금색 — 흰 배경에서 살아남는 유일한 밝기.
const PALETTE = {
  warm: { id: 'dodam-fire-w', o: ['#D32603', '#F74A00'], m: ['#FF7C0D', '#FFA114'], c: ['#FFC32E', '#FFE066'] },
  brand: { id: 'dodam-fire-g', o: ['#07663C', '#139551'], m: ['#22A45C', '#45CC80'], c: ['#FFC32E', '#FFE066'] },
}

/* ── 모션 (2026-10-05 재작업) ──────────────────────────────────────────────
 * 1차 모션이 「활활」이 아니라 「숨 쉬는」 것처럼 보인 이유 6가지 —
 *   ① 세 층(바깥·중간·속불)이 같은 주기·같은 위상이라 한 몸으로 기울고 늘어났다. 제일 큰 손실.
 *   ② 주기가 느렸다(0.95~1.45s). 만화 불의 날름거림은 그보다 빠르다.
 *   ③ `alternate` + ease-in-out 2키프레임 = 완벽한 사인파. 규칙적인 왕복은 호흡이지 불이 아니다.
 *   ④ 세로 늘임(scaleY)과 회전뿐이라 좌우로 «핥는» 성분이 없었다.
 *   ⑤ 칼라(사진 테두리)가 완전 정지라 빛이 일렁이지 않았다.
 *   ⑥ (추가로 찾은 것) 리스트의 아바타는 «동시에 마운트»된다 → 10행의 불이 전부 같은 위상으로
 *      맥동했다. 화면 전체가 한 박자로 뛰니 더더욱 기계적으로 보였다.
 *
 * 고친 방식
 *   · 리듬 3종(flame-a/b/c) × 6스톱 «불규칙» 키프레임 + linear. 꺾이는 지점이 생겨 «탁» 튄다.
 *     alternate 를 버리고 0%↔100% 를 이어 붙인 한 바퀴 루프로.
 *   · 좌우 성분을 skewX 로 넣었다. 밑동이 고정된 채 «끝»만 옆으로 휘니 혀가 핥는다.
 *     ⚠️ rotate 와 skewX 는 부호가 «반대»여야 끝이 같은 쪽으로 간다. 같은 부호로 뒀다가
 *       둘이 상쇄해 혀 끝이 5단위밖에 안 움직였다 — 이 작업에서 제일 오래 못 찾은 버그.
 *       부호를 고치자 끝 이동 폭이 5.0 → 10.3단위(40px 아바타에서 약 6.8px)로 두 배가 됐다.
 *   · 속불 층이 바깥보다 더 크게 솟았다 가라앉는다(세로 진폭 1.6배). 아래 BAND_MOTION 참고.
 *   · 늘어나면 가늘어진다(scaleX 반대로) — squash & stretch.
 *   · 인스턴스마다 시작 위상이 다르다(useId 해시). 랭킹 10행이 제각각 탄다.
 * 검증: scratchpad aura-preview/ 의 scan2·height·sweep(수치) + grow·extremes·tiny·strip·worst.png(눈).
 */
const RHYTHM = ['a', 'b', 'c', 'a', 'c']            // 혀 index → 키프레임 이름(이웃끼리 안 겹치게)
const PERIOD = [0.72, 0.56, 0.82, 0.64, 0.76]       // 혀 index → 주기(초). 혀마다 다르다.
const PHASE = [0, 0.48, 0.17, 0.66, 0.31]           // 혀 index → 시작 어긋남(주기의 몇 배)

/* 「커졌다 작아졌다」(본인 피드백 2026-10-05 ③, 레퍼런스 3.png = 작게→크게→작게 14프레임)
 *   앞선 모션은 scaleY 0.93↔1.07 이었다. 평균 1.0 을 가운데 두고 ±7% 라
 *   ⓐ 최댓값 1.07 이 카드 윗변 예산을 먹어 더 못 키웠고 ⓑ 7% 는 실루엣 변화로 안 읽혔다.
 *   → 진동대를 «위에 매달았다». 최댓값을 정지 높이(=승인된 실루엣)에 거의 묶고 아래로 떨어뜨린다.
 *     scaleY 는 이제 0.78 ~ 1.055 — 한 바퀴가 «승인된 정지 높이»를 위아래로 걸친다.
 *     체감 변화 폭 7% → 27%. 실루엣 꼭대기가 L3·md 기준 12.3 ~ 18.8px 사이를 오간다
 *     (예전엔 17.5 ~ 18.4px 로 1px 도 안 움직였다). 「더 높이」가 아니라 「더 크게 줄었다 커진다」.
 *   ⚠️ 0.75 아래로는 내리지 말 것 — 혀가 뭉툭해지고 사라지는 것처럼 보인다(본인 지시).
 *   ⚠️ 정지(reduce-motion)는 애니메이션 자체가 꺼져 transform 이 없다 = 승인된 모양 그대로.
 *      키프레임 평균이 1.0 보다 낮아도 «정지 모양»은 영향받지 않는다.
 */
// 키프레임의 세로 계수 Y 는 이제 [-1 .. +0.25] 다(대부분 음수 = 줄어 있음, 잠깐 솟는다).
// 띠별 진폭 — fx 좌우(skewX) · fr 회전 · fy 세로 신축 폭.
//   ⚠️ 측정해서 얻은 규칙(scratchpad sweep.mjs):
//     ⓐ 띠마다 «주기»나 «시작 시점»을 다르게 주면 속불이 바깥 테두리를 뚫는다 → 위상은 셋 다 같다.
//     ⓑ «세로 진폭» 차등은 거의 공짜다(속불 혀는 바깥 혀 키의 68% 라 위쪽 여유가 많다).
//        그래서 층 분리는 전부 세로로 낸다 — 속불이 바깥보다 훨씬 깊게 꺼졌다 솟는다.
//   ⚠️ 바깥 띠 fy 를 키우는 건 «아래로» 만 늘리는 것이라 윗변 예산과 무관하다.
//      대신 Y 의 최댓값(+0.25)을 키우면 윗변을 먹는다 — 거기는 건드리지 말 것(L3·md 18.8/20px).
const BAND_MOTION = {
  o: { fx: 9, fr: 4, fy: 0.22 },
  m: { fx: 10, fr: 4.75, fy: 0.28 },
  c: { fx: 11, fr: 5.5, fy: 0.36 },
}
// 혀마다 신축 폭이 다르다 — «제일 큰 혀가 제일 크게» 자랐다 줄어든다(레퍼런스도 중심 혀가 제일 역동적).
//   작은 혀까지 크게 흔들면 24px 에서 지저분해진다.
const tongueAmp = (h, hMax) => 0.72 + 0.28 * (h / hMax)

/* 단계별 «기세» (본인 피드백 2026-10-05 ④: 단계가 오를수록 더 활활)
 *   모양은 단계마다 다른데 모션이 똑같아서, 한 화면에 1·2·3단계가 섞여도 움직임으로는 구별이 안 됐다.
 *   speed  주기 배수(작을수록 빠르다)     amp  세로 신축 배수
 *   lat    좌우(skewX·rotate) 배수        spread 혀끼리 «제각각» 한 정도(주기·위상 분산)
 *   glow   속불 밝기 떨림 깊이            gd   밝기 떨림 주기(초)
 * ⚠️ amp 를 키우면 «아래로만» 늘어난다(진동대가 위에 매달려 있어서) — 윗변 예산과 무관하다.
 *    대신 혀가 제일 작아지는 값이 내려간다. 제일 큰 혀의 scaleY 최솟값이 0.75 밑으로 가면
 *    혀가 뭉툭해 보인다(본인 지시) → L3 의 amp 1.12 가 그 한계다(0.22×1.12 → 최솟값 0.754).
 * ⚠️ 키프레임의 세로 «최댓값(+0.25)» 은 어느 단계에서도 올리지 않는다 — 그쪽은 카드 윗변이다.
 * L1 은 혀가 원래 짧아 세게 줄이면 죽어 보인다 → 세로는 살짝만 줄이고(0.9)
 *    차이는 주로 «느린 속도 · 작은 좌우 · 가지런함» 으로 낸다.
 *    실측(실루엣 꼭대기가 오르내리는 폭, 40px 아바타): L1 3.6px · L2 5.9px · L3 7.6px.
 *    최고 높이: L1 10.9 · L2 16.5 · L3 19.1px (한도 20px). lg 는 L3 26.2px (한도 28px).
 */
const LEVEL_MOTION = {
  1: { speed: 1.15, amp: 0.9, lat: 0.78, spread: 0.6, glow: 0.6, gd: 1.4 },
  2: { speed: 1, amp: 1, lat: 1, spread: 1, glow: 1, gd: 1.17 },
  3: { speed: 0.85, amp: 1.12, lat: 1.45, spread: 1.4, glow: 1.55, gd: 0.92 },
}
const PERIOD_AVG = 0.7   // PERIOD 평균. spread 가 0 이면 모든 혀가 이 주기로 모인다(가지런).

function lickStyle(bandKey, i, inst, amp, lv) {
  const b = BAND_MOTION[bandKey], L = LEVEL_MOTION[lv]
  const rel = PERIOD[i % PERIOD.length] / PERIOD_AVG
  const dur = PERIOD_AVG * L.speed * (1 + (rel - 1) * L.spread)
  const ph = 0.5 + (PHASE[i % PHASE.length] - 0.5) * L.spread
  const frac = (((ph + inst) % 1) + 1) % 1
  return {
    '--fd': `${dur.toFixed(3)}s`,
    '--fdelay': `${(-frac * dur).toFixed(3)}s`,
    '--fx': `${+(b.fx * L.lat).toFixed(2)}deg`,
    '--fr': `${+(b.fr * L.lat).toFixed(2)}deg`,
    '--fy': +(b.fy * L.amp * amp).toFixed(4),
  }
}

// 경로 문자열은 (단계 × 키배수) 조합마다 한 번만 계산해 둔다 — 랭킹 수십 행에서 매번 돌 이유가 없다.
const cache = new Map()
function artwork(level, scale) {
  const key = `${level}|${scale}`
  const hit = cache.get(key)
  if (hit) return hit
  const cfg = LEVELS[level]
  const hMax = Math.max(...cfg.tongues.map((t) => t.h))
  const built = BANDS.map((b) => ({
    k: b.k,
    collar: collar(b.mul, cfg.swell),
    tongues: cfg.tongues.map((t) => {
      const a = (t.ang - 90) * RAD, rr = R - 4   // 밑동은 사진 아래로 4 만큼 묻는다
      const hm = b.h * scale
      return {
        at: `translate(${r2(CX + rr * Math.cos(a))} ${r2(CY + rr * Math.sin(a))}) rotate(${t.tilt})`,
        d: tonguePath({ w: t.w * b.w, h: t.h * hm, lean: t.lean * hm, curl: t.curl * hm, fat: t.fat, taper: t.taper }),
        amp: tongueAmp(t.h, hMax),
      }
    }),
  }))
  cache.set(key, built)
  return built
}

/**
 * level: 1(1주~) / 2(3주~) / 3(6주~, 브랜드 초록)
 * width: SVG 폭(px). 사진 지름 = width * 0.6.
 * scale: 혀의 «키»만 조절(테두리는 사진에 붙어 있어야 하므로 그대로). 좁은 행은 0.8 안팎.
 */
function FlameAura({ level = 1, width = 60, scale = 1 }) {
  const lv = Math.min(Math.max(level, 1), 3)
  const pal = lv >= 3 ? PALETTE.brand : PALETTE.warm
  const bands = useMemo(() => artwork(lv, scale), [lv, scale])
  const height = Math.round((width * VH) / VW)
  // 인스턴스마다 다른 시작 위상 — 리스트의 아바타는 동시에 마운트돼서 그냥 두면 전부 같이 뛴다.
  const uid = useId()
  const inst = useMemo(() => {
    let h = 2166136261
    for (let i = 0; i < uid.length; i++) h = Math.imul(h ^ uid.charCodeAt(i), 16777619)
    return ((h >>> 0) % 997) / 997
  }, [uid])
  return (
    <svg width={width} height={height} viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true" className="block overflow-visible">
      <defs>
        {BANDS.map((b) => (
          <linearGradient key={b.k} id={`${pal.id}-${b.k}`} gradientUnits="userSpaceOnUse" x1="0" y1={CY + R + 10} x2="0" y2="16">
            <stop offset="0" stopColor={pal[b.k][0]} />
            <stop offset="1" stopColor={pal[b.k][1]} />
          </linearGradient>
        ))}
      </defs>
      {bands.map((band) => (
        // 속불 층만 밝기가 아주 조금 떨린다 — 정지한 칼라(사진 테두리)에 빛이 일렁이게.
        <g
          key={band.k}
          fill={`url(#${pal.id}-${band.k})`}
          className={band.k === 'c' ? 'flame-glow' : undefined}
          style={band.k === 'c'
            ? { '--gd': `${LEVEL_MOTION[lv].gd}s`, '--gdelay': `${(-inst * LEVEL_MOTION[lv].gd).toFixed(3)}s`, '--gi': LEVEL_MOTION[lv].glow }
            : undefined}
        >
          <path d={band.collar} />
          {band.tongues.map((t, i) => (
            // 자리잡기는 <g> 의 transform, 흔들림은 안쪽 path 의 CSS transform — 서로 덮어쓰지 않게 분리.
            <g key={i} transform={t.at}>
              <path className={`flame-lick flame-${RHYTHM[i % RHYTHM.length]}`} style={lickStyle(band.k, i, inst, t.amp, lv)} d={t.d} />
            </g>
          ))}
        </g>
      ))}
    </svg>
  )
}

/**
 * 원형 요소(아바타·도장) 뒤에 불을 깐다.
 *   px    = 원 지름. 칼라가 그 원에 딱 맞게 붙는다.
 *   scale = 혀의 키(기본 1). 좁은 행(랭킹·댓글)은 0.8, 넓은 자리(시상대)는 1.
 *   level 0 이면 children 그대로 — 꺼진 사람은 평소 아바타다.
 */
export function FlameWrap({ level, px, scale = 1, title, className = '', children }) {
  if (!level) return children
  const width = Math.round((px / (R * 2)) * VW)
  const height = Math.round((width * VH) / VW)
  return (
    <span className={`relative inline-flex flex-shrink-0 ${className}`} title={title}>
      <span
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{ width, height, left: '50%', top: '50%', marginLeft: -width / 2, marginTop: -Math.round(height * (CY / VH)) }}
      >
        <FlameAura level={level} width={width} scale={scale} />
      </span>
      {children}
    </span>
  )
}

export default FlameAura
