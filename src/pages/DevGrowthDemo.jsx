import { useState, useMemo, useRef, useEffect, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Float, Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { ChevronLeft } from 'lucide-react'
import { IslandModel } from '../components/growth/IslandModel'

// 성장 공동 모델 데모 — A(공유 섬)·B(개인+이웃방문)·C(군도 줌). 참여자=꽃 1송이(임시 절차적, flower.glb 오면 교체).
//   숨긴 /dev/growth-demo. 목적: "다른 사람 식물 어떻게 보지"의 세 답을 실제로 비교.

const domeY = (r) => 1.0 * Math.sqrt(Math.max(0, 1 - (r / 2) ** 2))
// 섬 위 앵커(반경, 각도)
const ANCH = [[0, 0], [0.9, 0.5], [0.95, 2.35], [1.05, 4.1], [1.28, 1.25], [1.32, 3.5], [1.2, 5.35], [1.42, 0.2]]

const PEOPLE = [
  { name: '나', stage: 4, color: '#e5779a', me: true },
  { name: 'test2', stage: 3, color: '#f4a04d' },
  { name: 'test3', stage: 5, color: '#c084fc' },
  { name: '민수', stage: 2, color: '#f2c94c' },
  { name: '지연', stage: 4, color: '#5aa9e6' },
  { name: 'test6', stage: 1, color: '#ef7676' },
  { name: '하늘', stage: 3, color: '#5fc9b0' },
]
const flowerScale = (stage) => 0.75 + stage * 0.12

// ── 클레이 꽃 (public/models/flower.glb, 화분 데이지). 피벗 중앙이라 바닥을 접지로 올림 ──
const FLOWER_BASE = 0.72   // 2유닛 모델을 섬(반경2)에 맞게 축소
function Flower({ scale = 1, highlight = false }) {
  const { scene } = useGLTF('/models/flower.glb')
  const model = useMemo(() => {
    const s = scene.clone(true)
    s.traverse((o) => { if (o.isMesh) o.castShadow = true })
    return s
  }, [scene])
  const S = FLOWER_BASE * scale
  // 런타임 실제 bbox의 최하점을 그룹 원점(지면)에 정렬 — 모델 피벗이 어디든 접지
  const offsetY = useMemo(() => {
    model.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(model)
    return Number.isFinite(box.min.y) ? -box.min.y * S : 0
  }, [model, S])
  return (
    <group>
      <primitive object={model} scale={S} position={[0, offsetY, 0]} />
      {highlight && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[S * 1.2, S * 1.5, 28]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  )
}
useGLTF.preload('/models/flower.glb')

function NameTag({ text, me }) {
  return (
    <Html center distanceFactor={5} position={[0, 1.7, 0]} pointerEvents="none">
      <div style={{
        whiteSpace: 'nowrap', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
        background: me ? '#e5779a' : 'rgba(255,255,255,.85)', color: me ? '#fff' : '#37503f',
        boxShadow: '0 2px 6px rgba(0,0,0,.15)',
      }}>{text}</div>
    </Html>
  )
}

// 각 앵커에서 실제 섬 잔디 표면 Y를 레이캐스트로 산출(공식 대신 정확). 바닥 메시만 겨냥.
const _ray = new THREE.Raycaster()
const _down = new THREE.Vector3(0, -1, 0)
function useGroundYs(islandRef) {
  const [ys, setYs] = useState(null)
  useFrame(() => {
    if (ys || !islandRef.current) return
    const obj = islandRef.current
    obj.updateWorldMatrix(true, true)
    const targets = []
    obj.traverse((o) => { if (o.isMesh && /grass|soil/i.test(o.name) && !/blade|rock/i.test(o.name)) targets.push(o) })
    if (!targets.length) return   // 모델 로드 전 → 다음 프레임 재시도
    const res = ANCH.map(([r, a]) => {
      _ray.set(new THREE.Vector3(r * Math.cos(a), 40, r * Math.sin(a)), _down)
      const hit = _ray.intersectObjects(targets, false)
      return hit.length ? hit[0].point.y : domeY(r) * 0.8
    })
    setYs(res)
  })
  return ys
}

// 섬 하나 위에 참여자 꽃들 (A: 다수, B: 방문자 정원)
function PlantedIsland({ people, showTags = true }) {
  const ref = useRef()
  const ys = useGroundYs(ref)
  return (
    <group>
      <group ref={ref}><IslandModel /></group>
      {ys && people.map((p, i) => {
        const [r, a] = ANCH[i % ANCH.length]
        return (
          <group key={i} position={[r * Math.cos(a), ys[i % ANCH.length], r * Math.sin(a)]}>
            <Flower scale={flowerScale(p.stage)} highlight={p.me} />
            {showTags && <NameTag text={p.name} me={p.me} />}
          </group>
        )
      })}
    </group>
  )
}

// C 공유 땅 — A와 동일 scale-1 섬 + 레이캐스트 접지. 줌으로 내 자리↔전체.
function SharedLand({ far, onMyY }) {
  const ref = useRef()
  const ys = useGroundYs(ref)
  useEffect(() => { if (ys) onMyY?.(ys[0]) }, [ys, onMyY])
  return (
    <group>
      <group ref={ref}><IslandModel /></group>
      {ys && PEOPLE.map((p, i) => {
        if (!far && !p.me) return null
        const [r, a] = ANCH[i % ANCH.length]
        return (
          <group key={i} position={[r * Math.cos(a), ys[i % ANCH.length], r * Math.sin(a)]}>
            <Flower scale={flowerScale(p.stage)} highlight={p.me} />
            <NameTag text={p.name} me={p.me} />
          </group>
        )
      })}
    </group>
  )
}

// C 카메라 — 혼자(가까이) ↔ 함께(멀리). autoRotate와 안 싸우게 "거리(dolly)"만 lerp.
const _vt = new THREE.Vector3()
const _vd = new THREE.Vector3()
function CameraRig({ far, myY = 2 }) {
  const { camera } = useThree()
  const ctrl = useRef()
  useFrame(() => {
    const c = ctrl.current
    if (!c) return
    c.target.lerp(_vt.set(0, far ? 0.6 : 1.5, 0), 0.06)
    const dist = camera.position.distanceTo(c.target)
    const want = far ? 7.5 : 3.4
    const nd = dist + (want - dist) * 0.06
    _vd.copy(camera.position).sub(c.target)
    if (_vd.lengthSq() < 1e-4) _vd.set(1, 0.7, 1)
    _vd.normalize()
    camera.position.copy(c.target).addScaledVector(_vd, nd)
    c.update()   // autoRotate 각도만 적용(거리는 위에서 유지)
  })
  return <OrbitControls ref={ctrl} enablePan={false} enableZoom={false}
    minPolarAngle={0.5} maxPolarAngle={1.4} autoRotate autoRotateSpeed={0.5} />
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.75} />
      <hemisphereLight args={['#ffffff', '#bfe0c8', 0.55]} />
      <directionalLight position={[5, 8, 4]} intensity={1.15} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />
    </>
  )
}

