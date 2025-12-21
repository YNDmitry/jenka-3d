import { onMounted, onUnmounted, ref, shallowRef, type Ref } from 'vue'
import { useLoop } from '@tresjs/core'
import { CONSTANTS } from './config'
import type { PerspectiveCamera } from 'three'

export function useHeroInteraction(
  active: Ref<boolean>,
  reducedMotion: Ref<boolean>,
  container: HTMLElement | undefined,
  cameraRef: Ref<PerspectiveCamera | null>,
  invalidate: () => void,
) {
  const currentParallax = { x: 0, y: 0 }
  const targetParallax = { x: 0, y: 0 }

  function onMouseMove(e: MouseEvent) {
    if (!active.value || reducedMotion.value) {
      return
    }

    const x = (e.clientX / window.innerWidth) * 2 - 1
    const y = -(e.clientY / window.innerHeight) * 2 + 1

    const factor = CONSTANTS.parallax.factor

    targetParallax.x = x * factor
    targetParallax.y = y * factor

    if (invalidate) {
      invalidate()
    }
  }

  function onMouseLeave() {
    targetParallax.x = 0
    targetParallax.y = 0
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

  onBeforeRender(() => {
    if (!active.value) {
      return
    }

    // Parallax Smoothing
    const dx = targetParallax.x - currentParallax.x
    const dy = targetParallax.y - currentParallax.y

    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
      const easing = CONSTANTS.parallax.easing
      currentParallax.x += dx * easing
      currentParallax.y += dy * easing

      if (cameraRef.value) {
        cameraRef.value.position.x = CONSTANTS.layout.camPos[0] + currentParallax.x
        cameraRef.value.position.y = CONSTANTS.layout.camPos[1] + currentParallax.y
      }

      if (invalidate) {
        invalidate()
      }
    }
  })
}
