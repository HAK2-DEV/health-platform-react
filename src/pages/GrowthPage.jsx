// 성장 탭 — 준비 중 화면 (하단 탭바 「성장」 진입). 추후 실제 성장 대시보드로 대체.
export default function GrowthPage() {
  return (
    <div className="max-w-md mx-auto px-6 min-h-[72vh] flex flex-col items-center justify-center text-center">
      <img src="/icons/growth/sprout.png" alt="" aria-hidden="true" className="w-28 h-28 object-contain mb-3" />
      <h1 className="text-xl font-extrabold text-gray-900">성장</h1>
      <p className="text-[14px] text-gray-500 mt-2 leading-relaxed break-keep">
        준비 중인 기능이에요.<br />곧 나의 성장을 한눈에 볼 수 있어요
      </p>
      <span className="mt-5 inline-flex items-center px-3.5 h-8 rounded-full bg-gray-100 text-gray-500 text-[12px] font-bold">준비중</span>
    </div>
  )
}
