import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Float, useGLTF } from '@react-three/drei'

// 성장 v1 — 떠 있는 클레이 섬(R3F). 1컨셉·1식물(나무)로 용량 최소화.
//   활동(물=인증, 햇빛=출석)이 쌓일수록 섬에 나무가 늘고(plantCount) 더 자란다(growthRatio).
//   지금은 절차적 클레이(지오메트리+소프트 라이팅). 추후 실제 clay glb 로 섬/나무만 교체하면 됨.
//   카메라: 3/4 아이소(떠 있는 섬 + 언더사이드), 드래그 회전 + 완만한 자동 회전.

// 잔디 돔(반경2, y스케일0.5) 표면 높이 — 반경 r 위치의 y.
const domeY = (r) => 1.0 * Math.sqrt(Math.max(0, 1 - (r / 2) ** 2))

// 나무 앵커 — 섬 위 (반경, 각도). 순서대로 채워짐(중앙 히어로 → 바깥).
const RAW = [
  [0, 0, 1.15], [0.85, 0.5, 0.7], [0.95, 2.4, 0.72], [1.05, 4.2, 0.7],
  [1.3, 1.25, 0.62], [1.35, 3.5, 0.6], [1.25, 5.4, 0.64], [1.5, 0.2, 0.5],
  [0.6, 3.1, 0.55], [1.5, 2.0, 0.5], [1.45, 4.7, 0.52], [1.1, 6.0, 0.58],
]

function Tree({ pos, scale, grown }) {
  const s = scale * (0.7 + 0.5 * grown)
  return (
    <group position={pos} scale={s}>
      <mesh castShadow position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.07, 0.1, 0.42, 8]} />
        <meshStandardMaterial color="#8a5a36" roughness={0.95} />
      </mesh>
      <mesh castShadow position={[0, 0.58, 0]}>
        <icosahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial color="#57b368" roughness={0.7} flatShading />
      </mesh>
      <mesh castShadow position={[0.13, 0.8, 0.06]}>
        <icosahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial color="#6cc27a" roughness={0.7} flatShading />
      </mesh>
    </group>
  )
}

// Tripo 식물 glb — 임의 스케일/피벗을 바운딩박스로 정규화(높이 targetH, 밑동 y=0).
//   예전엔 테스트용 rose.glb(61MB)를 썼다 — 배포 용량 때문에 압축본 daisy_s5 로 교체.
useGLTF.preload('/models/daisy_s5.glb')
function PlantModel({ url = '/models/daisy_s5.glb', targetH = 1.1 }) {
  const { scene } = useGLTF(url)
  const model = useMemo(() => {
    const s = scene.clone(true)
    s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
    const box = new THREE.Box3().setFromObject(s)
    const size = new THREE.Vector3(); box.getSize(size)
    const k = size.y > 0 ? targetH / size.y : 1
    s.scale.setScalar(k)
    const box2 = new THREE.Box3().setFromObject(s)
    s.position.x -= (box2.min.x + box2.max.x) / 2   // 가로 중앙
    s.position.z -= (box2.min.z + box2.max.z) / 2
    s.position.y -= box2.min.y                       // 밑동을 원점에
    return s
  }, [scene, targetH])
  return <primitive object={model} />
}

// 섬 — 실제 clay glb(public/models/island.glb). 절차적 도형 완전 대체.
useGLTF.preload('/models/island.glb')
function IslandModel() {
  const { scene } = useGLTF('/models/island.glb')
  const model = useMemo(() => {
    const s = scene.clone(true)
    s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
    return s
  }, [scene])
  return <primitive object={model} />
}

function Island({ plantCount, growthRatio }) {
  const trees = useMemo(() => {
    const n = Math.max(1, Math.min(RAW.length, plantCount))
    return RAW.slice(0, n).map(([r, a, sc], i) => ({
      key: i,
      pos: [r * Math.cos(a), domeY(r) - 0.05, r * Math.sin(a)],
      scale: sc,
    }))
  }, [plantCount])

  return (
    <Float speed={1.4} rotationIntensity={0} floatIntensity={0.5}>
      <IslandModel />
      {/* ── 파이프라인 테스트: Tripo 장미 1송이를 섬 중앙에 심음(스케일은 성장률에 비례) ──
          검증되면 여러 송이/레이캐스트 심기로 확장. 기존 절차적 나무는 잠시 비활성. */}
      <group position={[0, domeY(0) - 0.05, 0]} scale={0.75 + 0.5 * growthRatio}>
        <PlantModel url="/models/daisy_s5.glb" targetH={1.1} />
      </group>
      {/* 나무(절차적) — 테스트 중 숨김. 필요 시 복구.
      {trees.map((t) => (
        <Tree key={t.key} pos={t.pos} scale={t.scale} grown={growthRatio} />
      ))} */}
    </Float>
  )
}

export default function ClayIslandScene({ plantCount = 1, growthRatio = 0 }) {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ alpha: true, antialias: true }}
      camera={{ position: [4.4, 2.4, 5.0], fov: 33 }} style={{ width: '100%', height: '100%' }}>
      <Suspense fallback={null}>
        <ambientLight intensity={0.75} />
        <hemisphereLight args={['#ffffff', '#bfe0c8', 0.55]} />
        <directionalLight position={[4, 7, 3]} intensity={1.15} castShadow
          shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
        <Island plantCount={plantCount} growthRatio={growthRatio} />
        <OrbitControls enablePan={false} enableZoom
          minDistance={3} maxDistance={11} zoomSpeed={0.8}
          minPolarAngle={0.55} maxPolarAngle={1.55} target={[0, 1.0, 0]}
          autoRotate autoRotateSpeed={0.55} />
      </Suspense>
    </Canvas>
  )
}
