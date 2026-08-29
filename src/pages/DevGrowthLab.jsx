import { useState, useMemo, useRef, useEffect, Suspense } from 'react'
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
// 흙받침을 통째로 묻어 줄기만 땅에서 나오게 한다. 정원·단독 뷰 공통.
// 여유분을 두는 이유: 필드가 울퉁불퉁해서 딱 맞게 묻으면 흙받침 가장자리로 지면 초록이 비친다.
const SOIL_MARGIN = 0.03
const soilSink = (sp, si) => sp.soil[si] + SOIL_MARGIN
// 단계별 흙받침 반경(정규화). 경사면 보정에 씀.
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
const tiltResidual = (sp, nrm, si) => {
  if (!nrm) return 0
  const theta = Math.acos(Math.min(1, Math.max(-1, nrm[1])))
  return sp.ext[si][1] * Math.tan(Math.min(theta, TILT_MAX / TILT_FIT) * (1 - TILT_FIT)) * 1.6   // 1.6 = 지형 굴곡 여유
}
// 참여자 수 → 섬/배치 스케일(밀도 일정). 낮은 divisor = 넉넉한 간격.
const spreadFor = (n) => Math.min(2.6, Math.max(1, Math.sqrt(n / 22)))
const POND_DROP = 0.15   // 주변 지면보다 이만큼(x spread) 꺼지면 연못으로 본다
const POND_FILL = 0.80   // 물 높이 — 웅덩이 바닥(0)과 주변 지면(1) 사이 비율. 올리면 물가도 같이 넓어진다.
const POND_DIRS = 20     // 물가를 훑는 방향 수. 이 점들을 이어 물 모양을 만든다.
const PACK = 1.06        // 두 꽃 반폭의 합에 곱하는 여유. 1.0 이면 잎이 딱 맞닿는다.
const POND_MARGIN = 0.25  // 물가와 꽃 사이 최소 여유(꽃 반경은 여기에 더해진다)
// 단계는 모델 5개와 1:1. «씨앗» 은 뒀다가 없앴다 — 모델이 새싹과 같아서 첫 레벨업에 화면이 안 변했다.
const STAGE_MSG = ['새싹이 돋았어요!', '잎이 무럭무럭 자라고 있어요', '꽃봉오리가 맺혔어요!', '꽃이 피기 시작했어요', '활짝 만개했어요! 🎉']
const STAGE_LABEL = ['새싹', '어린잎', '봉오리', '개화', '만개']
// ── 종 레지스트리 ────────────────────────────────────────────────────
// 종마다 모델·흙높이·크기·얼굴배치가 다르다. 전부 glb 를 직접 재서 넣은 값 —
// 새 종을 추가할 땐 측정 도구를 돌려 이 표만 채우면 된다.
//   soil  단계별 흙받침 높이(정규화). 흙이 없는 종은 0(줄기만 SOIL_MARGIN 만큼 묻힌다).
//   ext   [땅 위 반높이, 반폭] — 카메라 프레이밍과 꽃 사이 간격에 함께 쓴다.
//   faces 단계별 얼굴 배치. 없는 단계는 표정 없이 그린다.
//         n     얼굴이 향하는 방향(법선). ⚠️ 원반의 '실제' 법선이 크게 위를 보면(데이지 개화 58°)
//               그대로 쓰지 말 것 — 얼굴이 원반 위쪽에 붙어 '하늘 보는' 느낌이 된다. 35° 정도로 낮춘다.
//         c     얼굴 중심. **그 법선 방향에서 정사영으로 본** 중심. 3차원 무게중심으로 잡으면
//               뒷면까지 섞여 중심이 뒤로 밀린다.
//         w     표정 그림의 가로 폭. 그 면 폭의 80~95% 가 상한(넘으면 볼이 잘린다).
//         lift  c 에서 법선 방향으로 데칼 상자를 띄우는 양. **앞면 표면 높이에 맞춰야** 눈·입이 안 잘린다.
//         depth 투영 깊이. 키우면 뒷면에도 표정이 찍힌다.
const SPECIES = {
  daisy: {
    label: '데이지',
    fillH: 0.42,
    urls: ['/models/daisy_s1.glb', '/models/daisy_s2.glb', '/models/daisy_s3.glb', '/models/daisy_s4.glb', '/models/daisy_s5.glb'],
    soil: [0.355, 0.187, 0.134, 0.138, 0.141],
    ext: [[0.308, 0.497], [0.392, 0.193], [0.418, 0.164], [0.416, 0.228], [0.415, 0.258]],
    faces: {
      0: { n: [0.061, 0.306, 0.950], c: [0.005, 0.592, -0.026], w: 0.135, lift: 0.004, depth: 0.09 },
      1: { n: [-0.018, 0.000, 1.000], c: [0.015, 0.885, 0.050], w: 0.115, lift: 0.000, depth: 0.08 },
      2: { n: [0.026, 0.197, 0.980], c: [0.002, 0.876, 0.098], w: 0.104, lift: 0.000, depth: 0.10 },
      3: { n: [0.000, 0.574, 0.819], c: [-0.001, 0.877, 0.083], w: 0.155, lift: 0.020, depth: 0.06 },
      4: { n: [0.000, 0.574, 0.819], c: [0.020, 0.830, -0.024], w: 0.189, lift: 0.058, depth: 0.06 },
    },
  },
  lavender: {
    label: '라벤더',
    // 키가 크고 얼굴(꽃대 아래 목)이 작아서, 데이지와 같은 값이면 표정이 화면의 3% 밖에 안 된다.
    // 더 당겨서 데이지(5~9%)와 비슷하게 맞춘다.
    fillH: 0.60,
    // 1단계 새싹은 종마다 사실상 같아서 데이지 것을 공유한다(모델 24개 절약).
    urls: ['/models/daisy_s1.glb', '/models/lavender_s2.glb', '/models/lavender_s3.glb', '/models/lavender_s4.glb', '/models/lavender_s5.glb'],
    soil: [0.355, 0, 0, 0, 0],
    ext: [[0.308, 0.497], [0.500, 0.187], [0.500, 0.193], [0.500, 0.189], [0.500, 0.239]],
    // 2~5단계는 꽃대 아래 '초록 목' 앞면. 잎 뭉치가 아니라 중앙 기둥에서 잰 값이다.
    faces: {
      0: { n: [0.061, 0.306, 0.950], c: [0.005, 0.592, -0.026], w: 0.135, lift: 0.004, depth: 0.09 },
      1: { n: [0.000, 0.015, 1.000], c: [-0.010, 0.900, 0.056], w: 0.085, lift: 0.000, depth: 0.08 },
      2: { n: [0.000, 0.035, 0.999], c: [0.004, 0.714, 0.064], w: 0.110, lift: 0.000, depth: 0.08 },
      3: { n: [0.000, 0.087, 0.996], c: [-0.002, 0.598, 0.062], w: 0.080, lift: 0.000, depth: 0.08 },
      4: { n: [0.000, 0.208, 0.978], c: [-0.004, 0.575, 0.081], w: 0.105, lift: 0.000, depth: 0.08 },
    },
  },
  sunflower: {
    label: '해바라기',
    // 숫자 하나 또는 단계별 배열. 만개는 꽃이 커서 0.50 이면 줄기 밑동이 하단 카드(화면의 약 25%)에 가린다.
    fillH: 0.46,
    urls: ['/models/daisy_s1.glb', '/models/sunflower_s2.glb', '/models/sunflower_s3.glb', '/models/sunflower_s4.glb', '/models/sunflower_s5.glb'],
    soil: [0.355, 0, 0, 0, 0],
    ext: [[0.308, 0.497], [0.500, 0.437], [0.500, 0.299], [0.500, 0.281], [0.500, 0.285]],
    faces: {
      0: { n: [0.061, 0.306, 0.950], c: [0.005, 0.592, -0.026], w: 0.135, lift: 0.004, depth: 0.09 },
      // 어린잎은 y 0.75 쯤이 줄기 끝이지만 잎에 가린다 — 잎 사이로 줄기가 보이는 0.65 에 놓는다.
      1: { n: [0.000, 0.000, 1.000], c: [0.000, 0.650, 0.047], w: 0.100, lift: 0.000, depth: 0.09 },
      2: { n: [0.000, 0.016, 1.000], c: [0.002, 0.764, 0.142], w: 0.160, lift: 0.000, depth: 0.09 },
      // 만개 원반은 실제 20° 인데 그대로 두면 얼굴이 위를 보는 느낌이라 12° 로 낮췄다.
      // ⚠️ 개화는 낮추면 안 된다. 개화는 «평평한 원반» 이 아니라 위를 향해 오므린 «컵» 이라,
      // 실제 40° 를 20° 로 낮추면 카메라가 17° 로 내려가 컵 안이 거의 안 보이는데
      // 그 좁은 띠에 큰 표정을 투영하게 되어 눈·입이 눌려 뭉갰다. 실제 축(40°)에 맞추면
      // 카메라가 34° 로 올라가 컵 안이 정면으로 열린다 — 그래도 내려다보는 느낌은 없다.
      3: { n: [0.000, 0.643, 0.766], c: [0.028, 0.844, 0.013], w: 0.150, lift: 0.015, depth: 0.10 },
      // 새 원반은 씨앗 요철이 깊다. 매끈한 구간은 반지름 0.09 까지(표면 높이 폭 0.05)이고
      // 그 바깥은 테두리가 급히 떨어진다. w 0.285 는 반지름 0.14 까지 덮어 테두리를 물었고,
      // 그래서 눈이 조각나고 옆(±30°)에서 검은 줄로 늘어났다. 매끈한 구간 안으로 줄인다.
      // C 는 원반의 색 무게중심이었는데, 원반이 아래로 더 퍼져 있어 표정이 «우측 상단» 으로 보였다.
      // 위아래 갈색 여백이 같아지는 지점(실측)으로 내렸다.
      4: { n: [0.000, 0.208, 0.978], c: [0.016, 0.735, -0.014], w: 0.240, lift: 0.110, depth: 0.130 },
    },
  },
  rose: {
    label: '장미',
    fillH: 0.50,
    urls: ['/models/daisy_s1.glb', '/models/rose_s2.glb', '/models/rose_s3.glb', '/models/rose_s4.glb', '/models/rose_s5.glb'],
    soil: [0.355, 0, 0, 0, 0],
    ext: [[0.308, 0.497], [0.500, 0.349], [0.500, 0.295], [0.500, 0.307], [0.500, 0.340]],
    // 장미는 노란 원반 같은 단색 면이 없다 — 겹꽃잎 한가운데에 붙인다.
    faces: {
      0: { n: [0.061, 0.306, 0.950], c: [0.005, 0.592, -0.026], w: 0.135, lift: 0.004, depth: 0.09 },
      // 잎이 아니라 밑동 쪽 굵은 줄기(y 0.16, 폭 0.085)에 붙인다. 위쪽 줄기는 너무 가늘다(0.03).
      1: { n: [0.000, 0.075, 0.997], c: [0.016, 0.160, 0.052], w: 0.090, lift: 0.000, depth: 0.09 },
      2: { n: [0.000, 0.000, 1.000], c: [0.005, 0.657, 0.051], w: 0.085, lift: 0.000, depth: 0.09 },
      // 봉오리 컵의 투영 중심(0.045, 0.820). 상자를 얕게(0.13) 잡아야 뒤쪽 겹꽃잎을 물지 않는다.
      3: { n: [0.000, 0.174, 0.985], c: [0.045, 0.820, -0.015], w: 0.195, lift: 0.164, depth: 0.13 },
      4: { n: [0.000, 0.500, 0.866], c: [0.024, 0.794, 0.022], w: 0.190, lift: 0.104, depth: 0.08 },
    },
  },
  plumeria: {
    label: '플루메리아',
    fillH: 0.50,
    urls: ['/models/daisy_s1.glb', '/models/plumeria_s2.glb', '/models/plumeria_s3.glb', '/models/plumeria_s4.glb', '/models/plumeria_s5.glb'],
    soil: [0.355, 0, 0, 0, 0],
    ext: [[0.308, 0.497], [0.500, 0.399], [0.500, 0.315], [0.500, 0.278], [0.500, 0.323]],
    // 꽃이 여러 송이 뭉쳐 피어서 큰 단색 면이 없다. 만개는 꽃에 얹으면 정면에선 괜찮아도
    // 옆(±50°)에서 꽃잎 능선을 타고 일그러지고 옆 송이에 가린다 — 데칼은 한 방향 투영이라
    // 굴곡이 심한 면을 못 버틴다. 그래서 개화·만개도 원통형이라 각도에 강한 밑동 줄기에 붙인다.
    faces: {
      0: { n: [0.061, 0.306, 0.950], c: [0.005, 0.592, -0.026], w: 0.135, lift: 0.004, depth: 0.09 },
      // ⚠️ 줄기가 가늘다(실루엣 폭 0.085~0.134). 폭보다 넓은 얼굴은 원통을 감고 돌아가
      // 한쪽으로 밀린 채 찌그러진다 — w 는 그 높이의 실루엣 폭을 넘기지 않는다.
      // 줄기 축도 x=0 이 아니다(단계마다 -0.012 ~ +0.010). c 의 x 는 실루엣 중심.
      1: { n: [-0.031, 0.074, 0.997], c: [-0.011, 0.280, 0.040], w: 0.130, lift: 0.000, depth: 0.05 },
      2: { n: [0.015, 0.121, 0.993], c: [-0.012, 0.170, 0.037], w: 0.106, lift: 0.000, depth: 0.05 },
      3: { n: [-0.015, 0.102, 0.995], c: [0.010, 0.170, 0.006], w: 0.094, lift: 0.000, depth: 0.05 },
      4: { n: [0.003, 0.125, 0.992], c: [-0.004, 0.130, -0.038], w: 0.088, lift: 0.000, depth: 0.05 },
    },
  },
  iris: {
    label: '붓꽃',
    fillH: 0.56,
    urls: ['/models/daisy_s1.glb', '/models/iris_s2.glb', '/models/iris_s3.glb', '/models/iris_s4.glb', '/models/iris_s5.glb'],
    soil: [0.355, 0, 0, 0, 0],
    ext: [[0.308, 0.497], [0.500, 0.327], [0.500, 0.226], [0.500, 0.245], [0.500, 0.245]],
    // 표정은 꽃이 아니라 초록 면에 둔다(레퍼런스). 어린잎·봉오리는 줄기 밑동,
    // 개화·만개는 꽃 바로 아래 «꽃받침» 의 불룩한 앞면.
    // 밑동은 잎이 여러 장 겹쳐 z 폭이 넓으므로 depth 를 얕게 잡아 맨 앞 잎만 물게 한다.
    faces: {
      0: { n: [0.061, 0.306, 0.950], c: [0.005, 0.592, -0.026], w: 0.135, lift: 0.004, depth: 0.09 },
      1: { n: [-0.125, 0.043, 0.991], c: [0.000, 0.320, 0.199], w: 0.110, lift: 0.000, depth: 0.040 },
      2: { n: [-0.072, 0.064, 0.995], c: [0.004, 0.280, 0.105], w: 0.100, lift: 0.000, depth: 0.040 },
      3: { n: [0.110, 0.040, 0.993], c: [-0.012, 0.580, 0.120], w: 0.150, lift: 0.000, depth: 0.050 },
      4: { n: [0.046, 0.069, 0.997], c: [-0.004, 0.520, 0.058], w: 0.130, lift: 0.000, depth: 0.050 },
    },
  },
  cosmos: {
    label: '코스모스',
    fillH: 0.50,
    // ⚠️ 유일하게 «자기 새싹» 이 있는 종이다(다른 종은 데이지 새싹을 공유). 흙받침이 없으므로 soil 은 전부 0.
    urls: ['/models/cosmos_s1.glb', '/models/cosmos_s2.glb', '/models/cosmos_s3.glb', '/models/cosmos_s4.glb', '/models/cosmos_s5.glb'],
    soil: [0, 0, 0, 0, 0],
    ext: [[0.500, 0.405], [0.500, 0.303], [0.500, 0.205], [0.500, 0.259], [0.500, 0.299]],
    // 줄기가 0.03~0.07 로 너무 가늘어 얼굴이 못 들어간다 — 새싹·어린잎은 굵은 밑동, 나머지는 꽃.
    // 만개는 노란 원반이 있어 데이지와 같은 조건. 꽃 평면이 40° 라 카메라가 34° 로 올라간다.
    faces: {
      0: { n: [0.019, -0.082, 0.996], c: [0.020, 0.350, 0.104], w: 0.160, lift: 0.000, depth: 0.06 },
      1: { n: [-0.190, 0.050, 0.981], c: [-0.005, 0.190, 0.059], w: 0.105, lift: 0.000, depth: 0.05 },
      2: { n: [-0.188, -0.025, 0.982], c: [0.000, 0.820, 0.092], w: 0.120, lift: 0.000, depth: 0.06 },
      // 개화도 위를 향한 «컵» 이다. 정면(0°)에 맞추면 카메라가 14° 로 낮아져 컵 안이 안 보이고,
      // 앞 꽃잎에 얼굴을 얹게 되는데 그 꽃잎의 매끈한 구간은 폭 0.09 뿐이라 얼굴이 넘친다.
      // 컵의 실제 축(50°)에 맞추면 카메라가 41° 로 올라가 노란 수술이 정면으로 열린다 — 만개와 같은 자리.
      // ⚠️ 수술이 «둥근 알갱이 뭉치» 라 반지름 0.04 를 넘으면 경사가 47~61° 로 급해진다.
      //    폭 0.150 이면 눈이 딱 그 경계에 걸쳐, 카메라를 돌릴 때 눈이 알갱이 능선을 타고 늘어난다.
      //    눈이 «가운데 알갱이 하나» 안에 머물도록 0.105 로 줄였다(±55° 까지 형태 유지).
      3: { n: [0.000, 0.766, 0.643], c: [0.011, 0.828, -0.017], w: 0.105, lift: 0.010, depth: 0.07 },
      // 원반 지름 0.136. 데이지가 원반의 76% 를 쓰므로 같은 비율(0.135)로 맞췄다.
      // 0.170 이던 예전 값은 원반보다 25% 넓어 볼터치가 분홍 꽃잎에 얹혀 얼굴이 눈·입만 뜬 것처럼 보였다.
      4: { n: [0.000, 0.643, 0.766], c: [-0.001, 0.714, -0.036], w: 0.135, lift: -0.013, depth: 0.13 },
    },
  },
}
const SPECIES_KEYS = Object.keys(SPECIES)
for (const sp of Object.values(SPECIES)) sp.urls.forEach((u) => useGLTF.preload(u))
// ── 성장 규칙 ────────────────────────────────────────────────
// 물 = 인증(핵심 행동), 햇빛 = 그날 첫 방문(가벼운 습관). 물에 무게를 크게 둬서
// «들여다보기만 해도 자란다» 가 되지 않게 하되, 햇빛만으로도 아주 느리게는 자라게 둔다.
const PT_WATER = 3       // 인증 1건
const PT_SUN = 1         // 그날 첫 방문(하루 1회)
// 연속 배수 — «많이» 가 아니라 «꾸준히» 를 보상한다. 상한 2배로 막지 않으면 후반에 임계값이 무의미해진다.
// 실데이터에선 연속 판정을 «프로그램 리듬 G» 로 한다(참여자 간격 중앙값, 최근 28일). 여기선 개발용으로 누른 횟수.
const STREAK_MULT = [[10, 2.0], [6, 1.6], [3, 1.3], [0, 1.0]]
const multOf = (k) => STREAK_MULT.find(([m]) => k >= m)[1]

