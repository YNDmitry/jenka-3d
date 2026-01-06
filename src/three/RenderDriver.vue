<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useTres } from '@tresjs/core'
import type { QualityTier } from '../shared/types'
import { getTargetFpsForQuality } from './postfx'
import { unwrapRenderer } from './utils'

const props = defineProps<{
  active: boolean
  quality: QualityTier
  reducedMotion: boolean
}>()

const { invalidate, renderer } = useTres()

// Configuration
const BOOST_WINDOW_MS = 2000
const SLEEP_WINDOW_MS = 5000
const BASE_FPS = 144 // Cinematic idle

const idleFpsLimit = computed(() => {
  if (!props.active) { return 0 }
  const fps = getTargetFpsForQuality(props.quality)
  const limit = props.reducedMotion ? Math.min(30, fps) : fps
  return props.reducedMotion ? 15 : Math.min(BASE_FPS, limit)
})

// State
let rafId: number | null = null
let boostUntil = 0
let sleepAt = 0
let lastFrameTime = performance.now()

// The Loop
function loop(now: number) {
  try {
    const r = unwrapRenderer(renderer)
    if (!props.active || !r) {
      rafId = requestAnimationFrame(loop)
      return
    }

    // 1. BOOST MODE: Unlock FPS
    if (now < boostUntil) {
      const boostFps = getTargetFpsForQuality(props.quality)
      const interval = 1000 / boostFps
      const delta = now - lastFrameTime

      if (delta > interval) {
        invalidate()
        lastFrameTime = now - (delta % interval)
      }
      
      rafId = requestAnimationFrame(loop)
      return
    }

    // 2. IDLE/SLEEP MODE
    // If we've passed the sleep timer, stop rendering entirely (0 FPS)
    if (now > sleepAt) {
      rafId = requestAnimationFrame(loop)
      return
    }

    // Otherwise, run at BASE_FPS (Cinematic Idle) to keep glints/floating alive
    const targetFps = idleFpsLimit.value
    const interval = 1000 / targetFps
    const delta = now - lastFrameTime

    if (delta > interval) {
      invalidate()
      lastFrameTime = now - (delta % interval)
    }

    rafId = requestAnimationFrame(loop)
  } catch (err) {
    console.error('RenderDriver Loop Error:', err)
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
  }
}

function boost() {
  const now = performance.now()
  const alreadyBoosting = now < boostUntil

  boostUntil = now + BOOST_WINDOW_MS
  sleepAt = now + SLEEP_WINDOW_MS

  // Force immediate frame if waking up
  if (!alreadyBoosting) {
    invalidate()
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    boost()
  }
}

function onContextLost(event: Event) {
  event.preventDefault()
  console.warn('[RenderDriver] WebGL Context Lost')
  if (rafId !== null) cancelAnimationFrame(rafId)
  rafId = null
}

function onContextRestored() {
  console.log('[RenderDriver] WebGL Context Restored')
  boost()
  rafId = requestAnimationFrame(loop)
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
  const r = (renderer as any).value || renderer
  const el = (r as any)?.domElement as HTMLElement | undefined
  if (el) {
    el.addEventListener('webglcontextlost', onContextLost, opts)
    el.addEventListener('webglcontextrestored', onContextRestored, opts)
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
    el.removeEventListener('webglcontextlost', onContextLost, opts)
    el.removeEventListener('webglcontextrestored', onContextRestored, opts)
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
