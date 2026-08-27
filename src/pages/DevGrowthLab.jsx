import { useState, useMemo, useRef, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, X } from 'lucide-react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Float, Merged, Decal, useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// 성장 탭 토대 — field.glb + daisy_s1~s5(단계별). 활동 stage → 단계 모델. 필드=Merged 인스턴싱.
//   정원↔단독: 꽃 탭 → 카메라 이동 + 배경 페이드. 단독은 불투명 + 2D 표정(앞면 고정).

const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const FR = 1.4      // 꽃 배치 반경(섬 반경보다 작게 = 잔디 여백). spread 로 스케일.
const TOP_TARGET = 0.9
const CAM_GARDEN = [4.4, 2.6, 5.2]
// 단계별 흙받침 높이 — glb 의 흙 색 삼각형 최상단(실측). 모델을 바꾸면 다시 잴 것.
// 새싹은 흙더미가 모델 높이의 35% 나 된다.
const SOIL_H = [0.355, 0.187, 0.134, 0.138, 0.141]   // stageIdx 0~4
// 흙받침을 통째로 묻어 줄기만 땅에서 나오게 한다. 정원·단독 뷰 공통.
// 여유분을 두는 이유: 필드가 울퉁불퉁해서 딱 맞게 묻으면 흙받침 가장자리로 지면 초록이 비친다.
const SOIL_MARGIN = 0.03
const soilSink = (si) => SOIL_H[si] + SOIL_MARGIN
// 단계별 흙받침 반경(정규화). 경사면 보정에 씀.
const SOIL_R = [0.633, 0.341, 0.231, 0.291, 0.278]
// ── 경사면 처리 ───────────────────────────────────────────────────────
// 흙받침은 평평한데 필드는 기복이 있어서, 경사에 심으면 내리막 쪽 흙이 지면 위로 튀어나온다.
// 낙차만큼 더 묻으면 해결되지만 실측 결과 줄기가 최대 34% 까지 잠긴다 — 그래서 대신 **식물을 지면 기울기에 맞춰 눕힌다.**
// 완전히 눕히면(1.0) 언덕에서 부자연스러우니 일부만 따라가고, 남은 각도만큼만 추가로 묻는다.
const TILT_FIT = 0.85           // 지면 법선을 따라가는 비율
const TILT_MAX = 0.45           // 최대 기울기(rad ≒ 26°) — 절벽에서 과하게 눕지 않게
const UP = new THREE.Vector3(0, 1, 0)
// 지면 법선 → 식물을 눕히는 쿼터니언
function terrainQuat(nrm) {
  if (!nrm) return new THREE.Quaternion()
  const n = new THREE.Vector3(nrm[0], nrm[1], nrm[2]).normalize()
  const full = new THREE.Quaternion().setFromUnitVectors(UP, n)
  const q = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), full, TILT_FIT)
  const ang = 2 * Math.acos(Math.min(1, Math.abs(q.w)))
  return ang > TILT_MAX ? new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), full, TILT_FIT * TILT_MAX / ang) : q
}
// 눕히고도 남는 경사 때문에 필요한 추가 침하(정규화 단위)
const tiltResidual = (nrm, si) => {
  if (!nrm) return 0
  const theta = Math.acos(Math.min(1, Math.max(-1, nrm[1])))
  return SOIL_R[si] * Math.tan(Math.min(theta, TILT_MAX / TILT_FIT) * (1 - TILT_FIT)) * 1.6   // 1.6 = 지형 굴곡 여유
}
// 참여자 수 → 섬/배치 스케일(밀도 일정). 낮은 divisor = 넉넉한 간격.
const spreadFor = (n) => Math.min(2.6, Math.max(1, Math.sqrt(n / 22)))
const POND_DROP = 0.15   // 주변 지면보다 이만큼(x spread) 꺼지면 연못으로 본다
const POND_FILL = 0.72   // 물 높이 — 웅덩이 바닥(0)과 주변 지면(1) 사이 비율. 올리면 물가도 같이 넓어진다.
const MIN_GAP = 0.42   // 꽃 사이 최소 거리(만개 폭 기준). 완화 반복으로 보장.
const STAGE_MSG = ['씨앗을 심었어요', '새싹이 돋았어요!', '잎이 무럭무럭 자라고 있어요', '꽃봉오리가 맺혔어요!', '꽃이 피기 시작했어요', '활짝 만개했어요! 🎉']
const STAGE_LABEL = ['씨앗', '새싹', '어린잎', '봉오리', '개화', '만개']
const DAISY_URLS = ['/models/daisy_s1.glb', '/models/daisy_s2.glb', '/models/daisy_s3.glb', '/models/daisy_s4.glb', '/models/daisy_s5.glb']
DAISY_URLS.forEach((u) => useGLTF.preload(u))
const stageIdx = (s) => Math.min(4, Math.max(0, s - 1))   // stage 0~5 → 모델 0~4(s1~s5)

