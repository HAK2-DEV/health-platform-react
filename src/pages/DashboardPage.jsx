import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { Activity, ChevronRight, Bell, Plus } from 'lucide-react'
import ProgramDetailModal from '../components/program/ProgramDetailModal'
import ProgramBrowseModal from '../components/program/ProgramBrowseModal'
import WelcomeOperatorModal from '../components/program/WelcomeOperatorModal'
import LoadingState from '../components/common/LoadingState'
import ProgramCover from '../components/common/ProgramCover'
import {
  queryKeys,
  fetchMyPrograms,
  fetchActivePrograms,
  fetchPublicPrograms,
  fetchUnreadNotificationsCount,
} from '../lib/queries'

// 프로그램 타일 — 표지 이미지 + 제목만. 가로 스크롤 줄용 고정 폭.
function ProgramTile({ program, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 w-[76px] flex-shrink-0"
    >
      <ProgramCover
        imagePath={program.cover_image_path}
        categories={program.categories}
        name={program.name}
        variant="thumb"
        className="w-full shadow-soft transition group-hover:shadow-elevated group-active:scale-95"
      />
      <span className="text-[12px] font-semibold text-gray-800 leading-tight text-center line-clamp-2 w-full">
        {program.name}
      </span>
    </button>
  )
}

