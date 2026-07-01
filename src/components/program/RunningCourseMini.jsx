import { useRef, useEffect, useState, useCallback } from 'react'

// 달리기 코스 진행 오버레이 — 지도 사진(course-map.png) 위에 겹쳐 그린다.
//   · COURSE 경로는 지도 이미지 속 흰 도로 좌표(원본 2172×724px)에 맞춰 그림.
//   · 진행 라인은 pathLength=1 정규화 + strokeDashoffset(1-p) 로 시작점부터 정확히 p 만큼 채움.
//     선언적(React style)이라 첫 렌더부터 %와 일치 — dash 미설정으로 인한 "풀 그린 플래시" 없음.
//   · 위치 핀(teardrop)은 getPointAtLength 로 도로 위 좌표를 구해 이동. 지도는 object-cover 유지,
//     SVG 도 preserveAspectRatio="slice"(동일 크롭) → 핀은 컨테이너 실측 crop 변환으로 정확히 정합.
//   · dashoffset/핀좌표에 0.75s ease 트랜지션. 초기 마운트·reduced-motion 은 즉시 반영(튐 방지).
//   props: progress(0~100, 서버 계산값), showTest(데모 +25% 버튼), className
const BRAND = '#22A45C'
const EASE = 'cubic-bezier(.4,0,.2,1)'
const DUR = '0.9s'
// 지도 이미지 원본 픽셀 기준 (public/illustrations/themes/running/course-map.png = 2172×724)
const VB_W = 2172
const VB_H = 724
// 선 두께(사용자 단위). 지도폭≈208px, scale≈0.096 기준 46 → 렌더 약 4.4px.
const STROKE = 46
// 흰 도로 중심선: 좌하(출발) → 우상(결승 깃발 아래 도로 knob). 이미지 도로 좌표를 추적해 맞춤.
const COURSE = 'M 103 525 C 300 470 420 435 543 421 C 660 407 720 340 847 322 C 950 310 1000 322 1090 350 C 1150 370 1200 372 1280 360 C 1380 348 1450 330 1553 315 C 1650 302 1800 255 1900 235'

const clamp = (v) => Math.max(0, Math.min(1, v))
const reduceMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

