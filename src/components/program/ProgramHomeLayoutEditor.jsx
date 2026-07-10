import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronUp, ChevronDown, Minus, Plus, X } from 'lucide-react'
import { HOME_BOX_ORDER, HOME_BOX_LABELS } from './ProgramHome'

// 박스 미리보기 — 실제 홈 모양의 흰 카드.
//   요약=2칸 반폭 / 메뉴=활성 개수(2~4)칸 / 오늘의 미션·최근 인증=큰 Long / 그 외=Wide.
const CARD = 'rounded-2xl bg-white shadow-md flex items-center justify-center'
function BoxShape({ boxKey, menuLabels, labels = HOME_BOX_LABELS }) {
  if (boxKey === 'summary') {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        <div className={`${CARD} h-[104px]`}><span className="text-[13px] font-bold text-gray-400">목표</span></div>
        <div className={`${CARD} h-[104px]`}><span className="text-[13px] font-bold text-gray-400">주간 스트릭</span></div>
      </div>
    )
  }
  if (boxKey === 'menu') {
    const items = (menuLabels && menuLabels.length) ? menuLabels : ['미션', '퀴즈', '커뮤니티', '랭킹']
    return (
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((l) => <div key={l} className={`${CARD} h-[96px]`}><span className="text-[12px] font-bold text-gray-400 break-keep text-center px-1">{l}</span></div>)}
      </div>
    )
  }
  const tall = boxKey === 'todayMissions' || boxKey === 'recent'
  return <div className={`${CARD} ${tall ? 'h-[148px]' : 'h-[84px]'}`}><span className="text-[15px] font-bold text-gray-400">{labels[boxKey] || boxKey}</span></div>
}

// 개요 화면(카드홈) 레이아웃 편집기 — 운영자 전용.
//   커스터마이즈 박스만 대상(고정: 표지 히어로·메뉴 카드 제외). 박스 크기는 고정(Rule 1) — 순서·숨김만.
//   ▲▼ 순서 변경 / − 숨김 / + 복원 / 완료 → home_layout 저장.
//   부모가 open 시에만 마운트(조건부 렌더) → 열 때마다 현재 값으로 초기화.
function ProgramHomeLayoutEditor({ currentOrder, currentHidden, menuLabels, saving, onClose, onSave,
  boxKeys = HOME_BOX_ORDER, boxLabels = HOME_BOX_LABELS, nonHideable = ['menu'] }) {
  const allKeys = boxKeys
  const [visible, setVisible] = useState(() => {
    const hiddenArr = (currentHidden || []).filter((k) => allKeys.includes(k))
    const base = (currentOrder && currentOrder.length ? currentOrder : allKeys).filter((k) => allKeys.includes(k))
    const vis = base.filter((k) => !hiddenArr.includes(k))
    allKeys.forEach((k) => { if (!vis.includes(k) && !hiddenArr.includes(k)) vis.push(k) })  // 신규 박스 편입
    return vis
  })
  const [hidden, setHidden] = useState(() => (currentHidden || []).filter((k) => allKeys.includes(k)))

  const move = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= visible.length) return
    const next = [...visible]
    ;[next[i], next[j]] = [next[j], next[i]]
    setVisible(next)
  }
  const hide = (k) => { setVisible((v) => v.filter((x) => x !== k)); setHidden((h) => [...h, k]) }
  const restore = (k) => { setHidden((h) => h.filter((x) => x !== k)); setVisible((v) => [...v, k]) }

  return (
    <div className="fixed inset-0 z-[70] bg-white flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 h-[52px] border-b border-gray-100 flex-shrink-0">
        <button type="button" onClick={onClose} className="p-1.5 -ml-1.5 text-gray-600" aria-label="닫기"><X className="w-5 h-5" /></button>
        <span className="text-[15px] font-bold text-gray-800">개요 화면 편집</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50">
        <h2 className="text-[19px] font-extrabold text-gray-900 leading-snug mb-1">순서를 바꾸거나<br />목록에서 숨길 수 있어요</h2>
        <p className="text-[12px] text-gray-400 mb-4">박스 크기는 고정이에요. 순서와 표시 여부만 바꿀 수 있어요.</p>

        {/* 표시 중인 박스 — 실제 홈 모양의 흰 카드. − 좌상단 / ▲▼ 우상단 / 이름 가운데 */}
        <p className="text-[12px] font-bold text-gray-500 mb-1">화면에 표시</p>
        <ul className="space-y-5 mt-4">
          {visible.map((k, i) => (
            <motion.li key={k} layout transition={{ type: 'spring', stiffness: 600, damping: 42 }} className="relative">
              {/* 숨기기 — 좌상단 오버행 (메뉴는 숨김 불가: 카드홈엔 탭바가 없어 내비 유지 필요) */}
              {!nonHideable.includes(k) && (
                <button type="button" onClick={() => hide(k)} className="absolute -top-2 -left-2 z-10 w-8 h-8 rounded-full bg-gray-300 border-4 border-gray-50 text-gray-600 flex items-center justify-center hover:bg-gray-400 transition" aria-label="숨기기">
                  <Minus className="w-4 h-4" strokeWidth={2.5} />
                </button>
              )}
              {/* 순서 — 우상단 (▲▼) */}
              <div className="absolute top-2.5 right-2.5 z-10 flex flex-col gap-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 transition" aria-label="위로"><ChevronUp className="w-4 h-4" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === visible.length - 1} className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 flex items-center justify-center disabled:opacity-30 hover:bg-gray-100 transition" aria-label="아래로"><ChevronDown className="w-4 h-4" /></button>
              </div>
              <BoxShape boxKey={k} menuLabels={menuLabels} labels={boxLabels} />
            </motion.li>
          ))}
          {visible.length === 0 && (
            <li className="text-[12px] text-gray-400 text-center py-4">표시 중인 박스가 없어요</li>
          )}
        </ul>

        {/* 숨긴 항목 */}
        {hidden.length > 0 && (
          <>
            <p className="text-[12px] font-bold text-gray-500 mt-6 mb-2">숨긴 항목</p>
            <ul className="space-y-2">
              {hidden.map((k) => (
                <li key={k} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-3 py-3.5">
                  <span className="flex-1 text-[14px] font-bold text-gray-400">{boxLabels[k] || k}</span>
                  <button type="button" onClick={() => restore(k)} className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 hover:bg-emerald-600 transition" aria-label="복원">
                    <Plus className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* 하단 완료 */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-100" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
        <button
          type="button"
          onClick={() => onSave({ order: visible, hidden })}
          disabled={saving}
          className="w-full h-12 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-[15px] font-bold transition disabled:opacity-50"
        >
          {saving ? '저장 중...' : '완료'}
        </button>
      </div>
    </div>
  )
}

export default ProgramHomeLayoutEditor
