import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  Group,
  Sprite,
  SpriteMaterial,
  Vector3,
} from 'three'
import type { Box3, Texture } from 'three'
import { smoothstep } from '../shared/utils'

export interface GlintsOptions {
  bounds: Box3
  count?: number
  color?: number | string
  size?: number
  speed?: number
  opacity?: number
}

export interface GlintsController {
  group: Group
  update: (elapsed: number) => void
  setEnabled?: (enabled: boolean) => void
  dispose: () => void
}

function createGlintTexture(): Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) { throw new Error('2D context not available') }

  const cx = size / 2
  const cy = size / 2

  // Soft glow center
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.15, 'rgba(255,255,255,0.6)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.1)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  // Star cross
  ctx.save()
  ctx.translate(cx, cy)
  ctx.beginPath()
  // Horizontal tapered rect
  ctx.moveTo(-size * 0.4, 0)
  ctx.bezierCurveTo(-size * 0.1, -1, size * 0.1, -1, size * 0.4, 0)
  ctx.bezierCurveTo(size * 0.1, 1, -size * 0.1, 1, -size * 0.4, 0)

  // Vertical tapered rect
  ctx.moveTo(0, -size * 0.4)
  ctx.bezierCurveTo(-1, -size * 0.1, -1, size * 0.1, 0, size * 0.4)
  ctx.bezierCurveTo(1, size * 0.1, 1, -size * 0.1, 0, -size * 0.4)

  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fill()
  ctx.restore()

  const tex = new CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function buildDefaultPaths(
  bounds: Box3,
): Array<{ a: Vector3, b: Vector3, c: Vector3 }> {
  const min = bounds.min
  const max = bounds.max
  const size = new Vector3()
  bounds.getSize(size)

  const frontZ = max.z - size.z * 0.05
  const topY = max.y - size.y * 0.1
  const midY = min.y + size.y * 0.55

  return [
    {
      a: new Vector3(min.x, topY, frontZ),
      b: new Vector3(0, topY, frontZ),
      c: new Vector3(max.x, topY, frontZ),
    },
    {
      a: new Vector3(max.x - size.x * 0.1, min.y + size.y * 0.15, frontZ),
      b: new Vector3(max.x - size.x * 0.1, midY, frontZ),
      c: new Vector3(max.x - size.x * 0.1, max.y - size.y * 0.15, frontZ),
    },
    {
      a: new Vector3(min.x + size.x * 0.15, min.y + size.y * 0.2, frontZ),
      b: new Vector3(0, midY, frontZ),
      c: new Vector3(max.x - size.x * 0.15, max.y - size.y * 0.2, frontZ),
    },
  ]
}

export interface AttachedGlintsOptions {
  targets: any[]
  opacity?: number
  size?: number
  color?: number
}

