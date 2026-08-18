import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, BarChart3, Clock, Eye, ChevronDown, User } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fetchMyRole, fetchScreenStats, fetchScreenUserStats } from '../lib/queries'

// 관리자 전용 — 화면별 평균 체류·방문수 (UI/UX 개선 분석). 데이터 소스 screen_events(146)/RPC(147).
//   체류시간만 집계, 콘텐츠 없음. 프로드에서 수집된 데이터만 표시(dev는 비어 있음).
const DAYS_OPTIONS = [7, 30, 90]

function fmtMs(ms) {
  const s = Math.round(Number(ms) / 1000)
  if (s < 60) return `${s}초`
  const m = Math.floor(s / 60), r = s % 60
  return r ? `${m}분 ${r}초` : `${m}분`
}

// 경로 → 직관적 화면 이름. screenKeyOf 가 uuid 를 :id 로 정규화한 키 기준(?tab=X 포함).
const SCREEN_LABELS = {
  '/': '홈(랜딩)',
  '/login': '로그인',
  '/signup': '회원가입',
  '/nickname-setup': '닉네임 설정',
  '/auth/callback': '로그인 처리',
  '/dashboard': '대시보드',
  '/growth': '성장',
  '/onboarding': '온보딩 튜토리얼',
  '/todos': '할 일',
  '/admin/screen-stats': '관리자 · 화면 체류 분석',
  '/programs': '프로그램 목록',
  '/programs?tab=browse': '프로그램 · 둘러보기',
  '/programs?tab=mine': '프로그램 · 내 프로그램',
  '/programs/new': '프로그램 · 새로 만들기',
  '/record': '기록',
  '/rankings': '랭킹',
  '/notifications': '알림',
  '/profile': '프로필',
  '/profile/notifications-settings': '설정 · 알림',
  '/profile/account-settings': '설정 · 계정',
  '/profile/activity': '내 활동',
  '/operator-guide': '운영자 가이드',
  '/support': '고객센터 · 문의',
  '/join': '초대코드 참여',
  '/privacy': '개인정보처리방침',
  '/terms': '이용약관',
  '/install': '설치 가이드',
  '/flower-demo': '데모 · 정원',
  '/running-home-demo': '데모 · 달리기 홈',
  // 프로그램 상세 + 탭
  '/programs/:id': '프로그램 · 상세(개요)',
  '/programs/:id?tab=overview': '프로그램 · 개요',
  '/programs/:id?tab=missions': '프로그램 · 미션',
  '/programs/:id?tab=quizzes': '프로그램 · 퀴즈',
  '/programs/:id?tab=community': '프로그램 · 커뮤니티',
  '/programs/:id?tab=ranking': '프로그램 · 랭킹/성장',
  // 프로그램 하위
  '/programs/:id/report': '프로그램 · 종료 리포트',
  '/programs/:id/reviews': '프로그램 · 심사함',
  '/programs/:id/feed': '프로그램 · 피드',
  '/programs/:id/participants': '프로그램 · 참여 승인',
  '/programs/:id/operator-today': '오늘의 운영',
  '/programs/:id/survey/edit': '설문 · 문항 편집',
  '/programs/:id/posts': '프로그램 · 게시판',
  '/programs/:id/posts/quiz/new': '퀴즈 · 만들기',
  // 통계
  '/programs/:id/stats': '통계 · 개요',
  '/programs/:id/stats/missions': '통계 · 미션별',
  '/programs/:id/stats/quizzes': '통계 · 퀴즈',
  '/programs/:id/stats/survey': '통계 · 설문 결과',
  '/programs/:id/stats/classes': '통계 · 클래스',
  '/programs/:id/stats/users': '통계 · 참여자 목록',
  '/programs/:id/stats/users/:id': '통계 · 참여자 상세',
  '/programs/:id/stats/users/:id/missions': '참여자 · 미션',
  '/programs/:id/stats/users/:id/verifications': '참여자 · 인증',
  '/programs/:id/stats/users/:id/posts': '참여자 · 게시글',
  '/programs/:id/stats/users/:id/points': '참여자 · 점수',
  '/programs/:id/stats/users/:id/comments': '참여자 · 댓글',
  '/programs/:id/stats/users/:id/quizzes': '참여자 · 퀴즈',
  '/programs/:id/stats/users/:id/classes': '참여자 · 클래스',
  // 퀴즈/미션 상세
  '/programs/:id/quiz/:id': '퀴즈 · 풀기',
  '/programs/:id/missions/:id': '미션 · 인증',
  // 내 활동
  '/profile/activity/:id/missions': '내 활동 · 미션',
  '/profile/activity/:id/verifications': '내 활동 · 인증',
  '/profile/activity/:id/quizzes': '내 활동 · 퀴즈',
  '/profile/activity/:id/posts': '내 활동 · 게시글',
  '/profile/activity/:id/comments': '내 활동 · 댓글',
  '/profile/activity/:id/classes': '내 활동 · 클래스',
  '/profile/activity/today': '내 활동 · 오늘',
}
// 가변 뒤꼬리(묶음 param 등) — 접두 패턴 매칭
const SCREEN_LABEL_PATTERNS = [
  [/^\/programs\/:id\/reviews\/[^/]+\/[^/]+/, '심사 · 미션 상세'],
  [/^\/programs\/:id\/reviews\//, '심사 · 묶음'],
  [/^\/programs\/:id\/bundles\//, '프로그램 · 미션 묶음'],
  [/^\/programs\/:id\/stats\/users\/:id\/verifications\//, '참여자 · 인증 상세'],
  [/^\/programs\/:id\/posts\/quiz\/[^/]+\/edit/, '퀴즈 · 수정'],
  [/^\/programs\/:id\/posts\/quiz\//, '퀴즈 · 상세'],
  [/^\/profile\/activity\/:id\/verifications\//, '내 활동 · 인증 상세'],
]
function screenLabel(key) {
  if (SCREEN_LABELS[key]) return SCREEN_LABELS[key]
  for (const [re, label] of SCREEN_LABEL_PATTERNS) if (re.test(key)) return label
  return key   // 미매핑 폴백 — 원시 경로 그대로
}

// 상대 시각 (마지막 방문) — "방금 / N분 전 / N시간 전 / N일 전"
function relTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

// 화면별 계정 드릴다운 — 그 화면에 오래 머문 계정 순(총 체류시간). 펼칠 때만 조회(RPC 152).
function ScreenUserBreakdown({ screen, days, isAdmin }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['screen-user-stats', screen, days],
    queryFn: () => fetchScreenUserStats(screen, days),
    enabled: isAdmin,
  })
  if (isLoading) return <p className="text-[12px] text-gray-400 py-3 text-center">계정별 체류 불러오는 중...</p>
  if (rows.length === 0) return <p className="text-[12px] text-gray-400 py-3 text-center">이 화면의 계정별 기록이 없어요.</p>
  const maxTotal = Math.max(1, ...rows.map(r => Number(r.total_ms)))
  return (
    <ul className="mt-2 space-y-1.5">
      {rows.map((r, i) => (
        <li key={r.user_id} className="flex items-center gap-2.5 px-1">
          <span className="w-4 text-[11px] font-bold text-gray-300 flex-shrink-0 text-center">{i + 1}</span>
          <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold text-gray-700 truncate">{r.nickname || '(닉네임 없음)'}</span>
              <span className="text-[12px] font-extrabold text-emerald-600 flex-shrink-0">{fmtMs(r.total_ms)}</span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-emerald-300 rounded-full" style={{ width: `${Math.max(4, (Number(r.total_ms) / maxTotal) * 100)}%` }} />
            </div>
            <div className="flex items-center gap-2.5 text-[10px] text-gray-400 mt-0.5">
              <span>{Number(r.visits).toLocaleString()}회 방문</span>
              <span>평균 {fmtMs(r.avg_ms)}</span>
              <span className="ml-auto">{relTime(r.last_at)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function AdminScreenStatsPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id
  const [days, setDays] = useState(30)
  const [sortBy, setSortBy] = useState('avg')   // 'avg' | 'visits'
  const [expanded, setExpanded] = useState(null)   // 펼친 화면 키 (계정별 드릴다운)

  const { data: role, isLoading: roleLoading } = useQuery({
    queryKey: ['my-role', userId],
    queryFn: () => fetchMyRole(userId),
    enabled: !!userId,
  })
  const isAdmin = role === 'ADMIN'

  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['screen-stats', days],
    queryFn: () => fetchScreenStats(days),
    enabled: isAdmin,
  })

  const sorted = [...stats].sort((a, b) =>
    sortBy === 'avg' ? Number(b.avg_ms) - Number(a.avg_ms) : Number(b.visits) - Number(a.visits)
  )
  const maxAvg = Math.max(1, ...sorted.map(s => Number(s.avg_ms)))
  const maxVisits = Math.max(1, ...sorted.map(s => Number(s.visits)))

  // 비관리자 차단
  if (userId && !roleLoading && !isAdmin) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <p className="text-2xl mb-2">🔒</p>
        <p className="text-gray-700 font-bold">관리자 전용 화면이에요</p>
        <button type="button" onClick={() => navigate('/dashboard')} className="mt-4 px-4 h-10 rounded-xl bg-emerald-500 text-white text-sm font-bold">대시보드로</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto px-4 pt-3 pb-10">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <button type="button" onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-full hover:bg-gray-100" aria-label="뒤로"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
        <BarChart3 className="w-5 h-5 text-emerald-600" />
        <h1 className="text-lg font-bold text-gray-900">화면 체류 분석</h1>
      </div>
      <p className="text-[12px] text-gray-500 mb-3">화면별 평균 체류시간·방문수 (UI/UX 개선용). 체류시간만 집계하며 콘텐츠는 수집하지 않아요. 화면을 탭하면 어떤 계정이 오래 머물렀는지 볼 수 있어요.</p>

      {/* 기간 + 정렬 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex gap-1.5">
          {DAYS_OPTIONS.map(d => (
            <button key={d} type="button" onClick={() => setDays(d)}
              className={`px-3 h-8 rounded-full text-xs font-bold border transition ${days === d ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              최근 {d}일
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1.5">
          <button type="button" onClick={() => setSortBy('avg')}
            className={`inline-flex items-center gap-1 px-2.5 h-8 rounded-full text-xs font-bold border transition ${sortBy === 'avg' ? 'bg-gray-800 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-500'}`}>
            <Clock className="w-3.5 h-3.5" /> 체류
          </button>
          <button type="button" onClick={() => setSortBy('visits')}
            className={`inline-flex items-center gap-1 px-2.5 h-8 rounded-full text-xs font-bold border transition ${sortBy === 'visits' ? 'bg-gray-800 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-500'}`}>
            <Eye className="w-3.5 h-3.5" /> 방문
          </button>
        </div>
      </div>

      {/* 목록 */}
      {isLoading ? (
        <p className="text-sm text-gray-400 py-10 text-center">불러오는 중...</p>
      ) : sorted.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-[13px] text-gray-500">아직 수집된 데이터가 없어요.<br />배포된 환경에서 사용자가 화면을 이용하면 쌓여요.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {sorted.map((s) => {
            const pct = sortBy === 'avg'
              ? (Number(s.avg_ms) / maxAvg) * 100
              : (Number(s.visits) / maxVisits) * 100
            const isOpen = expanded === s.screen
            return (
              <li key={s.screen} className="bg-white border border-gray-100 rounded-xl shadow-soft p-3">
                <button type="button" onClick={() => setExpanded(isOpen ? null : s.screen)} className="w-full text-left">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <span className="block text-[13px] font-bold text-gray-800 truncate">{screenLabel(s.screen)}</span>
                      {screenLabel(s.screen) !== s.screen && (
                        <span className="block text-[10px] text-gray-400 font-normal truncate">{s.screen}</span>
                      )}
                    </div>
                    <span className="text-[12px] font-extrabold text-emerald-600 flex-shrink-0">{fmtMs(s.avg_ms)}</span>
                    <ChevronDown className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.max(3, pct)}%` }} />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-400">
                    <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" /> {Number(s.visits).toLocaleString()}회</span>
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> 평균 {fmtMs(s.avg_ms)}</span>
                    <span className="ml-auto">최대 {fmtMs(s.max_ms)}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                    <p className="text-[11px] font-bold text-gray-500 mb-0.5 px-1">계정별 체류 (오래 머문 순)</p>
                    <ScreenUserBreakdown screen={s.screen} days={days} isAdmin={isAdmin} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default AdminScreenStatsPage
