/**
 * 프로그램 상세(표준 카드홈) 「오늘 할 일」 칸 — 참여자. 본인 레퍼런스 2장(접힘·펼침) 2026-10-06, 실제 화면 2026-10-08.
 *   데이터·규칙은 lib/todayTodo.js(useTodayTodo). dev 시안 /dev/program 도 같은 부품을 쓴다.
 *
 * 항목 = 지금 할 일(인증·풀기) → 기다리는 일(심사 중·채점 중) → 오늘 끝낸 일 순.
 * 항목마다 진행 단계: 미션 「인증 → 심사 → 점수」(자동 승인 미션은 심사가 없어 「인증 → 점수」), 퀴즈 「풀기 → 채점 → 점수」.
 * 하나의 민트 상자: 머리줄(제목 · 요약 알약 · 오른쪽 위 ▼) + 첫 항목. ▼ 를 누르면 그 아래로 나머지 항목과
 *   「오늘 N명이 인증했어요」(0명이면 안 그린다)가 펼쳐지고 ▼ 는 ▲ 로 돈다(본인 2026-10-06 — 따로 떠 있던 「더 보기」 상자 대신).
 *   접힘·펼침이 같은 상자라 머리줄과 ▼ 자리가 움직이지 않고, 첫 항목도 그대로 있다.
 * 글자는 대시보드 ⑧과 같은 4단계(18 섹션 / 15 본문 / 12.5 라벨).
 */
import { useState, Fragment } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'

// redo = 다시 확인 필요(반려) — 빨강 대신 장미색: 잘못이 아니라 «한 번 더»라는 뜻
const STEP_TEXT = { now: 'text-emerald-600', done: 'text-emerald-600', wait: 'text-amber-600', redo: 'text-rose-600', todo: 'text-gray-500' }
const STEP_DOT = { now: 'bg-emerald-500', done: 'bg-emerald-500', wait: 'bg-amber-500', redo: 'bg-rose-500', todo: 'bg-gray-300' }
// 단계 사이 막대 — 그 다음 단계에 «도달했으면» 채운다(심사 중이면 인증→심사 구간이 초록→주황으로 차 있다, 본인 2026-10-06)
const STEP_BAR = { now: 'bg-emerald-400', done: 'bg-emerald-400', wait: 'bg-gradient-to-r from-emerald-400 to-amber-400', redo: 'bg-gradient-to-r from-emerald-400 to-rose-400', todo: 'bg-gray-200' }

