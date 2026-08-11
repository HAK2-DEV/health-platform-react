import { useState, useEffect, useRef } from 'react'

// ⚠️ 임시 진단 오버레이 — 키보드 과제(B) 측정용. 해결 후 제거.
//   inner(window.innerHeight)가 키보드 시 줄어드는지 = interactive-widget=resizes-content 작동 여부.
//   minInner 가 668→340 처럼 줄면 작동(콘텐츠 뷰포트 축소) → 모달이 키보드 위로.
function KeyboardDebug() {
  const [d, setD] = useState({})
  const minInnerRef = useRef(99999)
  useEffect(() => {
    const vv = window.visualViewport
    const update = () => {
      const inner = window.innerHeight
      const vvh = vv ? Math.round(vv.height) : inner
      if (inner < minInnerRef.current) minInnerRef.current = inner
      setD({ inner, vv: vvh, minInner: minInnerRef.current })
    }
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
      position: 'fixed', top: '90px', left: '8px', right: '8px', zIndex: 99999,
      background: 'rgba(0,0,0,0.9)', color: '#3f6', font: 'bold 15px monospace',
      padding: '10px 12px', pointerEvents: 'none', textAlign: 'center', borderRadius: '10px', lineHeight: 1.7,
    }}>
      지금 inner:{d.inner} vv:{d.vv}
      <br />
      <span style={{ color: '#fd6' }}>키보드때 minInner:{d.minInner}</span>
    </div>
  )
}

export default KeyboardDebug
