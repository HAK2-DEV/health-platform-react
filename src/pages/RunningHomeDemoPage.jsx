import { useState } from 'react'
import { ChevronLeft, Settings } from 'lucide-react'
import RunningHome from '../components/program/RunningHome'

// 달리기 홈 UI 데모 — localhost:5173/running-home-demo. 본 페이지 통합 전 비주얼 확인용.
function RunningHomeDemoPage() {
  const [hero, setHero] = useState(null)
  return (
    <div className="min-h-screen bg-white py-3">
      <div className="max-w-[430px] mx-auto px-[11px]">
        {/* 상단 헤더(기존 ProgramDetailPage 헤더 모사) */}
        <div className="h-[44px] flex items-center justify-center relative mb-1">
          <ChevronLeft className="absolute left-1 w-5 h-5 text-gray-600" />
          <span className="px-3 py-0.5 rounded-full border border-emerald-400 bg-white text-emerald-600 text-[11px] font-bold">진행중</span>
          <span className="ml-1.5 text-[15px] font-bold text-gray-800">러닝 챌린지</span>
          <Settings className="absolute right-1 w-[18px] h-[18px] text-gray-600" />
        </div>
        <RunningHome
          programName="러닝 챌린지"
          startDate="2026.06.29"
          endDate="2026.07.26"
          progress={3}
          rankingEnabled
          paceEditable
          showStampTest
          hero={hero}
          heroEditable
          onHeroChange={setHero}
        />
      </div>
    </div>
  )
}

export default RunningHomeDemoPage
