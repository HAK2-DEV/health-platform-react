import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'

// 「오늘의 활동」 상세 — 단일 4탭 · 보기 전용 데모 (/today-activity-demo).
//   대시보드 활동요약 타일 클릭 시 진입할 화면. 실배선 전 UI/데이터 형태 확인용.
//   탭: 미션 완료 / 게시물 작성 / 댓글 활동 / 획득 점수. 각 탭 = 오늘(KST) 것만 시간 역순.

// 아이콘(활동요약 타일과 동일 3D 아이콘 재사용) — 탭·헤더 심볼
const ICON = {
  missions: '/icons/activity/mission.png',
  posts: '/icons/activity/record.png',
  comments: '/icons/activity/comment.png',
  points: '/icons/activity/point.png',
}
const ICON_SCALE = { missions: 1.25, posts: 1.85, comments: 1.45, points: 0.84 }

const TABS = [
  { key: 'missions', label: '미션 완료', accent: 'emerald' },
  { key: 'posts', label: '게시물 작성', accent: 'sky' },
  { key: 'comments', label: '댓글 활동', accent: 'amber' },
  { key: 'points', label: '획득 점수', accent: 'violet' },
]

// ── 목 데이터 (오늘) ─────────────────────────────────
const MOCK = {
  missions: [
    { id: 1, title: '오늘 3km 달리기', program: '러닝 챌린지', time: '오후 7:12', status: 'APPROVED' },
    { id: 2, title: '물 8잔 마시기', program: '건강 식습관 21일', time: '오후 2:30', status: 'APPROVED' },
    { id: 3, title: '오늘 흡연 기록', program: '금연 습관 챌린지', time: '오전 9:05', status: 'PENDING_REVIEW' },
  ],
  posts: [
    { id: 1, title: '오늘 러닝 인증합니다!', body: '비 와서 실내 트레드밀로 뛰었어요. 그래도 완주 🎉', board: '자유게시판', program: '러닝 챌린지', time: '오후 7:20' },
    { id: 2, title: '식단 팁 공유', body: '아침에 그릭요거트 + 견과류 조합 추천해요.', board: '자유게시판', program: '건강 식습관 21일', time: '오전 8:40' },
  ],
  comments: [
    { id: 1, content: '저도 오늘 뛰었어요! 화이팅 💪', on: '러닝 인증 게시글', where: 'community', time: '오후 8:02' },
    { id: 2, content: '기록 꾸준하네요 👏', on: 'OO님의 인증', where: 'feed', time: '오후 6:15' },
    { id: 3, content: '이 조합 진짜 맛있죠', on: '식단 팁 게시글', where: 'community', time: '오전 9:10' },
    { id: 4, content: '내일 같이 뛰어요~', on: '러닝 인증 게시글', where: 'community', time: '오전 8:55' },
    { id: 5, content: '응원합니다!', on: 'OO님의 인증', where: 'feed', time: '오전 7:48' },
  ],
  points: [
    { id: 1, point: 10, reason: '미션 인증 승인 · 오늘 3km 달리기', program: '러닝 챌린지', time: '오후 7:12' },
    { id: 2, point: 10, reason: '미션 인증 승인 · 물 8잔 마시기', program: '건강 식습관 21일', time: '오후 2:30' },
    { id: 3, point: 5, reason: '미션 인증 승인 · 흡연 기록', program: '금연 습관 챌린지', time: '오전 9:05' },
  ],
}

const ACCENT = {
  emerald: 'bg-emerald-50 text-emerald-700',
  sky: 'bg-sky-50 text-sky-700',
  amber: 'bg-amber-50 text-amber-700',
  violet: 'bg-violet-50 text-violet-700',
}

function Icon3D({ tab, className = 'w-8 h-8' }) {
  return (
    <div className={`${className} flex items-center justify-center flex-shrink-0`}>
      <img src={ICON[tab]} alt="" aria-hidden="true" style={{ transform: `scale(${ICON_SCALE[tab]})` }} className="w-full h-full object-contain" />
    </div>
  )
}

function Row({ children }) {
  return <div className="flex items-start gap-3 p-3.5 bg-white rounded-2xl border border-gray-100 shadow-soft">{children}</div>
}

function Empty({ label }) {
  return (
    <div className="text-center py-16">
      <img src="/icons/growth/sprout.png" alt="" aria-hidden="true" className="w-16 h-16 object-contain mx-auto mb-2" />
      <p className="text-sm text-gray-500">오늘은 아직 {label} 활동이 없어요</p>
    </div>
  )
}

function TodayActivityDemoPage() {
  const [tab, setTab] = useState('missions')
  const items = MOCK[tab]
  const cur = TABS.find(t => t.key === tab)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-[460px] mx-auto h-[52px] px-2 flex items-center gap-1">
          <button type="button" className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-[16px] font-bold text-gray-900">오늘의 활동</h1>
        </div>

        {/* 탭 — 개수 뱃지 포함 */}
        <div className="max-w-[460px] mx-auto flex px-2">
          {TABS.map(t => {
            const on = t.key === tab
            const n = MOCK[t.key].length
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 pb-2.5 pt-1 flex flex-col items-center gap-1 border-b-2 transition ${
                  on ? 'border-emerald-500' : 'border-transparent'
                }`}
              >
                <span className={`text-[12px] font-bold ${on ? 'text-gray-900' : 'text-gray-400'}`}>
                  {t.label}
                </span>
                <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold inline-flex items-center justify-center ${
                  on ? ACCENT[t.accent] : 'bg-gray-100 text-gray-400'
                }`}>
                  {t.key === 'points' ? MOCK.points.reduce((s, r) => s + r.point, 0) : n}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 리스트 */}
      <div className="max-w-[460px] mx-auto px-4 py-4 space-y-2.5">
        {items.length === 0 ? (
          <Empty label={cur.label} />
        ) : tab === 'missions' ? (
          items.map(m => (
            <Row key={m.id}>
              <Icon3D tab="missions" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-gray-900 truncate">{m.title}</p>
                <p className="text-[12.5px] font-semibold text-gray-600 truncate">{m.program}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  m.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {m.status === 'APPROVED' ? '승인' : '심사중'}
                </span>
                <p className="text-[11px] text-gray-400 mt-1">{m.time}</p>
              </div>
            </Row>
          ))
        ) : tab === 'posts' ? (
          items.map(p => (
            <Row key={p.id}>
              <Icon3D tab="posts" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-gray-900 truncate">{p.title}</p>
                <p className="text-[12.5px] font-semibold text-gray-600 line-clamp-1">{p.body}</p>
                <p className="text-[12px] font-semibold text-gray-500 mt-1">{p.board} · {p.program}</p>
              </div>
              <p className="text-[11px] text-gray-400 flex-shrink-0">{p.time}</p>
            </Row>
          ))
        ) : tab === 'comments' ? (
          items.map(c => (
            <Row key={c.id}>
              <Icon3D tab="comments" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-gray-800 line-clamp-2 break-keep">{c.content}</p>
                <p className="text-[12px] font-semibold text-gray-500 mt-1">
                  <span className={c.where === 'community' ? 'text-sky-600' : 'text-emerald-600'}>
                    {c.where === 'community' ? '게시글' : '인증'}
                  </span>
                  {' '}· {c.on}
                </p>
              </div>
              <p className="text-[11px] text-gray-400 flex-shrink-0">{c.time}</p>
            </Row>
          ))
        ) : (
          items.map(p => (
            <Row key={p.id}>
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

export default TodayActivityDemoPage