function useMock(n) {
  return useMemo(() => {
    const rnd = (i, s) => { const x = Math.sin(i * 97.13 + s) * 43758.5453; return x - Math.floor(x) }
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      nickname: ['바다', '햇살', '초록', '구름', '단단', '도담', '새싹', '언덕', '민트', '노을'][i % 10] + (i + 1),
      stage: Math.floor(rnd(i, 1) * 6),
    }))
  }, [n])
}
function slots2D(n, fr, minD, pond) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const rnd = (s) => { const v = Math.sin(i * 91.7 + s) * 43758.5; return v - Math.floor(v) }
    const r = fr * Math.sqrt((i + 0.5) / n) + (rnd(1) - 0.5) * 0.04 * fr   // 흩뿌림(약하게)
    const th = i * GOLDEN + (rnd(2) - 0.5) * 0.18
    pts.push([r * Math.cos(th), r * Math.sin(th)])
  }
  // 최소 거리 보장 — 가까운 쌍을 서로 밀어냄(완화 반복) + 섬 반경 클램프
  for (let it = 0; it < 14; it++) {
    let moved = false
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = pts[j][0] - pts[i][0], dz = pts[j][1] - pts[i][1]
      const d = Math.hypot(dx, dz)
      if (d < minD && d > 1e-4) {
        const p = (minD - d) / 2, ux = dx / d, uz = dz / d
        pts[i][0] -= ux * p; pts[i][1] -= uz * p
        pts[j][0] += ux * p; pts[j][1] += uz * p
        moved = true
      }
    }
    if (pond) for (const q of pts) {   // 연못 밖으로 밀어냄
      const dx = q[0] - pond[0], dz = q[1] - pond[1], d = Math.hypot(dx, dz)
      if (d < pond[2]) { const ux = d > 1e-4 ? dx / d : 1, uz = d > 1e-4 ? dz / d : 0; q[0] = pond[0] + ux * pond[2]; q[1] = pond[1] + uz * pond[2]; moved = true }
    }
    for (const q of pts) { const rr = Math.hypot(q[0], q[1]); if (rr > fr) { q[0] *= fr / rr; q[1] *= fr / rr } }
    if (!moved) break
  }
  return pts
}

// glb scene 정규화(높이1·밑동 원점·중앙)
function normalizeScene(scene) {
  const s = scene.clone(true)
  s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  let box = new THREE.Box3().setFromObject(s); const size = new THREE.Vector3(); box.getSize(size)
  s.scale.setScalar(1 / (size.y || 1)); s.updateMatrixWorld(true)
  box = new THREE.Box3().setFromObject(s)
  s.position.x -= (box.min.x + box.max.x) / 2
  s.position.z -= (box.min.z + box.max.z) / 2
  s.position.y -= box.min.y; s.updateMatrixWorld(true)
  return s
}
// 서브메시 월드변환 베이크 → Merged 인스턴싱용 mesh 맵
function buildMeshes(template) {
  template.updateMatrixWorld(true)
  const out = {}; let i = 0
  template.traverse((o) => {
    if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); const m = o.material.clone(); m.transparent = true; out['p' + (i++)] = new THREE.Mesh(g, m) }
  })
  return out
}

