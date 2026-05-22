import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { CATEGORY } from '../lib/constants'
import {
  queryKeys,
  fetchActivePrograms,
  fetchProgramRanking,
} from '../lib/queries'

// 랭킹 페이지 — Bottom Tab Bar 🏆 진입점
// 동작: 본인 참여 중 프로그램 칩에서 선택 → 해당 프로그램 랭킹
// React Query: 인증 후 ['rankings'] invalidate (MissionVerifyPage onSuccess) → 다음 진입 시 자동 fresh
function RankingsPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id

  const [selectedProgramId, setSelectedProgramId] = useState(null)

  // 본인 참여 중 프로그램 (대시보드와 같은 키 — 캐시 공유)
  const { data: activePrograms = [], isLoading: isLoadingPrograms } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  // 첫 로딩 시 첫 프로그램 자동 선택 (참여 1개 이상)
  useEffect(() => {
    if (!selectedProgramId && activePrograms.length > 0) {
      setSelectedProgramId(activePrograms[0].id)
    }
  }, [activePrograms, selectedProgramId])

  // 선택된 프로그램 랭킹
  const { data: ranking = [], isLoading: isLoadingRanking } = useQuery({
    queryKey: queryKeys.programRanking(selectedProgramId),
    queryFn: () => fetchProgramRanking(selectedProgramId),
    enabled: !!selectedProgramId,
  })

  const selectedProgram = activePrograms.find(p => p.id === selectedProgramId)
  const myRow = ranking.find(r => r.user_id === userId)

  // ─── 로딩 ──────────────────────────────────────────────
  if (isLoadingPrograms) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center text-gray-500 text-sm">
        불러오는 중...
      </div>
    )
  }

  // ─── 참여 프로그램 0개 ──────────────────────────────────
  if (activePrograms.length === 0) {
    return (
      <div className="px-4 pt-4 max-w-4xl mx-auto">
        <h1 className="flex items-center gap-2 text-xl text-gray-800 mb-4">
          <Trophy className="w-5 h-5 text-amber-500" />
          랭킹
        </h1>
        <div className="bg-emerald-50/40 p-8 rounded-2xl text-center">
          <div className="w-24 h-24 mx-auto mb-3 flex items-center justify-center text-5xl">
            🏆
          </div>
          <p className="font-medium text-gray-800 mb-1">참여 중인 프로그램이 없어요</p>
          <p className="text-sm text-gray-500 mb-5">
            프로그램에 참여하면 랭킹이 표시돼요
          </p>
          <button
            type="button"
            onClick={() => navigate('/programs')}
            className="inline-flex items-center gap-1 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-sm font-medium transition shadow-sm"
          >
            프로그램 둘러보기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 pb-6 max-w-4xl mx-auto">
      <h1 className="flex items-center gap-2 text-xl text-gray-800 mb-4">
        <Trophy className="w-5 h-5 text-amber-500" />
        랭킹
      </h1>

      {/* 프로그램 선택 칩 — 가로 스크롤 */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-4 scrollbar-hide">
        {activePrograms.map(program => {
          const catKey = program.categories?.[0] || 'ETC'
          const cat = CATEGORY[catKey] || CATEGORY.ETC
          const isActive = program.id === selectedProgramId
          return (
            <button
              key={program.id}
              type="button"
              onClick={() => setSelectedProgramId(program.id)}
              className={`
                flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm transition
                ${isActive
                  ? 'bg-emerald-500 text-white shadow-sm font-medium'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-emerald-300'}
              `}
            >
              <span>{cat.emoji}</span>
              <span className="max-w-[140px] truncate">{program.name}</span>
            </button>
          )
        })}
      </div>

      {/* 본인 요약 카드 — 선택 프로그램에서의 등수 */}
      {selectedProgram && (
        <div className="bg-gradient-to-r from-emerald-50 via-emerald-50/80 to-teal-50 border border-emerald-100 rounded-2xl p-4 mb-4">
          <p className="text-xs text-emerald-700 mb-1">{selectedProgram.name}</p>
          {isLoadingRanking ? (
            <p className="text-sm text-gray-500">불러오는 중...</p>
          ) : myRow ? (
            <div className="flex items-end gap-3">
              <p className="text-3xl font-bold text-emerald-700 leading-none">
                {myRow.rank}<span className="text-base font-medium text-emerald-600">등</span>
              </p>
              <p className="text-sm text-gray-600 pb-0.5">
                {myRow.total_score}P
                <span className="text-gray-400 mx-1">·</span>
                전체 {ranking.length}명 중
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              아직 인증 기록이 없어요 — 오늘의 미션부터 도전해보세요
            </p>
          )}
        </div>
      )}

      {/* 랭킹 목록 */}
      {isLoadingRanking ? (
        <div className="bg-gray-50 p-8 rounded-2xl text-center text-gray-500 text-sm">
          불러오는 중...
        </div>
      ) : ranking.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-2xl text-center text-gray-500 text-sm">
          아직 참여자가 없어요
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid gap-2"
        >
          {ranking.map(row => {
            const isMe = row.user_id === userId
            const rankBadgeClass =
              row.rank === 1 ? 'bg-yellow-100 text-yellow-700'
              : row.rank === 2 ? 'bg-gray-200 text-gray-700'
              : row.rank === 3 ? 'bg-orange-100 text-orange-700'
              : 'bg-gray-50 text-gray-500'
            const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : null

            return (
              <div
                key={row.user_id}
                className={`
                  flex items-center justify-between p-3 rounded-2xl border
                  ${isMe ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200'}
                `}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`
                    flex items-center justify-center w-9 h-9 rounded-full text-sm font-medium flex-shrink-0
                    ${rankBadgeClass}
                  `}>
                    {medal || row.rank}
                  </span>
                  <span className={`font-medium truncate ${isMe ? 'text-emerald-800' : 'text-gray-800'}`}>
                    {row.nickname}
                    {isMe && <span className="ml-1 text-xs text-emerald-600">(나)</span>}
                  </span>
                </div>
                <span className={`text-sm font-medium flex-shrink-0 ${isMe ? 'text-emerald-700' : 'text-gray-600'}`}>
                  {row.total_score}P
                </span>
              </div>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}

export default RankingsPage
