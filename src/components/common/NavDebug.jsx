import { useState } from 'react'
import { useLocation } from 'react-router-dom'

// 임시 네비게이션 디버그 — ?navdebug=1 일 때만 노출(sessionStorage 유지). 일반 사용자엔 안 보임.
//   history.length(push마다 +1, replace는 그대로) + 현재 경로 + location.key 로 스택 추적.
//   대시보드→프로그램→미션→뒤로 각 단계에서 이 숫자를 보면 어디서 엔트리가 빠지는지 판별.
function NavDebug() {
  const location = useLocation()
  const [on] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).has('navdebug')
      if (q) sessionStorage.setItem('navdebug', '1')
      return q || sessionStorage.getItem('navdebug') === '1'
    } catch {
      return false
    }
  })
  if (!on) return null
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,.82)',
        color: '#37ff8b',
        font: '11px/1.4 monospace',
        padding: '3px 7px',
        maxWidth: '100%',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      len:{typeof window !== 'undefined' ? window.history.length : '?'} · {location.pathname}
      {location.search} · key:{location.key}
    </div>
  )
}

export default NavDebug