// 누적 포인트 → 단계. index = stage (0 씨앗 ~ 5 만개)
const STAGE_PT = [0, 12, 30, 55, 90]
const stageOf = (pt) => { let s = 0; for (let i = 1; i <= 4; i++) if (pt >= STAGE_PT[i]) s = i; return s }
const pctOf = (pt) => {
  const s = stageOf(pt); if (s >= 4) return 100
  const a = STAGE_PT[s], b = STAGE_PT[s + 1]
  return Math.max(0, Math.min(99, Math.round(((pt - a) / (b - a)) * 100)))
}

// ── 물·햇빛 이펙트 ───────────────────────────────────────────
// 재생 상태는 모듈 전역 하나(windU 와 같은 방식). R3F 안팎으로 prop 을 끌고 다니지 않는다.
const fxG = { warm: { value: 0 }, gust: { value: 0 } }   // 0~1. 모든 재질이 공유하는 «햇빛 물듦» 세기
const fxU = { kind: null, t: 0, dur: 0, seed: 0, power: 1 }   // power = 연속 배수(1.0~2.0). 물방울 양·크기에 쓴다
const FX_DUR = { water: 3.0, sun: 2.1, level: 2.0 }
const playFx = (kind, power = 1) => { fxU.kind = kind; fxU.t = 0; fxU.dur = FX_DUR[kind]; fxU.power = power; fxU.seed = (fxU.seed + 1) % 997 }
// ⚠️ 물의 «붓는 시간» 과 «한 방울이 떨어지는 시간» 은 따로 둔다.
//    한 덩어리로 두면 연출을 늘렸을 때 방울까지 슬로모션이 된다. 낙하는 늘 0.8초, 나머지는 붓는 구간.
const FX_FALL = 0.8
const waterHit = () => Math.max(0, Math.min(1, (fxU.t - FX_FALL) / Math.max(0.001, fxU.dur - FX_FALL)))