function RunningCourseMini({ progress = 0, showTest = false, className = '' }) {
  const [demoP, setDemoP] = useState(null)   // 데모 버튼으로 덮어쓴 진행률(없으면 실제값 사용)
  const [animP, setAnimP] = useState(0)       // 실제 렌더 진행률 — 최초 로드 시 0→목표 채우기 애니
  const [badgeBelow, setBadgeBelow] = useState(false) // 핀이 상단 근처(결승)면 %배지를 아래로
  const p = demoP != null ? demoP : clamp((progress || 0) / 100) // 목표 진행률
  const pct = Math.round(animP * 100)

  const wrapRef = useRef(null)      // 오버레이 컨테이너(= 지도 영역, 실측용)
  const fillRef = useRef(null)      // 진행(초록) path — getTotalLength/getPointAtLength 용
  const pinRef = useRef(null)       // 위치 핀 wrapper(HTML, 픽셀좌표)
  const pinMountedRef = useRef(false)
  const pRef = useRef(animP)
  pRef.current = animP

  // 핀 위치(도로 위 좌표) 갱신 — object-cover/slice 와 동일 crop 변환. withTransition=false 면 즉시.
  const positionPin = useCallback((withTransition) => {
    const wrap = wrapRef.current, path = fillRef.current, pin = pinRef.current
    if (!wrap || !path || !pin) return
    const L = path.getTotalLength()
    if (!L) { requestAnimationFrame(() => positionPin(withTransition)); return } // 레이아웃 전이면 재시도
    const pt = path.getPointAtLength(L * pRef.current)
    const r = wrap.getBoundingClientRect()
    const w = r.width || 1, h = r.height || 1
    const scale = Math.max(w / VB_W, h / VB_H)
    const ox = (w - VB_W * scale) / 2
    const oy = 0 // 상단 정렬(이미지 object-top / SVG xMidYMin 과 일치) — 결승 깃발 상단 안 잘리게
    const px = ox + pt.x * scale
    const py = oy + pt.y * scale
    setBadgeBelow(py < 30) // 핀이 컨테이너 상단 30px 이내면 배지가 위로 잘리므로 아래로 뒤집음
    if (!withTransition) pin.style.transition = 'none'
    pin.style.left = `${px}px`
    pin.style.top = `${py}px`
    if (!withTransition) {
      pin.getBoundingClientRect() // reflush
      if (!reduceMotion()) pin.style.transition = `left ${DUR} ${EASE}, top ${DUR} ${EASE}`
    }
  }, [])

  // 목표(p) 변경 → animP 를 목표로 이동. 최초 마운트는 animP=0 에서 시작하므로 첫 진입 시 0→목표
  //   채우기 애니가 재생됨. rAF 로 다음 프레임에 값 변경 → 첫 프레임(0%)이 그려진 뒤 트랜지션이 걸림.
  //   reduced-motion 은 즉시(애니 없음).
  useEffect(() => {
    if (reduceMotion()) { setAnimP(p); return }
    const id = requestAnimationFrame(() => setAnimP(p))
    return () => cancelAnimationFrame(id)
  }, [p])

  // animP(렌더 진행률) 변경 → 핀 위치 갱신. 첫 세팅(0%)·reduced-motion 은 즉시, 이후 트랜지션.
  useEffect(() => {
    positionPin(pinMountedRef.current && !reduceMotion())
    pinMountedRef.current = true
  }, [animP, positionPin])

  // 컨테이너 크기 변동(회전/레이아웃) 시 즉시 재배치
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => positionPin(false))
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [positionPin])

  const onTest = useCallback(() => {
    setDemoP((prev) => {
      const base = prev != null ? prev : clamp((progress || 0) / 100)
      const next = Math.round((base + 0.25) * 4) / 4
      return next > 1.0001 ? 0 : Math.min(1, next)
    })
  }, [progress])

  const fillTransition = reduceMotion() ? 'none' : `stroke-dashoffset ${DUR} ${EASE}`

  return (
    <div ref={wrapRef} className={`absolute inset-0 overflow-hidden ${className}`}>
      {/* 코스 라인 — 지도(object-cover)와 동일 crop(slice)으로 겹침. 늘어나도 선 두께 유지 */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMin slice"
        className="absolute inset-0 w-full h-full"
        role="img"
        aria-label={`코스 진행률 ${pct}%`}
      >
        {/* 베이스(아직 안 지난 구간) — 흰색. 두께는 사용자 단위(≈렌더 4.4px). non-scaling-stroke 는
            dash 단위를 화면 px 로 바꿔 pathLength 채우기를 깨므로 사용하지 않음 */}
        <path d={COURSE} fill="none" stroke="#FFFFFF" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
        {/* 진행 라인 — pathLength=1 정규화, dashoffset(1-p) 로 정확히 p 만큼 채움(선언적) */}
        <path ref={fillRef} d={COURSE} fill="none" stroke={BRAND} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round"
          pathLength={1}
          style={{ strokeDasharray: 1, strokeDashoffset: 1 - animP, transition: fillTransition }} />
      </svg>

      {/* 위치 핀 + %배지 — 도로 위 좌표를 따라다님. wrapper 원점(left/top)=핀 tip 좌표 */}
      <div ref={pinRef} className="absolute">
        {/* 핀 — tip 이 wrapper 원점(0,0)에 오도록 translate(-50%,-100%) */}
        <svg width="15" height="19" viewBox="0 0 15 19" className="absolute drop-shadow" style={{ transform: 'translate(-50%, -100%)' }}>
          <path d="M7.5,19 C4,12 0,10 0,6 A7.5,7.5 0 1 1 15,6 C15,10 11,12 7.5,19 Z" fill={BRAND} stroke="#FFFFFF" strokeWidth="1.5" />
          <circle cx="7.5" cy="6" r="2.7" fill="#FFFFFF" />
        </svg>
        {/* %배지 — 기본은 핀 위, 상단 근처(결승)면 tip 아래로 뒤집어 잘림·깃발 겹침 방지 */}
        <span
          className="absolute px-1 py-[1px] rounded-full bg-white/90 backdrop-blur text-[9px] font-extrabold text-emerald-600 tabular-nums leading-none shadow-sm whitespace-nowrap"
          style={{ transform: badgeBelow ? 'translate(-50%, 4px)' : 'translate(-50%, calc(-100% - 20px))' }}
        >
          {pct}%
        </span>
      </div>

      {showTest && (
        <button
          type="button"
          onClick={onTest}
          className="absolute bottom-1.5 right-1.5 text-[10px] font-bold text-white bg-emerald-600/90 hover:bg-emerald-600 rounded-full px-2 py-1 shadow transition"
        >
          +25% ({pct}%)
        </button>
      )}
    </div>
  )
}

export default RunningCourseMini
