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
  let currentTween: gsap.core.Tween | null = null

  onMounted(() => {
    ctx = gsap.context(() => {})
  })

  onUnmounted(() => {
    ctx?.revert()
  })

  function onGlowEnter(item: InteractableItem, _hitPoint?: Vector3) {
    // 1. Handle Debounce / Mouse Slip
    // If we are "leaving" but return quickly, cancel the leave.
    const wasLeaving = !!leaveTimer
    if (leaveTimer) {
      clearTimeout(leaveTimer)
      leaveTimer = null
    }

    // 2. Check if already active
    if (activeInteraction.value === item.id) {
      // If we salvaged a session, ensure UI state is restored
      if (wasLeaving) {
        document.body.style.cursor = 'pointer'
        
        // If tooltip wasn't visible yet (and timer was killed by leave), restart it
        if (!tooltipVisible.value) {
          if (showTimer) showTimer.kill()
          showTimer = gsap.delayedCall(0.2, () => {
            if (activeInteraction.value === item.id) {
              tooltipVisible.value = true
            }
          })
        }
      }
      return
    }

    // 3. Cleanup previous state (if switching directly from A to B)
    if (showTimer) {
      showTimer.kill()
      showTimer = null
    }

    if (currentTween) {
      currentTween.kill()
      currentTween = null
    }

    if (activeObject) {
      activeObject.userData.hideGlint = false
    }

    // 4. Activate New State
    activeInteraction.value = item.id
    activeObject = item.object
    activeObject.userData.hideGlint = true

    tooltipVisible.value = false
    document.body.style.cursor = 'pointer'

    // Capture start state for smooth interpolation
    const startGlow = new Vector3(glowNudge.x, glowNudge.y, glowNudge.z)
    const startLookAt = new Vector3(lookAtNudge.x, lookAtNudge.y, lookAtNudge.z)
    const progress = { t: 0 }

    if (ctx) {
      ctx.add(() => {
        // DYNAMIC CHASE LOGIC:
        // Recalculate target every frame to handle moving objects (transitions)
        currentTween = gsap.to(progress, {
          t: 1,
          duration: 1.0,
          ease: 'power3.out',
          onUpdate: () => {
             // 1. Get fresh World Pos
             const worldPos = item.object.getWorldPosition(new Vector3())
             const camPos = new Vector3(...layoutCamPos.value)
             
             // 2. Hybrid Focus Logic
             const vec = new Vector3().subVectors(worldPos, camPos)
             const currentDist = vec.length()
             const TARGET_DIST = 2.8
             
             const moveRatio = Math.max(0, (currentDist - TARGET_DIST) / currentDist)
             const dollyPos = camPos.clone().add(vec.clone().multiplyScalar(moveRatio))
             const idealPos = new Vector3(worldPos.x, worldPos.y, worldPos.z + TARGET_DIST)
             
             const BLEND = 0.5
             const finalCamPos = new Vector3().lerpVectors(dollyPos, idealPos, BLEND)
             const targetNudge = finalCamPos.sub(camPos)
             const targetLookAt = new Vector3(0, 0, 0).lerp(worldPos, BLEND)

             // 3. Interpolate Nudge
             lookAtNudge.x = startLookAt.x + (targetLookAt.x - startLookAt.x) * progress.t
             lookAtNudge.y = startLookAt.y + (targetLookAt.y - startLookAt.y) * progress.t
             lookAtNudge.z = startLookAt.z + (targetLookAt.z - startLookAt.z) * progress.t

             glowNudge.x = startGlow.x + (targetNudge.x - startGlow.x) * progress.t
             glowNudge.y = startGlow.y + (targetNudge.y - startGlow.y) * progress.t
             glowNudge.z = startGlow.z + (targetNudge.z - startGlow.z) * progress.t
          }
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
      
      if (currentTween) {
        currentTween.kill()
      }

      // Capture current state to tween back to 0 smoothly
      const startGlow = new Vector3(glowNudge.x, glowNudge.y, glowNudge.z)
      const startLookAt = new Vector3(lookAtNudge.x, lookAtNudge.y, lookAtNudge.z)
      const progress = { t: 0 }

      if (ctx) {
        ctx.add(() => {
           currentTween = gsap.to(progress, {
            t: 1,
            duration: 0.8,
            ease: 'power3.out',
            onUpdate: () => {
               lookAtNudge.x = startLookAt.x * (1 - progress.t)
               lookAtNudge.y = startLookAt.y * (1 - progress.t)
               lookAtNudge.z = startLookAt.z * (1 - progress.t)
               
               glowNudge.x = startGlow.x * (1 - progress.t)
               glowNudge.y = startGlow.y * (1 - progress.t)
               glowNudge.z = startGlow.z * (1 - progress.t)
            }
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

    if (currentTween) {
      currentTween.kill()
      currentTween = null
    }
    
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
