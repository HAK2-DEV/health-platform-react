import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { ChevronRight, Search, X } from 'lucide-react'
import ProgramDetailModal from '../../components/program/ProgramDetailModal'
import ProgramBrowseModal from '../../components/program/ProgramBrowseModal'
import ProgramTile from '../../components/program/ProgramTile'
import { queryKeys, fetchPublicPrograms } from '../../lib/queries'
import EmptyState from '../../components/common/EmptyState'
import LoadingState from '../../components/common/LoadingState'
import NotificationBell from '../../components/common/NotificationBell'

// 🔍 둘러보기 탭 — 공개 프로그램 탐색 전용 (참여중·운영중은 홈 화면으로 이관)
function ProgramListPage() {
  const { session } = useAuth()
  const userId = session?.user?.id

  const [selectedProgramId, setSelectedProgramId] = useState(null)  // 상세 모달
  const [browseOpen, setBrowseOpen] = useState(false)               // 둘러보기 모달 (카테고리 필터)
  const [searchQuery, setSearchQuery] = useState('')
  const isSearching = searchQuery.trim().length > 0

  const { data: publicPrograms = [], isLoading: isPublicLoading } = useQuery({
    queryKey: queryKeys.publicPrograms(userId),
    queryFn: () => fetchPublicPrograms(userId),
    enabled: !!userId,
  })

  // 검색 필터 — name 또는 description 매칭 (대소문자 무시)
  const filteredPublic = useMemo(() => {
    if (!isSearching) return publicPrograms
    const q = searchQuery.trim().toLowerCase()
    return publicPrograms.filter(p =>
      (p.name || '').toLowerCase().includes(q)
      || (p.description || '').toLowerCase().includes(q)
    )
  }, [publicPrograms, searchQuery])

  // 미리보기 8개만, 전체는 「전체 둘러보기」 모달(카테고리 필터)에서
  const COLLAPSED = 8
  const displayedPublic = isSearching ? filteredPublic : filteredPublic.slice(0, COLLAPSED)

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 — 풍경 일러스트 배경 (없으면 그라데이션 폴백) */}
      <div className="relative h-44 overflow-hidden bg-gradient-to-b from-emerald-100 via-emerald-50/80 to-teal-50/40">
        <img
          src="/header-programs.png"
          alt=""
          aria-hidden="true"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
          className="absolute inset-0 w-full h-full object-cover object-[center_30%]"
        />
        <div className="relative max-w-4xl mx-auto px-4 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800 drop-shadow-sm">
                프로그램 <span className="text-xl">🚩</span>
              </h1>
              <p className="text-sm font-medium text-gray-700 mt-1.5 leading-relaxed drop-shadow-sm">
                나에게 맞는 프로그램을 찾고,<br />새로운 건강 습관을 시작해요.
              </p>
            </div>
            <NotificationBell />
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 -mt-[34px] relative space-y-4 pt-[15px] pb-6 bg-white/100 rounded-t-3xl min-h-screen">
        {/* 검색바 */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="프로그램 이름이나 설명 검색..."
            className="w-full pl-10 pr-10 py-3.5 bg-white border border-gray-100 rounded-card text-sm shadow-soft focus:outline-none focus:border-emerald-400 focus:shadow-elevated transition"
          />
          {isSearching && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition"
              title="검색 지우기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 공개 둘러보기 — 타일 그리드 */}
        <section className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">
              🔍 둘러보기 <span className="text-sm font-medium text-gray-400">({filteredPublic.length})</span>
            </h2>
            {!isSearching && publicPrograms.length > 0 && (
              <button
                type="button"
                onClick={() => setBrowseOpen(true)}
                className="flex items-center gap-0.5 text-xs font-medium text-emerald-600 hover:text-emerald-700"
              >
                전체 둘러보기 ({publicPrograms.length})
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {isPublicLoading ? (
            <LoadingState />
          ) : publicPrograms.length === 0 ? (
            !isSearching && <EmptyState icon="🔍" title="아직 둘러볼 공개 프로그램이 없어요" />
          ) : displayedPublic.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="검색 결과가 없어요"
              description={`"${searchQuery.trim()}" 와 일치하는 프로그램이 없어요`}
            />
          ) : (
            <div className="grid grid-cols-4 gap-x-3 gap-y-4">
              {displayedPublic.map(program => (
                <ProgramTile
                  key={program.id}
                  program={program}
                  onClick={() => setSelectedProgramId(program.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 프로그램 상세 모달 — 공개 list 안에서 prev/next */}
        {(() => {
          const currentIndex = selectedProgramId
            ? publicPrograms.findIndex(p => p.id === selectedProgramId)
            : -1
          const currentProgram = currentIndex >= 0 ? publicPrograms[currentIndex] : null
          const goTo = (idx) => setSelectedProgramId(publicPrograms[idx].id)
          return (
            <ProgramDetailModal
              program={currentProgram}
              isOpen={currentProgram !== null}
              onClose={() => setSelectedProgramId(null)}
              onPrev={currentIndex > 0 ? () => goTo(currentIndex - 1) : undefined}
              onNext={currentIndex >= 0 && currentIndex < publicPrograms.length - 1 ? () => goTo(currentIndex + 1) : undefined}
            />
          )
        })()}

        {/* 둘러보기 모달 — 카테고리 필터 + 정렬. 카드 선택 시 상세 모달로 연결 */}
        <ProgramBrowseModal
          isOpen={browseOpen}
          onClose={() => setBrowseOpen(false)}
          programs={publicPrograms}
          onSelect={(id) => { setBrowseOpen(false); setSelectedProgramId(id) }}
        />
      </div>
    </div>
  )
}

export default ProgramListPage