// 필드 정규화 + 밝기 + 슬롯 레이캐스트
useGLTF.preload('/models/field.glb')
function useField(n) {
  const { scene } = useGLTF('/models/field.glb')
  return useMemo(() => {
    const spread = spreadFor(n)
    const field = scene.clone(true)
    field.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true
        o.material = o.material.clone(); o.material.transparent = true
        o.material.emissive = new THREE.Color('#3a5a28'); o.material.emissiveIntensity = 0.32
      }
    })
    let box = new THREE.Box3().setFromObject(field); const size = new THREE.Vector3(); box.getSize(size)
    field.scale.setScalar((4.6 * spread) / Math.max(size.x, size.z)); field.updateMatrixWorld(true)  // 섬이 인원에 비례해 커짐
    box = new THREE.Box3().setFromObject(field)
    field.position.x -= (box.min.x + box.max.x) / 2
    field.position.z -= (box.min.z + box.max.z) / 2
    field.position.y += TOP_TARGET - box.max.y; field.updateMatrixWorld(true)
    const ray = new THREE.Raycaster(); const down = new THREE.Vector3(0, -1, 0)
    const cast = (x, z) => { ray.set(new THREE.Vector3(x, TOP_TARGET + 3, z), down); return ray.intersectObject(field, true)[0] }

    // 연못 탐지 — 위치를 하드코딩하지 않는다. 1차 배치의 높이 분포에서 '크게 꺼진 자리'를 찾아
    // 중심·반경을 추정하고, 그걸 피해 다시 배치한다. 필드 모델이 바뀌어도 따라간다.
    const probe = slots2D(n, FR * spread, MIN_GAP)
    const py = probe.map(([x, z]) => { const h = cast(x, z); return h ? h.point.y : TOP_TARGET })
    const med = [...py].sort((a, b) => a - b)[py.length >> 1]
    const low = probe.filter((_, i) => py[i] < med - POND_DROP * spread)
    let pond = null, water = null
    if (low.length >= 2) {
      const cx = low.reduce((s, q) => s + q[0], 0) / low.length
      const cz = low.reduce((s, q) => s + q[1], 0) / low.length
      const floor = cast(cx, cz)
      const floorY = floor ? floor.point.y : med - POND_DROP * spread
      const waterY = floorY + (med - floorY) * POND_FILL
      // 물가 반경 — 중심에서 밖으로 훑어 지면이 물면 위로 올라오는 지점
      // 연못이 원형이 아니라 방향마다 물가가 다르다. 물 원판은 **중앙값**(넘치지 않게),
      // 꽃 회피 반경은 **최대값**(어느 방향에서도 물가에 안 걸리게) — 둘을 나눠 쓴다.
      const rs = []; const dirs = 12, step = 0.06 * spread, lim = 1.3 * spread
      for (let k = 0; k < dirs; k++) {
        const a = (k / dirs) * Math.PI * 2; let r = step
        for (; r < lim; r += step) { const h = cast(cx + Math.cos(a) * r, cz + Math.sin(a) * r); if (!h || h.point.y > waterY) break }
        rs.push(r)
      }
      rs.sort((p, q) => p - q)
      const wr = rs[dirs >> 1], guard = rs[Math.floor(dirs * 0.8)]   // 최대값은 한 방향의 튄 값에 끌려가 과하게 넓어진다
      water = { x: cx, z: cz, y: waterY, r: wr * 0.95 }   // 물 원판은 물가보다 살짝 안쪽
      pond = [cx, cz, guard + MIN_GAP * 0.6]               // 물가보다 조금 더 밖에 심는다
    }

    const normals = []
    const positions = slots2D(n, FR * spread, MIN_GAP, pond).map(([x, z]) => {
      const hit = cast(x, z)
      // 면 법선을 같이 챙긴다(레이 추가 비용 0). 필드는 균일 스케일+평행이동뿐이라 로컬 법선 = 월드 법선.
      const fn = hit && hit.face ? hit.face.normal : null
      normals.push(fn ? [fn.x, fn.y < 0 ? -fn.y : fn.y, fn.z] : [0, 1, 0])
      return [x, hit ? hit.point.y : TOP_TARGET - 0.1, z]
    })
    return { field, positions, normals, spread, water }
  }, [scene, n])
}

// 5단계 데이지 정규화 템플릿
function useDaisyTemplates() {
  const gltfs = useGLTF(DAISY_URLS)
  return useMemo(() => gltfs.map((g) => normalizeScene(g.scene)), [gltfs])
}

// 연못 물 — 반투명 원판. 모델에 굽지 않고 코드로 넣어야 잔물결·반짝임을 줄 수 있다.
function PondWater({ water }) {
  const ref = useRef()
  useFrame((st) => { if (ref.current) ref.current.position.y = water.y + Math.sin(st.clock.elapsedTime * 0.8) * 0.004 })
  if (!water) return null
  return (
    <mesh ref={ref} position={[water.x, water.y, water.z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <circleGeometry args={[water.r, 48]} />
      <meshStandardMaterial color="#6FC5E8" transparent opacity={0.72} roughness={0.15} metalness={0.1}
        emissive="#2E86B8" emissiveIntensity={0.25} depthWrite={false} />
    </mesh>
  )
}

// 단독 뷰 미니 플랫폼(island.glb) — 윗면을 y=0 에 맞춰 식물이 그 위에 서게.
useGLTF.preload('/models/island.glb')
function useIslandTemplate() {
  const { scene } = useGLTF('/models/island.glb')
  return useMemo(() => {
    const s = scene.clone(true)
    s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material = o.material.clone(); o.material.emissive = new THREE.Color('#3a5a28'); o.material.emissiveIntensity = 0.22 } })
    let box = new THREE.Box3().setFromObject(s); const size = new THREE.Vector3(); box.getSize(size)
    s.scale.setScalar(1.9 / Math.max(size.x, size.z)); s.updateMatrixWorld(true)
    box = new THREE.Box3().setFromObject(s)
    s.position.x -= (box.min.x + box.max.x) / 2
    s.position.z -= (box.min.z + box.max.z) / 2
    s.position.y -= box.max.y   // 윗면 y=0
    return s
  }, [scene])
}
function SoloPlatform({ template }) {
  const obj = useMemo(() => template.clone(true), [template])
  return <primitive object={obj} />
}