// 단계별 배율. index = stage(0 씨앗 ~ 5 만개).
// ⚠️ 씨앗과 새싹은 «같은 모델» 을 쓴다(모델은 5개, 단계는 6개). 크기까지 같으면 첫 레벨업에
//    축하 연출만 터지고 화면은 그대로다 — 그래서 씨앗을 확실히 작게 둬서 «돋아나는» 변화를 만든다.
const SOLO_SCALE = [0.72, 0.83, 0.94, 1.05, 1.16]

const stageIdx = (s) => Math.min(4, Math.max(0, s))       // stage 0~4 → 모델 0~4(s1~s5) 1:1

function useMock(n) {
  return useMemo(() => {
    const rnd = (i, s) => { const x = Math.sin(i * 97.13 + s) * 43758.5453; return x - Math.floor(x) }
    return Array.from({ length: n }, (_, i) => ({
      id: i,
      nickname: ['바다', '햇살', '초록', '구름', '단단', '도담', '새싹', '언덕', '민트', '노을'][i % 10] + (i + 1),
      stage: Math.floor(rnd(i, 1) * 5),
      // 표정 상태 — 나중에 '마지막 인증 이후 경과일'로 교체할 자리
      mood: MOODS[Math.floor(rnd(i, 4) * MOODS.length)],
      // 참여자마다 다른 꽃. 실제로는 참여자가 고른 종이 들어올 자리.
      sp: SPECIES_KEYS[Math.floor(rnd(i, 5) * SPECIES_KEYS.length)],
    }))
  }, [n])
}
// radii = 슬롯별 반경(월드). 단계마다 꽃 크기가 달라서 고정 간격으로는 만개끼리 겹친다
// (만개 두 송이는 0.46 이 필요한데 옛 고정값은 0.42 였다).
function slots2D(n, fr, radii, pond) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const rnd = (s) => { const v = Math.sin(i * 91.7 + s) * 43758.5; return v - Math.floor(v) }
    const r = fr * Math.sqrt((i + 0.5) / n) + (rnd(1) - 0.5) * 0.04 * fr   // 흩뿌림(약하게)
    const th = i * GOLDEN + (rnd(2) - 0.5) * 0.18
    pts.push([r * Math.cos(th), r * Math.sin(th)])
  }
  const rad = (i) => (Array.isArray(radii) ? radii[i] || 0.12 : radii / 2)
  // 완화 반복. 순서가 중요하다 —
  //   ① 연못 밀어내기를 **먼저**(그리고 한 번에 안 밀고 80%씩만). 쌍 완화 뒤에 하면
  //      연못 가장자리로 밀린 꽃이 겹쳐도 고칠 기회가 없다(겹침의 주원인이었다).
  //   ② 그다음 쌍 완화 → ③ 섬 안으로 클램프.
  // 최대 이동량이 SETTLE 밑으로 떨어지면 조기 종료(50명 90회, 200명은 상한까지).
  for (let it = 0; it < 250; it++) {
    let mv = 0
    if (pond) for (let i = 0; i < n; i++) {
      const q = pts[i], keep = pond[2] + rad(i)
      const dx = q[0] - pond[0], dz = q[1] - pond[1], d = Math.hypot(dx, dz)
      if (d >= keep) continue
      const ux = d > 1e-4 ? dx / d : 1, uz = d > 1e-4 ? dz / d : 0
      const push = (keep - d) * 0.8
      let nx = q[0] + ux * push, nz = q[1] + uz * push
      if (Math.hypot(nx, nz) > fr) {
        // 연못 반대편으로 밀면 섬을 벗어난다 → 아래 클램프에 다시 연못 안으로 끌려온다.
        // 섬 경계원과 연못 경계원의 **교점** 중 가까운 쪽으로 보낸다(둘 다 만족하는 유일한 자리).
        const pd = Math.hypot(pond[0], pond[1])
        const aa = pd > 1e-4 ? (pd * pd + keep * keep - fr * fr) / (2 * pd) : 0
        const hh2 = keep * keep - aa * aa
        if (pd > 1e-4 && hh2 > 0) {
          const hh = Math.sqrt(hh2), ox = -pond[0] / pd, oz = -pond[1] / pd
          const mx = pond[0] + ox * aa, mz = pond[1] + oz * aa
          const c1x = mx - oz * hh, c1z = mz + ox * hh, c2x = mx + oz * hh, c2z = mz - ox * hh
          const near1 = Math.hypot(c1x - q[0], c1z - q[1]) < Math.hypot(c2x - q[0], c2z - q[1])
          nx = near1 ? c1x : c2x; nz = near1 ? c1z : c2z
        }
      }
      mv = Math.max(mv, Math.hypot(nx - q[0], nz - q[1])); q[0] = nx; q[1] = nz
    }
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = pts[j][0] - pts[i][0], dz = pts[j][1] - pts[i][1]
      const d = Math.hypot(dx, dz)
      const need = Math.max(0.16, (rad(i) + rad(j)) * PACK)   // 두 꽃이 실제로 차지하는 폭
      if (d >= need) continue
      // 완전히 겹치면(교점으로 여러 꽃이 같은 자리로 밀린 경우) 방향이 없다 → 결정적으로 흩뜨린다
      const ux = d > 1e-4 ? dx / d : Math.cos(i * 2.399 + j)
      const uz = d > 1e-4 ? dz / d : Math.sin(i * 2.399 + j)
      const push = (need - d) / 2
      pts[i][0] -= ux * push; pts[i][1] -= uz * push
      pts[j][0] += ux * push; pts[j][1] += uz * push
      mv = Math.max(mv, push)
    }
    for (const q of pts) { const rr = Math.hypot(q[0], q[1]); if (rr > fr) { q[0] *= fr / rr; q[1] *= fr / rr } }
    if (mv < 0.002) break
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
// ── 바람 흔들림 ──────────────────────────────────────────────────────
// 정점 셰이더로 흔든다 — 뼈대도 쿼드 토폴로지도 필요 없고, 인스턴싱된 필드 꽃에도 그대로 먹는다.
// 밑동은 고정하고 **높이의 제곱**에 비례해 밀어야 줄기가 뻣뻣하지 않게 휜다.
// 인스턴스마다 위상을 어긋내야 50송이가 한 몸처럼 움직이지 않는다 — 위상은 인스턴스 위치에서 뽑는다.
const windU = { uTime: { value: 0 } }
const WIND_AMP = 0.055    // 꼭대기 흔들림 폭(정규화 높이 1 기준)
const WIND_SPEED = 1.15
// base/amp 는 **그 메시의 로컬 단위**. 지오메트리를 베이크한 메시는 정규화(높이 1)라 그대로 쓰지만,
// 원본 노드를 복제해 쓰는 경우 로컬 높이가 1이 아니라 환산해야 한다.
// 전체 채도. 후처리 라이브러리를 새로 넣지 않고 프래그먼트 마지막 단계에서 살짝 올린다.
// dithering_fragment 는 basic/standard 재질 모두의 **마지막** include 라, 여기서 하면
// 톤매핑·색공간 변환까지 끝난 최종 색에 적용된다(= 눈에 보이는 그대로의 채도).
const SAT = 1.45
// 밝기는 곱하지 말고 감마(<1)로 들어올린다. 곱하면 밝은 데가 먼저 1.0 에 붙어 하얗게 뭉개지는데,
// 감마는 1.0 을 1.0 에 그대로 두고 중간톤만 끌어올려서 흰 꽃잎의 음영이 살아남는다.
const FX_GAMMA = 0.86
// ⚠️ onBeforeCompile 은 재질당 하나뿐이다. 바람과 채도를 각각 걸면 나중 것이 앞의 것을 지운다 —
//    그래서 한 함수에서 같이 처리한다. wind 를 안 넘기면 채도만 적용.
function applyFx(mat, wind) {
  if (!mat || mat.userData.fx) return mat
  mat.userData.fx = true
  const base = wind ? wind.base : 0, amp = wind ? wind.amp : 0
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWarm = fxG.warm
    sh.fragmentShader = 'uniform float uWarm;' + String.fromCharCode(10) + sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
      {
        float fxL = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 fxC = mix(vec3(fxL), gl_FragColor.rgb, ${SAT.toFixed(2)});
        fxC = clamp(pow(max(fxC, 0.0), vec3(${FX_GAMMA.toFixed(2)})), 0.0, 1.0);
        // 햇빛 — 노랗게 물들이고 살짝 들어올린다. 알갱이보다 이게 «쬐는» 느낌을 만든다.
        gl_FragColor.rgb = clamp(mix(fxC, fxC * vec3(1.12, 1.04, 0.86) + vec3(0.05, 0.035, 0.0), uWarm), 0.0, 1.0);
      }`)
    if (!wind) return
    sh.uniforms.uTime = windU.uTime
    sh.uniforms.uGust = fxG.gust
    sh.vertexShader = 'uniform float uTime; uniform float uGust;' + String.fromCharCode(10) + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 wOrg = instanceMatrix[3].xyz;
      #else
        vec3 wOrg = vec3(0.0);
      #endif
      float wPh = wOrg.x * 1.7 + wOrg.z * 2.3;
      float wH = max(transformed.y - ${base.toFixed(4)}, 0.0);
      float wA = wH * wH * ${amp.toFixed(5)};
      wA *= 1.0 + uGust * 0.5;                     // 기존 바람은 살짝만 거들고
      transformed.x += sin(uTime * ${WIND_SPEED.toFixed(2)} + wPh) * wA;
      transformed.z += cos(uTime * ${(WIND_SPEED * 0.8).toFixed(2)} + wPh * 1.3) * wA * 0.6;
      // 물 맞은 «떨림» 은 따로 얹는다 — 빠르고(약 2Hz) 작게(높이의 3%). 잎마다 위상이 달라 각자 떤다.
      float wJ = uGust * wH * 0.030;
      transformed.x += sin(uTime * 13.0 + wPh * 3.1) * wJ;
      transformed.z += cos(uTime * 11.0 + wPh * 2.3) * wJ * 0.8;`)
  }
  mat.customProgramCacheKey = () => 'fx' + SAT + '_' + FX_GAMMA + '_' + base.toFixed(4) + '_' + amp.toFixed(5)
  mat.needsUpdate = true
  return mat
}
const applyWind = (mat, base, amp = WIND_AMP) => applyFx(mat, { base, amp })

