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

  // Accept optional hitPoint from the raycaster event
  function onGlowEnter(item: InteractableItem, hitPoint?: Vector3) {
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

    let targetX, targetY, targetZ;
    
    if (hitPoint) {
      targetX = hitPoint.x
      targetY = hitPoint.y
      targetZ = hitPoint.z
    } else {
      const worldPos = item.object.getWorldPosition(new Vector3())
      targetX = worldPos.x
      targetY = worldPos.y
      targetZ = worldPos.z
    }

    // CLOSER ZOOM:
    const SAFE_DISTANCE = 1.8 // Much closer for detail view
    const desiredCamZ = targetZ + SAFE_DISTANCE
    
    const baseZ = layoutCamPos.value[2]
    const nudgeZ = desiredCamZ - baseZ

    if (ctx) {
      ctx.add(() => {
        // 1. Look EXACTLY at the hit point
        gsap.to(lookAtNudge, {
          x: targetX,
          y: targetY,
          z: targetZ,
          duration: 0.8,
          ease: 'power2.out',
          overwrite: true,
        })

        // 2. Move Camera EXACTLY in front of the hit point
        gsap.to(glowNudge, {
          x: targetX, 
          y: targetY,
          z: nudgeZ, 
          duration: 0.8,
          ease: 'power2.out',
          overwrite: true,
        })

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
            duration: 0.6,
            ease: 'power2.out',
            overwrite: true,
          })
          gsap.to(lookAtNudge, {
            x: 0,
            y: 0,
            z: 0,
            duration: 0.6,
            ease: 'power2.out',
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
