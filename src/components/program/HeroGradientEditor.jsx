import { useRef, useState } from 'react'
import { Plus, Minus, FlipHorizontal2 } from 'lucide-react'

// 히어로 배경 그라데이션 편집기 (캔바/피그마 스타일).
//   value = { angle(deg), stops:[{ pos(0~100), color('#RRGGBB'), alpha(0~100) }] }
//   onChange(next) — 변경 시 전체 객체 전달
//   angle: CSS linear-gradient 각도(90=좌→우, 180=위→아래, 0=아래→위)

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

function hexToRgba(hex, a) {
  let h = String(hex || '').replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) h = 'ffffff'
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`
}

// 저장값(구버전 number | 신버전 object | null) → 표준 그라데이션 객체
export function normalizeGradient(grad, oldStart) {
  if (grad && typeof grad === 'object' && Array.isArray(grad.stops) && grad.stops.length >= 2) {
    return {
      angle: typeof grad.angle === 'number' ? grad.angle : 90,
      stops: grad.stops.map((s) => ({
        pos: clamp(Math.round(Number(s.pos) || 0), 0, 100),
        color: /^#?[0-9a-fA-F]{6}$/.test(String(s.color || '')) ? (String(s.color).startsWith('#') ? s.color : `#${s.color}`) : '#FFFFFF',
        alpha: clamp(Math.round(Number(s.alpha ?? 100)), 0, 100),
      })),
    }
  }
  // 구버전(밝기 number + 시작점) 또는 기본 — 좌측 흰색 스크림
  const alpha = typeof grad === 'number' ? clamp(grad, 0, 100) : 100
  const start = typeof oldStart === 'number' ? clamp(oldStart, 0, 100) : 50
  return {
    angle: 90,
    stops: [
      { pos: 0, color: '#FFFFFF', alpha },
      { pos: start, color: '#FFFFFF', alpha },
      { pos: 100, color: '#FFFFFF', alpha: 0 },
    ],
  }
}

// 그라데이션 객체 → CSS
export function buildGradient(grad) {
  const g = normalizeGradient(grad)
  const parts = [...g.stops].sort((a, b) => a.pos - b.pos).map((s) => `${hexToRgba(s.color, s.alpha / 100)} ${s.pos}%`)
  return `linear-gradient(${g.angle}deg, ${parts.join(', ')})`
}

const DIRECTIONS = [
  { deg: 90, arrow: '→' }, { deg: 135, arrow: '↘' }, { deg: 180, arrow: '↓' }, { deg: 225, arrow: '↙' },
  { deg: 270, arrow: '←' }, { deg: 315, arrow: '↖' }, { deg: 0, arrow: '↑' }, { deg: 45, arrow: '↗' },
]

const CHECKER = {
  backgroundImage: 'linear-gradient(45deg,#d1d5db 25%,transparent 25%),linear-gradient(-45deg,#d1d5db 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d1d5db 75%),linear-gradient(-45deg,transparent 75%,#d1d5db 75%)',
  backgroundSize: '10px 10px',
  backgroundPosition: '0 0,0 5px,5px -5px,-5px 0',
}

