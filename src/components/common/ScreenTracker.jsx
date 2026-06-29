import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { screenKeyOf, logScreenEvent } from '../../lib/queries'

// 화면 체류 추적 (자체 분석, 마이그 146) — UI/UX 개선용.
//   콘텐츠 수집 없음: 정규화 화면 키 + 체류시간만 기록. 프로드 한정(logScreenEvent 가 가드).
//   라우트 변경 시 직전 화면 flush, 백그라운드(visibilitychange/pagehide)에도 flush.
//   1초 미만 무시, 30분 캡(아이들 과대계상 방지). render 없음(null).
const MIN_MS = 1000
const MAX_MS = 30 * 60 * 1000

function ScreenTracker() {
  const loc = useLocation()
  const ref = useRef({ key: null, start: 0 })

  const flush = () => {
    const { key, start } = ref.current
    if (!key || !start) return
    const dur = Math.min(Date.now() - start, MAX_MS)
    ref.current.start = 0  // 중복 flush 방지
    if (dur >= MIN_MS) logScreenEvent(key, dur)
  }

  // 라우트 변경 — 직전 화면 flush 후 새 화면 시작
  useEffect(() => {
    flush()
    ref.current = { key: screenKeyOf(loc.pathname, loc.search), start: Date.now() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.pathname, loc.search])

  // 백그라운드/이탈 시 flush, 복귀 시 타이머 재시작(배경 시간 제외)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush()
      else if (ref.current.key) ref.current.start = Date.now()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', flush)
    return () => {
      flush()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', flush)
    }
  }, [])

  return null
}

export default ScreenTracker
