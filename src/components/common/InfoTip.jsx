import { useState, useRef } from 'react'
import { Info } from 'lucide-react'

// 공용 도움말 툴팁 — ⓘ 클릭(탭) 시 설명이 뜨는 툴팁. 모바일 친화(hover 아님).
//   위치는 fixed + 뷰포트 클램프 → ⓘ가 화면 가장자리에 있어도 툴팁이 밖으로 안 나감.
//   side: 'top'(기본, 위로) | 'bottom'(아래로). 위 공간 부족하면 자동으로 아래로 폴백.
function InfoTip({ children, side = 'top' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)

  const toggle = (e) => {
    e?.stopPropagation?.()
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const W = Math.min(260, window.innerWidth - 16)
      let left = r.left + r.width / 2 - W / 2          // ⓘ 중심 정렬 후
      left = Math.max(8, Math.min(left, window.innerWidth - W - 8))  // 좌우 8px 여백으로 클램프
      const up = side === 'top' && r.top > 130         // 위 공간 부족하면 아래로 폴백
      setPos({ left, top: up ? r.top - 8 : r.bottom + 8, width: W, up })
    }
    setOpen(o => !o)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        onBlur={() => setOpen(false)}
        className="text-gray-400 hover:text-emerald-500 transition flex-shrink-0 inline-flex align-middle"
        aria-label="도움말"
      >
        <Info className="w-[18px] h-[18px]" />
      </button>
      {open && pos && (
        <span
          className="fixed z-[100] text-[13px] font-normal text-white bg-gray-800 rounded-xl px-3.5 py-2.5 shadow-xl leading-relaxed break-keep text-left normal-case whitespace-pre-line"
          style={{ left: pos.left, top: pos.top, width: pos.width, transform: pos.up ? 'translateY(-100%)' : 'none' }}
        >
          {children}
        </span>
      )}
    </>
  )
}

export default InfoTip
