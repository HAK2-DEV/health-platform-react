import { useRef, useEffect } from 'react'

// 추세 — 주식차트형 인터랙티브 캔버스 (운영자 통계).
//   좌우 팬(기간 이동) + 핀치/휠 확대·축소 + 탭/드래그 값표시.
//   y축은 "보이는 구간의 최소~최대"에 자동 맞춤 + 최고(파랑)/최저(주황) 마커.
//   기본 = 오늘 기준 과거 14일. props:
//     data  = [{ date:'YYYY-MM-DD', [field]:number }] (시작일~오늘)
//     field = 값 키 ('rate' | 'count' 등)   unit = 단위 표기 ('%' | '건')
//     maxCap = y축 상한 (참여율 100, 건수 등 무제한이면 Infinity)
//     subField/subUnit = 툴팁·최고/최저 라벨에 괄호로 덧붙일 보조값 (예: 참여율에 '(2명)')
//     interaction = 'pan'(기본: 드래그로 기간 이동) | 'scrub'(드래그로 손가락 위치의 날짜·값 툴팁 표시)
export default function ParticipationTrendChart({ data, height = 200, field = 'rate', unit = '%', maxCap = 100, subField = null, subUnit = '', interaction = 'pan' }) {
  const cvRef = useRef(null)

  useEffect(() => {
    const cv = cvRef.current
    if (!cv || !data || data.length === 0) return
    const ctx = cv.getContext('2d')
    const N = data.length
    const val = (d) => d[field]
    const subOf = (d) => (subField != null && d[subField] != null) ? ` (${d[subField]}${subUnit})` : ''
    const PAD = { l: 30, r: 10, t: 18, b: 30 }
    const DOW = ['일', '월', '화', '수', '목', '금', '토']
    const fmtMD = (ds) => { const p = ds.split('-'); return `${+p[1]}/${+p[2]}` }
    const dowOf = (ds) => DOW[new Date(ds + 'T00:00:00+09:00').getDay()]

    let W = 0, H = 0, dpr = 1
    let count = Math.min(14, N), start = Math.max(0, N - count)
    let active = null, yLo = 0, yHi = 100
    let drag = null, pinch = null

    const clampView = () => { count = Math.max(5, Math.min(N, Math.round(count))); start = Math.max(0, Math.min(N - count, start)) }
    const xOf = (i) => PAD.l + (i - start) * ((W - PAD.l - PAD.r) / Math.max(1, count - 1))
    const yOf = (r) => PAD.t + (1 - (r - yLo) / (yHi - yLo)) * (H - PAD.t - PAD.b)
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath() }

    function draw() {
      if (!W || !H) return
      ctx.clearRect(0, 0, W, H)
      const grid = '#eef1f0', sub = '#9aa8a1'
      const va = Math.max(0, Math.round(start)), vb = Math.min(N - 1, Math.round(start + count - 1))
      let vmin = Infinity, vmax = -Infinity, vminI = va, vmaxI = va
      for (let i = va; i <= vb; i++) { const r = val(data[i]); if (r < vmin) { vmin = r; vminI = i } if (r >= vmax) { vmax = r; vmaxI = i } }
      { let lo = vmin, hi = vmax; if (hi === lo) { lo = Math.max(0, lo - 5); hi = lo + 10 } const p = (hi - lo) * 0.18; yLo = Math.max(0, lo - p); yHi = Math.min(maxCap, hi + p); if (yHi - yLo < 2) yHi = yLo + 2 }
      // y 그리드 (보이는 최대/중간/최소)
      ctx.font = '10px -apple-system,sans-serif'; ctx.textBaseline = 'middle'
      ;[yHi, (yLo + yHi) / 2, yLo].forEach(v => { const y = yOf(v); ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r, y); ctx.stroke(); ctx.fillStyle = sub; ctx.textAlign = 'right'; ctx.fillText(Math.round(v) + unit, PAD.l - 6, y) })
      // 라인 + 영역 (clip)
      ctx.save(); ctx.beginPath(); ctx.rect(PAD.l, PAD.t - 6, W - PAD.l - PAD.r, H - PAD.t - PAD.b + 6); ctx.clip()
      const i0 = Math.max(0, Math.floor(start) - 1), i1 = Math.min(N - 1, Math.ceil(start + count) + 1)
      const grad = ctx.createLinearGradient(0, PAD.t, 0, H - PAD.b); grad.addColorStop(0, 'rgba(16,185,129,.22)'); grad.addColorStop(1, 'rgba(16,185,129,.02)')
      ctx.beginPath(); for (let i = i0; i <= i1; i++) { const x = xOf(i), y = yOf(val(data[i])); i === i0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) } ctx.lineTo(xOf(i1), H - PAD.b); ctx.lineTo(xOf(i0), H - PAD.b); ctx.closePath(); ctx.fillStyle = grad; ctx.fill()
      ctx.beginPath(); for (let i = i0; i <= i1; i++) { const x = xOf(i), y = yOf(val(data[i])); i === i0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) } ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke()
      if (count <= 25) { for (let i = i0; i <= i1; i++) { const x = xOf(i), y = yOf(val(data[i])); ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fillStyle = '#10b981'; ctx.fill() } }
      // 눌린 지점 크로스헤어 + 점 (라인과 함께 clip 안에서)
      if (active != null && active >= 0 && active < N) {
        const x = xOf(active), y = yOf(val(data[active]))
        ctx.strokeStyle = 'rgba(16,185,129,.5)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, PAD.t - 6); ctx.lineTo(x, H - PAD.b); ctx.stroke(); ctx.setLineDash([])
        ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fillStyle = '#10b981'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke()
      }
      ctx.restore()
      // 최고/최저 마커 + 라벨
      const tag = (i, label, color, above) => {
        const x = xOf(i), y = yOf(val(data[i])); if (x < PAD.l - 2 || x > W - PAD.r + 2) return
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke()
        ctx.font = 'bold 10px -apple-system,sans-serif'; const txt = label + ' ' + val(data[i]) + unit + subOf(data[i]); const tw = ctx.measureText(txt).width
        const bx = Math.max(PAD.l, Math.min(W - PAD.r - tw - 10, x - tw / 2 - 5)); const by = above ? Math.max(0, y - 18) : Math.min(H - PAD.b - 17, y + 5)
        ctx.fillStyle = color; rr(bx, by, tw + 10, 15, 5); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, bx + 5, by + 8)
      }
      tag(vmaxI, '최고', '#0ea5e9', true)
      if (vmaxI !== vminI) tag(vminI, '최저', '#f59e0b', false)
      // 툴팁(날짜·값)은 항상 맨 위에 — 최고/최저 라벨에 가리지 않도록 마지막에 그림
      if (active != null && active >= 0 && active < N) {
        const x = xOf(active)
        const txt = `${val(data[active])}${unit}${subOf(data[active])}  ·  ${fmtMD(data[active].date)}(${dowOf(data[active].date)})`
        ctx.font = 'bold 11px -apple-system,sans-serif'; const tw = ctx.measureText(txt).width
        const bx = Math.max(PAD.l, Math.min(W - PAD.r - tw - 14, x - tw / 2 - 7))
        ctx.fillStyle = 'rgba(17,24,39,.92)'; rr(bx, PAD.t - 4, tw + 14, 20, 6); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, bx + 7, PAD.t + 6)
      }
      // x 날짜 라벨
      ctx.fillStyle = sub; ctx.font = '10px -apple-system,sans-serif'; ctx.textBaseline = 'top'
      const ticks = Math.min(5, count)
      for (let k = 0; k < ticks; k++) {
        const idx = Math.max(0, Math.min(N - 1, Math.round(start + (count - 1) * k / Math.max(1, ticks - 1))))
        const x = xOf(idx); ctx.textAlign = k === 0 ? 'left' : k === ticks - 1 ? 'right' : 'center'
        ctx.fillText(fmtMD(data[idx].date), Math.max(PAD.l, Math.min(W - PAD.r, x)), H - PAD.b + 12)
      }
    }

    function resize() { dpr = window.devicePixelRatio || 1; W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw() }
    const idxAtX = (px) => Math.max(0, Math.min(N - 1, Math.round(start + (px - PAD.l) / ((W - PAD.l - PAD.r) / Math.max(1, count - 1)))))
    const zoomAt = (px, f) => { const sp = (W - PAD.l - PAD.r) / Math.max(1, count - 1); const focus = start + (px - PAD.l) / sp; const nc = Math.max(5, Math.min(N, Math.round(count * f))); const ratio = (focus - start) / count; count = nc; start = focus - ratio * nc; clampView(); draw() }

    const scrub = interaction === 'scrub'
    const onDown = (e) => {
      cv.setPointerCapture(e.pointerId)
      if (scrub) { active = idxAtX(e.offsetX); draw(); return }
      drag = { x: e.clientX, start, moved: false }; active = idxAtX(e.offsetX); draw()
    }
    const onMove = (e) => {
      if (pinch) return
      if (scrub) { active = idxAtX(e.offsetX); draw(); return }   // 스크럽: 손가락 위치 값 표시
      if (drag) { const sp = (W - PAD.l - PAD.r) / Math.max(1, count - 1); const dd = (e.clientX - drag.x) / sp; if (Math.abs(e.clientX - drag.x) > 3) drag.moved = true; start = drag.start - dd; clampView(); active = drag.moved ? null : idxAtX(e.offsetX); draw() }
      else { active = idxAtX(e.offsetX); draw() }
    }
    const onUp = () => { drag = null; if (scrub) { active = null; draw() } }
    const onLeave = () => { if (scrub || !drag) { active = null; draw() } }
    const onWheel = (e) => { e.preventDefault(); zoomAt(e.offsetX, e.deltaY > 0 ? 1.15 : 0.87) }
    const tdist = (e) => { const a = e.touches[0], b = e.touches[1]; return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) }
    const onTStart = (e) => { if (e.touches.length === 2) { drag = null; pinch = { d: tdist(e), c: count } } }
    const onTMove = (e) => { if (pinch && e.touches.length === 2) { e.preventDefault(); const f = pinch.d / tdist(e); count = Math.max(5, Math.min(N, Math.round(pinch.c * f))); clampView(); draw() } }
    const onTEnd = (e) => { if (e.touches.length < 2) pinch = null }

    const none = interaction === 'none'   // 비대화형 프리뷰 — 이벤트 미부착(부모 버튼 클릭 통과)
    if (!none) {
      cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointerleave', onLeave); cv.addEventListener('pointercancel', onUp)
      cv.addEventListener('wheel', onWheel, { passive: false })
      cv.addEventListener('touchstart', onTStart, { passive: true }); cv.addEventListener('touchmove', onTMove, { passive: false }); cv.addEventListener('touchend', onTEnd)
    }
    const ro = new ResizeObserver(resize); ro.observe(cv)
    clampView(); resize()
    return () => {
      ro.disconnect()
      if (!none) {
        cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointerleave', onLeave); cv.removeEventListener('pointercancel', onUp)
        cv.removeEventListener('wheel', onWheel); cv.removeEventListener('touchstart', onTStart); cv.removeEventListener('touchmove', onTMove); cv.removeEventListener('touchend', onTEnd)
      }
    }
  }, [data, field, unit, maxCap, subField, subUnit, interaction])

  // 스크럽=세로 스크롤 페이지로 넘김(pan-y), 비대화형=auto(탭 통과), 기본(pan)=none
  const touchAction = interaction === 'scrub' ? 'pan-y' : interaction === 'none' ? 'auto' : 'none'
  return <canvas ref={cvRef} style={{ width: '100%', height: `${height}px`, display: 'block', touchAction, borderRadius: '10px', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }} />
}
