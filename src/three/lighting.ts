import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
} from 'three'
import type { Light, Object3D } from 'three'

export function collectLights(root: Object3D): Light[] {
  const lights: Light[] = []
  root.traverse((obj) => {
    const anyObj = obj as any
    if (anyObj?.isLight) {
      lights.push(anyObj as Light)
    }
  })
  return lights
}

export function hasLights(root: Object3D): boolean {
  return collectLights(root).length > 0
}

export function createFallbackLightRig(intensityMultiplier = 1): Group {
  const rig = new Group()

  const key = new DirectionalLight(
    new Color('#ffffff'),
    2.0 * intensityMultiplier,
  )
  key.position.set(3.5, 5.5, 6.5)

  const fill = new DirectionalLight(
    new Color('#bcd7ff'),
    0.8 * intensityMultiplier,
  )
  fill.position.set(-6.5, 2.5, 4.0)

  const rim = new DirectionalLight(
    new Color('#ffffff'),
    1.5 * intensityMultiplier,
  )
  rim.position.set(0.0, 4.0, -6.0)

  const hemi = new HemisphereLight(
    new Color('#dbe9ff'),
    new Color('#080a10'),
    0.2 * intensityMultiplier,
  )

  const ambient = new AmbientLight(
    new Color('#ffffff'),
    0.1 * intensityMultiplier,
  )

  rig.add(key, fill, rim, hemi, ambient)
  return rig
}