// 서브메시 월드변환 베이크 → Merged 인스턴싱용 mesh 맵
function buildMeshes(template, soil) {
  template.updateMatrixWorld(true)
  const out = {}; let i = 0
  template.traverse((o) => {
    if (o.isMesh) {
      const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld)
      const m = applyWind(o.material.clone(), soil)   // 베이크했으므로 로컬 = 정규화
      m.transparent = true
      out['p' + (i++)] = new THREE.Mesh(g, m)
    }
  })
  return out
}

// 필드 정규화 + 밝기 + 슬롯 레이캐스트
useGLTF.preload('/models/field.glb')
function useField(n, slotR) {
  const { scene } = useGLTF('/models/field.glb')
  // 연못 탐지는 레이를 400발쯤 쏜다(1발 ≈ 0.65ms). 참여자 수가 바뀔 때마다 다시 하면 슬라이더가 멈춘다.
  // 필드는 참여자 수에 비례해 **균일 확대**될 뿐이라, 연못 값도 spread 에 정비례한다
  // (y 는 윗면이 TOP_TARGET 에 고정되므로 TOP_TARGET 기준 상대값이 정비례).
  // → spread=1 기준으로 한 번만 재서 캐시하고, 이후엔 곱하기만 한다.
  const pondCache = useRef({ scene: null, base: null })
  return useMemo(() => {
    const spread = spreadFor(n)
    const field = scene.clone(true)
    field.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true
        o.material = o.material.clone(); o.material.transparent = true
        o.material.emissive = new THREE.Color('#3a5a28'); o.material.emissiveIntensity = 0.32
        applyFx(o.material)
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

    // ── 연못 ──────────────────────────────────────────────────────────
    // 위치를 하드코딩하지 않는다. 높이 분포에서 '크게 꺼진 자리'를 찾아 중심·물가를 추정한다.
    // 탐지에 레이를 400발쯤 쓰므로(1발 ≈ 0.65ms) spread=1 기준으로 캐시해 두고 이후엔 곱하기만 한다.
    if (pondCache.current.scene !== scene) {
      let base = null
      // 섬 크기에 정비례하는 고정 표본(동심원 4겹 x 12).
      // 참여자 배치(slots2D)를 쓰면 인원에 따라 패턴이 달라져 캐시한 값이 어긋난다.
      const probe = []
      for (let ring = 1; ring <= 4; ring++) for (let k = 0; k < 12; k++) {
        const r = (FR * spread * ring) / 4, a2 = (k / 12) * Math.PI * 2 + ring * 0.3
        probe.push([Math.cos(a2) * r, Math.sin(a2) * r])
      }
      const py = probe.map(([x, z]) => { const h = cast(x, z); return h ? h.point.y : TOP_TARGET })
      const med = [...py].sort((a, b) => a - b)[py.length >> 1]
      const low = probe.filter((_, i) => py[i] < med - POND_DROP * spread)
      if (low.length >= 2) {
        const cx = low.reduce((s2, q) => s2 + q[0], 0) / low.length
        const cz = low.reduce((s2, q) => s2 + q[1], 0) / low.length
        const floor = cast(cx, cz)
        const floorY = floor ? floor.point.y : med - POND_DROP * spread
        // 방향별로 밖으로 훑어 지면 높이를 기록(레이는 여기서 한 번만 쏜다)
        const dirs = POND_DIRS, step = 0.06 * spread, lim = 1.2 * spread
        const prof = []
        for (let k = 0; k < dirs; k++) {
          const a = (k / dirs) * Math.PI * 2, arr = []
          for (let r = step; r < lim; r += step) { const h = cast(cx + Math.cos(a) * r, cz + Math.sin(a) * r); arr.push(h ? h.point.y : Infinity); if (!h) break }
          prof.push(arr)
        }
        // ⚠️ 섬의 상당 부분이 수면보다 낮다. '지면이 수면 위로 올라올 때까지' 훑으면 물가를 못 찾고
        //    잔디까지 흘러간다. 먼저 **웅덩이가 담을 수 있는 한계 수위**를 구한다 —
        //    방향마다 넘어야 할 둑(그 방향 최고점) 중 가장 낮은 것이 물이 새기 시작하는 높이.
        const brim = Math.min(...prof.map((arr) => {
          const fin = arr.filter((v) => Number.isFinite(v))
          return fin.length ? Math.max(...fin) : Infinity
        }))
        const waterY = Math.min(floorY + (med - floorY) * POND_FILL, brim - 0.015 * spread)
        // 물가 = 수면 위로 올라온 뒤 **계속 올라가 있는** 첫 지점. 그냥 '처음 올라온 곳'이면
        // 바닥 요철에 걸려 덜 차고, '그 방향 최고점'이면 웅덩이 밖까지 흘러간다.
        const rs = prof.map((arr) => {
          let i = 0
          for (; i < arr.length; i++) {
            if (!(arr[i] > waterY)) continue
            let sustained = true
            for (let k = 1; k <= 2 && i + k < arr.length; k++) if (arr[i + k] <= waterY) { sustained = false; break }
            if (sustained) break
          }
          return step * (i + 1)
        })
        const sorted = [...rs].sort((a, b) => a - b)
        const guard = sorted[Math.floor(dirs * 0.8)]   // 최대값은 한 방향의 튄 값에 끌려가 과하게 넓어진다
        base = {
          cx: cx / spread, cz: cz / spread,
          dy: (waterY - TOP_TARGET) / spread,           // 윗면이 TOP_TARGET 에 고정 → 상대 높이가 정비례
          radii: rs.map((r) => (r * 0.99) / spread),    // 물가 바로 안쪽
          guard: guard / spread,                        // 물가(원 정규화). 꽃 여유분은 쓸 때 더한다
        }
      }
      pondCache.current = { scene, base }
    }
    const pb = pondCache.current.base
    const water = pb && { x: pb.cx * spread, z: pb.cz * spread, y: TOP_TARGET + pb.dy * spread, radii: pb.radii.map((r) => r * spread) }
    const pond = pb && [water.x, water.z, pb.guard * spread + POND_MARGIN]   // 물가 + 여유. 꽃 반경은 slots2D 가 더한다

    const normals = []
    const positions = slots2D(n, FR * spread, slotR, pond).map(([x, z]) => {
      const hit = cast(x, z)
      // 면 법선을 같이 챙긴다(레이 추가 비용 0). 필드는 균일 스케일+평행이동뿐이라 로컬 법선 = 월드 법선.
      const fn = hit && hit.face ? hit.face.normal : null
      normals.push(fn ? [fn.x, fn.y < 0 ? -fn.y : fn.y, fn.z] : [0, 1, 0])
      return [x, hit ? hit.point.y : TOP_TARGET - 0.1, z]
    })
    return { field, positions, normals, spread, water: water || null }
  }, [scene, n, slotR])
}

// 5단계 데이지 정규화 템플릿
// 모든 종의 모델을 URL 기준으로 한 번에 로드한다. 종마다 훅을 부르면 종이 늘어날 때
// 훅 개수가 달라져 위험하고, 새싹처럼 공유하는 모델을 중복 로드하게 된다.
const ALL_URLS = [...new Set(SPECIES_KEYS.flatMap((k) => SPECIES[k].urls))]
function useAllTemplates() {
  const gltfs = useGLTF(ALL_URLS)
  return useMemo(() => {
    const m = {}
    ALL_URLS.forEach((u, i) => { m[u] = normalizeScene(gltfs[i].scene) })
    return m
  }, [gltfs])
}

