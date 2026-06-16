import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

// 뒤로가기 버튼 — 하단 탭 제거(본인 결정) 후 헤더 좌측 진입 경로.
//   navigate(-1) — 직전 화면으로. 히스토리 없으면 홈으로 폴백.
function BackButton({ className = '' }) {
  const navigate = useNavigate()
  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/dashboard')
  }
  return (
    <button
      type="button"
      onClick={goBack}
      title="뒤로"
      className={`w-9 h-9 -ml-1 flex items-center justify-center rounded-full text-gray-700 hover:bg-white/60 transition flex-shrink-0 ${className}`}
    >
      <ChevronLeft className="w-6 h-6" />
    </button>
  )
}

export default BackButton
