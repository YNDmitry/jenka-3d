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
    if (
      !active.value ||
      reducedMotion.value ||
      !targetElement ||
      device.value !== 'desktop'
    ) {
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

  onBeforeRender(({ elapsed }) => {
    if (!active.value) {
      return
    }

    // Parallax Smoothing
    const dx = targetParallax.x - currentParallax.x
    const dy = targetParallax.y - currentParallax.y
    
    // Floating / Breathing Animation (Cinematic Idle)
    let floatY = 0
    let floatX = 0
    if (!reducedMotion.value) {
      // Slow, subtle vertical float (period ~6s)
      floatY = Math.sin(elapsed * 1.0) * 0.05
      // Very slow horizontal drift (period ~10s)
      floatX = Math.cos(elapsed * 0.6) * 0.03
    }

    const hasParallax = Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001
    const shouldUpdate = hasParallax || !reducedMotion.value

    if (shouldUpdate) {
      const easing = CONSTANTS.parallax.easing
      currentParallax.x += dx * easing
      currentParallax.y += dy * easing

      if (cameraRef.value) {
        const baseCamPos = CONSTANTS.layout.camPos[device.value] || CONSTANTS.layout.camPos.desktop
        
        // Combine Base + Parallax + Float
        // Float is suppressed slightly when moving mouse vigorously to keep control feeling tight
        const suppression = Math.max(0, 1 - (Math.abs(dx) + Math.abs(dy)) * 50)
        
        cameraRef.value.position.x = baseCamPos[0] + currentParallax.x + (floatX * suppression)
        cameraRef.value.position.y = baseCamPos[1] + currentParallax.y + (floatY * suppression)
      }

      if (invalidate) {
        invalidate()
      }
    }
  })
}