// 연못 물 — 방향별 물가를 이은 다각형. 모델에 굽지 않고 코드로 넣어야 잔물결·반짝임을 줄 수 있다.
function pondGeometry(radii) {
  const n = radii.length, pos = []
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2
    const r0 = radii[i], r1 = radii[(i + 1) % n]
    pos.push(0, 0, 0, Math.cos(a1) * r1, 0, Math.sin(a1) * r1, Math.cos(a0) * r0, 0, Math.sin(a0) * r0)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.computeVertexNormals()
  return g
}
function PondWater({ water }) {
  const ref = useRef()
  const geo = useMemo(() => pondGeometry(water.radii), [water])
  useFrame((st) => { if (ref.current) ref.current.position.y = water.y + Math.sin(st.clock.elapsedTime * 0.8) * 0.004 })
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh ref={ref} geometry={geo} position={[water.x, water.y, water.z]} renderOrder={2}>
      <meshStandardMaterial ref={(m) => applyFx(m)} color="#6FC5E8" transparent opacity={0.78} roughness={0.15} metalness={0.1}
        emissive="#2E86B8" emissiveIntensity={0.25} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

// 단독 뷰 미니 플랫폼(island.glb) — 윗면을 y=0 에 맞춰 식물이 그 위에 서게.
useGLTF.preload('/models/island.glb')
function useIslandTemplate() {
  const { scene } = useGLTF('/models/island.glb')
  return useMemo(() => {
    const s = scene.clone(true)
    s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material = applyFx(o.material.clone()); o.material.emissive = new THREE.Color('#3a5a28'); o.material.emissiveIntensity = 0.22 } })
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

// 2D 표정(캔버스) — 상태별 3종. 데칼로 표면에 투영된다.
//   normal 기본                  둥근 눈 + 하이라이트, 얌전한 미소
//   happy  물 준 직후             ^^ 감은 눈, 벌린 미소
//   joy    큰 성취(레벨업 등)      크게 뜬 눈, 크게 벌린 입, 진한 볼
// ※ 부정 표정(시듦·시무룩)은 두지 않는다 — 「꽃은 시들지 않는다」가 성장 탭의 원칙.
// 캔버스 512 기준 좌표. 잉크가 차지하는 가로 비율(FACE_INK)이 세 상태에서 비슷해야
// 같은 w 값으로 크기가 들쭉날쭉하지 않는다 — 볼 위치를 ±122 로 통일해 맞춰뒀다.
const MOODS = ['normal', 'happy', 'joy']
const MOOD_LABEL = { normal: '보통', happy: '방긋', joy: '기쁨' }
function makeFaceTexture(mood = 'normal') {
  const S = 512
  const c = document.createElement('canvas'); c.width = c.height = S
  const g = c.getContext('2d'); g.clearRect(0, 0, S, S)
  const cx = S / 2
  const INK = '#23201e'

  // 볼 — 부드러운 복숭아빛(가장자리 흐리게). 눈보다 먼저 그려 뒤에 깔림.
  const blush = (x, y, r, a) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, `rgba(255,150,120,${a})`)
    grad.addColorStop(0.55, `rgba(255,160,130,${a * 0.58})`)
    grad.addColorStop(1, 'rgba(255,170,140,0)')
    g.fillStyle = grad
    g.beginPath(); g.ellipse(x, y, r, r * 0.78, 0, 0, 7); g.fill()
  }
  const stroke = (w) => { g.strokeStyle = INK; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round' }
  // 둥근 눈 + 하이라이트
  const roundEye = (dir, y, rx, ry) => {
    const x = cx + dir * 64
    g.fillStyle = INK
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill()
    g.fillStyle = '#ffffff'
    g.beginPath(); g.arc(x - 7, y - ry * 0.37, rx * 0.4, 0, 7); g.fill()
    g.globalAlpha = 0.75
    g.beginPath(); g.arc(x + 9, y + ry * 0.4, rx * 0.17, 0, 7); g.fill()
    g.globalAlpha = 1
  }

  // 벌린 입. 안쪽에 분홍 혀를 넣어야 '벌린 입'으로 읽힌다 — 그냥 검게 채우면 구멍처럼 보인다.
  // dip = 윗변이 가운데로 처지는 양(양끝이 올라가 웃는 입이 된다). 0 이면 윗변 직선.
  //   ⚠️ 완전한 타원(사방 둥근 입)으로 하면 '놀란 표정'이 된다. 윗변은 거의 직선이어야 웃음으로 읽힌다.
  //   ⚠️ 혀가 너무 위로 붙으면 윗니처럼 보인다 — 입 높이의 절반 아래에 둬서 위쪽 검은 띠를 남긴다.
  // 혀는 **두 표정 모두 같은 크기**로 고정하고 입 모양으로 잘라낸다.
  const TONGUE_RX = 30, TONGUE_RY = 17
  const openMouth = (y, rx, ry, dip) => {
    const path = () => {
      g.beginPath()
      g.ellipse(cx, y, rx, ry, 0, 0, Math.PI)                  // 아랫변(반타원)
      g.quadraticCurveTo(cx, y + dip * 2, cx + rx, y)          // 윗변(제어점 2배 = 가운데가 dip 만큼 처짐)
      g.closePath()
    }
    g.fillStyle = INK; path(); g.fill()
    g.save(); path(); g.clip()
    g.fillStyle = '#F0707C'
    g.beginPath(); g.ellipse(cx, y + ry * 0.5 + TONGUE_RY, TONGUE_RX, TONGUE_RY, 0, 0, 7); g.fill()
    g.restore()
  }

  if (mood === 'happy') {
    blush(cx - 122, 288, 44, 0.82); blush(cx + 122, 288, 44, 0.82)
    stroke(11)   // ^^ 감은 눈
    for (const d of [-1, 1]) { g.beginPath(); g.arc(cx + d * 64, 232, 26, 1.13 * Math.PI, 1.87 * Math.PI); g.stroke() }
    openMouth(264, 47, 31, 3)
  } else if (mood === 'joy') {
    blush(cx - 124, 292, 48, 0.92); blush(cx + 124, 292, 48, 0.92)
    roundEye(-1, 220, 23, 29); roundEye(1, 220, 23, 29)
    openMouth(266, 41, 36, 4)
  } else {
    blush(cx - 122, 284, 40, 0.72); blush(cx + 122, 284, 40, 0.72)
    roundEye(-1, 222, 21, 27); roundEye(1, 222, 21, 27)
    stroke(9)
    g.beginPath(); g.arc(cx, 266, 38, 0.22 * Math.PI, 0.78 * Math.PI); g.stroke()
  }

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
// 상태별 텍스처는 한 번만 만들어 재사용(GPU 자원)
const faceTexCache = {}
const faceTexture = (mood) => (faceTexCache[mood] ||= makeFaceTexture(mood))

const FACE_INK = 0.619                  // 캔버스에서 표정 그림이 실제 차지하는 가로 비율(볼 바깥까지) — 실측
// 데칼의 +Z 축을 법선에 맞추는 XYZ 오일러 — 회전 0(정면 투영)이면 표정이 눌려 보인다.
const faceParams = (f) => {
  const yaw = Math.asin(f.n[0])
  const tilt = -Math.asin(f.n[1] / Math.cos(yaw))
  const sc = f.w / FACE_INK
  return { rot: [tilt, yaw, 0], pos: f.c.map((v, i) => v + f.n[i] * f.lift), size: [sc, sc, f.depth] }
}
// 종·단계별 데칼 파라미터(회전·위치·크기)는 한 번만 계산해 둔다
const FACE_PARAMS = Object.fromEntries(SPECIES_KEYS.map((k) =>
  [k, Object.fromEntries(Object.entries(SPECIES[k].faces).map(([si, f]) => [si, faceParams(f)]))]))
const FACE_BOX = typeof location !== 'undefined' && location.search.includes('facebox')  // ?facebox=1 → 데칼 상자 표시

// 단독 데이지 + 표정 데칼 — 표정이 표면에 직접 투영돼 '딱 박힘'. 회전해도 표면 따라감.
function SoloDaisyFace({ template, face, soil, mood }) {
  const tex = faceTexture(mood)
  const { geo, mat } = useMemo(() => {
    let g = null, m = null
    template.updateMatrixWorld(true)
    template.traverse((o) => { if (o.isMesh && !g) { g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); m = o.material.clone(); m.transparent = false } })
    return { geo: g, mat: applyWind(m, soil) }
  }, [template, soil])
  // ⚠️ 데칼 재질에도 같은 바람을 먹여야 한다. 본체만 흔들면 표정이 제자리에 남아 떨어져 보인다.
  const decalMat = useMemo(() => applyWind(new THREE.MeshBasicMaterial({
    transparent: true, polygonOffset: true, polygonOffsetFactor: -3, depthWrite: false, toneMapped: false,
  }), soil), [soil])
  useEffect(() => { decalMat.map = tex; decalMat.needsUpdate = true }, [decalMat, tex])
  if (!geo) return null
  return (
    <mesh geometry={geo} material={mat} castShadow receiveShadow>
      <Decal debug={FACE_BOX} map={tex} position={face.pos} rotation={face.rot} scale={face.size}>
        <primitive object={decalMat} attach="material" />
      </Decal>
    </mesh>
  )
}

// 단독/hero 데이지 — 복제마다 자기 재질. opaque=단독(불투명).
function Daisy({ template, opaque, soil }) {
  const obj = useMemo(() => {
    const c = template.clone(true)
    c.traverse((o) => {
      if (!o.isMesh) return
      o.material = o.material.clone(); o.material.transparent = !opaque
      // 이 메시는 원본 로컬 좌표라 높이가 1이 아니다 — 바람 상수를 로컬 단위로 환산한다.
      o.geometry.computeBoundingBox()
      const H = Math.max(1e-4, o.geometry.boundingBox.max.y - o.geometry.boundingBox.min.y)
      applyWind(o.material, soil * H, WIND_AMP / H)
    })
    return c
  }, [template, opaque, soil])
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
// 단독 뷰 프레이밍 — 단계마다 식물 크기·묻히는 깊이·생김새가 달라 카메라 거리를 고정하면 확대가 제각각이 된다.
// ⚠️ 높이만 보고 맞추면 안 된다. 새싹은 떡잎 때문에 **폭이 높이의 1.6배**라, 높이에 맞춰 당기면 가로로 화면을 넘친다
//    (다른 단계는 폭/높이가 0.4~0.6 이라 이 함정이 안 드러난다).
// → 땅 위로 나온 부분의 반높이·반폭(정규화)을 들고, 세로·가로 **둘 다** 만족하는 거리를 고른다.
const FILL_H = 0.42      // 식물 높이가 화면 세로의 기본 채움 비율(종별 SPECIES.fillH 로 덮어씀. 숫자 또는 단계별 배열)
const FILL_W = 0.75      // 가로 상한. 새싹은 이 값에 걸려 거리가 정해진다
const CARD_COVER = 0.25  // 하단 카드가 가리는 화면 세로 비율. 카메라가 이만큼을 피해서 식물을 올려 잡는다.
const CAM_ELEV = [0.25, 0.72]   // 카메라 고도 제한(rad ≒ 14°~41°).
                                // 개화는 꽃이 66° 를 봐서 그대로 맞추면 식물을 위에서 내려다보게 된다.
// 바닥 «젖음 지도». 큰 원 하나를 켰다 끄는 게 아니라 물방울이 «닿은 그 지점» 마다 칠한다.
// 방울이 쌓일수록 자국이 이어붙어 저절로 불규칙한 얼룩이 되고, 지나면 서서히 마른다.
const WET_S = 128          // 지도 해상도
const WET_W = 1.3          // 지도가 덮는 실제 폭(월드)
function makeWetMap() {
  const cv = document.createElement('canvas'); cv.width = cv.height = WET_S
  const ctx = cv.getContext('2d')
  const tex = new THREE.CanvasTexture(cv)
  let empty = true
  // 월드 (x,z) → 캔버스 (열,행). 평면을 -90° 눕히면 로컬 +Y 가 월드 -Z 가 되고,
  // CanvasTexture 는 flipY 라 v=0 이 캔버스 아랫줄이다 — 둘이 상쇄돼서 이 식이 된다.
  return {
    tex,
    splat(x, z, r, a) {
      const cx = (0.5 + x / WET_W) * WET_S, cy = (0.5 + z / WET_W) * WET_S
      const rp = (r / WET_W) * WET_S
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rp)
      g.addColorStop(0, 'rgba(255,255,255,' + a + ')')
      g.addColorStop(0.5, 'rgba(255,255,255,' + (a * 0.5) + ')')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(cx, cy, rp, 0, Math.PI * 2); ctx.fill()
      empty = false
      tex.needsUpdate = true
    },
    dry(k) {
      if (k <= 0) return
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.35, k) + ')'
      ctx.fillRect(0, 0, WET_S, WET_S)
      tex.needsUpdate = true
    },
    // destination-out 은 아무리 반복해도 옅은 알파가 남는다 — 다 마르면 한 번 깨끗이 지운다.
    clear() {
      if (empty) return
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, WET_S, WET_S)
      empty = true; tex.needsUpdate = true
    },
  }
}