// 2D 표정(캔버스) — 만개 데이지 참조: 큰 검정 눈 + 하이라이트, 복숭아빛 볼, 얌전한 미소
function makeFaceTexture() {
  const S = 512
  const c = document.createElement('canvas'); c.width = c.height = S
  const g = c.getContext('2d'); g.clearRect(0, 0, S, S)
  const cx = S / 2

  // 볼 — 부드러운 복숭아빛(가장자리 흐리게). 눈보다 먼저 그려 뒤에 깔림.
  const blush = (x, y, r) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, 'rgba(255,150,120,0.72)')
    grad.addColorStop(0.55, 'rgba(255,160,130,0.42)')
    grad.addColorStop(1, 'rgba(255,170,140,0)')
    g.fillStyle = grad
    g.beginPath(); g.ellipse(x, y, r, r * 0.78, 0, 0, 7); g.fill()
  }
  blush(cx - 122, 284, 40)
  blush(cx + 122, 284, 40)

  // 눈 — 세로로 살짝 긴 타원, 진한 먹색
  const EYE_DX = 64, EYE_Y = 222, EYE_RX = 21, EYE_RY = 27
  const eye = (dir) => {
    const x = cx + dir * EYE_DX
    g.fillStyle = '#23201e'
    g.beginPath(); g.ellipse(x, EYE_Y, EYE_RX, EYE_RY, 0, 0, 7); g.fill()
    // 하이라이트 — 왼쪽 위 큰 점 + 오른쪽 아래 작은 점
    g.fillStyle = '#ffffff'
    g.beginPath(); g.arc(x - 7, EYE_Y - 10, 8.5, 0, 7); g.fill()
    g.globalAlpha = 0.75
    g.beginPath(); g.arc(x + 9, EYE_Y + 11, 3.6, 0, 7); g.fill()
    g.globalAlpha = 1
  }
  eye(-1); eye(1)

  // 입 — 눈 바로 아래 작고 얌전한 미소(둥근 끝)
  g.strokeStyle = '#23201e'; g.lineWidth = 9; g.lineCap = 'round'
  g.beginPath(); g.arc(cx, 266, 38, 0.22 * Math.PI, 0.78 * Math.PI); g.stroke()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
