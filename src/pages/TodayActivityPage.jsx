import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { queryKeys, fetchTodayActivityDetail } from '../lib/queries'
import LoadingState from '../components/common/LoadingState'

// 「오늘의 활동」 — 대시보드 활동요약 타일 클릭 시 진입. 단일 4탭 · 보기 전용(2026-07-19).
//   탭: 미션 완료 / 게시물 작성 / 댓글 활동 / 획득 점수. 각 탭 = 오늘(KST) 것만 시간 역순.
//   진입: /profile/activity/today?tab=missions|posts|comments|points
const ICON = {
  missions: '/icons/activity/mission.png',
  posts: '/icons/activity/record.png',
  comments: '/icons/activity/comment.png',
  points: '/icons/activity/point.png',
}
const ICON_SCALE = { missions: 1.25, posts: 1.85, comments: 1.45, points: 0.84 }
const TABS = [
  { key: 'missions', label: '미션 완료', accent: 'bg-emerald-50 text-emerald-700' },
  { key: 'posts', label: '게시물 작성', accent: 'bg-sky-50 text-sky-700' },
  { key: 'comments', label: '댓글 활동', accent: 'bg-amber-50 text-amber-700' },
  { key: 'points', label: '획득 점수', accent: 'bg-violet-50 text-violet-700' },
]

function Icon3D({ tab }) {
  return (
    <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
      <img src={ICON[tab]} alt="" aria-hidden="true" style={{ transform: `scale(${ICON_SCALE[tab]})` }} className="w-full h-full object-contain" />
    </div>
  )
}
function Row({ onClick, children }) {
  const cls = 'w-full flex items-start gap-3 p-3.5 bg-white rounded-2xl border border-gray-100 shadow-soft text-left'
  return onClick
    ? <button type="button" onClick={onClick} className={`${cls} hover:border-emerald-200 hover:shadow-elevated active:scale-[0.99] transition`}>{children}</button>
    : <div className={cls}>{children}</div>
}
function Empty({ label }) {
  return (
    <div className="text-center py-16">
      <img src="/icons/growth/sprout.png" alt="" aria-hidden="true" className="w-16 h-16 object-contain mx-auto mb-2" />
      <p className="text-sm text-gray-500">오늘은 아직 {label} 활동이 없어요</p>
    </div>
  )
}

function TodayActivityPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id
  const [params, setParams] = useSearchParams()
  const tab = ['missions', 'posts', 'comments', 'points'].includes(params.get('tab')) ? params.get('tab') : 'missions'
  const setTab = (k) => setParams({ tab: k }, { replace: true })

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.myTodayActivityDetail(userId),
    queryFn: () => fetchTodayActivityDetail(userId),
    enabled: !!userId,
  })
  const d = data || { missions: [], posts: [], comments: [], points: [] }
  const counts = {
    missions: d.missions.length, posts: d.posts.length, comments: d.comments.length,
    points: d.points.reduce((s, r) => s + (r.point || 0), 0),
  }
  const items = d[tab]
  const cur = TABS.find(t => t.key === tab)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-[460px] mx-auto h-[52px] px-2 flex items-center gap-1">
          <button type="button" onClick={() => navigate('/dashboard')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100" aria-label="뒤로">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-[16px] font-bold text-gray-900">오늘의 활동</h1>
        </div>
        <div className="max-w-[460px] mx-auto flex px-2">
          {TABS.map(t => {
            const on = t.key === tab
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`flex-1 pb-2.5 pt-1 flex flex-col items-center gap-1 border-b-2 transition ${on ? 'border-emerald-500' : 'border-transparent'}`}>
                <span className={`text-[12px] font-bold ${on ? 'text-gray-900' : 'text-gray-400'}`}>{t.label}</span>
                <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center ${on ? t.accent : 'bg-gray-100 text-gray-400'}`}>
                  {counts[t.key]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-[460px] mx-auto px-4 py-4 space-y-2.5">
        {isLoading ? (
          <LoadingState size="sm" />
        ) : items.length === 0 ? (
          <Empty label={cur.label} />
        ) : tab === 'missions' ? (
          items.map(m => (
            <Row key={m.id} onClick={m.link ? () => navigate(m.link) : undefined}>
              <Icon3D tab="missions" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-gray-900 truncate">{m.title}</p>
                <p className="text-[12.5px] font-semibold text-gray-600 truncate">{m.program}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${m.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  {m.status === 'APPROVED' ? '승인' : '심사중'}
                </span>
                <p className="text-[11px] text-gray-400 mt-1">{m.time}</p>
              </div>
            </Row>
          ))
        ) : tab === 'posts' ? (
          items.map(p => (
            <Row key={p.id} onClick={p.link ? () => navigate(p.link) : undefined}>
              <Icon3D tab="posts" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-gray-900 truncate">{p.title}</p>
                <p className="text-[12.5px] font-semibold text-gray-600 line-clamp-1">{p.body}</p>
                <p className="text-[12px] font-semibold text-gray-500 mt-1">{p.program}</p>
              </div>
              <p className="text-[11px] text-gray-400 flex-shrink-0">{p.time}</p>
            </Row>
          ))
        ) : tab === 'comments' ? (
          items.map(c => (
            <Row key={c.id} onClick={c.link ? () => navigate(c.link) : undefined}>
              <Icon3D tab="comments" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-gray-800 line-clamp-2 break-keep">{c.content}</p>
                <p className="text-[12px] font-semibold text-gray-500 mt-1">
                  <span className={c.where === 'community' ? 'text-sky-600' : 'text-emerald-600'}>
                    {c.where === 'community' ? '게시글' : '인증'}
                  </span>{' '}· {c.on}
                </p>
              </div>
              <p className="text-[11px] text-gray-400 flex-shrink-0">{c.time}</p>
            </Row>
          ))
        ) : (
          items.map(p => (
            <Row key={p.id} onClick={p.link ? () => navigate(p.link) : undefined}>
              <Icon3D tab="points" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-gray-900">
                  <span className="text-amber-500">+{p.point}</span>
                  <span className="text-[12px] text-gray-400 font-bold ml-0.5">P</span>
                </p>
                <p className="text-[12.5px] font-semibold text-gray-600 truncate">{p.reason}</p>
                <p className="text-[12px] font-semibold text-gray-500 mt-0.5">{p.program}</p>
              </div>
              <p className="text-[11px] text-gray-400 flex-shrink-0">{p.time}</p>
            </Row>
          ))
        )}
      </div>
    </div>
  )
}

export default TodayActivityPage