// 물·햇빛 연출. 소품(물뿌리개·해님)을 놓지 않고 «세계가 반응» 하게 만든다 —
// 빛과 그림자가 움직이고, 바닥이 젖고, 맞은 잎이 흔들린다.
const FX_N = 30
function FxParticles() {
  const ref = useRef(), mat = useRef(), wet = useRef()
  const wetMap = useMemo(() => makeWetMap(), [])
  const landed = useRef(new Uint8Array(FX_N))
  const since = useRef(9)   // 물 연출이 끝난 뒤 경과(초)
  const seenSeed = useRef(-1)   // playFx 마다 증가 — 새 연출이 시작됐는지 판별
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(() => Array.from({ length: FX_N }, (_, i) => {
    const r = (k) => { const v = Math.sin(i * 71.3 + k * 13.7) * 43758.5; return v - Math.floor(v) }
    const a = r(1) * Math.PI * 2, rad = 0.05 + r(2) * 0.30
    return { ux: Math.cos(a), uz: Math.sin(a), rad,
             x: Math.cos(a) * rad, z: Math.sin(a) * rad,   // z 까지 퍼뜨려야 일부가 식물 «뒤» 로 지나간다
             d: r(3), s: 0.7 + r(4) * 0.6, sway: (r(5) - 0.5) * 0.12, up: 0.5 + r(6) * 0.9, tw: r(7) * 6.3 }
  }), [])
  useFrame((st, dt) => {
    const g = ref.current; if (!g) return
    const kind = fxU.kind
    const p = kind ? Math.min(1, fxU.t / fxU.dur) : 0
    const sun = kind === 'sun', water = kind === 'water'
    const hit = water ? waterHit() : 0

    fxG.warm.value = sun ? Math.sin(p * Math.PI) * 0.9 : Math.max(0, fxG.warm.value - 0.05)
    // 물을 맞은 «순간» 잎이 크게 흔들렸다 잦아든다. 셰이더에 잎마다 위상이 있어 각자 따로 흔들린다.
    fxG.gust.value = water && hit > 0 ? Math.sin(Math.min(1, hit * 2.2) * Math.PI) * Math.exp(-hit * 1.4) : Math.max(0, fxG.gust.value - 0.05)

    // ⚠️ 연출이 «시작될 때» 초기화한다. 끝날 때만 하면 연달아 누를 때 새 자국이 안 찍힌다.
    if (seenSeed.current !== fxU.seed) { seenSeed.current = fxU.seed; landed.current.fill(0) }
    // 붓는 동안엔 거의 안 마르고, 연출이 끝나면 빠르게 걷힌다. 자국이 계속 남아 있으면 안 된다.
    since.current = water ? 0 : since.current + dt
    wetMap.dry(water ? dt * 0.10 : dt * 1.6)
    if (since.current > 1.8) wetMap.clear()      // 잔여 알파까지 완전히 지운다

    g.visible = !!kind
    if (!kind) return
    mat.current.color.set(water ? '#6FC3EC' : sun ? '#FFEBB0' : '#FFC33A')
    mat.current.opacity = water ? 1 : 0.9
    const pw = Math.max(1, Math.min(2, fxU.power))
    const live = water ? Math.round(14 + 16 * (pw - 1)) : sun ? 16 : FX_N
    for (let i = 0; i < FX_N; i++) {
      const sd = seeds[i]
      if (i >= live) { dummy.scale.setScalar(0); dummy.updateMatrix(); g.setMatrixAt(i, dummy.matrix); continue }
      // 방울마다 출발 시각만 다르고 낙하 속도는 같다 → 연출을 늘리면 «더 오래 붓는다»
      const spread = Math.max(0.2, fxU.dur - FX_FALL - 0.35)
      const q = water ? Math.max(0, Math.min(1, (fxU.t - sd.d * spread) / FX_FALL))
                      : Math.max(0, Math.min(1, (p - sd.d * 0.35) / 0.62))
      let x = sd.x, y, z = sd.z, sx, sy
      if (water) {
        // 등속이 아니라 «가속», 그리고 빠를수록 길게 늘어난다 — 이 둘이 물처럼 보이게 하는 핵심.
        // 화면 밖 위에서 오는 물이라 살짝 비스듬히 떨어진다.
        const fall = q * q
        y = 1.55 - fall * 1.57
        x += q * 0.10
        const v = Math.max(0.2, 2 * q)
        const base = 0.026 * sd.s * (0.85 + 0.5 * (pw - 1))
        sx = base * (1 - q * 0.25); sy = base * (1 + v * 1.9)
        if (q > 0.94) {
          sx = 0; sy = 0
          // 닿는 «그 지점» 에 자국을 남긴다. 방울마다 시간이 달라서 얼룩이 하나씩 번져 나간다.
          if (!landed.current[i]) { landed.current[i] = 1; wetMap.splat(x, z, 0.055 + sd.s * 0.035, 0.5) }
        }
      } else if (sun) {
        // 햇살 속 먼지. 위로 쏘면 «마법가루» 다 — 천천히 «내려오며» 반짝여야 공기 중 먼지로 읽힌다.
        y = 1.5 - q * 1.35
        const tw = 0.5 + 0.5 * Math.sin(st.clock.elapsedTime * 3 + sd.tw)
        sx = sy = Math.sin(q * Math.PI) * 0.016 * sd.s * tw
        x += Math.sin(q * 3.2 + sd.tw) * 0.06; z += Math.cos(q * 2.6 + sd.tw) * 0.06
      } else {
        const b = Math.max(0, Math.min(1, (p - sd.d * 0.12) / 0.88))
        const rr = 0.05 + b * (0.34 + sd.s * 0.22)
        x = sd.ux * rr; z = sd.uz * rr
        y = 0.86 + b * sd.up * 0.42 - b * b * 0.30
        sx = sy = Math.sin(Math.min(1, b * 1.35) * Math.PI) * 0.032 * sd.s
      }
      dummy.position.set(x, y, z)
      dummy.scale.set(Math.max(0, sx), Math.max(0, sy), Math.max(0, sx))
      dummy.updateMatrix(); g.setMatrixAt(i, dummy.matrix)
    }
    g.instanceMatrix.needsUpdate = true
  })
  return (
    <>
      <instancedMesh ref={ref} args={[undefined, undefined, FX_N]} frustumCulled={false} visible={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial ref={mat} transparent opacity={1} toneMapped={false} depthWrite={false} />
      </instancedMesh>
      {/* 젖음 지도. 곱하기 합성이라 색을 덮지 않고 바닥색을 «누르기만» 한다 —
          잔디 위면 초록이 짙어지고, 흙받침 위면 흙이 짙어진다. 바닥이 뭐든 알아서 맞는다. */}
      <mesh ref={wet} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <planeGeometry args={[WET_W, WET_W]} />
        <meshBasicMaterial map={wetMap.tex} color="#6E8A5A" transparent depthWrite={false}
          toneMapped={false} blending={THREE.MultiplyBlending} />
      </mesh>
    </>
  )
}

// 장면 전체의 빛. 햇빛일 때 해가 높이 뜨고 색이 따뜻해진다 —
// «세계가 바뀌었다» 는 신호는 소품이 아니라 그림자가 짧아지고 방향이 도는 것에서 나온다.
function FxWorld({ spread }) {
  const dir = useRef(), amb = useRef(), hemi = useRef()
  useFrame(() => {
    const e = fxU.kind === 'sun' ? Math.sin(Math.min(1, fxU.t / fxU.dur) * Math.PI) : 0
    if (dir.current) {
      // ⚠️ 그림자 카메라는 «섬 전체» 를 덮어야 한다. 섬 반경은 2.3 x spread 라 참여자 수에 따라 커진다.
      //    작게 고정해두면 프러스텀 밖이 그림자맵 가장자리 값으로 채워져 통째로 어두워진다.
      const R = 2.3 * spread + 1.2
      const sc = dir.current.shadow.camera
      if (sc.right !== R) { sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.updateProjectionMatrix() }
      dir.current.position.set(4 - e * 1.8, 7 + e * 6.5, 3 + e * 1.4)
      dir.current.intensity = 1.05 + e * 0.9
      dir.current.color.setRGB(1, 1 - e * 0.05, 1 - e * 0.16)
    }
    if (amb.current) amb.current.intensity = 1.05 + e * 0.3
    if (hemi.current) hemi.current.intensity = 0.7 + e * 0.55
  })
  return (
    <>
      <ambientLight ref={amb} intensity={1.05} />
      <hemisphereLight ref={hemi} args={['#ffffff', '#cdeccf', 0.7]} />
      <directionalLight ref={dir} position={[4, 7, 3]} intensity={1.05} castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.00006} shadow-normalBias={0.018}
        shadow-camera-near={0.5} shadow-camera-far={40} />
    </>
  )
}

