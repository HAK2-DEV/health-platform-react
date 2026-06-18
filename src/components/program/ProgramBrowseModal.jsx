import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calendar, Users, ChevronRight, Search, X } from 'lucide-react'
import Modal from '../common/Modal'
import ProgramCover from '../common/ProgramCover'
import { CATEGORY } from '../../lib/constants'
import { queryKeys, fetchActiveParticipantCounts } from '../../lib/queries'
import { formatKoreanDate } from '../../lib/formatters'
import EmptyState from '../common/EmptyState'

// 프로그램 둘러보기 모달 — 카테고리 필터 칩 + 정렬 토글 + 리스트.
//   복수 카테고리는 OR 매칭(그 카테고리를 "포함"하면 노출). 칩은 프로그램이 있는 카테고리만.
//   정렬: 최신순(created_at) / 인기순(참여자 수). 기본 최신순.
//   카드 클릭 → onSelect(programId) (부모가 상세 모달 열기).
const SORTS = [
  { key: 'latest', label: '최신순' },
  { key: 'popular', label: '인기순' },
]

function ProgramBrowseModal({ isOpen, onClose, programs = [], onSelect }) {
  const [cat, setCat] = useState('all')
  const [sort, setSort] = useState('latest')
  const [query, setQuery] = useState('')

  const programIds = useMemo(() => programs.map(p => p.id), [programs])
  // 인기순 + 카드 참여자수 표시용 — 모달 열렸을 때만 조회
  const { data: counts = {} } = useQuery({
    queryKey: queryKeys.activeParticipantCounts(programIds),
    queryFn: () => fetchActiveParticipantCounts(programIds),
    enabled: isOpen && programIds.length > 0,
  })

  // 실제 프로그램이 존재하는 카테고리만 칩으로 노출 (빈 카테고리 숨김)
  const presentCats = useMemo(() => {
    const set = new Set()
    for (const p of programs) for (const c of (p.categories || [])) set.add(c)
    return Object.values(CATEGORY).filter(c => set.has(c.key))
  }, [programs])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = cat === 'all'
      ? [...programs]
      : programs.filter(p => (p.categories || []).includes(cat))
    if (q) {
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q)
        || (p.description || '').toLowerCase().includes(q)
      )
    }
    list.sort((a, b) => {
      if (sort === 'popular') return (counts[b.id] || 0) - (counts[a.id] || 0)
      // 최신순 — created_at(ISO) 내림차순, 없으면 start_date fallback
      const ad = a.created_at || a.start_date || ''
      const bd = b.created_at || b.start_date || ''
      return bd.localeCompare(ad)
    })
    return list
  }, [programs, cat, sort, counts, query])

  const chipCls = (active) =>
    `flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-pill text-sm transition border ${
      active
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold'
        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
    }`

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-5">
        <h2 className="text-lg font-bold text-gray-800 mb-3 pr-8">🔍 프로그램 둘러보기</h2>

        {/* 검색바 — 이름·설명 */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="프로그램 이름·설명 검색..."
            className="w-full pl-9 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:border-emerald-400 focus:bg-white transition"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition"
              title="검색 지우기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 카테고리 칩 — 가로 스크롤. 전체 + 존재하는 카테고리만 */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          <button type="button" onClick={() => setCat('all')} className={chipCls(cat === 'all')}>
            전체
          </button>
          {presentCats.map(c => (
            <button key={c.key} type="button" onClick={() => setCat(c.key)} className={chipCls(cat === c.key)}>
              <span>{c.emoji}</span>
              <span className="whitespace-nowrap">{c.label}</span>
            </button>
          ))}
        </div>

        {/* 정렬 토글 */}
        <div className="flex items-center justify-between mt-3 mb-3">
          <span className="text-xs text-gray-400">{filtered.length}개</span>
          <div className="flex gap-1 p-0.5 bg-gray-100 rounded-pill">
            {SORTS.map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                className={`px-3 py-1 text-xs font-medium rounded-pill transition ${
                  sort === s.key ? 'bg-white text-brand-deep shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 리스트 */}
        {filtered.length === 0 ? (
          <EmptyState icon="🔍" title={query.trim() ? '검색 결과가 없어요' : '해당 카테고리에 프로그램이 없어요'} />
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {filtered.map(program => {
              const cats = (program.categories || [])
                .map(k => CATEGORY[k])
                .filter(Boolean)
              return (
                <button
                  key={program.id}
                  type="button"
                  onClick={() => onSelect(program.id)}
                  className="w-full flex items-center gap-2.5 p-3 bg-white border border-gray-100 rounded-card shadow-soft hover:shadow-elevated hover:border-emerald-200 transition text-left"
                >
                  <ProgramCover
                    imagePath={program.cover_image_path}
                    categories={program.categories}
                    name={program.name}
                    variant="thumb"
                    className="w-16 h-16 rounded-card flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-gray-800 truncate">{program.name}</h3>
                    {/* 카테고리 칩 — 복수 모두 표시 */}
                    {cats.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {cats.map(c => (
                          <span key={c.key} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
                            {c.emoji} {c.label}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-0.5">
                        <Users className="w-3 h-3" />{(counts[program.id] || 0).toLocaleString()}명
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-emerald-600 whitespace-nowrap">
                        <Calendar className="w-3 h-3" />{formatKoreanDate(program.start_date)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ProgramBrowseModal