function HeroGradientEditor({ value, onChange }) {
  const grad = normalizeGradient(value)
  const stops = grad.stops
  const [sel, setSel] = useState(0)
  const barRef = useRef(null)

  const emit = (next) => onChange?.(next)
  const setStops = (ns) => emit({ ...grad, stops: ns })
  const setStop = (i, patch) => setStops(stops.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  const addStop = () => {
    const sorted = [...stops].sort((a, b) => a.pos - b.pos)
    let bestGap = -1, mid = 50
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].pos - sorted[i].pos
      if (gap > bestGap) { bestGap = gap; mid = Math.round((sorted[i].pos + sorted[i + 1].pos) / 2) }
    }
    const ns = [...stops, { pos: mid, color: sorted[0].color, alpha: 50 }]
    setStops(ns); setSel(ns.length - 1)
  }
  const removeStop = (i) => {
    if (stops.length <= 2) return
    setStops(stops.filter((_, idx) => idx !== i))
    setSel(0)
  }
  const reverse = () => setStops(stops.map((s) => ({ ...s, pos: 100 - s.pos })))

  // 바 위 핸들 드래그로 위치 조절
  const startDrag = (i) => (e) => {
    e.preventDefault(); setSel(i)
    const bar = barRef.current
    if (!bar) return
    const rect = bar.getBoundingClientRect()
    const move = (ev) => {
      const x = (ev.clientX - rect.left) / rect.width
      setStop(i, { pos: clamp(Math.round(x * 100), 0, 100) })
    }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // 편집용 바 램프(각도 무시, 좌→우로 색 배치)
  const barRamp = `linear-gradient(90deg, ${[...stops].sort((a, b) => a.pos - b.pos).map((s) => `${hexToRgba(s.color, s.alpha / 100)} ${s.pos}%`).join(', ')})`

  return (
    <div className="space-y-2.5">
      {/* 방향 */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[12px] font-bold text-gray-600 mr-1">방향</span>
        {DIRECTIONS.map((d) => (
          <button key={d.deg} type="button" onClick={() => emit({ ...grad, angle: d.deg })}
            className={`w-6 h-6 rounded-md text-[13px] leading-none border transition ${grad.angle === d.deg ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}>{d.arrow}</button>
        ))}
        <button type="button" onClick={reverse} title="좌우 반전"
          className="w-6 h-6 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 flex items-center justify-center"><FlipHorizontal2 className="w-3.5 h-3.5" /></button>
      </div>

      {/* 그라데이션 바 + 핸들 */}
      <div className="relative pt-1 pb-3">
        <div ref={barRef} className="h-6 rounded-md overflow-hidden border border-gray-200" style={CHECKER}>
          <div className="w-full h-full" style={{ background: barRamp }} />
        </div>
        {stops.map((s, i) => (
          <button key={i} type="button" onPointerDown={startDrag(i)} onClick={() => setSel(i)}
            className="absolute -translate-x-1/2 rounded-[3px] shadow"
            style={{ left: `${s.pos}%`, top: 0, width: 12, height: 30, background: '#fff', border: sel === i ? '2px solid #10b981' : '1px solid #9ca3af', cursor: 'grab' }} aria-label={`중지점 ${i + 1}`}>
            <span className="block rounded-[1px]" style={{ position: 'absolute', inset: 2, backgroundColor: s.color }} />
          </button>
        ))}
      </div>

      {/* 중지점 목록 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-bold text-gray-600">중지점</span>
          <button type="button" onClick={addStop} className="w-6 h-6 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-1">
          {stops.map((s, i) => (
            <div key={i} onClick={() => setSel(i)}
              className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md cursor-pointer ${sel === i ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
              {/* 위치 % */}
              <input type="number" min={0} max={100} value={s.pos} onChange={(e) => setStop(i, { pos: clamp(Math.round(Number(e.target.value) || 0), 0, 100) })}
                className="w-12 text-[12px] text-right px-1 py-0.5 border border-gray-200 rounded [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <span className="text-[11px] text-gray-400">%</span>
              {/* 색 */}
              <label className="relative w-6 h-6 rounded border border-gray-200 overflow-hidden shrink-0" style={{ backgroundColor: s.color }}>
                <input type="color" value={s.color} onChange={(e) => setStop(i, { color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
              <span className="text-[11px] font-mono text-gray-500 uppercase w-12 shrink-0">{s.color.replace('#', '')}</span>
              {/* 불투명도 % */}
              <input type="number" min={0} max={100} value={s.alpha} onChange={(e) => setStop(i, { alpha: clamp(Math.round(Number(e.target.value) || 0), 0, 100) })}
                className="w-12 text-[12px] text-right px-1 py-0.5 border border-gray-200 rounded [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              <span className="text-[11px] text-gray-400">%</span>
              {/* 삭제 */}
              <button type="button" onClick={(e) => { e.stopPropagation(); removeStop(i) }} disabled={stops.length <= 2}
                className="ml-auto w-6 h-6 rounded-md text-gray-400 hover:text-red-500 disabled:opacity-30 flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default HeroGradientEditor
