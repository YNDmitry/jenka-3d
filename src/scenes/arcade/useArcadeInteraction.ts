import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  type Ref,
  shallowRef,
  watch,
} from 'vue'
import { useLoop } from '@tresjs/core'
import { gsap } from 'gsap'
import { type Object3D, type PerspectiveCamera, Vector3 } from 'three'
import { CONSTANTS } from './config'
import type { DeviceClass } from '../../shared/types'

export function useArcadeInteraction(
  active: Ref<boolean>,
  device: Ref<DeviceClass>,
  reducedMotion: Ref<boolean>,
  container: HTMLElement | undefined,
  cameraRef: Ref<PerspectiveCamera | null>,
  modelA: Ref<Object3D | null>,
  modelB: Ref<Object3D | null>,
  invalidate: () => void,
  onInternalSwap: () => void,
  onModelClick?: () => void,
) {
  const isSwapped = ref(false)
  const mouseX = ref(0)
  const mouseY = ref(0)
  const mouseXSmoothed = ref(0)
  const camParallaxOffset = shallowRef({ x: 0, y: 0, z: 0 })
  const lightIntensity = ref(4.0)

  const hoverState = reactive({ A: 0, B: 0 })

  const getConfig = () => ({
    front:
      CONSTANTS.states.front[device.value] || CONSTANTS.states.front.desktop,
    back: CONSTANTS.states.back[device.value] || CONSTANTS.states.back.desktop,
  })

  const initialCfg = getConfig()

  const stateA = reactive({
    pos: new Vector3(...(initialCfg.front.pos as [number, number, number])),
    rot: new Vector3(...(initialCfg.front.rot as [number, number, number])),
    scale: new Vector3(...(initialCfg.front.scale as [number, number, number])),
    influence: { value: 1 },
  })

  const stateB = reactive({
    pos: new Vector3(...(initialCfg.back.pos as [number, number, number])),
    rot: new Vector3(...(initialCfg.back.rot as [number, number, number])),
    scale: new Vector3(...(initialCfg.back.scale as [number, number, number])),
    influence: { value: 0 },
  })

  // Watch device change to update positions responsively
  watch(device, () => {
    // Only update if not currently animating a swap
    if (gsap.isTweening(stateA.pos)) {
      return
    }

    const cfg = getConfig()
    const targetA = !isSwapped.value ? cfg.front : cfg.back
    const targetB = !isSwapped.value ? cfg.back : cfg.front

    stateA.pos.set(...(targetA.pos as [number, number, number]))
    stateA.rot.set(...(targetA.rot as [number, number, number]))
    stateA.scale.set(...(targetA.scale as [number, number, number]))

    stateB.pos.set(...(targetB.pos as [number, number, number]))
    stateB.rot.set(...(targetB.rot as [number, number, number]))
    stateB.scale.set(...(targetB.scale as [number, number, number]))

    if (invalidate) {
      invalidate()
    }
  })

  const offsetsA = reactive({
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: { x: 0, y: 0, z: 0 },
  })
  const offsetsB = reactive({
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
    scale: { x: 0, y: 0, z: 0 },
  })

  const cameraPosition = computed(() => {
    const [x, y, z] = CONSTANTS.layout.camPos
    return [
      x + camParallaxOffset.value.x,
      y + camParallaxOffset.value.y,
      z + camParallaxOffset.value.z,
    ] as [number, number, number]
  })

  function swap() {
    if (gsap.isTweening(stateA.pos)) {
      return
    }

    if (onInternalSwap) {
      onInternalSwap()
    }

    isSwapped.value = !isSwapped.value

    // Targets
    const { front, back } = getConfig()

    const targetA = isSwapped.value
      ? { pos: back.pos, rot: back.rot, scale: back.scale, infl: 0 }
      : { pos: front.pos, rot: front.rot, scale: front.scale, infl: 1 }

    const targetB = isSwapped.value
      ? { pos: front.pos, rot: front.rot, scale: front.scale, infl: 1 }
      : { pos: back.pos, rot: back.rot, scale: back.scale, infl: 0 }

    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      onUpdate: () => {
        if (invalidate) {
          invalidate()
        }
      },
    })
    const dur = CONSTANTS.animation.swapDuration

    tl.to(
      [stateA.pos, stateB.pos],
      {
        x: (i: number) => (i === 0 ? targetA.pos[0] : targetB.pos[0]),
        y: (i: number) => (i === 0 ? targetA.pos[1] : targetB.pos[1]),
        z: (i: number) => (i === 0 ? targetA.pos[2] : targetB.pos[2]),
        duration: dur,
        ease: 'back.inOut(0.6)',
      },
      0,
    )

    tl.to(
      [stateA.rot, stateB.rot],
      {
        x: (i: number) => (i === 0 ? targetA.rot[0] : targetB.rot[0]),
        y: (i: number) => (i === 0 ? targetA.rot[1] : targetB.rot[1]),
        z: (i: number) => (i === 0 ? targetA.rot[2] : targetB.rot[2]),
        duration: dur,
        ease: 'back.inOut(0.6)',
      },
      0,
    )

    tl.to(
      [stateA.scale, stateB.scale],
      {
        x: (i: number) => (i === 0 ? targetA.scale[0] : targetB.scale[0]),
        y: (i: number) => (i === 0 ? targetA.scale[1] : targetB.scale[1]),
        z: (i: number) => (i === 0 ? targetA.scale[2] : targetB.scale[2]),
        duration: dur,
      },
      0,
    )

    tl.to(
      [stateA.influence, stateB.influence],
      {
        value: (i: number) => (i === 0 ? targetA.infl : targetB.infl),
        duration: dur,
      },
      0,
    )

    // --- 2. The "Juice" ---
    const isMovingToFront = (i: number) =>
      i === 0 ? !isSwapped.value : isSwapped.value

    // Lift & Tilt
    tl.to(
      [offsetsA.pos, offsetsB.pos],
      { y: 0.4, duration: 0.3, ease: 'power2.out', yoyo: true, repeat: 1 },
      0,
    )
    tl.to(
      [offsetsA.rot, offsetsB.rot],
      { x: -0.15, duration: 0.2, ease: 'power2.in', yoyo: true, repeat: 1 },
      0,
    )

    // Drift
    tl.to(
      [offsetsA.rot, offsetsB.rot],
      {
        z: (i: number) => (isMovingToFront(i) ? -0.4 : 0.4),
        duration: dur * 0.6,
        ease: 'power2.inOut',
        yoyo: true,
        repeat: 1,
      },
      0.1,
    )

    // Impact
    tl.to(
      [offsetsA.pos, offsetsB.pos],
      { y: 0, duration: 0.15, ease: 'expo.in' },
      dur - 0.15,
    )
    tl.to(
      [offsetsA.scale, offsetsB.scale],
      { y: -0.05, x: 0.02, z: 0.02, duration: 0.05, ease: 'power4.out' },
      dur - 0.05,
    )
    tl.to(
      [offsetsA.scale, offsetsB.scale],
      { y: 0, x: 0, z: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' },
      dur,
    )

    // Camera & Light FX
    gsap.to(camParallaxOffset.value, {
      z: 1.5,
      duration: dur * 0.6,
      ease: 'power2.inOut',
    })
    gsap.to(camParallaxOffset.value, {
      z: -0.2,
      duration: 0.1,
      delay: dur - 0.15,
      ease: 'expo.in',
      onComplete: () => {
        gsap.to(camParallaxOffset.value, {
          z: 0,
          duration: 0.5,
          ease: 'elastic.out(1, 0.5)',
        })
      },
    })

    const flashDelay = dur - 0.1
    gsap.to(lightIntensity, {
      value: 20.0,
      duration: 0.05,
      delay: flashDelay,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        gsap.to(lightIntensity, { value: 4.0, duration: 0.3 })
      },
    })

    gsap.to(hoverState, { A: 0, B: 0, duration: 0.2 })
  }

  function handleHover(model: 'A' | 'B', over: boolean) {
    if (device.value !== 'desktop') {
      return
    }
    const isBack =
      (model === 'A' && isSwapped.value) || (model === 'B' && !isSwapped.value)
    // console.log('Hover:', model, over, 'isBack:', isBack)
    if (over) {
      document.body.style.cursor = isBack ? 'pointer' : 'auto'
      if (isBack) {
        gsap.to(hoverState, {
          [model]: 0.25,
          duration: 0.5,
          ease: 'back.out(1.2)',
          overwrite: true,
          onUpdate: () => {
            if (invalidate) {
              invalidate()
            }
          },
        })
      }
    } else {
      document.body.style.cursor = 'auto'
      gsap.to(hoverState, {
        [model]: 0,
        duration: 0.4,
        ease: 'power3.out',
        overwrite: true,
        onUpdate: () => {
          if (invalidate) {
            invalidate()
          }
        },
      })
    }
  }

  function handleClick(e: any, model: 'A' | 'B') {
    if (gsap.isTweening(stateA.pos)) {
      return
    }
    const isFront =
      (model === 'A' && !isSwapped.value) || (model === 'B' && isSwapped.value)
    if (isFront) {
      return
    }
    e.stopPropagation()

    if (onModelClick) {
      onModelClick()
      // We continue to swap() to ensure immediate local feedback.
      // The parent component handles debouncing if the event triggers a loopback.
    }

    swap()
  }

  function onMouseMove(e: MouseEvent) {
    if (!active.value || reducedMotion.value || device.value !== 'desktop') {
      return
    }
    const x = (e.clientX / window.innerWidth) * 2 - 1
    const y = -(e.clientY / window.innerHeight) * 2 + 1
    mouseX.value = x
    mouseY.value = y
    if (invalidate) {
      invalidate()
    }
  }

  function onMouseLeave() {
    mouseX.value = 0
    mouseY.value = 0
    if (invalidate) {
      invalidate()
    }
  }

  onMounted(() => {
    if (container) {
      container.addEventListener('mousemove', onMouseMove)
      container.addEventListener('mouseleave', onMouseLeave)
    }
  })

  onUnmounted(() => {
    if (container) {
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
    }
  })

  const { onBeforeRender } = useLoop()

  onBeforeRender(({ elapsed }) => {
    if (!active.value) {
      return
    }

    const diff = mouseX.value - mouseXSmoothed.value
    if (Math.abs(diff) > 0.005) {
      mouseXSmoothed.value += diff * 0.08
      if (invalidate) {
        invalidate()
      }
    }

    // Floating Animation (Cinematic Idle)
    let floatY = 0
    let floatRot = 0
    if (!reducedMotion.value) {
      // Period ~4s
      floatY = Math.sin(elapsed * 1.5) * 0.08
      // Subtle rotation drift
      floatRot = Math.cos(elapsed * 0.5) * 0.02
    }

    if (modelA.value) {
      const s = stateA
      const o = offsetsA
      const sway =
        mouseXSmoothed.value * CONSTANTS.animation.rotRange * s.influence.value
      // Apply float only if this model is "in front" (influence > 0.5)
      const fY = s.influence.value > 0.5 ? floatY : 0
      const fR = s.influence.value > 0.5 ? floatRot : 0

      modelA.value.position.set(s.pos.x, s.pos.y + o.pos.y + fY, s.pos.z)
      modelA.value.rotation.set(
        s.rot.x + o.rot.x,
        s.rot.y - sway + o.rot.y + fR,
        s.rot.z + o.rot.z,
      )

      const signA = s.scale.x < 0 ? -1 : 1
      modelA.value.scale.set(
        s.scale.x + (o.scale.x + hoverState.A) * signA,
        s.scale.y + o.scale.y + hoverState.A,
        s.scale.z + o.scale.z + hoverState.A,
      )
    }

    if (modelB.value) {
      const s = stateB
      const o = offsetsB
      const sway =
        mouseXSmoothed.value * CONSTANTS.animation.rotRange * s.influence.value
      // Apply float only if this model is "in front" (influence > 0.5)
      const fY = s.influence.value > 0.5 ? floatY : 0
      const fR = s.influence.value > 0.5 ? floatRot : 0

      modelB.value.position.set(s.pos.x, s.pos.y + o.pos.y + fY, s.pos.z)
      modelB.value.rotation.set(
        s.rot.x + o.rot.x,
        s.rot.y - sway + o.rot.y + fR,
        s.rot.z + o.rot.z,
      )

      const signB = s.scale.x < 0 ? -1 : 1
      modelB.value.scale.set(
        s.scale.x + (o.scale.x + hoverState.B) * signB,
        s.scale.y + o.scale.y + hoverState.B,
        s.scale.z + o.scale.z + hoverState.B,
      )
    }
  })

  return {
    cameraPosition,
    lightIntensity,
    swap,
    handleClick,
    handleHover,
  }
}
