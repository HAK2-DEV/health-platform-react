import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import IconBox from './IconBox'

// 마이페이지 메뉴 한 줄 — 아이콘 상자 + 제목(+설명) + ›. 마이페이지와 그 하위 목록 화면(업데이트 사항)이 같이 쓴다(2026-10-09 분리).
//   모든 메뉴 아이콘 통일 — 동일 IconBox(둥근 모서리 + 연한 톤 배경) 안에 심볼(투명 PNG 또는 lucide).
function ProfileMenuItem({ tone, icon, imgSrc, title, description, onClick }) {
  const [imgErr, setImgErr] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 bg-white rounded-[10px] shadow-soft hover:shadow-elevated transition text-left"
    >
      <IconBox tone={tone} size="lg" shape="square" className="!rounded-[18px]">
        {imgSrc && !imgErr
          ? <img src={imgSrc} alt="" aria-hidden="true" onError={() => setImgErr(true)} className="w-8 h-8 object-contain" />
          : icon}
      </IconBox>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
    </button>
  )
}

export default ProfileMenuItem