// ⚠️ soloScale(실제 배율)과 soloFrame(카메라 프레이밍용 배율)을 나눠 받는다.
//    하나로 쓰면 카메라가 «자란 만큼» 뒤로 물러나서 화면에선 늘 같은 크기로 보인다 — 성장이 안 보인다.
//    프레이밍은 «그 단계의 최대 크기» 로 고정하고, 그 안에서 식물이 실제로 커지게 한다.
function Rig({ selectedPos, gardenRef, soloRef, controlsRef, camGarden, soloScale, soloFrame, head, soloExt, fillH }) {
  const { camera, size } = useThree()
  const focus = useRef(0); const gt = useRef(new THREE.Vector3()); const ct = useRef(new THREE.Vector3())
  const grow = useRef(0)   // 화면에 실제로 그려지는 배율. 목표로 «천천히» 따라가야 자라는 게 보인다.
  const fxSeen = useRef(-1), fxDist = useRef(0)   // 연출 시작 시점의 카메라 거리(뒤로 물러났다 제자리로)
  useFrame((_, dt) => {
    windU.uTime.value += dt
    const active = !!selectedPos; const target = active ? 1 : 0
    focus.current += (target - focus.current) * Math.min(1, dt * 5); const f = focus.current
    if (gardenRef.current) {
      gardenRef.current.visible = f < 0.98
      gardenRef.current.traverse((o) => { if (o.isMesh && o.material && !o.material.userData?.noFade && 'opacity' in o.material) { o.material.opacity = 1 - f; o.material.depthWrite = f < 0.5 } })
    }
    // 물·햇빛 반응. 물은 «맞고 통통», 햇빛은 «쭉 늘어남», 레벨업은 «팡».
    if (fxU.kind) { fxU.t += dt; if (fxU.t >= fxU.dur) fxU.kind = null }
    let bx = 1, by = 1
    if (fxU.kind) {
      const p = fxU.t / fxU.dur
      if (fxU.kind === 'water') {
        const h = waterHit()                                        // 물이 닿기 전엔 반응 없음
        const e = Math.sin(h * Math.PI * 3) * Math.exp(-h * 3.5)
        by = 1 - e * 0.11; bx = 1 + e * 0.07
      } else if (fxU.kind === 'sun') {
        const e = Math.sin(Math.min(1, p / 0.8) * Math.PI)
        by = 1 + e * 0.06; bx = 1 - e * 0.025
      } else {
        // 단계가 오르면 모델 자체가 커진다 — 그 변화에 묻히지 않게 팝을 크게 준다.
        const e = Math.sin(Math.min(1, p * 1.6) * Math.PI) * Math.exp(-p * 1.6)
        by = 1 + e * 0.34; bx = 1 + e * 0.20
      }
    }
    // 물을 준 만큼 커지는 건 한 번에 3~4% 라 «툭» 바뀌면 눈에 안 띈다. 0.6초에 걸쳐 자라게 해서
    // «변화량» 이 아니라 «움직임» 으로 보이게 한다. 꽃을 바꿀 땐(차이가 크면) 즉시 맞춘다.
    if (grow.current === 0 || Math.abs(soloScale - grow.current) > 0.08 || f < 0.05) grow.current = soloScale
    else grow.current += (soloScale - grow.current) * (1 - Math.exp(-4 * dt))
    if (soloRef.current) { const S = grow.current * f; soloRef.current.scale.set(S * bx, S * by, S * bx); soloRef.current.visible = f > 0.02 }
    if (!controlsRef.current) return
    if (active) {
      const dir = new THREE.Vector2(selectedPos[0], selectedPos[2]); if (dir.lengthSq() < 0.02) dir.set(0, 1); dir.normalize()
      if (head) {
        // 꽃이 위를 보니 카메라도 그만큼 올라가야 표정이 정면으로 보인다.
        const view = new THREE.Vector3(dir.x, 0, dir.y).lerp(head.n, CAM_ALIGN).normalize()
        const elev = Math.asin(THREE.MathUtils.clamp(view.y, -1, 1))
        const want = THREE.MathUtils.clamp(elev, CAM_ELEV[0], CAM_ELEV[1])
        if (want !== elev) { const h = Math.hypot(view.x, view.z) || 1; view.set(view.x / h * Math.cos(want), Math.sin(want), view.z / h * Math.cos(want)) }
        // 세로·가로 각각 필요한 거리 중 큰 쪽 — 어느 방향으로도 잘리지 않는 최소 거리
        const halfV = Math.tan((camera.fov * Math.PI) / 360)
        const aspect = size.height > 0 ? size.width / size.height : 1
        const [hh, hw] = soloExt
        const dist = Math.max(hh * soloFrame / (halfV * (fillH || FILL_H)), hw * soloFrame / (halfV * aspect * FILL_W))
        // ⚠️ 하단 카드가 화면의 CARD 만큼을 가린다. 예전엔 얼굴을 화면 중앙 가까이 두다 보니
        //    식물이 아래로 밀려 줄기 밑동이 늘 카드에 묻혔다. 대신 **식물 전체를 '카드 위 영역'의
        //    한가운데**에 놓는다 — 화면 세로 시야(span)를 알아야 하므로 거리 계산 뒤에 한다.
        const span = 2 * dist * halfV
        gt.current.set(selectedPos[0], selectedPos[1] + hh * soloFrame - (CARD_COVER / 2) * span, selectedPos[2])
        ct.current.copy(head.c).addScaledVector(view, dist)
      } else {
        gt.current.set(selectedPos[0], selectedPos[1] + 0.55, selectedPos[2])
        ct.current.set(selectedPos[0] + dir.x * 4.4, selectedPos[1] + 2.2, selectedPos[2] + dir.y * 4.4)
      }
    } else { gt.current.set(0, TOP_TARGET, 0); ct.current.set(camGarden[0], camGarden[1], camGarden[2]) }
    // 프레임률에 안 흔들리는 감쇠. 예전엔 고정 계수(0.06)로 전환 구간에만 움직여서
    // 목표에 채 도달하지 못했고, 출발 위치에 따라 최종 확대가 매번 달라졌다.
    const k = 1 - Math.exp(-6 * dt)
    controlsRef.current.target.lerp(gt.current, k)
    if (Math.abs(target - f) > 0.001) camera.position.lerp(ct.current, k)
    // 물·햇빛 동안 한 발 물러선다 — 떨어지는 물과 하늘까지 들어와야 «세계가 반응» 하는 게 보인다.
    // ⚠️ ct(계산된 카메라 위치)로 되돌리면 사용자가 손으로 돌려둔 각도를 뺏는다.
    //    방향은 그대로 두고 «타깃까지의 거리» 만 늘렸다 줄인다.
    if (fxU.kind === 'water' || fxU.kind === 'sun') {
      const tgt = controlsRef.current.target
      const d = camera.position.clone().sub(tgt)
      if (fxSeen.current !== fxU.seed) { fxSeen.current = fxU.seed; fxDist.current = d.length() }
      const pz = Math.min(1, fxU.t / fxU.dur)
      const want = fxDist.current * (1 + Math.sin(Math.min(1, pz * 1.12) * Math.PI) * 0.30)
      d.setLength(d.length() + (want - d.length()) * (1 - Math.exp(-5 * dt)))
      camera.position.copy(tgt).add(d)
    }
    controlsRef.current.update()
  })
  return null
}

function Scene({ n, selected, onSelect, mood, spKey, gain }) {
  // spKey === 'mix' 면 참여자마다 제 종을 쓴다. 아니면 전부 그 종으로 덮어쓴다.
  const parts0 = useMock(n)
  const parts = useMemo(() => {
    const base = spKey === 'mix' ? parts0 : parts0.map((q) => ({ ...q, sp: spKey }))
    // 물·햇빛으로 얻은 포인트만큼 단계 + 그 단계 «안» 의 진행률까지 계산(개발용 · 실데이터 붙이면 서버 값)
    return base.map((q, i) => {
      const pt = STAGE_PT[q.stage] + ((gain && gain[i]) || 0)
      const st = stageOf(pt)
      const a = STAGE_PT[st], b = st >= 4 ? a : STAGE_PT[st + 1]
      return { ...q, stage: st, prog: b > a ? Math.min(1, (pt - a) / (b - a)) : 1 }
    })
  }, [parts0, spKey, gain])
  const spOf = (i) => SPECIES[parts[i].sp]
  // 슬롯별 반경 = 그 단계의 반폭 x 그 꽃의 크기. 내 꽃(meIndex)만 scale 0.95 로 그린다.
  const slotR = useMemo(() => parts.map((q, i) => SPECIES[q.sp].ext[stageIdx(q.stage)][1] * (i === 0 ? 0.95 : 0.3 + q.stage * 0.12)), [parts])
  const { field, positions, normals, spread, water } = useField(n, slotR)
  const camGarden = useMemo(() => CAM_GARDEN.map((v) => v * spread), [spread])
  const byUrl = useAllTemplates()
  // 종 x 단계 별 인스턴싱 메시. 종이 섞여도 같은 종·단계끼리는 한 번에 그린다.
  const meshSets = useMemo(() => Object.fromEntries(SPECIES_KEYS.map((k) =>
    [k, SPECIES[k].urls.map((u, si) => buildMeshes(byUrl[u], SPECIES[k].soil[si]))])), [byUrl])
  const tmplOf = (k, si) => byUrl[SPECIES[k].urls[si]]
  const meIndex = 0
  const gardenRef = useRef(); const soloRef = useRef(); const controlsRef = useRef()
  const selIdx = selected != null ? Math.min(selected, n - 1) : null
  const selPos = selIdx != null ? positions[selIdx] : null
  const sel = selIdx != null ? parts[selIdx] : null
  const mePos = positions[meIndex]
  const heroSink = mePos ? (soilSink(spOf(meIndex), stageIdx(parts[meIndex].stage)) + tiltResidual(spOf(meIndex), normals[meIndex], stageIdx(parts[meIndex].stage))) * 0.95 : 0
  const faceAngle = selPos ? (Math.hypot(selPos[0], selPos[2]) < 0.15 ? 0 : Math.atan2(selPos[0], selPos[2])) : 0
  // 단계 «안» 에서도 연속적으로 자란다 — 물을 줄 때마다 꽃이 실제로 조금 커진다.
  const soloScale = sel
    ? SOLO_SCALE[sel.stage] + (sel.prog || 0) * (SOLO_SCALE[Math.min(4, sel.stage + 1)] - SOLO_SCALE[sel.stage])
    : 1.15
  // 프레이밍은 «그 단계 시작 크기» 로 고정 — 예전에 맞춰둔 거리를 그대로 두고, 자란 만큼만 화면에서 커진다.
  // 씨앗은 새싹 기준으로 잡아야 «작게» 보인다(자기 기준이면 화면에 꽉 차서 안 작아 보인다).
  const soloFrame = sel ? SOLO_SCALE[sel.stage] : 1.15
  // 새싹(stageIdx 0)은 흙더미가 워낙 커서 경사 보정까지 하면 잎까지 잠긴다 — 기울기만 맞추고 추가 침하는 안 한다.
  const soloSi = sel ? stageIdx(sel.stage) : 0
  const soloNrm = selIdx != null ? normals[selIdx] : null
  const selSp = SPECIES[sel ? sel.sp : SPECIES_KEYS[0]]
  const soloBury = sel ? soilSink(selSp, soloSi) + (soloSi > 0 ? tiltResidual(selSp, soloNrm, soloSi) : 0) : 0
  const soloQuat = useMemo(() => terrainQuat(soloNrm), [soloNrm])

  // 단독 뷰의 얼굴 위치·방향(월드) — 표정이 있는 단계에서만. 카메라 정렬에 씀.
  const head = useMemo(() => {
    const f = sel ? selSp.faces[stageIdx(sel.stage)] : null
    if (!selPos || !f) return null
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), faceAngle)
    return {   // 그룹 순서(지면 기울기 → faceAngle)와 같게 두 번 돌린다
      c: new THREE.Vector3(f.c[0], f.c[1] - soloBury, f.c[2]).multiplyScalar(soloScale).applyQuaternion(q).applyQuaternion(soloQuat)
           .add(new THREE.Vector3(selPos[0], selPos[1], selPos[2])),
      n: new THREE.Vector3(...f.n).applyQuaternion(q).applyQuaternion(soloQuat).normalize(),
    }
  }, [selPos, sel, faceAngle, soloScale, soloBury, soloQuat, selSp])

  // 필드 아이템을 단계별로 그룹화
  const groups = useMemo(() => {
    const gs = Object.fromEntries(SPECIES_KEYS.map((k) => [k, [[], [], [], [], []]]))
    parts.forEach((p, i) => {
      if (i === meIndex || !positions[i]) return
      const [x, y, z] = positions[i]
      const r = (s) => { const v = Math.sin(i * 53.7 + s) * 43758.5; return v - Math.floor(v) }
      const sc = 0.3 + p.stage * 0.12, si = stageIdx(p.stage), psp = SPECIES[p.sp]
      const nrm = normals[i]
      gs[p.sp][si].push({ idx: i, x, y: y - (soilSink(psp, si) + tiltResidual(psp, nrm, si)) * sc, z, scale: sc, quat: terrainQuat(nrm),
        ry: r(1) * Math.PI * 2, tx: (r(2) - 0.5) * 0.18, tz: (r(3) - 0.5) * 0.18 })
    })
    return gs
  }, [parts, positions, normals])

  return (
    <Canvas shadows dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ position: camGarden, fov: 34 }}
      style={{ width: '100%', height: '100%' }} onPointerMissed={() => onSelect(null)}>
      <Suspense fallback={null}>
        <FxWorld spread={spread} />

        <Float speed={1.0} rotationIntensity={0} floatIntensity={0.35}>
          <primitive object={field} />{/* 필드(땅)는 단독 뷰에서도 보임 — gardenRef 밖 */}
          {water && <PondWater water={water} />}
          <group ref={gardenRef}>
            {SPECIES_KEYS.map((k) => meshSets[k].map((meshes, si) => (
              <DaisyField key={k + si} meshes={meshes} items={groups[k][si]} onSelect={onSelect} soloActive={selIdx != null} />
            )))}
            {mePos && (
              <group position={[mePos[0], mePos[1] - heroSink, mePos[2]]} quaternion={terrainQuat(normals[meIndex])} scale={0.95} onClick={(e) => { e.stopPropagation(); onSelect(selIdx != null ? null : meIndex) }}
                onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = 'auto')}>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[0.3, 0.4, 32]} /><meshBasicMaterial color="#FFE58A" transparent opacity={0.7} side={THREE.DoubleSide} /></mesh>
                <Daisy template={tmplOf(parts[meIndex].sp, stageIdx(parts[meIndex].stage))} opaque={false} soil={spOf(meIndex).soil[stageIdx(parts[meIndex].stage)]} />
              </group>
            )}
          </group>
          {/* ⚠️ 단독 식물도 Float «안» 이어야 한다. 밖에 두면 땅만 위아래로 떠다녀서
              가만히 있어도 밑동과 젖은 자국이 지면에 잠겼다 나왔다 한다. */}
          <group ref={soloRef} position={selPos || [0, TOP_TARGET, 0]} quaternion={soloQuat} visible={false} onClick={(e) => { e.stopPropagation(); onSelect(null) }}>
          <group rotation={[0, faceAngle, 0]} position={[0, -soloBury, 0]}>{/* 흙받침을 통째로 묻음 — 안쪽 그룹이라 등장 애니의 scale 을 같이 탄다 */}
            {sel && (FACE_PARAMS[sel.sp][stageIdx(sel.stage)]
              ? <SoloDaisyFace template={tmplOf(sel.sp, stageIdx(sel.stage))} face={FACE_PARAMS[sel.sp][stageIdx(sel.stage)]} soil={selSp.soil[stageIdx(sel.stage)]} mood={mood} />
              : <Daisy template={tmplOf(sel.sp, stageIdx(sel.stage))} opaque soil={selSp.soil[stageIdx(sel.stage)]} />)}
          </group>
          {/* ⚠️ «묻는» 안쪽 그룹 밖에 둔다. 안에 두면 흙받침이 큰 새싹(0.355)에서 물방울이
              땅속에서 출발해 지면 아래로 사라진다. 밖에 두면 y=0 이 늘 지면이다. */}
            <FxParticles />
          </group>
        </Float>

        <OrbitControls ref={controlsRef} makeDefault enablePan={false} enableZoom
          minDistance={1.4} maxDistance={12 * spread} zoomSpeed={0.8} minPolarAngle={0.3} maxPolarAngle={1.6} target={[0, TOP_TARGET, 0]} />
        <Rig selectedPos={selPos} gardenRef={gardenRef} soloRef={soloRef} controlsRef={controlsRef} camGarden={camGarden} soloScale={soloScale} soloFrame={soloFrame} head={head} soloExt={selSp.ext[soloSi]} fillH={Array.isArray(selSp.fillH) ? selSp.fillH[soloSi] : selSp.fillH} />
      </Suspense>
    </Canvas>
  )
}

