import { useState, useEffect } from 'react'

// ⚠️ 임시 진단 오버레이 — 키보드 과제(B) 측정용. 해결 후 제거.
//   화면 최상단에 실제 뷰포트 수치를 실시간 표시 → 키보드가 뷰포트를 줄이는지(resize)
//   덮는지(overlay) 판별. inset = 키보드가 가리는 높이(px).
function KeyboardDebug() {
  const [d, setD] = useState({})
  useEffect(() => {
    const vv = window.visualViewport
    const update = () => setD({
      inner: window.innerHeight,
      vv: vv ? Math.round(vv.height) : '-',
      top: vv ? Math.round(vv.offsetTop) : '-',
      inset: vv ? Math.round(window.innerHeight - vv.height - vv.offsetTop) : '-',
      client: document.documentElement.clientHeight,
      dvh: Math.round(window.innerHeight),
    })
    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.85)', color: '#3f6', font: '11px monospace',
      padding: '3px 8px', pointerEvents: 'none', textAlign: 'center', letterSpacing: '0.3px',
    }}>
      inner:{d.inner} · vv:{d.vv} · top:{d.top} · inset:{d.inset} · client:{d.client}
    </div>
  )
}

export default KeyboardDebug