function Stepper({ steps }) {
  return (
    <div className="mt-3 flex items-center">
      {steps.map((s, i) => (
        <Fragment key={s.label}>
          {i > 0 && <span aria-hidden="true" className={`flex-1 h-[3px] rounded-full mx-2 ${STEP_BAR[s.state]}`} />}
          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-bold ${STEP_TEXT[s.state]}`}>
            <span aria-hidden="true" className={`w-2 h-2 rounded-full ${STEP_DOT[s.state]}`} />
            {s.label}
          </span>
        </Fragment>
      ))}
    </div>
  )
}

function TodoItem({ it, onGo }) {
  return (
    <div className="rounded-2xl bg-white px-3.5 pt-3.5 pb-3 shadow-soft">
      <div className="flex items-center gap-3">
        <img
          src={it.icon}
          alt=""
          aria-hidden="true"
          className="w-11 h-11 object-contain flex-shrink-0"
          onError={(e) => { e.currentTarget.src = '/icons/feature/mission.png' }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold leading-snug text-gray-900 break-keep line-clamp-2">{it.title}</p>
          <p className="mt-0.5 text-[12.5px] text-gray-500 truncate">{it.sub}</p>
        </div>
        <button
          type="button"
          onClick={() => onGo?.(it.go)}
          className={`flex-shrink-0 rounded-full px-3.5 py-2.5 text-[15px] font-bold transition active:scale-[0.97] ${it.primary ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700'}`}
        >
          {it.action}
        </button>
      </div>
      {/* 다시 확인 — 운영자 메모(사유)를 운영자 이름으로. 평균 36자라 두 줄까지 */}
      {(it.memo || it.memoNote) && (
        <div className="mt-2.5 rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] leading-snug">
          {it.memo && (
            <p className="text-rose-800 break-keep line-clamp-2"><span className="font-bold">{it.memoBy}</span> · {it.memo}</p>
          )}
          {/* 만회 시간 — 잘리면 안 되는 정보라 제목 밑 한 줄이 아니라 여기 */}
          {it.memoNote && <p className={`font-bold text-rose-700 ${it.memo ? 'mt-1' : ''}`}>{it.memoNote}</p>}
        </div>
      )}
      <Stepper steps={it.steps} />
    </div>
  )
}

export default function TodayTodoCard({ items = [], verifierCount = 0, feedEnabled = true, onGo }) {
  const [open, setOpen] = useState(false)
  if (!items.length) return null
  const total = items.length
  const canToggle = total > 1                 // 한 건뿐이면 펼칠 게 없다 — ▼ 없이 처음부터 다 보인다
  const expanded = !canToggle || open
  const reviewWait = items.filter(it => it.kind === 'review').length
  const gradeWait = items.filter(it => it.kind === 'quiz' && it.steps.some(s => s.state === 'wait')).length
  const redoCnt = items.filter(it => it.kind === 'redo').length
  // 알약은 짧게 — 총 건수 + 가장 급한 상태 하나(다시 확인 > 심사 중 > 채점 중)
  const pill = [`${total}건`, redoCnt ? `${redoCnt}건 다시 확인` : reviewWait ? `${reviewWait}건 심사 중` : gradeWait ? `${gradeWait}건 채점 중` : null].filter(Boolean).join(' · ')
  const [first, ...rest] = items
  const hasMore = rest.length > 0 || verifierCount > 0

  return (
    <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-emerald-50/70 to-teal-50 p-3">
      {/* 머리줄 — 오른쪽 위 ▼ 버튼으로 펼치고 접는다(누르는 자리 40px). 제목은 버튼 밖(버튼 안에 제목을 넣지 않는다) */}
      <div className="flex items-center gap-2 px-1 pb-2.5">
        <h3 className="text-[18px] font-extrabold text-gray-900">오늘 할 일</h3>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[12.5px] font-bold text-gray-700">{pill}</span>
        {canToggle && (
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            aria-label={open ? '오늘 할 일 접기' : `오늘 할 일 나머지 ${total - 1}건 펼치기`}
            className="ml-auto -mr-2 -my-1.5 w-10 h-10 grid place-items-center rounded-full text-gray-500 hover:bg-white/70 transition"
          >
            <motion.svg
              viewBox="0 0 10 6"
              aria-hidden="true"
              className="w-2.5 h-[7px]"
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <path d="M0 0h10L5 6z" fill="currentColor" />
            </motion.svg>
          </button>
        )}
      </div>

      <TodoItem it={first} onGo={onGo} />

      {/* 나머지 — 첫 항목 아래로 펼쳐진다. 카드 그림자가 잘리지 않게 좌우·아래로 여유를 두고 그만큼 되돌린다 */}
      <AnimatePresence initial={false}>
        {expanded && hasMore && (
          <motion.div
            key="rest"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden -mx-2 px-2 -mb-2 pb-2"
          >
            <div className="pt-2 flex flex-col gap-2">
              {rest.map(it => <TodoItem key={it.key} it={it} onGo={onGo} />)}
              {/* 오늘 인증한 사람 수 — 0명이면 안 그린다. 커뮤니티(피드)가 꺼진 프로그램은 갈 곳이 없어 글만 */}
              {verifierCount > 0 && (feedEnabled ? (
                <button type="button" onClick={() => onGo?.('feed')} className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-3 text-left shadow-soft">
                  <img src="/icons/feature/community.png" alt="" aria-hidden="true" className="w-6 h-6 object-contain flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-[15px] font-bold text-gray-800">오늘 {verifierCount}명이 인증했어요</span>
                  <span className="inline-flex items-center text-[12.5px] font-bold text-emerald-700 flex-shrink-0">
                    보러 가기<ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-3 shadow-soft">
                  <img src="/icons/feature/community.png" alt="" aria-hidden="true" className="w-6 h-6 object-contain flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-[15px] font-bold text-gray-800">오늘 {verifierCount}명이 인증했어요</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
