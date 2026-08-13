import { useState, useEffect, useCallback } from 'react'

// 🔧 임시 진단 오버레이 — 갤럭시 가로 밀림 원인 규명용. 조사 끝나면 삭제.
//   켜기: 아무 URL 에 ?diag=1 붙여 한 번 열면 localStorage 에 저장 → PWA 안에서 계속 유지.
//   끄기: 오버레이의 ✕ (localStorage 플래그 제거).
//
//   판별 논리:
//   · docSW > docCW  → 문서에 가로 오버플로 있음 → [스캔] 으로 넘치는 요소 이름 확인.
//   · vv.scale ≠ 1 또는 vv.offsetLeft ≠ 0 → 뷰포트 자체가 확대/이동(핀치·팬) → DOM 아님.
//   · 둘 다 정상인데 밀리면 → 레이아웃 뷰포트(clientWidth) 값이 열기 전/후로 바뀌는지 비교.

function isOn() {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('diag') === '1') { localStorage.setItem('diag', '1'); return true }
    if (q.get('diag') === '0') { localStorage.removeItem('diag'); return false }
    return localStorage.getItem('diag') === '1'
  } catch { return false }
}

const sel = (el) => {
  if (!el || el === document.body) return 'body'
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ''
  const cls = (typeof el.className === 'string' ? el.className : '')
    .split(/\s+/).filter(Boolean).slice(0, 3).map(c => `.${c}`).join('')
  return `${tag}${id}${cls}`.slice(0, 60)
}

function DiagOverlay() {
  const [on] = useState(isOn)
  const [m, setM] = useState({})
  const [hits, setHits] = useState(null)

  const read = useCallback(() => {
    const de = document.documentElement
    const vv = window.visualViewport
    setM({
      iw: window.innerWidth,
      cw: de.clientWidth,           // 레이아웃 뷰포트 폭 (스크롤바 제외)
      dsw: de.scrollWidth,          // 문서 전체 폭 (가로 오버플로 있으면 cw 초과)
      bcw: document.body.clientWidth,
      bsw: document.body.scrollWidth,
      sx: Math.round(window.scrollX),
      sy: Math.round(window.scrollY),
      vvw: vv ? Math.round(vv.width) : '-',
      vvol: vv ? +vv.offsetLeft.toFixed(1) : '-',
      vvsc: vv ? +vv.scale.toFixed(3) : '-',
    })
  }, [])

  useEffect(() => {
    if (!on) return
    read()
    const id = setInterval(read, 300)
    const vv = window.visualViewport
    window.addEventListener('resize', read)
    window.addEventListener('scroll', read, true)
    vv?.addEventListener('resize', read)
    vv?.addEventListener('scroll', read)
    return () => {
      clearInterval(id)
      window.removeEventListener('resize', read)
      window.removeEventListener('scroll', read, true)
      vv?.removeEventListener('resize', read)
      vv?.removeEventListener('scroll', read)
    }
  }, [on, read])

  // 화면(뷰포트 폭)을 넘어가는 요소 스캔 — 오른쪽으로 넘치거나 왼쪽으로 음수인 요소.
  const scan = useCallback(() => {
    const cw = document.documentElement.clientWidth
    const out = []
    const all = document.querySelectorAll('body *')
    for (const el of all) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      const overRight = r.right - cw           // >0 이면 오른쪽으로 넘침
      const overLeft = -r.left                 // >0 이면 왼쪽으로 넘침(음수 위치)
      const over = Math.max(overRight, overLeft)
      if (over > 1) out.push({ s: sel(el), r: Math.round(r.right), l: Math.round(r.left), w: Math.round(r.width), o: Math.round(over) })
    }
    out.sort((a, b) => b.o - a.o)
    setHits(out.slice(0, 8))
  }, [])

  if (!on) return null

  const overflow = m.dsw > m.cw + 0.5
  const panned = (m.vvsc && m.vvsc !== 1) || (typeof m.vvol === 'number' && Math.abs(m.vvol) > 0.5)

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 2147483647,
      background: 'rgba(0,0,0,0.86)', color: '#fff', font: '11px/1.35 monospace',
      padding: '6px 8px calc(6px + env(safe-area-inset-bottom))', pointerEvents: 'auto',
    }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span>iw:<b>{m.iw}</b></span>
        <span>cw:<b style={{ color: '#6ee7b7' }}>{m.cw}</b></span>
        <span style={{ color: overflow ? '#fca5a5' : '#9ca3af' }}>dsw:<b>{m.dsw}</b>{overflow ? ` ⚠+${m.dsw - m.cw}` : ' ok'}</span>
        <span>body sw:<b>{m.bsw}</b>/{m.bcw}</span>
        <span>sx:<b style={{ color: m.sx ? '#fca5a5' : '#9ca3af' }}>{m.sx}</b></span>
        <span style={{ color: panned ? '#fca5a5' : '#9ca3af' }}>vv w:{m.vvw} ol:{m.vvol} sc:{m.vvsc}</span>
        <button onClick={scan} style={{ marginLeft: 'auto', background: '#059669', color: '#fff', border: 0, borderRadius: 5, padding: '3px 10px', fontWeight: 700 }}>스캔</button>
        <button onClick={() => setHits(null)} style={{ background: '#374151', color: '#fff', border: 0, borderRadius: 5, padding: '3px 8px' }}>지움</button>
        <button onClick={() => { try { localStorage.removeItem('diag') } catch { /* noop */ } window.location.reload() }} style={{ background: '#7f1d1d', color: '#fff', border: 0, borderRadius: 5, padding: '3px 8px' }}>✕</button>
      </div>
      {hits && (
        <div style={{ marginTop: 5, maxHeight: 150, overflowY: 'auto', borderTop: '1px solid #374151', paddingTop: 4 }}>
          {hits.length === 0 ? (
            <div style={{ color: '#6ee7b7' }}>넘치는 요소 없음 — 가로 오버플로 아님(뷰포트/스크롤바 문제일 수 있음)</div>
          ) : hits.map((h, i) => (
            <div key={i} style={{ color: '#fde68a' }}>
              +{h.o}px │ {h.s} <span style={{ color: '#9ca3af' }}>[l{h.l} r{h.r} w{h.w}]</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DiagOverlay
