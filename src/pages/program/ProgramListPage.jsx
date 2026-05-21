import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { Plus, Activity } from 'lucide-react'
import { formatKoreanDate } from '../../lib/formatters'
import ProgramDetailModal from '../../components/program/ProgramDetailModal'

// 📋 프로그램 탭 — 3섹션 전체 표시
// 대시보드 요약(.slice(0, 3))의 "전체보기 →" 도착지
function ProgramListPage() {
  const { session } = useAuth()
  const navigate = useNavigate()

  const [myPrograms, setMyPrograms] = useState([])
  const [activePrograms, setActivePrograms] = useState([])
  const [publicPrograms, setPublicPrograms] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedProgram, setSelectedProgram] = useState(null)

  useEffect(() => {
    if (!session) return

    const fetchAll = async () => {
      setIsLoading(true)

      // 1) 내 프로그램
      const my = await supabase
        .from('programs')
        .select('*')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false })

      if (my.error) console.error('내 프로그램 조회 실패:', my.error)
      else setMyPrograms(my.data || [])

      // 2) 참여 중
      const active = await supabase
        .from('program_participants')
        .select('joined_at, programs(*)')
        .eq('user_id', session.user.id)
        .eq('status', 'ACTIVE')
        .order('joined_at', { ascending: false })

      if (active.error) console.error('참여 프로그램 조회 실패:', active.error)
      else {
        const programs = (active.data || []).map(row => row.programs).filter(Boolean)
        setActivePrograms(programs)
      }

      // 3) 공개 둘러보기
      const pub = await supabase
        .from('programs')
        .select('*')
        .eq('status', 'PUBLISHED')
        .eq('is_public', true)
        .neq('owner_id', session.user.id)
        .order('published_at', { ascending: false })

      if (pub.error) console.error('공개 프로그램 조회 실패:', pub.error)
      else setPublicPrograms(pub.data || [])

      setIsLoading(false)
    }

    fetchAll()
  }, [session])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl text-gray-800 mb-6">📋 프로그램</h1>

      {/* 내 프로그램 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-lg text-gray-800">
            <Activity className="w-5 h-5 text-green-500" />
            내 프로그램 <span className="text-sm text-gray-500">({myPrograms.length})</span>
          </h2>
          <Link
            to="/programs/new"
            className="flex items-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-md transition"
          >
            <Plus className="w-4 h-4" />
            새 프로그램
          </Link>
        </div>

        {isLoading ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">불러오는 중...</div>
        ) : myPrograms.length === 0 ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">
            아직 만든 프로그램이 없어요
          </div>
        ) : (
          <div className="grid gap-3">
            {myPrograms.map(program => (
              <div
                key={program.id}
                onClick={() => setSelectedProgram(program)}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-gray-800">{program.name}</h3>
                  <span className={`
                    px-2 py-0.5 rounded text-xs
                    ${program.status === 'PUBLISHED'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'}
                  `}>
                    {program.status === 'PUBLISHED' ? '진행중' : '임시저장'}
                  </span>
                </div>
                {program.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{program.description}</p>
                )}
                <p className="text-xs text-gray-500">
                  {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 참여 중인 프로그램 */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-lg text-gray-800 mb-4">
          🎯 참여 중인 프로그램 <span className="text-sm text-gray-500">({activePrograms.length})</span>
        </h2>

        {isLoading ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">불러오는 중...</div>
        ) : activePrograms.length === 0 ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">
            아직 참여한 프로그램이 없어요
          </div>
        ) : (
          <div className="grid gap-3">
            {activePrograms.map(program => (
              <div
                key={program.id}
                onClick={() => navigate(`/programs/${program.id}`)}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
              >
                <h3 className="font-medium text-gray-800 mb-2">{program.name}</h3>
                {program.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{program.description}</p>
                )}
                <p className="text-xs text-gray-500">
                  {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 공개 둘러보기 */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-lg text-gray-800 mb-4">
          🔍 공개 프로그램 둘러보기 <span className="text-sm text-gray-500">({publicPrograms.length})</span>
        </h2>

        {isLoading ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">불러오는 중...</div>
        ) : publicPrograms.length === 0 ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center text-gray-500 text-sm">
            아직 둘러볼 공개 프로그램이 없어요
          </div>
        ) : (
          <div className="grid gap-3">
            {publicPrograms.map(program => (
              <div
                key={program.id}
                onClick={() => setSelectedProgram(program)}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
              >
                <h3 className="font-medium text-gray-800 mb-2">{program.name}</h3>
                {program.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">{program.description}</p>
                )}
                <p className="text-xs text-gray-500">
                  {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 프로그램 상세 모달 (대시보드와 동일 컴포넌트 재사용) */}
      <ProgramDetailModal
        program={selectedProgram}
        isOpen={selectedProgram !== null}
        onClose={() => setSelectedProgram(null)}
      />
    </div>
  )
}

export default ProgramListPage
