// 꽃 도감 (/dev/growth-flower) — 개발용. 7종 x 5단계를 한 화면에 늘어놓고 본다.
//
// 왜 필요한가: 지금까지 꽃을 하나씩 열어 확인했는데, 그러면 «종끼리·단계끼리» 비교가 안 된다.
// 새 모델을 넣거나 크기·표정을 손봤을 때 어긋난 하나를 찾으려면 전부 나란히 놓고 봐야 한다.
//
// 구현 — 캔버스 하나에 격자로 배치한다(칸마다 캔버스를 두면 35개가 되어 못 쓴다).
//   직교 카메라라 «월드 좌표 → 화면 비율» 이 선형이다. 그래서 HTML 라벨을 같은 격자 비율로
//   겹쳐 놓으면 정확히 맞는다(원근 카메라면 칸마다 어긋난다).
import { Suspense, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useThree } from '@react-three/fiber'
import { OrthographicCamera, useGLTF } from '@react-three/drei'
import { ChevronLeft } from 'lucide-react'
import * as THREE from 'three'
import { SPECIES, SPECIES_KEYS } from '../lib/growthSpecies'

const STAGE_LABEL = ['새싹', '어린잎', '봉오리', '개화', '만개']
const COLS = 5
const ROWS = SPECIES_KEYS.length
const CELL = 1                       // 칸 하나의 월드 크기(정사각)
const PLANT_H = 0.78                 // 칸 안에서 식물이 차지하는 높이 비율

const ALL_URLS = [...new Set(SPECIES_KEYS.flatMap((k) => SPECIES[k].urls))]

// 모델 하나 — 칸 한가운데에 «높이를 맞춰» 세운다. 종·단계마다 원본 높이가 달라서
// 그대로 두면 크기 비교가 아니라 «원본 스케일 비교» 가 되어버린다.
function Cell({ url, col, row }) {
  const { scene } = useGLTF(url)
  const obj = useMemo(() => {
    const c = scene.clone(true)
    c.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(c)
    const size = new THREE.Vector3(); box.getSize(size)
    const s = (CELL * PLANT_H) / Math.max(1e-4, size.y)
    c.scale.setScalar(s)
    // 밑동을 칸 바닥에 맞춘다
    c.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s - (CELL * 0.42), -((box.min.z + box.max.z) / 2) * s)
    c.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.side = THREE.DoubleSide } })
    return c
  }, [scene])
  return (
    <group position={[(col - (COLS - 1) / 2) * CELL, ((ROWS - 1) / 2 - row) * CELL, 0]}>
      <primitive object={obj} />
    </group>
  )
}

// 격자 전체가 화면에 «딱» 들어오게 zoom 을 맞춘다 — HTML 라벨이 같은 비율로 겹쳐야 하므로
// 여백 없이 정확히 채워야 한다.
function FitCamera() {
  const { size } = useThree()
  const zoom = Math.min(size.width / (COLS * CELL), size.height / (ROWS * CELL))
  return <OrthographicCamera makeDefault position={[0, 0, 20]} zoom={zoom} near={0.1} far={100} />
}

export default function DevGrowthFlower() {
  const navigate = useNavigate()
  return (
    <div className="h-[100dvh] flex flex-col" style={{ background: 'linear-gradient(180deg,#EAF6FB,#F2F8E9)' }}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-2" style={{ paddingTop: 'max(env(safe-area-inset-top),0.75rem)' }}>
        <button type="button" onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-white/80 shadow-sm flex items-center justify-center text-gray-700">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-[17px] font-extrabold text-gray-900">꽃 도감</h1>
        <span className="text-[10px] font-bold text-gray-400 bg-white/70 px-2 py-1 rounded-full">/dev/growth-flower</span>
        <span className="ml-auto text-[11px] font-bold text-gray-400">{ROWS}종 × {COLS}단계</span>
      </div>

      <div className="flex-1 min-h-0 relative">
        <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-emerald-700/50 text-sm">불러오는 중…</div>}>
          <Canvas dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
            <FitCamera />
            <ambientLight intensity={1.15} />
            <hemisphereLight args={['#ffffff', '#cdeccf', 0.7]} />
            <directionalLight position={[3, 6, 5]} intensity={1.0} />
            {SPECIES_KEYS.map((k, row) =>
              SPECIES[k].urls.map((u, col) => <Cell key={k + col} url={u} col={col} row={row} />))}
          </Canvas>
        </Suspense>

        {/* 라벨 — 직교 카메라라 월드 격자와 화면 비율이 1:1 이다. 같은 격자로 겹친다. */}
        <div className="absolute inset-0 pointer-events-none grid"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
          {SPECIES_KEYS.map((k, row) =>
            STAGE_LABEL.map((lab, col) => (
              <div key={k + col} className="relative">
                {col === 0 && (
                  <span className="absolute left-1 top-1 text-[10px] font-extrabold text-emerald-800/70 bg-white/70 rounded px-1">
                    {SPECIES[k].label}
                  </span>
                )}
                {row === 0 && (
                  <span className="absolute right-1 top-1 text-[10px] font-bold text-gray-500 bg-white/70 rounded px-1">
                    {lab}
                  </span>
                )}
              </div>
            )))}
        </div>
      </div>
    </div>
  )
}

ALL_URLS.forEach((u) => useGLTF.preload(u))