export function createAttachedGlints(
  options: AttachedGlintsOptions,
): GlintsController {
  const { targets, color = 0xFFFFFF, size = 0.18, opacity = 0.9 } = options

  const tex = createGlintTexture()
  // We don't use a main group for transform, but we can return one if needed for consistency.
  // Actually, SceneHeroDuo expects a .group to add.
  // But if we attach to targets, we don't need to add the group to the scene.
  // However, to keep API compatible, we return an empty group (or a dummy).
  const group = new Group()

  const glints = targets.map((target, i) => {
    const mat = new SpriteMaterial({
      map: tex,
      color: new Color(color),
      blending: AdditiveBlending,
      transparent: true,
      depthTest: false, // Always on top
      depthWrite: false,
      toneMapped: false, // Don't let exposure affect it
      opacity: 0,
    })
    const sprite = new Sprite(mat)
    sprite.renderOrder = 9999 // Draw last
    sprite.raycast = () => {} // Disable raycasting

    // Compensate for target scale so the glint is roughly 'size' in world units
    // (Assuming uniform scale for simplicity, taking max component)
    const pScale = target.scale
    const maxScale = Math.max(pScale.x, pScale.y, pScale.z) || 1
    const s = size / maxScale
    sprite.scale.set(s, s, s)

    // Push slightly forward/up to avoid z-fighting with the button face
    // We assume Z or Y is "out". A small offset usually helps.
    // Since we don't know the axis, 0,0,0 is safest if it renders on top.
    // Sprite renders on top of its center usually.
    sprite.position.set(0, 0, 0)

    // Attach directly to target
    target.add(sprite)

    return {
      sprite,
      target,
      baseScale: s,
      phase: Math.random() * Math.PI * 2,
      speed: 1.5 + Math.random(),
    }
  })

  let enabled = true

  const update = (elapsed: number) => {
    if (!enabled) {
      for (const g of glints) {
        g.sprite.material.opacity = 0
      }
      return
    }
    for (const g of glints) {
      if (g.target.userData?.hideGlint) {
        g.sprite.material.opacity = 0
        continue
      }

      const t = elapsed * g.speed + g.phase

      // "Blink" / Flash effect instead of smooth pulse
      // Using power of sine makes the peak sharper and the trough wider (mostly off)
      const sine = Math.sin(t * 3.0) // Faster frequency
      const pulse = ((sine + 1) * 0.5) ** 8.0 // Very sharp peaks

      // Random jitter for "broken/neon" feel? Optional.
      // For now, just the sharp flash.

      g.sprite.material.opacity = (0.2 + 0.8 * pulse) * opacity

      const s = g.baseScale * (0.8 + 0.4 * pulse)
      g.sprite.scale.set(s, s, s)
    }
  }

  const dispose = () => {
    tex.dispose()
    for (const g of glints) {
      g.sprite.removeFromParent()
      g.sprite.material.dispose()
    }
  }

  return {
    group,
    update,
    setEnabled: (v: boolean) => {
      enabled = v
      if (!enabled) {
        for (const g of glints) { g.sprite.material.opacity = 0 }
      }
    },
    dispose,
  }
}

export function createGlints(options: GlintsOptions): GlintsController {
  const {
    bounds,
    count = 3,
    color = 0xFFFFFF,
    size = 0.18,
    speed = 0.24,
    opacity = 0.9,
  } = options

  const tex = createGlintTexture()
  const group = new Group()
  const paths = buildDefaultPaths(bounds)

  const glints = Array.from({ length: Math.max(1, count) }).map((_, i) => {
    const mat = new SpriteMaterial({
      map: tex,
      color: new Color(color),
      blending: AdditiveBlending,
      transparent: true,
      depthTest: false, // Always on top
      depthWrite: false,
      toneMapped: false, // Don't let exposure affect it
      opacity: 0,
    })
    const sprite = new Sprite(mat)
    sprite.renderOrder = 9999 // Draw last
    sprite.raycast = () => {} // Disable raycasting
    sprite.scale.setScalar(size)

    const p = paths[i % paths.length]
    const phase = Math.random()
    const localSpeed = speed * (0.85 + Math.random() * 0.35)

    group.add(sprite)
    return { sprite, p, phase, localSpeed }
  })

  const tmp = new Vector3()

  let enabled = true

  const update = (elapsed: number) => {
    if (!enabled) {
      for (const g of glints) { g.sprite.material.opacity = 0 }
      return
    }
    for (const g of glints) {
      const t = (elapsed * g.localSpeed + g.phase) % 1
      const visible = smoothstep(0.0, 0.08, t) * (1 - smoothstep(0.7, 1.0, t))
      const t2 = smoothstep(0.02, 0.98, t)

      tmp
        .copy(g.p.a)
        .lerp(g.p.b, t2)
        .lerp(g.p.c, t2 * t2)
      g.sprite.position.copy(tmp)
      g.sprite.material.opacity = visible * opacity
      const s = size * (0.75 + 0.75 * visible)
      g.sprite.scale.set(s, s, s)
    }
  }

  const dispose = () => {
    tex.dispose()
    for (const g of glints) { g.sprite.material.dispose() }
  }

  return {
    group,
    update,
    setEnabled: (v: boolean) => {
      enabled = v
      if (!enabled) {
        for (const g of glints) { g.sprite.material.opacity = 0 }
      }
    },
    dispose,
  }
}
