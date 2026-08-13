// 🔧 임시 진단 오버레이 (바닐라 DOM · React 밖) — 갤럭시 가로 밀림 원인 규명용. 조사 후 삭제.
//   React 트리 밖에서 document.body 에 직접 붙이므로, 어떤 에러가 나도 앱 자체는 안 죽는다.
//   켜기: 아무 URL 에 ?diag=1 (한 번 열면 localStorage 저장 → PWA 안에서 계속 유지). 끄기: ✕ 버튼.
//
//   판별:
//   · dsw > cw       → 문서 가로 오버플로 → [스캔] 으로 넘치는 요소 확인.
//   · vv.scale ≠ 1 / offsetLeft ≠ 0 → 뷰포트 확대·이동(핀치/팬) → DOM 아님.
//   · sx ≠ 0         → 문서가 실제 가로 스크롤된 상태.
//   · 다 정상인데 cw 가 열기 전/후 바뀌면 → 스크롤바 공간 리플로우.

function isOn() {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('diag') === '1') { localStorage.setItem('diag', '1'); return true }
    if (q.get('diag') === '0') { localStorage.removeItem('diag'); return false }
    return localStorage.getItem('diag') === '1'
  } catch { return false }
}

function sel(el) {
  if (!el || el === document.body) return 'body'
  const tag = el.tagName ? el.tagName.toLowerCase() : '?'
  const id = el.id ? '#' + el.id : ''
  const cn = typeof el.className === 'string' ? el.className : ''
  const cls = cn.split(/\s+/).filter(Boolean).slice(0, 3).map(c => '.' + c).join('')
  return (tag + id + cls).slice(0, 56)
}

export function initDiag() {
  try {
    if (!isOn()) return
    if (document.getElementById('diag-overlay')) return

    const bar = document.createElement('div')
    bar.id = 'diag-overlay'
    bar.style.cssText = [
      'position:fixed', 'left:0', 'right:0', 'bottom:0', 'z-index:2147483647',
      'background:rgba(0,0,0,0.86)', 'color:#fff',
      'font:11px/1.35 monospace', 'padding:6px 8px', 'padding-bottom:calc(6px + env(safe-area-inset-bottom))',
    ].join(';')

    const row = document.createElement('div')
    row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center'
    const stat = document.createElement('div')
    stat.style.cssText = 'flex:1 1 auto;min-width:0'
    const btnScan = document.createElement('button')
    btnScan.textContent = '스캔'
    btnScan.style.cssText = 'background:#059669;color:#fff;border:0;border-radius:5px;padding:3px 10px;font-weight:700'
    const btnClr = document.createElement('button')
    btnClr.textContent = '지움'
    btnClr.style.cssText = 'background:#374151;color:#fff;border:0;border-radius:5px;padding:3px 8px'
    const btnX = document.createElement('button')
    btnX.textContent = '✕'
    btnX.style.cssText = 'background:#7f1d1d;color:#fff;border:0;border-radius:5px;padding:3px 8px'
    row.appendChild(stat); row.appendChild(btnScan); row.appendChild(btnClr); row.appendChild(btnX)

    const list = document.createElement('div')
    list.style.cssText = 'margin-top:5px;max-height:150px;overflow-y:auto;border-top:1px solid #374151;padding-top:4px;display:none'

    bar.appendChild(row); bar.appendChild(list)
    document.body.appendChild(bar)

    const read = () => {
      try {
        const de = document.documentElement
        const vv = window.visualViewport
        const cw = de.clientWidth
        const dsw = de.scrollWidth
        const sx = Math.round(window.scrollX)
        const over = dsw > cw + 0.5
        const vvol = vv ? +vv.offsetLeft.toFixed(1) : 0
        const vvsc = vv ? +vv.scale.toFixed(3) : 1
        const panned = vvsc !== 1 || Math.abs(vvol) > 0.5
        const red = (c) => `color:${c}`
        stat.innerHTML =
          `iw:<b>${window.innerWidth}</b>  ` +
          `cw:<b style="${red('#6ee7b7')}">${cw}</b>  ` +
          `<span style="${red(over ? '#fca5a5' : '#9ca3af')}">dsw:<b>${dsw}</b>${over ? ' ⚠+' + (dsw - cw) : ' ok'}</span>  ` +
          `bsw:<b>${document.body.scrollWidth}</b>/${document.body.clientWidth}  ` +
          `<span style="${red(sx ? '#fca5a5' : '#9ca3af')}">sx:<b>${sx}</b></span>  ` +
          `<span style="${red(panned ? '#fca5a5' : '#9ca3af')}">vv w:${vv ? Math.round(vv.width) : '-'} ol:${vvol} sc:${vvsc}</span>`
      } catch (e) { stat.textContent = 'read err: ' + (e && e.message) }
    }

    const scan = () => {
      try {
        const cw = document.documentElement.clientWidth
        const out = []
        const all = document.body.getElementsByTagName('*')
        for (let i = 0; i < all.length; i++) {
          const el = all[i]
          if (el.id === 'diag-overlay' || bar.contains(el)) continue
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          const o = Math.max(r.right - cw, -r.left)
          if (o > 1) out.push({ s: sel(el), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), o: Math.round(o) })
        }
        out.sort((a, b) => b.o - a.o)
        list.style.display = 'block'
        if (out.length === 0) {
          list.innerHTML = '<div style="color:#6ee7b7">넘치는 요소 없음 — 가로 오버플로 아님(뷰포트/스크롤바 쪽)</div>'
        } else {
          list.innerHTML = out.slice(0, 8).map(h =>
            `<div style="color:#fde68a">+${h.o}px │ ${h.s} <span style="color:#9ca3af">[l${h.l} r${h.r} w${h.w}]</span></div>`
          ).join('')
        }
      } catch (e) { list.style.display = 'block'; list.textContent = 'scan err: ' + (e && e.message) }
    }

    btnScan.addEventListener('click', scan)
    btnClr.addEventListener('click', () => { list.style.display = 'none'; list.innerHTML = '' })
    btnX.addEventListener('click', () => { try { localStorage.removeItem('diag') } catch { /* noop */ } bar.remove() })

    read()
    setInterval(read, 300)
    const vv = window.visualViewport
    window.addEventListener('resize', read)
    window.addEventListener('scroll', read, true)
    if (vv) { vv.addEventListener('resize', read); vv.addEventListener('scroll', read) }
  } catch (e) {
    // 진단이 앱을 죽이지 않도록 완전 무해화
    if (window.console) console.warn('[diag] init failed', e)
  }
}

export default initDiag
