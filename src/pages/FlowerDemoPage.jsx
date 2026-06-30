import WateringFlower from '../components/program/WateringFlower'

// 꽃 키우기 「물주기 손맛」 데모 — 임시 미리보기 (localhost:5173/flower-demo).
//   인터랙션 손맛 확인용. 비주얼은 다음 슬라이스에서 에셋으로 교체.
function FlowerDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-10">
      <h1 className="text-lg font-extrabold text-gray-800 mb-1">🌱 꽃 키우기 — 물주기 손맛 데모</h1>
      <p className="text-[12px] text-gray-500 mb-6">버튼을 눌러 물을 줘보세요. 단계가 오르면 축포가 터져요.</p>
      <WateringFlower />
    </div>
  )
}

export default FlowerDemoPage
