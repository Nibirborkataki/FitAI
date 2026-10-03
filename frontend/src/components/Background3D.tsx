import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import type { Theme } from '../lib/theme'

/*
 * Ambient "pulse field": a GPU-displaced terrain of points with rolling
 * waves and a heartbeat ripple, plus slow floating wireframe shapes.
 * Sits behind every page (fixed, pointer-events: none).
 */

const PALETTES: Record<Theme, { a: string; b: string; opacity: number; lines: number }> = {
  dark: { a: '#c8f65d', b: '#8b7cff', opacity: 0.85, lines: 0.12 },
  light: { a: '#8fc21a', b: '#8b7cff', opacity: 0.55, lines: 0.16 },
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  varying float vHeight;
  varying float vDist;
  varying float vRing;
  varying float vDepth;

  void main() {
    vec3 p = position;
    float d = length(p.xz);

    float wave =
        sin(p.x * 0.32 + uTime * 0.7) * 0.45
      + sin(p.z * 0.45 + uTime * 0.55) * 0.35
      + sin((p.x + p.z) * 0.18 + uTime * 0.35) * 0.6;

    // heartbeat: a ring expanding from the centre every ~6 s
    float radius = mod(uTime * 9.0, 54.0);
    float ring = exp(-pow(d - radius, 2.0) * 0.06) * 1.3 * (1.0 - radius / 54.0);

    p.y += wave + ring;

    vHeight = clamp((p.y + 1.4) / 3.2, 0.0, 1.0);
    vDist = d;
    vRing = ring;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    // capped so points right in front of the camera don't balloon
    gl_PointSize = min(uSize * (1.0 + ring * 0.4) * (28.0 / max(vDepth, 1.0)), 7.0);
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  varying float vHeight;
  varying float vDist;
  varying float vRing;
  varying float vDepth;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float soft = smoothstep(0.5, 0.05, r);
    float fade = smoothstep(52.0, 12.0, vDist) * smoothstep(6.0, 16.0, vDepth);
    vec3 color = mix(uColorB, uColorA, vHeight);
    gl_FragColor = vec4(color, soft * fade * uOpacity * (0.6 + vRing * 0.3));
  }
`

// Window-wide pointer + scroll, read inside the render loop
const input = { x: 0, y: 0, scroll: 0 }
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    (e) => {
      input.x = (e.clientX / window.innerWidth) * 2 - 1
      input.y = (e.clientY / window.innerHeight) * 2 - 1
    },
    { passive: true },
  )
  window.addEventListener('scroll', () => (input.scroll = window.scrollY), { passive: true })
}

function PulseField({ theme, animate }: { theme: Theme; animate: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const cols = 150
    const rows = 90
    const width = 120
    const depth = 80
    const positions = new Float32Array(cols * rows * 3)
    const stepX = width / (cols - 1)
    const stepZ = depth / (rows - 1)
    // deterministic jitter so grid columns never line up into bright streaks
    const jitter = (n: number) => (Math.sin(n * 12.9898) * 43758.5453) % 1
    let i = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const n = r * cols + c
        positions[i++] = (c / (cols - 1) - 0.5) * width + jitter(n) * stepX * 0.45
        positions[i++] = 0
        positions[i++] = (r / (rows - 1) - 0.5) * depth + jitter(n + 7.31) * stepZ * 0.45
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 4.2 },
      uColorA: { value: new THREE.Color() },
      uColorB: { value: new THREE.Color() },
      uOpacity: { value: 0.6 },
    }),
    [],
  )

  // Theme colours (tweened so a theme switch doesn't snap)
  const target = useRef({ a: new THREE.Color(), b: new THREE.Color(), opacity: 0.6 })
  useEffect(() => {
    const palette = PALETTES[theme]
    target.current.a.set(palette.a)
    target.current.b.set(palette.b)
    target.current.opacity = palette.opacity
    if (uniforms.uColorA.value.getHex() === 0) {
      uniforms.uColorA.value.copy(target.current.a)
      uniforms.uColorB.value.copy(target.current.b)
    }
  }, [theme, uniforms])

  useFrame((_, delta) => {
    if (animate) uniforms.uTime.value += Math.min(delta, 0.05)
    uniforms.uColorA.value.lerp(target.current.a, 0.08)
    uniforms.uColorB.value.lerp(target.current.b, 0.08)
    uniforms.uOpacity.value += (target.current.opacity - uniforms.uOpacity.value) * 0.08
  })

  return (
    <points geometry={geometry} position={[0, -5, -16]}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
      />
    </points>
  )
}

// side: -1 left / 1 right. x is computed from the live viewport so the
// shapes always hug the screen edges and never sit behind headlines.
const SHAPES = [
  { kind: 'ico', side: -1, y: 9, z: -22, scale: 2.6, speed: 0.12 },
  { kind: 'torus', side: 1, y: 11, z: -24, scale: 2.4, speed: 0.09 },
  { kind: 'octa', side: 1, y: -5, z: -10, scale: 1.2, speed: 0.16 },
  { kind: 'ico', side: -1, y: -7, z: -8, scale: 0.9, speed: 0.2 },
] as const

function FloatingShapes({ theme, animate }: { theme: Theme; animate: boolean }) {
  const group = useRef<THREE.Group>(null)
  const palette = PALETTES[theme]

  const geometries = useMemo(
    () => ({
      ico: new THREE.IcosahedronGeometry(1, 1),
      torus: new THREE.TorusGeometry(1, 0.32, 10, 36),
      octa: new THREE.OctahedronGeometry(1, 0),
    }),
    [],
  )

  const target = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock, camera, viewport }) => {
    if (!group.current) return
    const t = animate ? clock.elapsedTime : 0
    group.current.children.forEach((mesh, i) => {
      const s = SHAPES[i]
      const halfWidth = viewport.getCurrentViewport(camera, target.set(0, 0, s.z)).width / 2
      mesh.position.set(s.side * (halfWidth - s.scale * 1.4), s.y + Math.sin(t * 0.5 + i) * 0.6, s.z)
      // scrolling spins them a little faster
      mesh.rotation.x = t * s.speed + input.scroll * 0.0008
      mesh.rotation.y = t * s.speed * 1.3
    })
  })

  return (
    <group ref={group}>
      {SHAPES.map((s, i) => (
        <mesh key={i} geometry={geometries[s.kind]} scale={s.scale}>
          <meshBasicMaterial
            color={i % 2 ? palette.b : palette.a}
            wireframe
            transparent
            opacity={palette.lines}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

function CameraRig({ animate }: { animate: boolean }) {
  const { camera } = useThree()
  const look = useMemo(() => new THREE.Vector3(0, -2, -14), [])

  useFrame(() => {
    if (!animate) return
    // parallax with the pointer, tilt down slowly as the page scrolls
    const scrollTilt = Math.min(input.scroll / 2500, 1)
    camera.position.x += (input.x * 2.2 - camera.position.x) * 0.03
    camera.position.y += (3 - input.y * 1.2 + scrollTilt * 3 - camera.position.y) * 0.03
    camera.lookAt(look)
  })

  return null
}

export default function Background3D({ theme }: { theme: Theme }) {
  const reduce = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  return (
    <div className="bg-3d" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        frameloop={reduce ? 'demand' : 'always'}
        camera={{ position: [0, 3, 18], fov: 55, near: 0.1, far: 200 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      >
        <CameraRig animate={!reduce} />
        <PulseField theme={theme} animate={!reduce} />
        <FloatingShapes theme={theme} animate={!reduce} />
      </Canvas>
    </div>
  )
}