// ── 단계별 얼굴 배치 실측값 (2026-08-26 새 저폴리 데이지 기준) ─────────
// 각 glb 를 직접 디코딩해서 잰 값(정규화: 높이 1, 밑동 y=0). 눈대중 금지 — 모델을 바꾸면 반드시 다시 잴 것.
//   n     얼굴이 향하는 방향(법선).
//         ⚠️ 원반의 '실제' 법선은 만개 48° / 개화 58° 인데, 그대로 쓰면 너무 하늘을 보는 느낌이라
//            둘 다 35° 로 낮췄다(2026-08-26 본인 피드백). 원반이 평평해 이 정도 비스듬한 투영은 왜곡이 거의 없다.
//            봉오리는 실제 앞면 법선 11° 를 그대로 쓴다.
//   c     얼굴 중심. **그 법선 방향에서 정사영으로 본** 노란 영역(봉오리는 흰 봉오리 앞면)의 중심.
//         3차원 무게중심으로 잡으면 안 된다 — 원반 뒷면까지 섞여 중심이 뒤로 밀린다.
//   w     표정 그림의 가로 폭. 그 각도에서 보이는 지름(만개 0.203 / 개화 0.167 / 봉오리 0.097)의 약 92%.
//   lift  c 에서 법선 방향으로 데칼 상자를 띄우는 양. **앞면 표면 높이에 맞춰야 한다.**
//         만개가 0.058 로 유독 큰 건 c 가 원반 두께의 중간에 잡히기 때문 — 안 맞추면 눈·입이 상자 밖으로 잘린다.
//   depth 투영 깊이. 만개 뒷면이 -0.06 이라 0.06 을 넘기면 꽃 뒤통수에도 표정이 찍힌다.
// ※ 어린잎(stageIdx 1 = daisy_s2)만 표정 없음 — 줄기가 가늘고 잎만 있어 얼굴 놓을 면이 없다.
//    새싹(stageIdx 0)은 떡잎이 갈라지기 직전의 줄기 앞면(폭 0.13)에 붙인다.
const FACE_INK = 0.619                  // 캔버스에서 표정 그림이 실제 차지하는 가로 비율(볼 바깥까지) — 실측
const FACES = {
  0: { n: [0.061, 0.306, 0.950], c: [ 0.005, 0.592, -0.026], w: 0.135, lift: 0.004, depth: 0.09 },  // 새싹   daisy_s1 (떡잎 아래 줄기 앞면. 줄기 폭이 0.12~0.15 뿐이라 이보다 더 키우면 볼이 줄기 밖으로 나간다)
  2: { n: [0.026, 0.197, 0.980], c: [ 0.002, 0.868,  0.096], w: 0.078, lift: 0.000, depth: 0.09 },  // 봉오리 daisy_s3 (흰 봉오리 앞면)
  3: { n: [0.000, 0.574, 0.819], c: [-0.001, 0.877,  0.083], w: 0.155, lift: 0.020, depth: 0.06 },  // 개화   daisy_s4
  4: { n: [0.000, 0.574, 0.819], c: [ 0.020, 0.830, -0.024], w: 0.189, lift: 0.058, depth: 0.06 },  // 만개   daisy_s5
}
// 데칼의 +Z 축을 법선에 맞추는 XYZ 오일러 — 회전 0(정면 투영)이면 표정이 눌려 보인다.
const faceParams = (f) => {
  const yaw = Math.asin(f.n[0])
  const tilt = -Math.asin(f.n[1] / Math.cos(yaw))
  const sc = f.w / FACE_INK
  return { rot: [tilt, yaw, 0], pos: f.c.map((v, i) => v + f.n[i] * f.lift), size: [sc, sc, f.depth] }
}
const FACE_PARAMS = Object.fromEntries(Object.entries(FACES).map(([k, f]) => [k, faceParams(f)]))
const FACE_BOX = typeof location !== 'undefined' && location.search.includes('facebox')  // ?facebox=1 → 데칼 상자 표시

// 단독 데이지 + 표정 데칼 — 표정이 표면에 직접 투영돼 '딱 박힘'. 회전해도 표면 따라감.
function SoloDaisyFace({ template, face }) {
  const tex = useMemo(() => makeFaceTexture(), [])
  const { geo, mat } = useMemo(() => {
    let g = null, m = null
    template.updateMatrixWorld(true)
    template.traverse((o) => { if (o.isMesh && !g) { g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); m = o.material.clone(); m.transparent = false } })
    return { geo: g, mat: m }
  }, [template])
  if (!geo) return null
  return (
    <mesh geometry={geo} material={mat} castShadow receiveShadow>
      <Decal debug={FACE_BOX} position={face.pos} rotation={face.rot} scale={face.size}>
        <meshBasicMaterial map={tex} transparent polygonOffset polygonOffsetFactor={-3} depthWrite={false} toneMapped={false} />
      </Decal>
    </mesh>
  )
}

// 단독/hero 데이지 — 복제마다 자기 재질. opaque=단독(불투명).
function Daisy({ template, opaque }) {
  const obj = useMemo(() => {
    const c = template.clone(true)
    c.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = !opaque } })
    return c
  }, [template, opaque])
  return <primitive object={obj} />
}

// 한 단계의 필드 데이지들 — Merged 인스턴싱
function DaisyField({ meshes, items, onSelect, soloActive }) {
  const keys = Object.keys(meshes)
  if (!items.length) return null
  return (
    <Merged meshes={meshes}>
      {(models) => items.map((it) => (
        <group key={it.idx} position={[it.x, it.y, it.z]} quaternion={it.quat} scale={it.scale}
          onClick={(e) => { e.stopPropagation(); if (soloActive) { onSelect(null); return } onSelect(it.idx) }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = 'auto')}>
          <group rotation={[it.tx, it.ry, it.tz]}>{/* 지면 기울기(바깥) + 개체별 랜덤 회전(안쪽) */}
            {keys.map((k) => { const C = models[k]; return <C key={k} /> })}
          </group>
        </group>
      ))}
    </Merged>
  )
}

