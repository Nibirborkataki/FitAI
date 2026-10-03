import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, useAnimations, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

/*
 * Animated athlete mascot. Model: "Man" from the Animated Men Pack by
 * Quaternius (CC0), via poly.pizza. All clips are in-place.
 */

const MODEL_URL = '/models/athlete.glb'
const CLIP = (name: string) => `HumanArmature|Man_${name}`

export type AthleteLoop = 'Idle' | 'Run' | 'Walk' | 'Punch'
export type AthleteGesture = 'Jump' | 'RunningJump' | 'Clapping' | 'Punch' | 'Standing'

export interface AthleteProps {
  loop?: AthleteLoop
  /** Change `key` to replay the same gesture. */
  gesture?: { name: AthleteGesture; key: number } | null
  className?: string
  /** Camera distance multiplier (bigger = smaller athlete). */
  zoom?: number
}

// Training kit in the FitAI palette
const KIT: Record<string, string> = {
  Shirt: '#c8f65d',
  Pants: '#1a202b',
  Socks: '#f1f4f2',
  Hair: '#16110d',
}

// Shared pointer position (window-wide so the athlete looks at the cursor anywhere)
const pointer = { x: 0, y: 0 }
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1
    },
    { passive: true },
  )
}

function AthleteModel({ loop = 'Idle', gesture }: Pick<AthleteProps, 'loop' | 'gesture'>) {
  const group = useRef<THREE.Group>(null)
  const { scene, animations } = useGLTF(MODEL_URL)

  const model = useMemo(() => {
    const cloned = cloneSkinned(scene)
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      const recoloured = materials.map((m) => {
        const material = (m as THREE.MeshStandardMaterial).clone()
        const color = KIT[material.name]
        if (color) material.color = new THREE.Color(color)
        material.roughness = material.name === 'Shirt' ? 0.45 : 0.7
        material.metalness = 0
        return material
      })
      mesh.material = Array.isArray(mesh.material) ? recoloured : recoloured[0]
      mesh.castShadow = true
      mesh.frustumCulled = false
    })
    return cloned
  }, [scene])

  const { actions, mixer } = useAnimations(animations, group)

  // Looping base animation
  useEffect(() => {
    const action = actions[CLIP(loop)]
    if (!action) return
    action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.35).play()
    return () => {
      action.fadeOut(0.35)
    }
  }, [actions, loop])

  // One-shot gestures that blend back into the loop
  useEffect(() => {
    if (!gesture) return
    const action = actions[CLIP(gesture.name)]
    const base = actions[CLIP(loop)]
    if (!action) return

    base?.fadeOut(0.2)
    action.reset().setLoop(THREE.LoopRepeat, gesture.name === 'Clapping' ? 2 : 1)
    action.clampWhenFinished = true
    action.fadeIn(0.2).play()

    const onFinished = (event: { action: THREE.AnimationAction }) => {
      if (event.action !== action) return
      action.fadeOut(0.3)
      base?.reset().fadeIn(0.3).play()
    }
    mixer.addEventListener('finished', onFinished)
    return () => mixer.removeEventListener('finished', onFinished)
  }, [actions, mixer, gesture, loop])

  useFrame((state) => {
    if (!group.current) return
    const t = state.clock.elapsedTime
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, pointer.x * 0.6, 0.06)
    // gentle hover so he never looks frozen between clips
    group.current.position.y = -2.45 + Math.sin(t * 1.4) * 0.03
  })

  return (
    <group ref={group} position={[0, -2.45, 0]}>
      <primitive object={model} />
    </group>
  )
}

export default function Athlete({ loop, gesture, className, zoom = 1 }: AthleteProps) {
  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0.3, 14 * zoom], fov: 30 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <hemisphereLight args={['#ffffff', '#1a1f2a', 1.9]} />
        <directionalLight position={[4, 6, 5]} intensity={2.6} />
        <pointLight position={[-4, 2, -3]} intensity={36} color="#8b7cff" />
        <pointLight position={[4, -1, 3]} intensity={10} color="#c8f65d" />
        <Suspense fallback={null}>
          <AthleteModel loop={loop} gesture={gesture} />
          <ContactShadows position={[0, -2.45, 0]} opacity={0.5} scale={8} blur={2.6} far={3} color="#000000" />
        </Suspense>
      </Canvas>
    </div>
  )
}

useGLTF.preload(MODEL_URL)
