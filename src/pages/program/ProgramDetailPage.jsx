import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../supabaseClient'
import { ChevronLeft } from 'lucide-react'
import { formatKoreanDate, toKSTDateString } from '../../lib/formatters'
import VerificationSubmitModal from '../../components/program/VerificationSubmitModal'
import ProgramEditModal from '../../components/program/ProgramEditModal'
import MissionCreateModal from '../../components/program/MissionCreateModal'
import { Plus } from 'lucide-react'

function ProgramDetailPage() {
  const { id } = useParams()
  const { session } = useAuth()
  const navigate = useNavigate()

  const [program, setProgram] = useState(null)
  const [missions, setMissions] = useState([])
  const [myScore, setMyScore] = useState(0)
  const [todayScore, setTodayScore] = useState(0)
  const [ranking, setRanking] = useState([])
  // 본인 KST 오늘 미션별 인증 횟수 (mission_id → count)
  const [todayCounts, setTodayCounts] = useState({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedMission, setSelectedMission] = useState(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isMissionCreateOpen, setIsMissionCreateOpen] = useState(false)

  // KST 기준 'YYYY-MM-DD' 문자열 (Intl 이 timezone 안전)
  const formatKstDate = (date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)

  const fetchData = async () => {
    if (!session || !id) return

    setError(null)

    // 1) 프로그램 정보
    const { data: programData, error: programError } = await supabase
      .from('programs')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (programError || !programData) {
      setError('프로그램을 찾을 수 없습니다')
      return
    }
    setProgram(programData)

    // 2) 미션 목록
    const { data: missionsData, error: missionsError } = await supabase
      .from('missions')
      .select('*')
      .eq('program_id', id)
      .order('feature')

    if (missionsError) {
      console.error('미션 조회 실패:', missionsError)
    } else {
      setMissions(missionsData || [])
    }

    // 3) 본인의 점수 (누적 + KST 오늘)
    const { data: scoreData, error: scoreError } = await supabase
      .from('score_ledgers')
      .select('point, created_at')
      .eq('program_id', id)
      .eq('user_id', session.user.id)

    if (scoreError) {
      console.error('점수 조회 실패:', scoreError)
    } else {
      const rows = scoreData || []
      const total = rows.reduce((sum, row) => sum + row.point, 0)
      setMyScore(total)

      // KST 오늘만 합산
      const todayKst = formatKstDate(new Date())
      const todayTotal = rows
        .filter(row => formatKstDate(new Date(row.created_at)) === todayKst)
        .reduce((sum, row) => sum + row.point, 0)
      setTodayScore(todayTotal)
    }

    // 4) 랭킹 (RPC — RLS 우회 SECURITY DEFINER 함수)
    const { data: rankingData, error: rankingError } = await supabase
      .rpc('get_program_ranking', { p_program_id: id })

    if (rankingError) {
      console.error('랭킹 조회 실패:', rankingError)
    } else {
      setRanking(rankingData || [])
    }

    // 5) 본인의 KST 오늘 미션별 인증 횟수 (daily_limit 연동)
    const { data: vData, error: vError } = await supabase
      .from('verifications')
      .select('mission_id, submitted_at')
      .eq('user_id', session.user.id)
      .eq('status', 'APPROVED')

    if (vError) {
      console.error('인증 횟수 조회 실패:', vError)
    } else {
      const todayKst = formatKstDate(new Date())
      const counts = {}
      ;(vData || []).forEach(v => {
        const vKst = formatKstDate(new Date(v.submitted_at))
        if (vKst === todayKst) {
          counts[v.mission_id] = (counts[v.mission_id] || 0) + 1
        }
      })
      setTodayCounts(counts)
    }
  }

  useEffect(() => {
    setIsLoading(true)
    fetchData().finally(() => setIsLoading(false))
  }, [session, id])

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center text-gray-500">
        불러오는 중...
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="p-4 bg-red-100 text-red-700 rounded">{error}</p>
        <Link to="/dashboard" className="block mt-4 text-green-600 hover:underline">
          ← 대시보드로
        </Link>
      </div>
    )
  }

  return (
    <div className="px-4 pt-2 pb-6 max-w-4xl mx-auto">
      {/* 좌측 상단 작은 "<" 백 버튼 (컴팩트) */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center justify-center w-9 h-9 -ml-1 mb-2 rounded-full hover:bg-gray-100 transition"
        title="뒤로"
      >
        <ChevronLeft className="w-5 h-5 text-gray-600" />
      </button>

      {/* 프로그램 헤더 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-3">
          <h1 className="text-2xl font-medium text-gray-800">{program.name}</h1>
          <span className={`
            px-2 py-0.5 rounded text-xs
            ${program.status === 'PUBLISHED'
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'}
          `}>
            {program.status === 'PUBLISHED' ? '진행중' : program.status}
          </span>
        </div>

        {program.description && (
          <p className="text-gray-600 mb-3 whitespace-pre-wrap">{program.description}</p>
        )}

        {(program.start_date || program.end_date) && (
          <p className="text-sm text-gray-500">
            📅 {formatKoreanDate(program.start_date)} ~ {formatKoreanDate(program.end_date)}
          </p>
        )}
      </div>

      {/* 운영자 패널 (owner 본인) — 미래 관리 기능의 기반 자리 */}
      {program.owner_id === session?.user?.id && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 mb-6">
          <h2 className="flex items-center gap-2 text-sm font-medium text-amber-800 mb-3">
            ⚙️ 운영자 패널
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="px-3 py-2 bg-white border border-amber-300 hover:border-amber-500 hover:bg-amber-100 rounded text-sm text-amber-800 transition text-left"
            >
              ✏️ 프로그램 수정
              <span className="block text-xs text-amber-700">이름·기간·카테고리</span>
            </button>
            <button
              type="button"
              disabled
              className="px-3 py-2 bg-white border border-amber-200 rounded text-sm text-gray-400 cursor-not-allowed text-left"
              title="추후 진화"
            >
              📋 게시물 관리
              <span className="block text-xs">(COMMUNITY 도입 시)</span>
            </button>
            <button
              type="button"
              disabled
              className="px-3 py-2 bg-white border border-amber-200 rounded text-sm text-gray-400 cursor-not-allowed text-left"
              title="추후 진화"
            >
              ✅ 인증 심사
              <span className="block text-xs">(MANUAL 활성화 시)</span>
            </button>
            <button
              type="button"
              disabled
              className="px-3 py-2 bg-white border border-amber-200 rounded text-sm text-gray-400 cursor-not-allowed text-left"
              title="추후 진화"
            >
              📊 참여자 통계
              <span className="block text-xs">(준비 중)</span>
            </button>
          </div>
        </div>
      )}

      {/* 점수 요약 — 오늘 / 누적 두 카드 */}
      {(() => {
        // 오늘 가능 점수: daily_max_score 가 있으면 우선, 없으면 미션별 point × daily_limit(또는 1) 합
        const todayMax = program.daily_max_score ?? missions.reduce(
          (sum, m) => sum + m.point * (m.daily_limit || 1),
          0
        )
        return (
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs text-blue-700 mb-1">오늘 획득</p>
              <p className="font-medium text-blue-800">
                <span className="text-2xl">{todayScore}</span>
                <span className="text-base"> P</span>
                <span className="text-sm text-blue-600 ml-1">/ {todayMax}P</span>
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-xs text-green-700 mb-1">누적</p>
              <p className="font-medium text-green-800">
                <span className="text-2xl">{myScore}</span>
                <span className="text-base"> P</span>
              </p>
            </div>
          </div>
        )
      })()}

      {/* 미션 목록 헤더 (owner 면 + 미션 추가 버튼) */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium text-gray-800">📋 미션 목록</h2>
        {program.owner_id === session?.user?.id && (
          <button
            type="button"
            onClick={() => setIsMissionCreateOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-full transition"
          >
            <Plus className="w-4 h-4" />
            미션 추가
          </button>
        )}
      </div>
      {missions.length === 0 ? (
        <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
          미션이 아직 없어요
        </div>
      ) : (
        <div className="grid gap-3">
          {missions.map(mission => {
            // 인증 유형 메타로 분기 (운영자 추가 미션 + 자동 생성 둘 다 처리)
            const types = []
            if (mission.requires_image) types.push('업로드')
            if (mission.requires_numeric) types.push('기록')
            if (mission.requires_note) types.push('소감')
            const isSupported = types.length > 0
            const buttonLabel = types.length === 1 ? types[0] : (isSupported ? '인증' : null)

            // daily_limit 연동 — 오늘 인증 횟수가 한도 도달했나?
            const todayCount = todayCounts[mission.id] || 0
            const limit = mission.daily_limit
            const reachedLimit = limit != null && todayCount >= limit

            // 활성 기간 검증 (KST 기준)
            const now = new Date()
            const activeFrom = mission.active_from ? new Date(mission.active_from) : null
            const activeUntil = mission.active_until ? new Date(mission.active_until) : null
            const isBeforeStart = activeFrom && now < activeFrom
            const isAfterEnd = activeUntil && now > activeUntil
            const isInactive = isBeforeStart || isAfterEnd

            const inactiveLabel = isBeforeStart
              ? `${formatKoreanDate(toKSTDateString(activeFrom))} 시작`
              : isAfterEnd
              ? '운영 종료'
              : null

            return (
              <div
                key={mission.id}
                className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 mb-1">{mission.title}</h3>
                  <p className="text-xs text-gray-500">
                    {mission.verification_type === 'AUTO' ? '자동 승인' : '운영자 심사'}
                    {mission.daily_limit ? ` · 하루 ${mission.daily_limit}회` : ' · 무제한'}
                  </p>
                </div>

                <span className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded font-medium flex-shrink-0">
                  {mission.point}P
                </span>

                {/* 우측 액션 — 4가지 상태: 미지원 / 비활성기간 / 오늘 완료 / 활성 */}
                {!isSupported ? (
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    준비 중
                  </span>
                ) : isInactive ? (
                  <div className="text-right flex-shrink-0">
                    <button
                      type="button"
                      disabled
                      className="px-3 py-2 bg-gray-200 text-gray-400 text-sm rounded cursor-not-allowed whitespace-nowrap"
                      title={inactiveLabel}
                    >
                      {buttonLabel}
                    </button>
                    <p className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                      {inactiveLabel}
                    </p>
                  </div>
                ) : reachedLimit ? (
                  <div className="text-right flex-shrink-0">
                    <span className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-50 text-emerald-600 text-sm rounded font-medium whitespace-nowrap">
                      ✓ 오늘 인증 완료
                    </span>
                    {limit > 1 && (
                      <p className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                        {todayCount}/{limit}회
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-right flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedMission(mission)}
                      className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded transition whitespace-nowrap"
                    >
                      {buttonLabel}
                    </button>
                    {limit > 1 && todayCount > 0 && (
                      <p className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                        {todayCount}/{limit}회
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 랭킹 */}
      <h2 className="text-lg font-medium text-gray-800 mb-3 mt-8">🏆 랭킹</h2>
      {ranking.length === 0 ? (
        <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500 text-sm">
          아직 참여자가 없어요
        </div>
      ) : (
        <div className="grid gap-2">
          {ranking.map(row => {
            const isMe = row.user_id === session?.user?.id
            const rankBadgeClass =
              row.rank === 1 ? 'bg-yellow-100 text-yellow-700'
              : row.rank === 2 ? 'bg-gray-200 text-gray-700'
              : row.rank === 3 ? 'bg-orange-100 text-orange-700'
              : 'bg-gray-50 text-gray-500'

            return (
              <div
                key={row.user_id}
                className={`
                  flex items-center justify-between p-3 rounded-lg border
                  ${isMe
                    ? 'bg-green-50 border-green-300'
                    : 'bg-white border-gray-200'}
                `}
              >
                <div className="flex items-center gap-3">
                  <span className={`
                    flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                    ${rankBadgeClass}
                  `}>
                    {row.rank}
                  </span>
                  <span className={`font-medium ${isMe ? 'text-green-800' : 'text-gray-800'}`}>
                    {row.nickname}
                    {isMe && <span className="ml-1 text-xs text-green-600">(나)</span>}
                  </span>
                </div>
                <span className={`text-sm font-medium ${isMe ? 'text-green-700' : 'text-gray-600'}`}>
                  {row.total_score}P
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* 인증 제출 모달 */}
      <VerificationSubmitModal
        mission={selectedMission}
        isOpen={selectedMission !== null}
        onClose={() => setSelectedMission(null)}
        onSuccess={fetchData}
      />

      {/* 프로그램 수정 모달 (owner 만) */}
      <ProgramEditModal
        program={program}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={fetchData}
      />

      {/* 미션 추가 모달 (owner 만) */}
      <MissionCreateModal
        program={program}
        isOpen={isMissionCreateOpen}
        onClose={() => setIsMissionCreateOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  )
}

export default ProgramDetailPage