const CAM_ALIGN = 0.85          // 0=수평 시선 유지, 1=얼굴 법선과 완전 일치(꽃을 정면으로 봄)
const CAM_DIST = 4.2            // 얼굴에서 카메라까지 거리(만개 기준)
// 어린 단계는 식물이 작은 데다 흙에 묻히는 비율도 커서, 땅 위로 나온 높이가 만개의 46% 밖에 안 된다
// (새싹은 흙더미가 모델 높이의 35% 라 그만큼 더 묻힌다). 카메라 거리가 같으면 화면에서 그대로 절반 크기다.
// 아래 값은 **단계별로 화면을 얼마나 채울지**를 만개=1 기준으로 직접 지정한 것.
// 카메라 거리를 여기에 맞춰 계산하므로, 이 숫자가 곧 보이는 크기다. 새싹만 더 당기고 싶으면 첫 값만 올린다.
const SOLO_FILL = [0.92, 0.92, 0.95, 0.98, 1.0]   // stageIdx 0~4
const CAM_ELEV = [0.25, 0.72]   // 카메라 고도 제한(rad ≒ 14°~41°).
                                // 개화는 꽃이 66° 를 봐서 그대로 맞추면 식물을 위에서 내려다보게 된다.
function Rig({ selectedPos, gardenRef, soloRef, controlsRef, camGarden, soloMax, head, soloDist }) {
  const { camera } = useThree()
  const focus = useRef(0); const gt = useRef(new THREE.Vector3()); const ct = useRef(new THREE.Vector3())
  useFrame((_, dt) => {
    const active = !!selectedPos; const target = active ? 1 : 0
    focus.current += (target - focus.current) * Math.min(1, dt * 5); const f = focus.current
    if (gardenRef.current) {
      gardenRef.current.visible = f < 0.98
      gardenRef.current.traverse((o) => { if (o.isMesh && o.material && !o.material.userData?.noFade && 'opacity' in o.material) { o.material.opacity = 1 - f; o.material.depthWrite = f < 0.5 } })
    }
    if (soloRef.current) { soloRef.current.scale.setScalar(soloMax * f); soloRef.current.visible = f > 0.02 }
    if (!controlsRef.current) return
    if (active) {
      const dir = new THREE.Vector2(selectedPos[0], selectedPos[2]); if (dir.lengthSq() < 0.02) dir.set(0, 1); dir.normalize()
      if (head) {
        // 꽃이 위를 보니 카메라도 그만큼 올라가야 표정이 정면으로 보인다.
        const view = new THREE.Vector3(dir.x, 0, dir.y).lerp(head.n, CAM_ALIGN).normalize()
        const elev = Math.asin(THREE.MathUtils.clamp(view.y, -1, 1))
        const want = THREE.MathUtils.clamp(elev, CAM_ELEV[0], CAM_ELEV[1])
        if (want !== elev) { const h = Math.hypot(view.x, view.z) || 1; view.set(view.x / h * Math.cos(want), Math.sin(want), view.z / h * Math.cos(want)) }
        gt.current.copy(head.c).lerp(new THREE.Vector3(selectedPos[0], selectedPos[1] + 0.5, selectedPos[2]), 0.3)  // 화면 중앙은 머리보다 살짝 아래(줄기까지 담기게)
        ct.current.copy(head.c).addScaledVector(view, soloDist)
      } else {
        gt.current.set(selectedPos[0], selectedPos[1] + 0.55, selectedPos[2])
        ct.current.set(selectedPos[0] + dir.x * 4.4, selectedPos[1] + 2.2, selectedPos[2] + dir.y * 4.4)
      }
    } else { gt.current.set(0, TOP_TARGET, 0); ct.current.set(camGarden[0], camGarden[1], camGarden[2]) }
    controlsRef.current.target.lerp(gt.current, 0.12)
    if (Math.abs(target - f) > 0.02) camera.position.lerp(ct.current, 0.06)
    controlsRef.current.update()
  })
  return null
}

