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
  const lookAtNudge = reactive({ x: 0, y: 0, z: 0 })

  let ctx: gsap.Context | null = null
  let activeObject: Object3D | null = null

  let leaveTimer: any = null
  let showTimer: gsap.core.Tween | null = null

  onMounted(() => {
    ctx = gsap.context(() => {})
  })

  onUnmounted(() => {
    ctx?.revert()
  })

  function onGlowEnter(item: InteractableItem, _hitPoint?: Vector3) {
    if (activeInteraction.value === item.id) {
      return
    }

    if (leaveTimer) {
      clearTimeout(leaveTimer)
      leaveTimer = null
    }
    
    if (showTimer) {
      showTimer.kill()
      showTimer = null
    }

    if (activeObject) {
      activeObject.userData.hideGlint = false
    }

    activeInteraction.value = item.id
    activeObject = item.object
    activeObject.userData.hideGlint = true

    tooltipVisible.value = false
    document.body.style.cursor = 'pointer'

    item.object.updateMatrixWorld(true)

    // STABILITY FIX: Pure Dolly Zoom
    // Instead of centering the object (which slides it away from the mouse),
    // we move the camera ALONG the line of sight. This keeps the object
    // in the exact same screen position while making it larger.
    
    // 1. Get World Positions
    const worldPos = item.object.getWorldPosition(new Vector3())
    const camPos = new Vector3(...layoutCamPos.value)
    
    // 2. Calculate Vector from Camera to Object
    const vec = new Vector3().subVectors(worldPos, camPos)
    const dist = vec.length()
    
    // 3. Calculate Stop Point (Dolly)
    const TARGET_DIST = 2.5 // Comfortable inspection distance
    const moveRatio = Math.max(0, (dist - TARGET_DIST) / dist)
    
    // 4. Calculate Nudge Vector (How much to move from original pos)
    const nudge = vec.multiplyScalar(moveRatio)

    if (ctx) {
      ctx.add(() => {
        // Do NOT rotate camera to face object (this causes centering/sliding).
        // Keep looking at the main scene center.
        gsap.to(lookAtNudge, {
          x: 0,
          y: 0,
          z: 0,
          duration: 1.0,
          ease: 'power3.out',
          overwrite: true,
        })

        // Move camera physically towards the object
        gsap.to(glowNudge, {
          x: nudge.x, 
          y: nudge.y,
          z: nudge.z, 
          duration: 1.0,
          ease: 'power3.out',
          overwrite: true,
        })

        showTimer = gsap.delayedCall(0.2, () => {
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
      if (activeObject) {
        activeObject.userData.hideGlint = false
        activeObject = null
      }

      activeInteraction.value = null
      tooltipVisible.value = false
      leaveTimer = null

      if (ctx) {
        ctx.add(() => {
          gsap.to(glowNudge, {
            x: 0,
            y: 0,
            z: 0,
            duration: 0.8,
            ease: 'power3.out',
            overwrite: true,
          })
          gsap.to(lookAtNudge, {
            x: 0,
            y: 0,
            z: 0,
            duration: 0.8,
            ease: 'power3.out',
            overwrite: true,
          })
        })
      }
    }, 150)
  }

  function reset() {
    if (activeObject) {
      activeObject.userData.hideGlint = false
      activeObject = null
    }

    activeInteraction.value = null
    tooltipVisible.value = false
    
    if (showTimer) {
      showTimer.kill()
      showTimer = null
    }

    gsap.killTweensOf(glowNudge)
    gsap.killTweensOf(lookAtNudge)
    
    glowNudge.x = 0
    glowNudge.y = 0
    glowNudge.z = 0
    lookAtNudge.x = 0
    lookAtNudge.y = 0
    lookAtNudge.z = 0
    
    if (leaveTimer) {
      clearTimeout(leaveTimer)
      leaveTimer = null
    }
  }

  return {
    activeInteraction,
    tooltipVisible,
    glowNudge,
    lookAtNudge,
    onGlowEnter,
    onGlowLeave,
    reset,
  }
}
