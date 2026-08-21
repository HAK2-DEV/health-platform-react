import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'

// 공용 섬 로더 — public/models/island.glb. 인스턴스마다 clone(개인 섬·군도 미니 섬 재사용).
export function IslandModel(props) {
  const { scene } = useGLTF('/models/island.glb')
  const model = useMemo(() => {
    const s = scene.clone(true)
    s.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
    return s
  }, [scene])
  return <primitive object={model} {...props} />
}

useGLTF.preload('/models/island.glb')
