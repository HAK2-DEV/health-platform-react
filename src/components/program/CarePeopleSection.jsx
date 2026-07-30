import { useMemo } from 'react'
import UserAvatar from '../common/UserAvatar'

// 「챙기면 좋은 참여자」 — 예전엔 꾸준했는데 최근 조용해진 참여자 + 바로 응원.
//   통계의 「이번 주 하이라이트」를 실행 가능하게 보강(진단 → 실제 응원).
//   기준: 누적 2건+ · 마지막 활동 3~13일 전(완전 휴면 7일+ 전에 챙김). userStats(lastActiveAt) 사용.
//   props: stats(fetchProgramStats), onCheerUser(user → 응원 모달)
const DAY = 86_400_000

export default function CarePeopleSection({ stats, onCheerUser }) {
  const atRisk = useMemo(() => {
    const users = stats?.userStats || []
    const now = Date.now()
    return users
      .filter(u => (u.totalCount || 0) >= 2 && u.lastActiveAt)
      .map(u => ({ ...u, days: Math.floor((now - new Date(u.lastActiveAt).getTime()) / DAY) }))
      .filter(u => u.days >= 3 && u.days <= 13)
      .sort((a, b) => (b.totalCount || 0) - (a.totalCount || 0))
      .slice(0, 6)
  }, [stats])

  if (atRisk.length === 0) return null

  return (
    <div className="mb-4 bg-white border border-gray-100 rounded-2xl shadow-soft p-4">
      <p className="text-[14px] font-bold text-gray-800">🌙 챙기면 좋은 참여자</p>
      <p className="text-[11.5px] text-gray-400 leading-snug mt-0.5 mb-2.5">최근 조용해진 참여자예요. 응원 한마디가 큰 힘이 돼요.</p>
      <div className="space-y-0.5">
        {atRisk.map(u => (
          <div key={u.user_id} className="flex items-center gap-2 py-1">
            <UserAvatar avatarPath={u.avatar_path} nickname={u.nickname} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-800 truncate">{u.nickname || '참여자'}</p>
              <p className="text-[11px] text-gray-400 leading-tight">{u.days}일째 조용해요 · 누적 {u.totalCount}건</p>
            </div>
            {onCheerUser && (
              <button type="button" onClick={() => onCheerUser(u)}
                className="flex-shrink-0 px-2.5 h-7 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold transition">
                응원
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