// 가로 스크롤 섹션 — 헤더(제목 + 전체보기) + 한 줄 타일
function HScrollSection({ title, count, loading, emptyText, emptyAction, onSeeAll, children, hasItems }) {
  return (
    <section className="bg-white border border-gray-100 rounded-card-lg shadow-soft p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-gray-800">{title}</h2>
        {hasItems && onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-700"
          >
            전체 {count != null ? `(${count})` : ''}
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
      {loading ? (
        <LoadingState size="sm" />
      ) : !hasItems ? (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400">{emptyText}</p>
          {emptyAction && (
            <button
              type="button"
              onClick={emptyAction.onClick}
              className="inline-flex items-center gap-1 mt-3 px-5 py-2 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 text-white text-sm font-semibold rounded-full transition shadow-sm"
            >
              <Plus className="w-4 h-4" /> {emptyAction.label}
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-hide">
          {children}
        </div>
      )}
    </section>
  )
}

function DashboardPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const userId = session?.user?.id

  // selectedSource: { listKey: 'my'|'public', programId } — 상세 모달 (list 안에서 prev/next)
  const [selectedSource, setSelectedSource] = useState(null)
  const [browseOpen, setBrowseOpen] = useState(false)      // 둘러보기 모달
  const [showWelcome, setShowWelcome] = useState(false)    // 첫 프로그램 발행 후 환영 캐러셀

  // 로그아웃 시 /login 으로
  useEffect(() => {
    if (session === null) navigate('/login')
  }, [session, navigate])

  // 첫 프로그램 발행 직후 환영 캐러셀 1회
  useEffect(() => {
    if (sessionStorage.getItem('show_operator_welcome') === '1') {
      sessionStorage.removeItem('show_operator_welcome')
      localStorage.setItem('operator_welcome_seen', '1')
      setShowWelcome(true)
    }
  }, [])

  // ─── React Query ───────────
  const { data: myPrograms = [], isLoading: isMyLoading } = useQuery({
    queryKey: queryKeys.myPrograms(userId),
    queryFn: () => fetchMyPrograms(userId),
    enabled: !!userId,
  })

  const { data: activePrograms = [], isLoading: isActiveLoading } = useQuery({
    queryKey: queryKeys.activePrograms(userId),
    queryFn: () => fetchActivePrograms(userId),
    enabled: !!userId,
  })

  const { data: publicPrograms = [], isLoading: isPublicLoading } = useQuery({
    queryKey: queryKeys.publicPrograms(userId),
    queryFn: () => fetchPublicPrograms(userId),
    enabled: !!userId,
  })

  const { data: unreadNotifCount = 0 } = useQuery({
    queryKey: queryKeys.notificationsUnread(userId),
    queryFn: fetchUnreadNotificationsCount,
    enabled: !!userId,
  })

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 — 풍경 일러스트 배경 (없으면 그라데이션 폴백) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative h-45 overflow-hidden bg-gradient-to-b from-emerald-100 via-emerald-50/80 to-teal-50/50"
      >
        <img
          src="/home-header.png"
          alt=""
          aria-hidden="true"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
          className="absolute inset-0 w-full h-full object-cover object-[center_32%]"
        />
        <div className="relative max-w-4xl mx-auto px-4 pt-3">
          <div className="flex items-start justify-between">
            <p className="text-[14px] font-semibold text-gray-800 pr-4 leading-relaxed pt-1 drop-shadow-sm">
              안녕하세요, 오늘도 건강한 하루 되세요! 🌿
            </p>
            <button
              type="button"
              className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-soft flex-shrink-0 hover:shadow-elevated transition"
              title="알림"
              onClick={() => navigate('/notifications')}
            >
              <Bell className="w-4 h-4 text-gray-600" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] px-1.5 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white shadow-md">
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* 둥근 흰 시트 — 세 섹션을 가로 스크롤로 담아 한 화면에 (세로 스크롤 최소화) */}
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 -mt-[60px] relative space-y-3 pt-5 pb-6 bg-white rounded-t-3xl min-h-screen">

        {/* 참여 중인 프로그램 */}
        <HScrollSection
          title={<>🎯 참여 중인 프로그램</>}
          count={activePrograms.length}
          loading={isActiveLoading}
          hasItems={activePrograms.length > 0}
          emptyText="아직 참여 중인 프로그램이 없어요"
          onSeeAll={() => navigate('/programs')}
        >
          {activePrograms.slice(0, 12).map(program => (
            <ProgramTile
              key={program.id}
              program={program}
              onClick={() => navigate(`/programs/${program.id}`)}
            />
          ))}
        </HScrollSection>

        {/* 둘러보기 (공개 프로그램) */}
        <HScrollSection
          title={<>🔍 둘러보기</>}
          count={publicPrograms.length}
          loading={isPublicLoading}
          hasItems={publicPrograms.length > 0}
          emptyText="둘러볼 공개 프로그램이 없어요"
          onSeeAll={() => setBrowseOpen(true)}
        >
          {publicPrograms.slice(0, 12).map(program => (
            <ProgramTile
              key={program.id}
              program={program}
              onClick={() => setSelectedSource({ listKey: 'public', programId: program.id })}
            />
          ))}
        </HScrollSection>

        {/* 운영중인 프로그램 */}
        <HScrollSection
          title={<><Activity className="w-5 h-5 text-emerald-500" /> 운영중인 프로그램</>}
          count={myPrograms.length}
          loading={isMyLoading}
          hasItems={myPrograms.length > 0}
          emptyText="아직 만든 프로그램이 없어요"
          emptyAction={{ label: '프로그램 생성하기', onClick: () => navigate('/programs/new') }}
          onSeeAll={() => navigate('/programs')}
        >
          {myPrograms.slice(0, 12).map(program => (
            <ProgramTile
              key={program.id}
              program={program}
              onClick={() => {
                if (program.status === 'DRAFT') navigate(`/programs/new?id=${program.id}`)
                else setSelectedSource({ listKey: 'my', programId: program.id })
              }}
            />
          ))}
        </HScrollSection>

        {/* 프로그램 상세 모달 — my/public 리스트 안에서 prev/next */}
        {(() => {
          const sourceList = selectedSource?.listKey === 'public'
            ? publicPrograms
            : selectedSource?.listKey === 'my'
              ? myPrograms
              : []
          const currentIndex = selectedSource
            ? sourceList.findIndex(p => p.id === selectedSource.programId)
            : -1
          const currentProgram = currentIndex >= 0 ? sourceList[currentIndex] : null
          const goTo = (idx) => setSelectedSource({ listKey: selectedSource.listKey, programId: sourceList[idx].id })
          return (
            <ProgramDetailModal
              program={currentProgram}
              isOpen={currentProgram !== null}
              onClose={() => setSelectedSource(null)}
              onPrev={currentIndex > 0 ? () => goTo(currentIndex - 1) : undefined}
              onNext={currentIndex >= 0 && currentIndex < sourceList.length - 1 ? () => goTo(currentIndex + 1) : undefined}
            />
          )
        })()}

        {/* 둘러보기 모달 — 카테고리 필터 + 정렬. 선택 시 상세 모달 연결 */}
        <ProgramBrowseModal
          isOpen={browseOpen}
          onClose={() => setBrowseOpen(false)}
          programs={publicPrograms}
          onSelect={(id) => { setBrowseOpen(false); setSelectedSource({ listKey: 'public', programId: id }) }}
        />

        {/* 첫 프로그램 발행 후 환영 캐러셀 (1회) */}
        <WelcomeOperatorModal isOpen={showWelcome} onClose={() => setShowWelcome(false)} />

      </div>
    </div>
  )
}

export default DashboardPage
