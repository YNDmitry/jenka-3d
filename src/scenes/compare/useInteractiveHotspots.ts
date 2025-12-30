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

  // We ignore hitPoint to ensure stable centering on the Object itself,
  // preventing the "chasing cursor" effect where the object slides away from the mouse.
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

    // STABILITY FIX: Always use the object's center world position.
    // Using the raycast hitPoint caused unpredictable camera jumps (high/low)
    // and made the object "slide" away from the cursor.
    const worldPos = item.object.getWorldPosition(new Vector3())
    const targetX = worldPos.x
    const targetY = worldPos.y
    const targetZ = worldPos.z

    // CLOSER ZOOM:
    // Increased slightly to 2.2 to be less aggressive/disorienting
    const SAFE_DISTANCE = 2.2 
    const desiredCamZ = targetZ + SAFE_DISTANCE
    
    const baseZ = layoutCamPos.value[2]
    const nudgeZ = desiredCamZ - baseZ

    if (ctx) {
      ctx.add(() => {
        // 1. Look EXACTLY at the object center
        gsap.to(lookAtNudge, {
          x: targetX,
          y: targetY,
          z: targetZ,
          duration: 1.0, // Smoother duration
          ease: 'power3.out', // Professional smooth easing
          overwrite: true,
        })

        // 2. Move Camera EXACTLY in front of the object
        gsap.to(glowNudge, {
          x: targetX, 
          y: targetY,
          z: nudgeZ, 
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
