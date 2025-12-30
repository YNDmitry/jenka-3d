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

    if (currentTween) {
      currentTween.kill()
      currentTween = null
    }

    if (activeObject) {
      activeObject.userData.hideGlint = false
    }

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
        // We recalculate the target every frame. This handles the case where
        // the user hovers the model WHILE it is still transitioning/flying in.
        // Instead of locking to the "mid-flight" position (bug), the camera
        // will smoothly chase the object to its final destination.
        
        currentTween = gsap.to(progress, {
          t: 1,
          duration: 1.0,
          ease: 'power3.out',
          onUpdate: () => {
             // 1. Get fresh World Pos (Object might be moving!)
             const worldPos = item.object.getWorldPosition(new Vector3())
             const camPos = new Vector3(...layoutCamPos.value)
             
             // 2. Hybrid Focus Logic (same as before)
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

             // 3. Interpolate Nudge (Start -> Target)
             // We manually lerp based on the GSAP progress 't'
             // This ensures we start exactly where we are and end exactly where the object is
             
             // LookAt
             lookAtNudge.x = startLookAt.x + (targetLookAt.x - startLookAt.x) * progress.t
             lookAtNudge.y = startLookAt.y + (targetLookAt.y - startLookAt.y) * progress.t
             lookAtNudge.z = startLookAt.z + (targetLookAt.z - startLookAt.z) * progress.t

             // GlowNudge (Pos)
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
               // Tween back to 0,0,0
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
