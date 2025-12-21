import { onMounted, onUnmounted, reactive, ref, type Ref } from 'vue'
import { type Object3D, Vector3 } from 'three'
import gsap from 'gsap'

export interface InteractableItem {
  id: string
  label: string
  position: [number, number, number]
  object: Object3D
  type: 'button' | 'speaker'
}

export function useInteractiveHotspots(
  layoutCamPos: Ref<[number, number, number]>,
) {
  const activeInteraction = ref<string | null>(null)
  const tooltipVisible = ref(false)
  const glowNudge = reactive({ x: 0, y: 0, z: 0 })
  let ctx: gsap.Context | null = null

  let leaveTimer: any = null
  let showTimer: gsap.core.Tween | null = null // Store the GSAP delayedCall

  onMounted(() => {
    ctx = gsap.context(() => {})
  })

  onUnmounted(() => {
    ctx?.revert()
  })

  function onGlowEnter(item: InteractableItem) {
    if (activeInteraction.value === item.id) {
      return
    }

    if (leaveTimer) {
      clearTimeout(leaveTimer)
      leaveTimer = null
    }
    
    // Kill pending show timer if switching targets fast
    if (showTimer) {
      showTimer.kill()
      showTimer = null
    }

    activeInteraction.value = item.id
    tooltipVisible.value = false
    document.body.style.cursor = 'pointer'

    // Force update matrix to get correct world position even if scene graph changed
    item.object.updateMatrixWorld(true)

    const basePos = new Vector3(...layoutCamPos.value)
    const targetPos = item.object.getWorldPosition(new Vector3())
    const direction = targetPos.clone().sub(basePos)

    // Stronger zoom on hover (0.6 instead of 0.35)
    const nudgeTarget = direction.multiplyScalar(0.6)
    
    if (ctx) {
      ctx.add(() => {
        gsap.to(glowNudge, {
          x: nudgeTarget.x,
          y: nudgeTarget.y,
          z: nudgeTarget.z,
          duration: 1.2,
          ease: 'power2.out',
          overwrite: true,
        })

        // Store the timer
        showTimer = gsap.delayedCall(0.15, () => {
          if (activeInteraction.value === item.id) {
            tooltipVisible.value = true
          }
        })
      })
    }
  }

  function onGlowLeave() {
    if (leaveTimer) {
      return
    }
    document.body.style.cursor = 'auto'
    
    if (showTimer) {
      showTimer.kill()
      showTimer = null
    }

    leaveTimer = setTimeout(() => {
      activeInteraction.value = null
      tooltipVisible.value = false
      leaveTimer = null

      if (ctx) {
        ctx.add(() => {
          gsap.to(glowNudge, {
            x: 0,
            y: 0,
            z: 0,
            duration: 1.0,
            ease: 'power2.out',
            overwrite: true,
          })
        })
      }
    }, 100)
  }

  function reset() {
    activeInteraction.value = null
    tooltipVisible.value = false
    
    if (showTimer) {
      showTimer.kill()
      showTimer = null
    }

    // Fix: Kill any pending animations to prevents stuck offsets
    gsap.killTweensOf(glowNudge)
    
    glowNudge.x = 0
    glowNudge.y = 0
    glowNudge.z = 0
    if (leaveTimer) {
      clearTimeout(leaveTimer)
      leaveTimer = null
    }
  }

  return {
    activeInteraction,
    tooltipVisible,
    glowNudge,
    onGlowEnter,
    onGlowLeave,
    reset,
  }
}
