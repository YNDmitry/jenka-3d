<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useTres } from '@tresjs/core'
import type { QualityTier } from '../shared/types'
import { getTargetFpsForQuality } from './postfx'

const props = defineProps<{
  active: boolean
  quality: QualityTier
  reducedMotion: boolean
}>()

const { invalidate, renderer } = useTres()

// Configuration
const IDLE_TIMEOUT_MS = 2000
const BASE_FPS = 60

const idleFpsLimit = computed(() => {
  if (!props.active) { return 0 }
  const fps = getTargetFpsForQuality(props.quality)
  const limit = props.reducedMotion ? Math.min(30, fps) : fps
  // In idle state, we clamp even harder to save battery
  return props.reducedMotion ? 15 : Math.min(BASE_FPS, limit)
})

// State
let rafId: number | null = null
let boostUntil = 0
let lastFrameTime = 0

// The Loop
function loop(now: number) {
  if (!props.active) {
    rafId = requestAnimationFrame(loop)
    return
  }

  // 1. BOOST MODE: Unlock FPS (but capped at 60 to save battery/heat)
  // If user interacted recently, we want smoothness, but not necessarily 120Hz/144Hz
  if (now < boostUntil) {
    const boostFps = Math.min(60, getTargetFpsForQuality(props.quality))
    const interval = 1000 / boostFps
    const delta = now - lastFrameTime

    if (delta > interval) {
      invalidate()
      lastFrameTime = now - (delta % interval)
    }
    
    rafId = requestAnimationFrame(loop)
    return
  }

  // 2. IDLE MODE: Cap FPS
  // If idle, throttle to 60fps or lower
  const targetFps = idleFpsLimit.value
  const interval = 1000 / targetFps
  const delta = now - lastFrameTime

  if (delta > interval) {
    invalidate()
    lastFrameTime = now - (delta % interval)
  }

  rafId = requestAnimationFrame(loop)
}

function boost() {
  const now = performance.now()
  const alreadyBoosting = now < boostUntil

  // Extend boost time
  boostUntil = now + IDLE_TIMEOUT_MS

  // Only force immediate render if we weren't already boosting
  // to avoid spamming invalidate() and messing up frame deltas
  if (!alreadyBoosting) {
    invalidate()
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    boost()
  }
}

onMounted(() => {
  // Start Loop
  rafId = requestAnimationFrame(loop)

  // Interaction Listeners
  const opts = { passive: true, capture: true }
  
  // Keep event listeners as backup for mouse/touch interactions
  window.addEventListener('resize', boost, opts)
  document.addEventListener('visibilitychange', onVisibilityChange, opts)
  
  // Element level interactions
  // Element level interactions
  const r = (renderer as any).value || renderer
  const el = (r as any)?.domElement as HTMLElement | undefined
  if (el) {
    el.addEventListener('pointermove', boost, opts)
    el.addEventListener('pointerdown', boost, opts)
    el.addEventListener('wheel', boost, opts)
    el.addEventListener('click', boost, opts)
  }
})

onUnmounted(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
  }

  const opts = { capture: true } as any
  window.removeEventListener('resize', boost, opts)
  document.removeEventListener('visibilitychange', onVisibilityChange, opts)

  // Element level interactions
  const r = (renderer as any).value || renderer
  const el = (r as any)?.domElement as HTMLElement | undefined
  if (el) {
    el.removeEventListener('pointermove', boost, opts)
    el.removeEventListener('pointerdown', boost, opts)
    el.removeEventListener('wheel', boost, opts)
    el.removeEventListener('click', boost, opts)
  }
})

watch(() => props.active, (isActive) => {
  if (isActive) { boost() }
})
</script>

<template />