function Scene({ n, selected, onSelect }) {
  const parts = useMock(n)
  const { field, positions, normals, spread, water } = useField(n)
  const camGarden = useMemo(() => CAM_GARDEN.map((v) => v * spread), [spread])
  const templates = useDaisyTemplates()
  const meshSets = useMemo(() => templates.map(buildMeshes), [templates])
  const meIndex = 0
  const gardenRef = useRef(); const soloRef = useRef(); const controlsRef = useRef()
  const selIdx = selected != null ? Math.min(selected, n - 1) : null
  const selPos = selIdx != null ? positions[selIdx] : null
  const sel = selIdx != null ? parts[selIdx] : null
  const mePos = positions[meIndex]
  const heroSink = mePos ? (soilSink(stageIdx(parts[meIndex].stage)) + tiltResidual(normals[meIndex], stageIdx(parts[meIndex].stage))) * 0.95 : 0
  const faceAngle = selPos ? (Math.hypot(selPos[0], selPos[2]) < 0.15 ? 0 : Math.atan2(selPos[0], selPos[2])) : 0
  const soloMax = sel ? 0.72 + stageIdx(sel.stage) * 0.11 : 1.15   // 새싹 작게 ~ 만개 크게
  // 새싹(stageIdx 0)은 흙더미가 워낙 커서 경사 보정까지 하면 잎까지 잠긴다 — 기울기만 맞추고 추가 침하는 안 한다.
  const soloSi = sel ? stageIdx(sel.stage) : 0
  const soloNrm = selIdx != null ? normals[selIdx] : null
  const soloBury = sel ? soilSink(soloSi) + (soloSi > 0 ? tiltResidual(soloNrm, soloSi) : 0) : 0
  const soloQuat = useMemo(() => terrainQuat(soloNrm), [soloNrm])
  // 땅 위로 나온 높이 = (1 - 묻히는 깊이) x 크기. 만개를 1로 보고 카메라 거리를 줄인다.
  const visH = sel ? (1 - soilSink(soloSi)) * soloMax : 1
  const VIS_MAX = (1 - soilSink(4)) * (0.72 + 4 * 0.11)
  const soloDist = CAM_DIST * (visH / VIS_MAX) / SOLO_FILL[soloSi]
  // 단독 뷰의 얼굴 위치·방향(월드) — 표정이 있는 단계에서만. 카메라 정렬에 씀.
  const head = useMemo(() => {
    const f = sel ? FACES[stageIdx(sel.stage)] : null
    if (!selPos || !f) return null
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), faceAngle)
    return {   // 그룹 순서(지면 기울기 → faceAngle)와 같게 두 번 돌린다
      c: new THREE.Vector3(f.c[0], f.c[1] - soloBury, f.c[2]).multiplyScalar(soloMax).applyQuaternion(q).applyQuaternion(soloQuat)
           .add(new THREE.Vector3(selPos[0], selPos[1], selPos[2])),
      n: new THREE.Vector3(...f.n).applyQuaternion(q).applyQuaternion(soloQuat).normalize(),
    }
  }, [selPos, sel, faceAngle, soloMax, soloBury, soloQuat])

  // 필드 아이템을 단계별로 그룹화
  const groups = useMemo(() => {
    const gs = [[], [], [], [], []]
    parts.forEach((p, i) => {
      if (i === meIndex || !positions[i]) return
      const [x, y, z] = positions[i]
      const r = (s) => { const v = Math.sin(i * 53.7 + s) * 43758.5; return v - Math.floor(v) }
      const sc = 0.3 + p.stage * 0.12; const si = stageIdx(p.stage)
      const nrm = normals[i]
      gs[si].push({ idx: i, x, y: y - (soilSink(si) + tiltResidual(nrm, si)) * sc, z, scale: sc, quat: terrainQuat(nrm),
        ry: r(1) * Math.PI * 2, tx: (r(2) - 0.5) * 0.18, tz: (r(3) - 0.5) * 0.18 })
    })
    return gs
  }, [parts, positions, normals])

  return (
    <Canvas shadows dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ position: camGarden, fov: 34 }}
      style={{ width: '100%', height: '100%' }} onPointerMissed={() => onSelect(null)}>
      <Suspense fallback={null}>
        <ambientLight intensity={1.05} />
        <hemisphereLight args={['#ffffff', '#cdeccf', 0.7]} />
        <directionalLight position={[4, 7, 3]} intensity={1.05} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} />

        <Float speed={1.0} rotationIntensity={0} floatIntensity={0.35}>
          <primitive object={field} />{/* 필드(땅)는 단독 뷰에서도 보임 — gardenRef 밖 */}
          {water && <PondWater water={water} />}
          <group ref={gardenRef}>
            {meshSets.map((meshes, si) => (
              <DaisyField key={si} meshes={meshes} items={groups[si]} onSelect={onSelect} soloActive={selIdx != null} />
            ))}
            {mePos && (
              <group position={[mePos[0], mePos[1] - heroSink, mePos[2]]} quaternion={terrainQuat(normals[meIndex])} scale={0.95} onClick={(e) => { e.stopPropagation(); onSelect(selIdx != null ? null : meIndex) }}
                onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = 'auto')}>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[0.3, 0.4, 32]} /><meshBasicMaterial color="#FFE58A" transparent opacity={0.7} side={THREE.DoubleSide} /></mesh>
                <Daisy template={templates[stageIdx(parts[meIndex].stage)]} opaque={false} />
              </group>
            )}
          </group>
        </Float>

        <group ref={soloRef} position={selPos || [0, TOP_TARGET, 0]} quaternion={soloQuat} visible={false} onClick={(e) => { e.stopPropagation(); onSelect(null) }}>
          <group rotation={[0, faceAngle, 0]} position={[0, -soloBury, 0]}>{/* 흙받침을 통째로 묻음 — 안쪽 그룹이라 등장 애니의 scale 을 같이 탄다 */}
            {sel && (FACE_PARAMS[stageIdx(sel.stage)]
              ? <SoloDaisyFace template={templates[stageIdx(sel.stage)]} face={FACE_PARAMS[stageIdx(sel.stage)]} />
              : <Daisy template={templates[stageIdx(sel.stage)]} opaque />)}
          </group>
        </group>

        <OrbitControls ref={controlsRef} makeDefault enablePan={false} enableZoom
          minDistance={1.4} maxDistance={12 * spread} zoomSpeed={0.8} minPolarAngle={0.3} maxPolarAngle={1.6} target={[0, TOP_TARGET, 0]} />
        <Rig selectedPos={selPos} gardenRef={gardenRef} soloRef={soloRef} controlsRef={controlsRef} camGarden={camGarden} soloMax={soloMax} head={head} soloDist={soloDist} />
      </Suspense>
    </Canvas>
  )
}

