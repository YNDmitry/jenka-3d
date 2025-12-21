import { computed, reactive, ref, watch, type Ref } from 'vue'
import { type Object3D, Vector2, Vector3 } from 'three'
import gsap from 'gsap'
import { useDragRotate } from '../../three/controls'
import type { CompareMode } from '../../shared/types'

export function useCompareInteraction(
  active: Ref<boolean>,
  mode: Ref<CompareMode>,
  groupA: Ref<Object3D | null>,
  groupB: Ref<Object3D | null>,
  reducedMotion: Ref<boolean>,
  baseLookAt: Ref<[number, number, number]>,
  emitChangeMode: (newMode: CompareMode) => void,
  onModelClick?: () => void,
) {
  const camNudge = reactive(new Vector3())
  const fovNudge = ref(0)
  const lookAtRef = reactive(new Vector3(...baseLookAt.value))

  // -- 1. Настройка Drag Controls --
  const dragTarget = computed(() => {
    if (mode.value === 'focus-a') {
      return groupA.value
    }
    if (mode.value === 'focus-b') {
      return groupB.value
    }
    return null
  })

  const drag = useDragRotate({
    enabled: computed(() => !reducedMotion.value),
    active: computed(() => mode.value !== 'grid'),
    target: dragTarget,
    axis: 'xy',
    sensitivity: 0.006,
    damping: 6,
    clampX: [-0.1, 0.6], // Низ нельзя (-0.1), верх чуть-чуть (0.6)
    clampY: [-1.2, 1.2], // Спину нельзя (±1.2 рад)
  })

  // -- 2. Умная логика клика --
  const startPos = new Vector2(-1, -1)
  const CLICK_THRESHOLD = 20

  function handlePointerDown(e: any) {
    if (e.stopPropagation) {
      e.stopPropagation()
    }

    const native = e.nativeEvent || e
    startPos.set(native.clientX, native.clientY)

    if (mode.value !== 'grid' && drag.onPointerDown) {
      drag.onPointerDown(native)
    }
  }

  function handleModelClick(e: any, targetMode: CompareMode) {
    e.stopPropagation()

    if (mode.value === 'grid') {
      if (onModelClick) {
        onModelClick()
      }
      emitChangeMode(targetMode)
      return
    }

    if (startPos.x !== -1 || startPos.y !== -1) {
      const native = e.nativeEvent || e
      const dx = native.clientX - startPos.x
      const dy = native.clientY - startPos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      startPos.set(-1, -1)

      if (dist > CLICK_THRESHOLD) return
    }

    if (onModelClick) {
      onModelClick()
    }
    
    if (mode.value === targetMode) {
      emitChangeMode('grid')
    } else {
      emitChangeMode(targetMode)
    }
  }

  function resetCamera() {
    gsap.to(camNudge, { x: 0, y: 0, z: 0, duration: 1 })
    gsap.to(lookAtRef, { x: 0, y: 0, z: 0, duration: 1 })
    fovNudge.value = 0
  }

  watch(mode, (newVal, oldVal) => {
    drag.cancel()
    drag.setTargetRotation({ x: 0, y: 0 })

    // When switching back to grid, the drag target becomes null immediately,
    // so the drag loop stops updating rotation. We must manually reset the
    // rotation of the group that was just active.
    if (newVal === 'grid') {
      const duration = 1.0
      const ease = 'power2.out'

      if (oldVal === 'focus-a' && groupA.value) {
        gsap.to(groupA.value.rotation, { x: 0, y: 0, duration, ease })
      }
      if (oldVal === 'focus-b' && groupB.value) {
        gsap.to(groupB.value.rotation, { x: 0, y: 0, duration, ease })
      }
    }
  })

  return {
    camNudge,
    fovNudge,
    lookAtRef,
    pointer: computed(() => ({ x: 0, y: 0 })),
    drag,
    resetCamera,
    handlePointerDown,
    handleModelClick,
  }
}
