import { ref, type Ref } from 'vue'
import gsap from 'gsap'
import { type Object3D, Vector3 } from 'three'
import type { CompareMode, DeviceClass } from '../../shared/types'
import { CONSTANTS } from './config'

export function useCompareLayout(
  modelA: Ref<Object3D | null>,
  modelB: Ref<Object3D | null>,
  device: Ref<DeviceClass>,
) {
  const layout = ref({
    camPos: [0, 0, CONSTANTS.layout.cameraZ[device.value] || CONSTANTS.layout.cameraZ.desktop] as [number, number, number],
    lookAt: [0, 0, 0] as [number, number, number],
    stagePos: (CONSTANTS.layout.stagePos[device.value] || CONSTANTS.layout.stagePos.desktop) as [number, number, number],
    fov: CONSTANTS.layout.baseFov,
    scale: 1.0,
  })

  function getGridConfig(deviceType: DeviceClass) {
    let cfg = CONSTANTS.grid.desktop
    if (deviceType === 'mobile') cfg = CONSTANTS.grid.mobile
    if (deviceType === 'tablet') cfg = CONSTANTS.grid.tablet

    return {
      a: {
        pos: new Vector3(...(cfg.a.pos as [number, number, number])),
        scale: cfg.a.scale,
        rot: cfg.a.rot as [number, number, number],
      },
      b: {
        pos: new Vector3(...(cfg.b.pos as [number, number, number])),
        scale: cfg.b.scale,
        rot: cfg.b.rot as [number, number, number],
      },
      camZ: CONSTANTS.layout.cameraZ[deviceType] || CONSTANTS.layout.cameraZ.desktop,
      stagePos: CONSTANTS.layout.stagePos[deviceType] || CONSTANTS.layout.stagePos.desktop,
    }
  }

  function applyGridLayout(animate = false) {
    if (!modelA.value || !modelB.value) {
      return
    }

    const cfg = getGridConfig(device.value)

    gsap.to(layout.value, {
      duration: animate ? 0.8 : 0,
      fov: CONSTANTS.layout.baseFov,
      ease: 'power2.inOut',
      onUpdate: () => {
        layout.value.camPos[2] = cfg.camZ
        // Cast to tuple to satisfy type checker
        layout.value.stagePos = cfg.stagePos as [number, number, number]
      },
    })

    const t = animate ? 0.8 : 0
    gsap.to(modelA.value.position, {
      ...cfg.a.pos,
      duration: t,
      ease: 'power2.inOut',
    })
    gsap.to(modelA.value.scale, {
      x: cfg.a.scale,
      y: cfg.a.scale,
      z: cfg.a.scale,
      duration: t,
    })

    gsap.to(modelB.value.position, {
      ...cfg.b.pos,
      duration: t,
      ease: 'power2.inOut',
    })
    gsap.to(modelB.value.scale, {
      x: cfg.b.scale,
      y: cfg.b.scale,
      z: cfg.b.scale,
      duration: t,
    })

    gsap.to(modelA.value.rotation, {
      x: cfg.a.rot[0],
      y: cfg.a.rot[1],
      z: cfg.a.rot[2],
      duration: t,
      ease: 'power2.inOut',
      overwrite: true,
    })
    gsap.to(modelB.value.rotation, {
      x: cfg.b.rot[0],
      y: cfg.b.rot[1],
      z: cfg.b.rot[2],
      duration: t,
      ease: 'power2.inOut',
      overwrite: true,
    })

    // Fade in both for grid
    fadeObject(modelA.value, 1, t)
    fadeObject(modelB.value, 1, t)
  }

  function applyFocusLayout(focus: 'a' | 'b', animate: boolean) {
    if (!modelA.value || !modelB.value) {
      return
    }

    const isA = focus === 'a'
    const target = isA ? modelA.value : modelB.value
    const bg = isA ? modelB.value : modelA.value

    const dur = animate ? 0.8 : 0
    const f = CONSTANTS.focus[device.value] || CONSTANTS.focus.desktop

    // Fade in target, Fade out background
    fadeObject(target, 1, dur)
    fadeObject(bg, 0, dur)

    gsap.to(target.position, {
      x: f.target.pos[0],
      y: f.target.pos[1],
      z: f.target.pos[2],
      duration: dur,
      ease: 'back.out(0.8)',
    })
    gsap.to(target.scale, {
      x: f.target.scale,
      y: f.target.scale,
      z: f.target.scale,
      duration: dur,
    })

    gsap.to(bg.position, {
      x: f.background.pos[0],
      y: f.background.pos[1],
      z: f.background.pos[2],
      duration: dur,
      ease: 'power2.inOut',
    })
    gsap.to(bg.scale, {
      x: f.background.scale,
      y: f.background.scale,
      z: f.background.scale,
      duration: dur,
    })

    gsap.to(target.rotation, {
      x: f.target.rot[0],
      y: f.target.rot[1],
      z: f.target.rot[2],
      duration: dur,
      ease: 'power2.inOut',
      overwrite: true,
    })
    gsap.to(bg.rotation, {
      x: f.background.rot[0],
      y: f.background.rot[1],
      z: f.background.rot[2],
      duration: dur,
      ease: 'power2.inOut',
      overwrite: true,
    })
  }

  function fadeObject(obj: Object3D, targetOpacity: number, duration: number) {
    // If fading in, make visible immediately
    if (targetOpacity > 0) obj.visible = true

    const mats: any[] = []
    obj.traverse((child: any) => {
      if (child.isMesh && child.material) {
        const m = child.material
        m.transparent = true // Always ensure transparency mode for transition
        m.needsUpdate = true
        mats.push(m)
      }
    })

    if (mats.length === 0) return

    // Kill any existing opacity tweens on these materials to prevent conflicts
    gsap.killTweensOf(mats)

    // We animate the materials directly now for better reliability than a proxy
    gsap.to(mats, {
      opacity: targetOpacity,
      duration: duration,
      ease: 'power2.inOut',
      overwrite: true, // IMPORTANT: Ensure this tween replaces any prior fades
      onStart: () => {
        if (targetOpacity > 0) obj.visible = true
      },
      onComplete: () => {
        if (targetOpacity === 0) {
          obj.visible = false
        } else if (targetOpacity === 1) {
           // Restore opacity performance and correct rendering for solid objects
           mats.forEach(m => {
             m.transparent = false
             m.needsUpdate = true
           })
        }
      }
    })
  }

  function applyMode(next: CompareMode, animate: boolean) {
    if (next === 'grid') {
      applyGridLayout(animate)
    } else if (next === 'focus-a') {
      applyFocusLayout('a', animate)
    } else if (next === 'focus-b') {
      applyFocusLayout('b', animate)
    }
  }

  return {
    layout,
    applyMode,
    applyGridLayout,
  }
}
