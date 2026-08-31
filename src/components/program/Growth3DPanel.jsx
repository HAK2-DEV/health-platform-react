// 프로그램 상세 「성장」 탭에 들어가는 3D 정원.
//
// ⚠️ 로컬 전용이다(ProgramDetailPage 의 GROWTH_3D 플래그). 아직 참여자에게 선보일 단계가 아니다.
//
// 개발 화면(/dev/growth, /dev/growth-operator)과 «같은 컴포넌트» 를 쓴다 —
// 여기서 새로 만들면 개발 화면에서 다듬은 게 실제 탭에 반영되지 않아 둘이 갈라진다.
// 이 파일이 하는 일은 셋뿐이다: 프로그램 id 를 넘기고, 운영자/참여자를 가르고, 탭 높이를 준다.
import { lazy, Suspense } from 'react'

const DevGrowthLab = lazy(() => import('../../pages/DevGrowthLab'))
const DevGrowthOperator = lazy(() => import('../../pages/DevGrowthOperator'))

export default function Growth3DPanel({ programId, isOwner }) {
  return (
    <div className="-mx-4 -mb-4 h-[72dvh]">
      {/* 개발 화면은 «주소의 ?program=» 으로 프로그램을 받는다. 탭 안에서는 URL 이 다르므로 prop 으로 준다. */}
      <Suspense fallback={<div className="h-full" />}>
        {isOwner
          ? <DevGrowthOperator embedProgramId={programId} />
          : <DevGrowthLab embedProgramId={programId} />}
      </Suspense>
    </div>
  )
}
