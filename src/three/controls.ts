import { onUnmounted, ref, watch } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import type { Object3D } from 'three'
import { damp } from '../shared/utils'
import { useLoop } from '@tresjs/core'

export interface DragRotateOptions {
  enabled: Ref<boolean>
  active: Ref<boolean>
  target: ShallowRef<Object3D | null>
  axis: 'y' | 'xy'
  sensitivity?: number
  damping?: number
  clampY?: [number, number]
  clampX?: [number, number]
  onStart?: () => void
  onEnd?: () => void
}

export interface DragRotateApi {
  isDragging: Ref<boolean>
  onPointerDown: (event: any) => void
  cancel: () => void
  setTargetRotation: (rotation: { x?: number, y?: number }) => void
  getTargetRotation: () => { x: number, y: number }
}

export function useDragRotate(options: DragRotateOptions): DragRotateApi {
  const {
    enabled,
    active,
    target,
    axis,
    sensitivity = 0.0065,
    damping = 12,
    clampY,
    clampX,
    onStart,
    onEnd,
  } = options

  const isDragging = ref(false)
  const rotationTarget = { x: 0, y: 0 }

  let pointerId: number | null = null
  let lastX = 0
  let lastY = 0

  const cancel = () => {
    isDragging.value = false
    pointerId = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
    onEnd?.()
  }

  const setTargetRotation = (rot: { x?: number, y?: number }) => {
    if (typeof rot.x === 'number') {
      rotationTarget.x = rot.x
    }
    if (typeof rot.y === 'number') {
      rotationTarget.y = rot.y
    }
  }

  const getTargetRotation = () => ({
    x: rotationTarget.x,
    y: rotationTarget.y,
  })

  const onPointerMove = (e: PointerEvent) => {
    if (!enabled.value || !active.value) {
      return
    }
    if (!isDragging.value) {
      return
    }
    if (pointerId !== null && e.pointerId !== pointerId) {
      return
    }

    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY

    rotationTarget.y += dx * sensitivity
    if (clampY) {
      rotationTarget.y = Math.min(
        clampY[1],
        Math.max(clampY[0], rotationTarget.y),
      )
    }

    if (axis === 'xy') {
      rotationTarget.x += dy * sensitivity
      if (clampX) {
        rotationTarget.x = Math.min(
          clampX[1],
          Math.max(clampX[0], rotationTarget.x),
        )
      }
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    if (pointerId !== null && e.pointerId !== pointerId) {
      return
    }
    cancel()
  }

  const onPointerDown = (event: any) => {
    if (!enabled.value || !active.value) {
      return
    }
    if (!target.value) {
      return
    }

    event?.stopPropagation?.()

    isDragging.value = true
    pointerId = typeof event?.pointerId === 'number' ? event.pointerId : null
    lastX = event?.clientX ?? 0
    lastY = event?.clientY ?? 0
    onStart?.()

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    window.addEventListener('pointercancel', onPointerUp, { passive: true })
  }

  const { onBeforeRender } = useLoop()
  onBeforeRender(({ delta }) => {
    if (!active.value) {
      return
    }
    if (!enabled.value) {
      return
    }
    const obj = target.value
    if (!obj) {
      return
    }

    obj.rotation.y = damp(obj.rotation.y, rotationTarget.y, damping, delta)
    if (axis === 'xy') {
      obj.rotation.x = damp(obj.rotation.x, rotationTarget.x, damping, delta)
    }
  })

  watch(
    () => active.value,
    (v) => {
      if (!v) {
        cancel()
      }
    },
  )

  onUnmounted(() => cancel())

  return {
    isDragging,
    onPointerDown,
    cancel,
    setTargetRotation,
    getTargetRotation,
  }
}
