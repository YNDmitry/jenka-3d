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

    // HYBRID FOCUS LOGIC:
    // Pure Dolly (Factor 0.0) = Stable mouse, but high/low elements clip off screen.
    // Pure Center (Factor 1.0) = Object safe in center, but slides away from mouse.
    // Hybrid (Factor 0.5) = Pulls object 50% towards center. Safe visibility + Low slide speed.
    
    const worldPos = item.object.getWorldPosition(new Vector3())
    const camPos = new Vector3(...layoutCamPos.value)
    
    // 1. Calculate Distances
    const vec = new Vector3().subVectors(worldPos, camPos)
    const currentDist = vec.length()
    const TARGET_DIST = 2.8 // Increased slightly for better context
    
    // 2. Calculate "Dolly" Position (Line of Sight)
    const moveRatio = Math.max(0, (currentDist - TARGET_DIST) / currentDist)
    const dollyPos = camPos.clone().add(vec.clone().multiplyScalar(moveRatio))
    
    // 3. Calculate "Ideal" Position (Perfect Centering)
    // Camera placed directly in front of object on Z-axis
    const idealPos = new Vector3(worldPos.x, worldPos.y, worldPos.z + TARGET_DIST)
    
    // 4. Blend Factors
    const BLEND = 0.5
    
    // Interpolate Camera Position
    const finalCamPos = new Vector3().lerpVectors(dollyPos, idealPos, BLEND)
    const targetNudge = finalCamPos.sub(camPos)

    // Interpolate LookAt Target (Tilt camera up/down/left/right towards object)
    // 0,0,0 is the base LookAt.
    const targetLookAt = new Vector3(0, 0, 0).lerp(worldPos, BLEND)

    if (ctx) {
      ctx.add(() => {
        gsap.to(lookAtNudge, {
          x: targetLookAt.x,
          y: targetLookAt.y,
          z: targetLookAt.z,
          duration: 1.0,
          ease: 'power3.out',
          overwrite: true,
        })

        gsap.to(glowNudge, {
          x: targetNudge.x, 
          y: targetNudge.y,
          z: targetNudge.z, 
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
