import { useState, useRef, useEffect } from 'react'
import { Info } from 'lucide-react'

// 공용 도움말 툴팁 — ⓘ 클릭(탭) 시 설명이 뜨는 툴팁. 모바일 친화(hover 아님).
//   위치는 fixed + 뷰포트 클램프 → ⓘ가 화면 가장자리에 있어도 툴팁이 밖으로 안 나감.
//   side: 'top'(기본, 위로) | 'bottom'(아래로). 위 공간 부족하면 자동으로 아래로 폴백.
//   danger: 생성 후 변경 불가 등 「되돌릴 수 없는」 설정 경고 → ⓘ·툴팁을 빨간색으로.
//   openSignal: 부모가 이 값을 증가시키면 툴팁을 자동으로 연다(운영자가 한 번 읽도록). 마운트 시엔 안 열림.
function InfoTip({ children, side = 'top', danger = false, openSignal = 0 }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)

  const computePos = () => {
    if (!btnRef.current) return null
    const r = btnRef.current.getBoundingClientRect()
    const W = Math.min(260, window.innerWidth - 16)
    let left = r.left + r.width / 2 - W / 2          // ⓘ 중심 정렬 후
    left = Math.max(8, Math.min(left, window.innerWidth - W - 8))  // 좌우 8px 여백으로 클램프
    const up = side === 'top' && r.top > 130         // 위 공간 부족하면 아래로 폴백
    return { left, top: up ? r.top - 8 : r.bottom + 8, width: W, up }
  }
  const toggle = (e) => {
    e?.stopPropagation?.()
    if (!open) { const p = computePos(); if (p) setPos(p) }
    setOpen(o => !o)
  }
  // 부모 openSignal 증가 시 자동 오픈 (마운트/동일값에선 무시 — ref 로 실제 변화만 감지)
  const prevSignal = useRef(openSignal)
  useEffect(() => {
    if (openSignal === prevSignal.current) return
    prevSignal.current = openSignal
    if (openSignal <= 0) return
    const p = computePos()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (p) { setPos(p); setOpen(true) }
  }, [openSignal])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        onBlur={() => setOpen(false)}
        className={`transition flex-shrink-0 inline-flex align-middle ${danger ? 'text-red-400 hover:text-red-600' : 'text-gray-400 hover:text-emerald-500'}`}
        aria-label={danger ? '주의' : '도움말'}
      >
        <Info className="w-[18px] h-[18px]" />
      </button>
      {open && pos && (
        <span
          className={`fixed z-[100] text-[13px] font-normal text-white rounded-xl px-3.5 py-2.5 shadow-xl leading-relaxed break-keep text-left normal-case whitespace-pre-line ${danger ? 'bg-red-600' : 'bg-gray-800'}`}
          style={{ left: pos.left, top: pos.top, width: pos.width, transform: pos.up ? 'translateY(-100%)' : 'none' }}
        >
          {children}
        </span>
      )}
    </>
  )
}

export default InfoTip
