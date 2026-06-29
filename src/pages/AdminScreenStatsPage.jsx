import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, BarChart3, Clock, Eye } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { fetchMyRole, fetchScreenStats } from '../lib/queries'

// 관리자 전용 — 화면별 평균 체류·방문수 (UI/UX 개선 분석). 데이터 소스 screen_events(146)/RPC(147).
//   체류시간만 집계, 콘텐츠 없음. 프로드에서 수집된 데이터만 표시(dev는 비어 있음).
const DAYS_OPTIONS = [7, 30, 90]

function fmtMs(ms) {
  const s = Math.round(Number(ms) / 1000)
  if (s < 60) return `${s}초`
  const m = Math.floor(s / 60), r = s % 60
  return r ? `${m}분 ${r}초` : `${m}분`
}

function AdminScreenStatsPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session?.user?.id
  const [days, setDays] = useState(30)
  const [sortBy, setSortBy] = useState('avg')   // 'avg' | 'visits'

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
      <p className="text-[12px] text-gray-500 mb-3">화면별 평균 체류시간·방문수 (UI/UX 개선용). 체류시간만 집계하며 콘텐츠는 수집하지 않아요.</p>

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
            return (
              <li key={s.screen} className="bg-white border border-gray-100 rounded-xl shadow-soft p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[13px] font-bold text-gray-800 truncate flex-1 min-w-0">{s.screen}</span>
                  <span className="text-[12px] font-extrabold text-emerald-600 flex-shrink-0">{fmtMs(s.avg_ms)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1.5">
                  <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.max(3, pct)}%` }} />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-gray-400">
                  <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" /> {Number(s.visits).toLocaleString()}회</span>
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> 평균 {fmtMs(s.avg_ms)}</span>
                  <span className="ml-auto">최대 {fmtMs(s.max_ms)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default AdminScreenStatsPage
