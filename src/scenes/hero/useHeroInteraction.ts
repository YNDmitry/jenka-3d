import { onMounted, onUnmounted, ref, shallowRef, type Ref } from 'vue'
import { useLoop } from '@tresjs/core'
import { CONSTANTS } from './config'
import type { PerspectiveCamera } from 'three'
import type { DeviceClass } from '../../shared/types'

export function useHeroInteraction(
  active: Ref<boolean>,
  device: Ref<DeviceClass>,
  reducedMotion: Ref<boolean>,
  container: HTMLElement | undefined,
  cameraRef: Ref<PerspectiveCamera | null>,
  invalidate: () => void,
) {
  const currentParallax = { x: 0, y: 0 }
  const targetParallax = { x: 0, y: 0 }
  let targetElement: HTMLElement | null = null

  function onMouseMove(e: MouseEvent) {
    if (!active.value || reducedMotion.value || !targetElement) {
      return
    }

    const rect = targetElement.getBoundingClientRect()
    
    // Normalize mouse position relative to the target element
    // Clamp to -1..1 to prevent extreme movement if mouse is outside (but listener is on element, so usually inside)
    // Actually, if we listen on window, we can have parallax even outside.
    // But user asked to relate to the section. Usually implies "Mouse over section".
    
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

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
    // Priority: .section_main-hero -> container -> window (fallback)
    const section = document.querySelector('.section_main-hero') as HTMLElement
    targetElement = section || container || document.body

    if (targetElement) {
      targetElement.addEventListener('mousemove', onMouseMove)
      targetElement.addEventListener('mouseleave', onMouseLeave)
    }
  })

  onUnmounted(() => {
    if (targetElement) {
      targetElement.removeEventListener('mousemove', onMouseMove)
      targetElement.removeEventListener('mouseleave', onMouseLeave)
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
        const baseCamPos = CONSTANTS.layout.camPos[device.value] || CONSTANTS.layout.camPos.desktop
        cameraRef.value.position.x = baseCamPos[0] + currentParallax.x
        cameraRef.value.position.y = baseCamPos[1] + currentParallax.y
      }

      if (invalidate) {
        invalidate()
      }
    }
  })
}
