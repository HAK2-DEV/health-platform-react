import ProgramCover from '../common/ProgramCover'

// 프로그램 타일 — 표지 이미지 + 제목만. 그리드 셀(w-full)에 맞춰 정사각.
function ProgramTile({ program, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 w-full"
    >
      <ProgramCover
        imagePath={program.cover_image_path}
        categories={program.categories}
        name={program.name}
        variant="thumb"
        className="w-full shadow-soft transition group-hover:shadow-elevated group-active:scale-95"
      />
      <span className="text-[12px] font-semibold text-gray-800 leading-tight text-center line-clamp-2 break-keep w-full">
        {program.name}
      </span>
    </button>
  )
}

export default ProgramTile
