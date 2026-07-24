import { useEffect, useRef, useState } from 'react'

// 통계 화면 전용 스크롤 진입 애니메이션 유틸.
//   - 페이드업(카드/섹션), 막대 자라남(scaleY), 숫자 카운트업
//   - 모두 뷰포트 진입 시 1회만 (IntersectionObserver + unobserve)
//   - prefers-reduced-motion: reduce → 즉시 최종 상태

export const STATS_EASE = 'cubic-bezier(.2,.75,.25,1)'
export const SPRING_EASE = 'cubic-bezier(.34,1.56,.64,1)'   // 선택 시 살짝 튕기는 스프링

export function useReducedMotion() {
  const [rm, setRm] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setRm(mq.matches)
    const on = () => setRm(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return rm
}

// 뷰포트 첫 진입 감지(1회) — 한 번 보이면 unobserve
export function useInViewOnce({ threshold = 0.15, rootMargin = '0px 0px -8% 0px' } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const obs = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { setInView(true); obs.unobserve(el) }
    }, { threshold, rootMargin })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, inView]
}

// 카드/섹션 페이드업 — opacity 0→1 + translateY(16px)→0. index 로 70ms stagger.
//   주의: will-change/transform 은 자식의 position:fixed(모달·팝업) 기준을 바꿔버리므로(컨테이닝 블록),
//   will-change 는 쓰지 않고, 다 뜨면 transform:none 으로 되돌려 팝업이 뷰포트 기준으로 뜨게 한다.
export function Reveal({ children, index = 0, className, as: Tag = 'div' }) {
  const [ref, inView] = useInViewOnce()
  const rm = useReducedMotion()
  const shown = inView || rm
  const style = rm ? undefined : {
    opacity: shown ? 1 : 0,
    transform: shown ? 'none' : 'translateY(16px)',
    transition: `opacity .55s ${STATS_EASE} ${index * 0.07}s, transform .55s ${STATS_EASE} ${index * 0.07}s`,
  }
  return <Tag ref={ref} className={className} style={style}>{children}</Tag>
}

// 세로 막대 자라남 — 컨테이너가 뷰에 들어오면 각 막대 scaleY 0→1 (왼→오 wave).
//   컨테이너에 ref, 각 막대에 barGrowStyle(grown, rm, i) 를 병합.
export function useBarGrow(opts) {
  const [ref, inView] = useInViewOnce(opts)
  const rm = useReducedMotion()
  return [ref, inView || rm, rm]
}

export function barGrowStyle(grown, rm, i, baseDelay = 0.15, step = 0.016) {
  if (rm) return { transformOrigin: 'bottom' }
  return {
    transformOrigin: 'bottom',
    transform: grown ? 'scaleY(1)' : 'scaleY(0)',
    transition: `transform .55s ${STATS_EASE} ${baseDelay + i * step}s`,
    willChange: 'transform',
  }
}

// 뷰 진입 시 0→value 로 굴러 올라가는 값(1회). 렌더링은 호출부에서 format 으로.
export function useCountUp(value, { duration = 900 } = {}) {
  const [ref, inView] = useInViewOnce()
  const rm = useReducedMotion()
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!inView) return
    if (rm) { setN(value); return }
    let raf, start = null
    const tick = (t) => {
      if (start == null) start = t
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)   // easeOutCubic
      setN(value * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
      else setN(value)
    }
    raf = requestAnimationFrame(tick)
    return () => { if (raf) cancelAnimationFrame(raf) }
  }, [inView, value, duration, rm])
  return [ref, n]
}

// 숫자 카운트업 span — value 0→목표. suffix/prefix, format 커스터마이즈.
export function CountUp({ value, duration = 900, className, prefix = '', suffix = '', format = (x) => Math.round(x) }) {
  const [ref, n] = useCountUp(value, { duration })
  return <span ref={ref} className={className}>{prefix}{format(n)}{suffix}</span>
}
