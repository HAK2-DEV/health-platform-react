import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Plus, Activity } from 'lucide-react'

function DashboardPage() {
  const { nickname } = useAuth()
  
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
      
      {/* 내가 만든 프로그램 섹션 */}
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
        
        <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500">
          아직 만든 프로그램이 없어요
          <br />
          <span className="text-sm">위의 "새 프로그램" 버튼으로 시작해보세요</span>
        </div>
      </section>
      
      {/* 내가 참여한 프로그램 섹션 (미래) */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-xl text-gray-800 mb-4">
          🎯 참여 중인 프로그램
        </h2>
        <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
          (미래에 추가 예정)
        </div>
      </section>
      
      {/* 공개 프로그램 둘러보기 (미래) */}
      <section className="mb-8">
        <h2 className="flex items-center gap-2 text-xl text-gray-800 mb-4">
          🔍 공개 프로그램 둘러보기
        </h2>
        <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-500 text-sm">
          (미래에 추가 예정)
        </div>
      </section>
    </div>
  )
}

export default DashboardPage