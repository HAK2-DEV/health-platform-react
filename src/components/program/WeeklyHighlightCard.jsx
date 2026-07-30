import { useMemo } from 'react'
import { Flame, ChevronRight } from 'lucide-react'
import UserAvatar from '../common/UserAvatar'
import { formatKstDate } from '../../lib/queries'

// 운영자 「이번 주」 요약 카드 (잔존율 레버 — 주간 하이라이트 1단계, 인앱).
//   fetchProgramStats(_raw 인증로그 + userStats + participantsCount) 재사용 → 클라 계산, 서버 X.
//   지표: 이번 주 인증(지난주 대비) · 활동 참여자/도달률 · 활발한 참여자 · 휴면 위험(응원 대상) · 심사 대기.
//   톤: 격려·규칙기반(강요 X). 종료 리포트와 결.
//   props: stats, pendingCount, onReview(심사 열기), onCheerUser(user → 응원 모달)

const DAY = 86_400_000
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return formatKstDate(d) }
function mmdd(s) { const p = s.split('-'); return `${+p[1]}/${+p[2]}` }

function computeWeekly(stats) {
  if (!stats) return null
  const raw = stats._raw || []
  const users = stats.userStats || []
  const pc = stats.participantsCount || 0

  const recent = new Set(); for (let i = 0; i < 7; i++) recent.add(daysAgo(i))
  const prev = new Set(); for (let i = 7; i < 14; i++) prev.add(daysAgo(i))

  let week = 0, prevWeek = 0
  const wkByUser = new Map()
  for (const r of raw) {
    const d = formatKstDate(new Date(r.submitted_at))
    if (recent.has(d)) { week++; wkByUser.set(r.user_id, (wkByUser.get(r.user_id) || 0) + 1) }
    else if (prev.has(d)) prevWeek++
  }
  const activeThisWeek = wkByUser.size
  const reach = pc > 0 ? Math.round((activeThisWeek / pc) * 100) : 0
  const byId = new Map(users.map(u => [u.user_id, u]))

  // 활발한 참여자 — 이번 주 인증 많은 순
  const activeTop = [...wkByUser.entries()]
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([id, c]) => ({ ...(byId.get(id) || { user_id: id, nickname: '참여자' }), week: c }))

  // 휴면 위험 — 예전엔 꾸준했는데(누적 2건+) 이번 주 0, 마지막 활동 3~13일 전(완전 휴면 7일+ 전에 챙김)
  const now = Date.now()
  const atRisk = users
    .filter(u => (u.totalCount || 0) >= 2 && !wkByUser.has(u.user_id) && u.lastActiveAt)
    .map(u => ({ ...u, days: Math.floor((now - new Date(u.lastActiveAt).getTime()) / DAY) }))
    .filter(u => u.days >= 3 && u.days <= 13)
    .sort((a, b) => (b.totalCount || 0) - (a.totalCount || 0))
    .slice(0, 4)

  return { week, delta: week - prevWeek, activeThisWeek, reach, activeTop, atRisk, range: `${mmdd(daysAgo(6))}–${mmdd(daysAgo(0))}` }
}

function Person({ u, sub, action }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <UserAvatar avatarPath={u.avatar_path} nickname={u.nickname} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-800 truncate">{u.nickname || '참여자'}</p>
        {sub && <p className="text-[11px] text-gray-400 leading-tight">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

export default function WeeklyHighlightCard({ stats, pendingCount = 0, onReview, onCheerUser, plain = false }) {
  const hi = useMemo(() => computeWeekly(stats), [stats])
  if (!hi) return null
  const { week, delta, activeThisWeek, reach, activeTop, atRisk, range } = hi
  const shell = plain ? '' : 'mb-3 bg-white border border-gray-100 rounded-2xl shadow-soft p-4'

  const line = week === 0
    ? '이번 주 인증이 아직 없어요 — 응원이나 새 미션으로 불씨를 살려보세요.'
    : delta > 0 ? `지난주보다 활발해요 🔥 (+${delta}건)`
      : delta < 0 ? '이번 주는 조금 잠잠했어요. 챙길 참여자에게 응원 한 번 어때요?'
        : '지난주와 비슷한 페이스예요.'

  return (
    <div className={shell}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-bold text-gray-800">📈 이번 주</h3>
        <span className="text-[11px] text-gray-400 tabular-nums">{range}</span>
      </div>

      {/* 지표 2개 */}
      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
          <p className="text-[11px] text-emerald-700/80 font-semibold">인증</p>
          <p className="text-[19px] font-extrabold text-emerald-700 leading-tight">
            {week}<span className="text-[12px] font-bold">건</span>
            {delta !== 0 && (
              <span className={`ml-1 text-[11px] font-bold ${delta > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                {delta > 0 ? `▲${delta}` : `▼${-delta}`}
              </span>
            )}
          </p>
        </div>
        <div className="rounded-xl bg-sky-50 px-3 py-2.5">
          <p className="text-[11px] text-sky-700/80 font-semibold">활동 참여자</p>
          <p className="text-[19px] font-extrabold text-sky-700 leading-tight">
            {activeThisWeek}<span className="text-[12px] font-bold">명</span>
            <span className="ml-1 text-[11px] font-bold text-sky-500">도달 {reach}%</span>
          </p>
        </div>
      </div>

      {/* 활발한 참여자 */}
      {activeTop.length > 0 && (
        <div className="mb-2.5">
          <p className="flex items-center gap-1 text-[12px] font-bold text-gray-500 mb-1">
            <Flame className="w-3.5 h-3.5 text-orange-500" /> 활발한 참여자
          </p>
          <div className="space-y-0.5">
            {activeTop.map(u => (
              <Person key={u.user_id} u={u} sub={`이번 주 ${u.week}건`} />
            ))}
          </div>
        </div>
      )}

      {/* 휴면 위험 — 응원 대상 */}
      {atRisk.length > 0 && (
        <div className="mb-2.5">
          <p className="text-[12px] font-bold text-gray-500 mb-1">🌙 챙기면 좋은 참여자</p>
          <div className="space-y-0.5">
            {atRisk.map(u => (
              <Person key={u.user_id} u={u} sub={`${u.days}일째 조용해요 · 누적 ${u.totalCount}건`}
                action={onCheerUser && (
                  <button type="button" onClick={() => onCheerUser(u)}
                    className="flex-shrink-0 px-2.5 h-7 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold transition">
                    응원
                  </button>
                )} />
            ))}
          </div>
        </div>
      )}

      {/* 한마디 */}
      <p className="text-[12px] text-gray-500 leading-relaxed break-keep bg-gray-50 rounded-lg px-3 py-2">{line}</p>

      {/* 심사 대기 CTA */}
      {pendingCount > 0 && onReview && (
        <button type="button" onClick={onReview}
          className="mt-2.5 w-full flex items-center justify-center gap-1 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold transition">
          인증 심사 {pendingCount}건 검토하기 <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