export default function DevGrowthLab() {
  const navigate = useNavigate()
  const [n, setN] = useState(50)
  const [selected, setSelected] = useState(null)
  const [moodOverride, setMoodOverride] = useState(null)   // dev: 상태별 표정 미리보기
  const [spKey, setSpKey] = useState('mix')
  const [gain, setGain] = useState({})               // {참여자 index: 얻은 포인트}
  const [streak, setStreak] = useState(0)           // 개발용 연속 — 실데이터에선 «프로그램 리듬 G» 로 판정한다
  const mult = multOf(streak)
  const parts0 = useMock(n)
  const selIdx = selected != null ? Math.min(selected, n - 1) : null
  const base = selIdx != null ? parts0[selIdx] : null
  const pt = base ? STAGE_PT[base.stage] + (gain[selIdx] || 0) : 0
  const stage = base ? stageOf(pt) : 0
  const pct = base ? pctOf(pt) : 0
  const sel = base ? { ...base, stage } : null
  const [sunSky, setSunSky] = useState(false)      // 햇빛일 때 하늘도 같이 따뜻해진다
  const [moodFx, setMoodFx] = useState(null)          // 물·햇빛 반응 표정(개발용 미리보기보다 우선)
  const moodTimers = useRef([])
  const mood = moodFx || moodOverride || (sel ? sel.mood : 'normal')
  const need = stage >= 4 ? 0 : STAGE_PT[stage + 1] - pt

  // 물 = 인증, 햇빛 = 그날 첫 방문. 단계가 오르면 레벨업 연출까지 이어 붙인다.
  const give = (kind) => {
    if (selIdx == null) return
    const add = kind === 'water' ? Math.round(PT_WATER * mult) : PT_SUN
    const up = stageOf(pt + add) > stage
    if (kind === 'water') setStreak((k) => k + 1)
    playFx(kind, kind === 'water' ? mult : 1)
    setGain((g) => ({ ...g, [selIdx]: (g[selIdx] || 0) + add }))
    // 표정: 물·햇빛 → 방긋, 레벨업 → 기쁨. 겹쳐 누르면 앞 타이머가 표정을 먼저 지워버리므로 매번 비운다.
    moodTimers.current.forEach(clearTimeout); moodTimers.current = []
    const T = (fn, ms) => moodTimers.current.push(window.setTimeout(fn, ms))
    setMoodFx('happy')
    if (kind === 'sun') { setSunSky(true); T(() => setSunSky(false), FX_DUR.sun * 1000) }
    if (up) {
      T(() => { playFx('level'); setMoodFx('joy') }, FX_DUR[kind] * 600)
      T(() => setMoodFx(null), FX_DUR[kind] * 600 + FX_DUR.level * 1000 + 400)
    } else {
      T(() => setMoodFx(null), FX_DUR[kind] * 1000 + 300)
    }
  }
  useEffect(() => () => moodTimers.current.forEach(clearTimeout), [])

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col" style={{ background: 'linear-gradient(180deg,#C7E9F4,#E9F6DD)' }}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-1" style={{ paddingTop: 'max(env(safe-area-inset-top),0.75rem)' }}>
        <button type="button" onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-white/70 flex items-center justify-center text-gray-700 shadow-sm"><ChevronLeft className="w-5 h-5" /></button>
        <div className="ml-auto flex items-center gap-1">
          {['mix', ...SPECIES_KEYS].map((k) => (
            <button key={k} type="button" onClick={() => { setSpKey(k); setSelected(null) }}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition ${spKey === k ? 'bg-emerald-500 text-white' : 'bg-white/70 text-gray-500'}`}>
              {k === 'mix' ? '섞기' : SPECIES[k].label}
            </button>
          ))}
          <span className="text-[10px] font-bold text-emerald-900/50 bg-white/50 px-2 py-1 rounded-full ml-1">/dev/growth</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {/* 햇빛 — 위에서 따뜻한 빛이 하늘에 번진다. 캔버스 안 광원만 바꾸면 배경이 그대로라 어색하다. */}
        <div className="absolute inset-0 pointer-events-none z-[5] transition-opacity duration-700"
          style={{ opacity: sunSky ? 1 : 0, background: 'radial-gradient(120% 70% at 50% -10%, rgba(255,214,120,0.55), rgba(255,236,175,0.18) 45%, transparent 70%)' }} />
        <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-emerald-700/50 text-sm">불러오는 중…</div>}>
          <Scene key={spKey} n={n} selected={selected} onSelect={setSelected} mood={mood} spKey={spKey} gain={gain} />
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
                <p className="text-[15px] font-extrabold text-gray-900">레벨 {stage + 1} · {STAGE_LABEL[stage]}</p>
                <p className="text-[15px] font-extrabold text-emerald-600">{stage >= 4 ? '완성' : pct + '%'}</p>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3"><div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-500" style={{ width: pct + '%' }} /></div>
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className="text-[11px] font-bold text-gray-400 mr-0.5">표정</span>
                {MOODS.map((m) => (
                  <button key={m} type="button" onClick={() => setMoodOverride(moodOverride === m ? null : m)}
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition ${mood === m ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {MOOD_LABEL[m]}
                  </button>
                ))}
                {moodOverride && <button type="button" onClick={() => setMoodOverride(null)} className="text-[11px] text-gray-400 underline ml-0.5">자동</button>}
              </div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-gray-400">{stage >= 4 ? '활짝 피었어요' : `다음 단계까지 ${need}점`}</p>
                {/* 개발용 계기판 — 실제 화면엔 숫자 대신 «물방울 양» 으로만 전달한다 */}
                <p className="text-[10px] font-bold text-gray-300">연속 {streak} · ×{mult.toFixed(1)}<button type="button" onClick={() => { setStreak(0); setGain({}) }} className="ml-1.5 underline">초기화</button></p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => give('water')} className="rounded-2xl bg-sky-50 px-3 py-2.5 text-left active:scale-95 transition"><p className="text-[13px] font-extrabold text-sky-700">💧 물 주기</p><p className="text-[11px] text-sky-600/70">오늘 인증하기 · +{Math.round(PT_WATER * mult)}</p></button>
                <button type="button" onClick={() => give('sun')} className="rounded-2xl bg-amber-50 px-3 py-2.5 text-left active:scale-95 transition"><p className="text-[13px] font-extrabold text-amber-700">☀️ 햇빛 쬐기</p><p className="text-[11px] text-amber-600/70">오늘 들르기 · +{PT_SUN}</p></button>
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
