import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../supabaseClient'
import { Plus, Activity, Trash2 } from 'lucide-react'
import { formatKoreanDate } from '../lib/formatters'
import { PROGRAM_STATUS } from '../lib/constants'
import ProgramDetailModal from '../components/program/ProgramDetailModal'


function DashboardPage() {
  const { session, nickname } = useAuth()
  const [myPrograms, setMyPrograms] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const navigate = useNavigate()
  const [selectedProgram, setSelectedProgram] = useState(null)   // ⭐ 추가

  // 공개 프로그램 둘러보기
  const [publicPrograms, setPublicPrograms] = useState([])
  const [isLoadingPublic, setIsLoadingPublic] = useState(true)

  // 참여 중인 프로그램
  const [activePrograms, setActivePrograms] = useState([])
  const [isLoadingActive, setIsLoadingActive] = useState(true)


  // 로그아웃 시 /login 으로                              // ⭐ 추가
  useEffect(() => {
    if (session === null) {
      navigate('/login')
    }
  }, [session, navigate])

  // 본인이 만든 프로그램 가져오기
  useEffect(() => {
    if (!session) return

    const fetchMyPrograms = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('프로그램 조회 실패:', error)
      } else {
        setMyPrograms(data || [])
      }
      setIsLoading(false)
    }

    fetchMyPrograms()
  }, [session])

  // 공개 프로그램 둘러보기 (PUBLISHED + is_public + 본인 것 제외)
  useEffect(() => {
    if (!session) return

    const fetchPublicPrograms = async () => {
      setIsLoadingPublic(true)
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('status', 'PUBLISHED')
        .eq('is_public', true)
        .neq('owner_id', session.user.id)
        .order('published_at', { ascending: false })

      if (error) {
        console.error('공개 프로그램 조회 실패:', error)
      } else {
        setPublicPrograms(data || [])
      }
      setIsLoadingPublic(false)
    }

    fetchPublicPrograms()
  }, [session])

  // 참여 중인 프로그램 (ACTIVE 상태만)
  useEffect(() => {
    if (!session) return

    const fetchActivePrograms = async () => {
      setIsLoadingActive(true)
      const { data, error } = await supabase
        .from('program_participants')
        .select('joined_at, programs(*)')
        .eq('user_id', session.user.id)
        .eq('status', 'ACTIVE')
        .order('joined_at', { ascending: false })

      if (error) {
        console.error('참여 프로그램 조회 실패:', error)
      } else {
        // 중첩된 programs 객체만 추출
        const programs = (data || [])
          .map(row => row.programs)
          .filter(Boolean)
        setActivePrograms(programs)
      }
      setIsLoadingActive(false)
    }

    fetchActivePrograms()
  }, [session])

  // 임시저장(DRAFT) 삭제
  const handleDelete = async (programId, programName) => {
    // 본인이 실수 방지 - 확인
    if (!window.confirm(`"${programName}" 임시저장을 삭제할까요?`)) {
      return
    }
    
    const { error } = await supabase
      .from('programs')
      .delete()
      .eq('id', programId)
      .eq('status', 'DRAFT')          // ⭐ DRAFT 만 (안전장치)
    
    if (error) {
      console.error('삭제 실패:', error)
      alert('삭제에 실패했습니다')
      return
    }
    
    // 목록에서 제거 (화면 갱신)
    setMyPrograms(myPrograms.filter(p => p.id !== programId))
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl text-gray-800 mb-2">
          안녕하세요, {nickname}님 👋
        </h1>
        <p className="text-gray-600">
          오늘도 건강한 하루 만들어요
        </p>
      </div>
      
      {/* 내가 만든 프로그램 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-xl text-gray-800">
            <Activity className="w-5 h-5 text-green-500" />
            내 프로그램
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
          <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500">
            불러오는 중...
          </div>
        ) : myPrograms.length === 0 ? (
          <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500">
            아직 만든 프로그램이 없어요
            <br />
            <span className="text-sm">위의 "새 프로그램" 버튼으로 시작해보세요</span>
          </div>
        ) : (
          <div className="grid gap-3">
            {myPrograms.map(program => (
              <div 
  key={program.id}
  onClick={() => setSelectedProgram(program)}                    // ⭐ 추가
  className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition cursor-pointer"
>
                <div className="flex items-start justify-between mb-2">
  <h3 className="font-medium text-gray-800">{program.name}</h3>
  <div className="flex items-center gap-2">
    <span className={`
      px-2 py-0.5 rounded text-xs
      ${program.status === 'PUBLISHED' 
        ? 'bg-green-100 text-green-700' 
        : 'bg-gray-100 text-gray-600'}
    `}>
      {program.status === 'PUBLISHED' ? '진행중' : '임시저장'}
    </span>
    {/* DRAFT 만 삭제 버튼 */}
    {program.status === 'DRAFT' && (
      <button
  onClick={(e) => {
    e.stopPropagation()                          // ⭐ 추가 (모달 안 열림)
    handleDelete(program.id, program.name)
  }}
  className="p-1 text-gray-400 hover:text-red-500 transition"
  title="삭제"
>
  <Trash2 className="w-4 h-4" />
</button>
    )}
  </div>
</div>
                {program.description && (
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {program.description}
                  </p>
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
        <h2 className="flex items-center gap-2 text-xl text-gray-800 mb-4">
          🎯 참여 중인 프로그램
        </h2>

        {isLoadingActive ? (
          <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500">
            불러오는 중...
          </div>
        ) : activePrograms.length === 0 ? (
          <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
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
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {program.description}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
      
      {/* 공개 프로그램 둘러보기 */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-xl text-gray-800 mb-4">
          🔍 공개 프로그램 둘러보기
        </h2>

        {isLoadingPublic ? (
          <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500">
            불러오는 중...
          </div>
        ) : publicPrograms.length === 0 ? (
          <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
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
                  <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                    {program.description}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 프로그램 상세 모달 */}
      <ProgramDetailModal
        program={selectedProgram}
        isOpen={selectedProgram !== null}
        onClose={() => setSelectedProgram(null)}
      />

    </div>
  )
}

export default DashboardPage