export default function DevGrowthLab() {
  const navigate = useNavigate()
  const [n, setN] = useState(50)
  const [selected, setSelected] = useState(null)
  const parts = useMock(n)
  const sel = selected != null ? parts[Math.min(selected, n - 1)] : null
  const pct = sel ? Math.min(99, 28 + sel.stage * 12) : 0

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col" style={{ background: 'linear-gradient(180deg,#C7E9F4,#E9F6DD)' }}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-1" style={{ paddingTop: 'max(env(safe-area-inset-top),0.75rem)' }}>
        <button type="button" onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/70 flex items-center justify-center text-gray-700 shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
        <span className="ml-auto text-[10px] font-bold text-emerald-900/50 bg-white/50 px-2 py-1 rounded-full">5단계 데이지 · /dev/growth</span>
      </div>

      <div className="flex-1 min-h-0 relative">
        <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-emerald-700/50 text-sm">불러오는 중…</div>}>
          <Scene n={n} selected={selected} onSelect={setSelected} />
        </Suspense>
        {sel && (
          <>
            <div className="absolute top-3 left-5 right-14 z-10">
              <h2 className="text-[21px] font-extrabold text-gray-800 leading-tight break-keep">{STAGE_MSG[sel.stage]}</h2>
              <p className="text-[12px] font-bold text-emerald-600/80 mt-0.5">{sel.nickname}{selected === 0 ? ' (나)' : ''}의 꽃</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/85 shadow flex items-center justify-center text-gray-700 z-10"><X className="w-5 h-5" /></button>
            <div className="absolute bottom-4 left-4 right-4 bg-white rounded-3xl p-4 shadow-xl z-10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[15px] font-extrabold text-gray-900">레벨 {sel.stage} · {STAGE_LABEL[sel.stage]}</p>
                <p className="text-[15px] font-extrabold text-emerald-600">{pct}%</p>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3"><div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500" style={{ width: pct + '%' }} /></div>
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" className="rounded-2xl bg-sky-50 px-3 py-2.5 text-left active:scale-95 transition"><p className="text-[13px] font-extrabold text-sky-700">💧 물 주기</p><p className="text-[11px] text-sky-600/70">오늘 인증하기</p></button>
                <button type="button" className="rounded-2xl bg-amber-50 px-3 py-2.5 text-left active:scale-95 transition"><p className="text-[13px] font-extrabold text-amber-700">💊 영양제</p><p className="text-[11px] text-amber-600/70">응원 받기</p></button>
              </div>
            </div>
          </>
        )}
      </div>

      {!sel && (
        <div className="px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2">
          <div className="bg-white/85 backdrop-blur rounded-2xl p-3 shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[12px] font-extrabold text-gray-800">참여자 {n}명</p>
              <input type="range" min={3} max={200} value={n} onChange={(e) => { setN(+e.target.value); setSelected(null) }} className="flex-1 ml-3 accent-emerald-500" />
            </div>
            <p className="text-[10px] text-gray-400 mt-1 text-center">🌱 활동별 단계(새싹~만개) · 큰 꽃=나 · 꽃 탭 → 단독 뷰(표정) · 빈 곳/✕ → 정원</p>
          </div>
        </div>
      )}
    </div>
  )
}