const MODES = [
  { key: 'A', label: 'A · 공유 섬', desc: '한 섬에 참여자 꽃이 다 같이. 내 꽃 강조(흰 링).' },
  { key: 'B', label: 'B · 이웃 방문', desc: '내 섬만 보다가 「이웃 방문」으로 남의 정원 구경.' },
  { key: 'C', label: 'C · 군도(줌)', desc: '내 섬 클로즈업 ↔ 「함께 보기」로 줌아웃해 모두의 섬.' },
]

export default function DevGrowthDemo() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('C')
  const [whose, setWhose] = useState(1)   // B: 방문 대상 index
  const [far, setFar] = useState(false)   // C: 줌아웃 여부
  const [myY, setMyY] = useState(2.2)     // C: 레이캐스트로 잡은 내 꽃 표면 높이

  const meGarden = useMemo(() => Array.from({ length: PEOPLE[0].stage }).map((_, i) => ({ ...PEOPLE[0], me: i === 0 })), [])
  const visitPerson = PEOPLE[whose]
  const visitGarden = useMemo(() => Array.from({ length: visitPerson.stage }).map(() => ({ ...visitPerson, me: false })), [visitPerson])

  const camInit = mode === 'C' ? [2.2, 2.4, 2.6] : [4.8, 2.9, 5.4]

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col" style={{ background: 'linear-gradient(180deg,#C7E9F4,#E9F6DD)' }}>
      {/* 상단 */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2" style={{ paddingTop: 'max(env(safe-area-inset-top),0.75rem)' }}>
        <button type="button" onClick={() => navigate(-1)} aria-label="뒤로" className="w-9 h-9 rounded-full bg-white/70 backdrop-blur flex items-center justify-center text-gray-700 shadow-sm">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="ml-auto text-[10px] font-bold text-emerald-900/50 bg-white/50 px-2 py-1 rounded-full">데모 · /dev/growth-demo</span>
      </div>

      {/* 탭 */}
      <div className="px-4">
        <div className="flex gap-1.5">
          {MODES.map((m) => (
            <button key={m.key} type="button" onClick={() => setMode(m.key)}
              className={`flex-1 h-9 rounded-xl text-[12.5px] font-bold transition ${mode === m.key ? 'bg-emerald-600 text-white shadow' : 'bg-white/60 text-emerald-900/70'}`}>
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-emerald-900/70 mt-2 leading-snug break-keep">{MODES.find((m) => m.key === mode).desc}</p>
      </div>

      {/* 씬 */}
      <div className="flex-1 min-h-0 relative">
        <Canvas key={mode} shadows dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ position: camInit, fov: 34 }}>
          <Suspense fallback={null}>
            <Lights />
            {mode === 'A' && <PlantedIsland people={PEOPLE} />}
            {mode === 'B' && <PlantedIsland people={visitGarden.length ? visitGarden : [visitPerson]} showTags={false} />}
            {mode === 'C' && <SharedLand far={far} onMyY={setMyY} />}
            {mode === 'C'
              ? <CameraRig far={far} myY={myY} />
              : <OrbitControls enablePan={false} enableZoom={false} minPolarAngle={0.5} maxPolarAngle={1.4} target={[0, 0.9, 0]} autoRotate autoRotateSpeed={0.5} />}
          </Suspense>
        </Canvas>

        {/* C 혼자 보기 — 내 꽃 집중: 가장자리 블러 비네트(줌아웃 시 걷힘) */}
        {mode === 'C' && (
          <div aria-hidden style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backdropFilter: 'blur(5px)', WebkitBackdropFilter: 'blur(5px)',
            maskImage: 'radial-gradient(ellipse 62% 55% at 50% 46%, transparent 60%, #000 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 62% 55% at 50% 46%, transparent 60%, #000 100%)',
            opacity: far ? 0 : 1, transition: 'opacity 0.6s ease',
          }} />
        )}

        {/* B 방문 컨트롤 */}
        {mode === 'B' && (
          <div className="absolute left-0 right-0 bottom-4 flex flex-col items-center gap-2 px-6">
            <div className="px-4 py-1.5 rounded-full bg-white/85 text-[13px] font-extrabold text-emerald-800 shadow">{visitPerson.name}님의 정원 · 레벨 {visitPerson.stage}</div>
            <button type="button" onClick={() => setWhose((w) => (w + 1) % PEOPLE.length)}
              className="h-11 px-6 rounded-2xl bg-emerald-600 text-white text-[14px] font-bold shadow-lg active:scale-95 transition">다음 이웃 방문 →</button>
          </div>
        )}

        {/* C 줌 토글 */}
        {mode === 'C' && (
          <div className="absolute left-0 right-0 bottom-4 flex justify-center px-6">
            <button type="button" onClick={() => setFar((v) => !v)}
              className="h-11 px-6 rounded-2xl bg-emerald-600 text-white text-[14px] font-bold shadow-lg active:scale-95 transition">
              {far ? '← 내 섬으로 (혼자 보기)' : '함께 보기 (줌아웃) →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
