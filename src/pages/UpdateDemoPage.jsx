import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import PwaUpdatePrompt from '../components/common/PwaUpdatePrompt'

// 업데이트 흐름 로컬 데모 — 실제 배너(PwaUpdatePrompt) + 브랜드 스플래시(UpdateSplash)를
//   reload 없이 미리보기. 라우트: /update-demo.
//   「배너 다시 띄우기」 → key 를 바꿔 PwaUpdatePrompt 를 remount(forceShow) 해 배너 재노출.
function UpdateDemoPage() {
  const navigate = useNavigate()
  const [instance, setInstance] = useState(0)  // remount 트리거

  return (
    <div className="min-h-screen bg-surface-app">
      <div className="max-w-md mx-auto px-5 pt-4 pb-40">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 -ml-1.5 mb-3 rounded-full hover:bg-gray-100"
          aria-label="뒤로"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>

        <h1 className="text-xl font-extrabold text-gray-900 mb-1">업데이트 화면 데모</h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          새 버전이 배포됐을 때 사용자에게 보이는 흐름이에요.<br />
          <span className="text-gray-400">(데모라 실제 새로고침은 일어나지 않아요)</span>
        </p>

        <ol className="space-y-3 text-sm text-gray-700 mb-8">
          <li className="flex gap-2">
            <span className="font-bold text-emerald-600 flex-shrink-0">1</span>
            <span>새 버전 감지 → 하단에 <b>"새 버전이 있어요 · 새로고침"</b> 배너</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-emerald-600 flex-shrink-0">2</span>
            <span><b>새로고침</b> 탭 → 🌱 <b>도담 브랜드 스플래시</b>가 잠깐 뜸</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-emerald-600 flex-shrink-0">3</span>
            <span>실제로는 여기서 최신 버전으로 reload 완료</span>
          </li>
        </ol>

        <button
          type="button"
          onClick={() => setInstance((n) => n + 1)}
          className="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition"
        >
          ▶ 배너 다시 띄우기
        </button>
        <p className="text-xs text-gray-400 mt-3 text-center">
          아래 배너의 「새로고침」을 눌러 스플래시를 확인하세요.
        </p>
      </div>

      {/* 실제 배너 컴포넌트를 데모 모드로 — forceShow 로 즉시 노출, reload 대신 스플래시만 재생 */}
      <PwaUpdatePrompt key={instance} demo forceShow />
    </div>
  )
}

export default UpdateDemoPage
