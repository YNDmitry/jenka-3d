<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
  toRaw,
} from 'vue'
import { useLoop, useTres } from '@tresjs/core'
import gsap from 'gsap'
import {
  MeshBasicMaterial,
  SphereGeometry,
  DoubleSide,
  PerspectiveCamera,
} from 'three'

import {
  BloomPmndrs,
  BrightnessContrastPmndrs,
  EffectComposerPmndrs,
  SMAAPmndrs as SMAA,
  ToneMappingPmndrs,
} from '@tresjs/post-processing'
import { ToneMappingMode } from 'postprocessing'
import { Environment, Html } from '@tresjs/cientos'

import type {
  CompareMode,
  DeviceClass,
  LoaderState,
  QualityTier,
  WebflowSceneConfig,
} from '../shared/types'

import { damp } from '../shared/utils'
import { createAttachedGlints } from '../three/glow'
import { getPostFXSettings } from '../three/postfx'
import { disposeObject3D } from '../three/dispose'
import { CONSTANTS } from './compare/config'

import { useCompareLayout } from './compare/useCompareLayout'
import { useCompareInteraction } from './compare/useCompareInteraction'
import { useCompareModels } from './compare/useCompareModels'
import { useInteractiveHotspots } from './compare/useInteractiveHotspots'
import { useWebflowIntegration } from '../shared/useWebflowIntegration'
import {
  useShadowBaking,
  precompileScene,
  unwrapRenderer,
} from '../three/utils'

const props = defineProps<{
  container?: HTMLElement
  config: WebflowSceneConfig
  active: boolean
  quality: QualityTier
  device: DeviceClass
  reducedMotion: boolean
  exposure: number
  emissive: number
  envIntensity: number
  bloom: number
  background: boolean
  dpr?: number | [number, number]
  trigger?: number
}>()

const emit = defineEmits<{
  (e: 'state', state: LoaderState): void
  (e: 'change-mode', mode: CompareMode): void
}>()

// --- Helper for Optimization ---
const getRaw = (obj: any) => toRaw(obj)

const { emitFromCanvas } = useWebflowIntegration(props.container)

const { renderer, invalidate, camera } = useTres()
const rendererReady = ref(false)

watch(
  () => unwrapRenderer(renderer),
  (r) => {
    if (r) rendererReady.value = true
  },
  { immediate: true },
)

const { onBeforeRender } = useLoop()
const hasInteracted = ref(false)

// --- 1. Models & State ---
const groupA = shallowRef<any>(null)
const groupB = shallowRef<any>(null)
const internalMode = ref<CompareMode>('grid')
const mode = computed(() => internalMode.value)
const isFocus = computed(() => mode.value !== 'grid')

const {
  state,
  loadModels,
  modelA,
  modelB,
  buttonsA,
  buttonsB,
  interactablesA,
  interactablesB,
  emissiveA,
  emissiveB,
} = useCompareModels(props.config, props.quality, renderer)

// OPTIMIZATION: Bake shadows once (Professional performance)
useShadowBaking(renderer, state, invalidate)

// --- 2. Layout ---
const { layout, applyMode, applyGridLayout } = useCompareLayout(
  modelA,
  modelB,
  computed(() => props.device),
)

let ctx: gsap.Context | null = null

// --- 3. Interaction (Mouse & Click) ---
const {
  camNudge,
  fovNudge,
  lookAtRef,
  pointer,
  drag,
  resetCamera,
  handlePointerDown,
  handleModelClick: _handleModelClick,
} = useCompareInteraction(
  computed(() => props.active),
  computed(() => props.device),
  mode,
  groupA,
  groupB,
  computed(() => props.reducedMotion),
  computed(() => layout.value.lookAt),
  (newMode) => handleModeChange(newMode),
  () => emitFromCanvas(),
)

// Wrapper for click to handle scrolling
function handleModelClick(e: any, targetMode: CompareMode) {
  // Disable click on mobile/tablet in grid mode to prevent accidental triggers while scrolling
  if (props.device !== 'desktop' && internalMode.value === 'grid') {
    return
  }

  // If we are about to enter a focus mode from grid, apply scroll logic
  if (internalMode.value === 'grid' && targetMode !== 'grid') {
    savedScrollY = window.scrollY
    const section = document.querySelector('.section_arcade-scene')
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
  // If we are clicking (toggling) back to grid
  else if (internalMode.value === targetMode) {
    // We are in focus mode and clicked the same model -> go back to grid
    window.scrollTo({ top: savedScrollY, behavior: 'smooth' })
  }

  // Delegate to composable
  _handleModelClick(e, targetMode)
}

const isDragging = computed(() => drag.isDragging.value)
function onPointerDownWrapper(e: any) {
  hasInteracted.value = true
  handlePointerDown(e)
}

// Hover Effect
function handleHover(target: 'a' | 'b' | null) {
  if (props.device !== 'desktop') return
  if (isDragging.value) return // Don't override cursor while dragging

  if (!modelA.value || !modelB.value) return

  // Cursor logic
  if (target) {
    if (mode.value === 'grid') {
      document.body.style.cursor = 'pointer'
    } else {
      document.body.style.cursor = 'grab'
    }
  } else {
    document.body.style.cursor = 'default'
  }

  // Scale logic - ONLY IN GRID
  if (mode.value !== 'grid') return

  if (!ctx) ctx = gsap.context(() => {})

  const gridCfg = CONSTANTS.grid.desktop

  const animate = (obj: any, s: number) =>
    gsap.to(obj.scale, {
      x: s,
      y: s,
      z: s,
      duration: 0.4,
      ease: 'back.out(1.5)',
      overwrite: true,
    })

  if (target === 'a') {
    animate(modelA.value, gridCfg.a.scale * 1.12)
    animate(modelB.value, gridCfg.b.scale)
  } else if (target === 'b') {
    animate(modelA.value, gridCfg.a.scale)
    animate(modelB.value, gridCfg.b.scale * 1.12)
  } else {
    animate(modelA.value, gridCfg.a.scale)
    animate(modelB.value, gridCfg.b.scale)
  }
}

// Watch drag state for cursor
watch(isDragging, (dragging) => {
  if (dragging) {
    document.body.style.cursor = 'grabbing'
    onGlowLeave()
  } else {
    document.body.style.cursor = 'grab'
  }
})

// --- Watch External Trigger ---
const isInternalUpdate = ref(false)

watch(
  () => props.trigger,
  () => {
    // Guard: If we just updated locally, ignore the echo from Webflow
    if (isInternalUpdate.value) {
      isInternalUpdate.value = false
      return
    }

    if (internalMode.value === 'grid') {
      handleModeChange('focus-b', false) // External trigger
    } else {
      handleModeChange('grid', false) // External trigger
    }
  },
)

// --- 4. Hotspots ---
const {
  activeInteraction,
  tooltipVisible,
  glowNudge,
  lookAtNudge, // Re-enabled
  onGlowEnter,
  onGlowLeave,
  reset: resetHotspots,
} = useInteractiveHotspots(computed(() => layout.value.camPos))

// --- 5. Webflow Events ---
onMounted(() => {
  window.addEventListener('jenka-set-mode', onExternalSetMode)
  ctx = gsap.context(() => {})

  // Restore mode from DOM if present
  if (props.container) {
    const saved = props.container.getAttribute('data-mode')
    if (saved && (saved === 'focus-a' || saved === 'focus-b')) {
      handleModeChange(saved as CompareMode, false)
    }
  }
})

onUnmounted(() => {
  window.removeEventListener('jenka-set-mode', onExternalSetMode)
  ctx?.revert()
  glintsA?.dispose()
  glintsB?.dispose()
  if (modelA.value) disposeObject3D(modelA.value)
  if (modelB.value) disposeObject3D(modelB.value)
  invisibleMaterial.dispose()
})

let savedScrollY = 0

function onExternalSetMode(e: any) {
  const targetMode = e.detail?.mode
  if (targetMode && ['grid', 'focus-a', 'focus-b'].includes(targetMode)) {
    // Scroll Logic:
    // If entering focus mode (from grid), save scroll and go to top of section
    if (targetMode !== 'grid' && internalMode.value === 'grid') {
      savedScrollY = window.scrollY
      const section = document.querySelector('.section_arcade-scene')
      if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    // If going back to grid, restore scroll
    else if (targetMode === 'grid' && internalMode.value !== 'grid') {
      // Use timeout to allow transition to start/finish if needed,
      // but immediate feels snappier. Smooth scroll back.
      window.scrollTo({ top: savedScrollY, behavior: 'smooth' })
    }

    handleModeChange(targetMode as CompareMode, false)
  }
}

function handleModeChange(newMode: CompareMode, internal = true) {
  if (internal) {
    isInternalUpdate.value = true
    emitFromCanvas()
  }

  internalMode.value = newMode
  if (newMode !== 'grid') hasInteracted.value = false
  emit('change-mode', newMode)

  // Set attribute manually if internal (since Webflow didn't do it yet)
  // If external, Webflow likely already set it, but setting it again is harmless
  if (props.container) {
    props.container.setAttribute('data-mode', newMode)
  }

  // Check if we need to reset camera BEFORE resetting hotspots (which clears activeInteraction)
  if (activeInteraction.value) {
    resetCamera()
  }

  resetHotspots()
  document.body.style.cursor = 'default'

  applyMode(newMode, !props.reducedMotion)

  if (newMode === 'grid') {
    // Safety: Ensure visibility is restored in case fadeObject logic missed a frame
    if (modelA.value) modelA.value.visible = true
    if (modelB.value) modelB.value.visible = true
  }
}

// --- 6. Effects ---
let glintsA: ReturnType<typeof createAttachedGlints> | null = null
let glintsB: ReturnType<typeof createAttachedGlints> | null = null

const postfx = computed(() =>
  getPostFXSettings({
    quality: props.quality,
    bloomMultiplier: props.bloom,
    reducedMotion: props.reducedMotion,
    focusBoost: isFocus.value ? 1.15 : 1,
  }),
)

// PUNCHY LIGHTING CONFIG (Softened slightly to save screens)
const lightConfig = computed(() => {
  const isMobile = props.device === 'mobile'
  const intensityMod = isMobile ? 0.8 : 1.0

  // Focus A: Key from Left, Fill from Right (Mirrored Arcade values)
  if (mode.value === 'focus-a') {
    return {
      key: {
        pos: [-3.5, 5.5, 6.5] as [number, number, number],
        intensity: 1.6 * intensityMod, // Reduced from 2.0
      },
      fill: {
        pos: [6.5, 2.5, 4.0] as [number, number, number],
        intensity: 0.6 * intensityMod,
      },
      rim: {
        pos: [0.0, 4.0, -6.0] as [number, number, number],
        intensity: 1.2 * intensityMod, // Reduced from 1.5
      },
    }
  }
  // Focus B or Grid: Key from Right, Fill from Left (Standard Arcade values)
  return {
    key: {
      pos: [3.5, 5.5, 6.5] as [number, number, number],
      intensity: 1.6 * intensityMod, // Reduced from 2.0
    },
    fill: {
      pos: [-6.5, 2.5, 4.0] as [number, number, number],
      intensity: 0.6 * intensityMod,
    },
    rim: {
      pos: [0.0, 4.0, -6.0] as [number, number, number],
      intensity: 1.2 * intensityMod, // Reduced from 1.5
    },
  }
})

const glowGeom = new SphereGeometry(0.1, 16, 16)
const invisibleMaterial = new MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false,
  side: DoubleSide,
  color: 0xffffff,
})

watch(state, (s) => emit('state', s))

watch(
  () => [props.config.modelA, props.config.modelB, props.quality],
  async () => {
    await loadModels({
      emissive: props.emissive,
      envIntensity: props.envIntensity,
    })

    // Safari Fix: Compile shaders async to prevent main thread freeze
    const r = unwrapRenderer(renderer)
    if (r && camera.value) {
      if (modelA.value) {
        await precompileScene(r, toRaw(modelA.value), camera.value)
      }
      if (modelB.value) {
        await precompileScene(r, toRaw(modelB.value), camera.value)
      }
    }
  },
  { immediate: true, deep: true },
)

// Handle Glints & Layout when models (state) OR device changes
watch(
  () => [state.value, props.device, props.quality],
  () => {
    if (state.value !== 'ready') return

    // Clean up previous glints
    if (glintsA) {
      glintsA.dispose()
      glintsA = null
    }
    if (glintsB) {
      glintsB.dispose()
      glintsB = null
    }

    const isDesktop = props.device === 'desktop'

    const targetsA = [...buttonsA.value]
    glintsA =
      isDesktop && targetsA.length > 0
        ? createAttachedGlints({
            targets: targetsA,
            opacity: CONSTANTS.glints.opacity,
            size: CONSTANTS.glints.size,
          })
        : null

    const targetsB = [...buttonsB.value]
    glintsB =
      isDesktop && targetsB.length > 0
        ? createAttachedGlints({
            targets: targetsB,
            opacity: CONSTANTS.glints.opacity,
            size: CONSTANTS.glints.size,
          })
        : null

    // Set initial state based on mode
    glintsA?.setEnabled?.(mode.value === 'focus-a')
    glintsB?.setEnabled?.(mode.value === 'focus-b')

    applyGridLayout()
    if (mode.value !== 'grid') {
      applyMode(mode.value, false)
    }
  },
  { immediate: true },
)

watch(mode, (newMode) => {
  glintsA?.setEnabled?.(newMode === 'focus-a')
  glintsB?.setEnabled?.(newMode === 'focus-b')
})
watch(
  () => [mode.value, props.device],
  ([m, d]) => {
    if (d !== 'desktop') {
      document.body.style.overflow = m !== 'grid' ? 'hidden' : ''
    }
  },
  { immediate: true },
)
onUnmounted(() => {
  document.body.style.overflow = ''
})

watch(
  () => props.emissive,
  (newVal, oldVal) => {
    const update = (list: any[]) =>
      list.forEach((entry) => {
        if (entry.material) {
          // Обновляем базу (на случай пропорций)
          // Но главное - обновляем сам material:
          entry.material.emissiveIntensity = newVal
        }
      })
    update(emissiveA.value)
    update(emissiveB.value)
  },
  { immediate: true },
)

// --- Render Loop ---
const stageRef = shallowRef<any>(null)
const cameraRef = shallowRef<PerspectiveCamera | null>(null)

// Optimized Render Loop: Direct Camera Manipulation
onBeforeRender(({ elapsed, delta }) => {
  if (!props.active || state.value !== 'ready') return
  if (typeof elapsed !== 'number' || isNaN(elapsed)) return

  // Parallax in Grid Mode
  if (stageRef.value) {
    if (mode.value === 'grid' && !props.reducedMotion && props.device === 'desktop') {
      const strength = CONSTANTS.controls.parallaxStrength
      const maxRot = 0.07 * strength
      stageRef.value.rotation.y = damp(
        stageRef.value.rotation.y,
        pointer.value.x * maxRot,
        4,
        delta,
      )
      stageRef.value.rotation.x = damp(
        stageRef.value.rotation.x,
        -pointer.value.y * maxRot * 0.7,
        4,
        delta,
      )
    } else {
      stageRef.value.rotation.x = damp(stageRef.value.rotation.x, 0, 4, delta)
      stageRef.value.rotation.y = damp(stageRef.value.rotation.y, 0, 4, delta)
    }
  }

  // Camera Updates (Moved from Computed to Loop for Performance)
  if (cameraRef.value) {
    // 1. Update Position
    const cx = layout.value.camPos[0] + camNudge.x + glowNudge.x
    const cy = layout.value.camPos[1] + camNudge.y + glowNudge.y
    const cz = layout.value.camPos[2] + camNudge.z + glowNudge.z
    cameraRef.value.position.set(cx, cy, cz)

    // 2. Update LookAt (Standard Center LookAt + Nudge)
    cameraRef.value.lookAt(
      lookAtRef.x + lookAtNudge.x,
      lookAtRef.y + lookAtNudge.y,
      lookAtRef.z + lookAtNudge.z,
    )

    // 3. Update FOV
    const newFov = layout.value.fov + fovNudge.value
    if (Math.abs(cameraRef.value.fov - newFov) > 0.01) {
      cameraRef.value.fov = newFov
      cameraRef.value.updateProjectionMatrix()
    }
  }

  try {
    glintsA?.update(elapsed)
    glintsB?.update(elapsed + 0.5)
  } catch (e) {
    // Suppress update errors to keep scene alive
  }
})
</script>

<template>
  <TresPerspectiveCamera ref="cameraRef" make-default :position="[0, 0, 10]" />

  <Suspense>
    <Environment preset="city" :blur="1.0" :background="false" />
  </Suspense>

  <!-- Professional Studio Lighting -->
  <TresAmbientLight :intensity="0.6" />

  <!-- Key Light: Main source -->
  <TresDirectionalLight
    :position="lightConfig.key.pos"
    :intensity="lightConfig.key.intensity"
    :cast-shadow="quality === 'high'"
    :shadow-bias="-0.0001"
  />

  <!-- Fill Light: Softens shadows -->
  <TresDirectionalLight
    :position="lightConfig.fill.pos"
    :intensity="lightConfig.fill.intensity"
    color="#bcd7ff"
  />

  <!-- Rim Light: Backlight for separation -->
  <TresDirectionalLight
    :position="lightConfig.rim.pos"
    :intensity="lightConfig.rim.intensity"
  />

  <TresGroup ref="stageRef" :position="layout.stagePos">
    <!-- Group A -->
    <TresGroup ref="groupA">
      <primitive
        v-if="modelA"
        :object="getRaw(modelA)"
        @click="(e: any) => handleModelClick(e, 'focus-a')"
        @pointer-down="onPointerDownWrapper"
        @pointerdown="onPointerDownWrapper"
        @pointer-enter="() => handleHover('a')"
        @pointerenter="() => handleHover('a')"
        @pointer-leave="() => handleHover(null)"
        @pointerleave="() => handleHover(null)"
      >
        <template v-if="mode === 'focus-a'">
          <!-- Hotspots: Reusing Geometry/Material via Vue Loop -->
          <TresMesh
            v-for="item in interactablesA"
            :key="item.id"
            :position="item.position"
            :scale="
              activeInteraction === item.id ? [1.6, 1.6, 1.6] : [1.0, 1.0, 1.0]
            "
            :geometry="glowGeom"
            :material="invisibleMaterial"
            :user-data="{
              id: item.id,
              label: item.label,
              isHotspot: true,
              item,
            }"
            @pointerenter="
              (e: any) =>
                device === 'desktop' &&
                mode === 'focus-a' &&
                !isDragging &&
                onGlowEnter(item, e.point)
            "
            @pointerleave="onGlowLeave"
            @click="(e: any) => handleModelClick(e, 'focus-a')"
            @pointer-down="onPointerDownWrapper"
            @pointerdown="onPointerDownWrapper"
          >
            <Html
              v-if="activeInteraction === item.id && tooltipVisible"
              :distance-factor="1.2"
              :transform="false"
              :style="{ pointerEvents: 'none' }"
            >
              <div
                class="jenka-tech-hud"
                :class="{ 'is-mirrored': item.position[0] < 0 }"
              >
                <div class="hud-box">
                  {{ item.label }}
                </div>
                <svg
                  class="hud-leader"
                  viewBox="0 0 60 40"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M60 40 L50 40 L20 0 H0"
                    vector-effect="non-scaling-stroke"
                  />
                  <g class="hud-marker">
                    <circle cx="60" cy="40" r="1.5" fill="white" />
                    <circle
                      cx="60"
                      cy="40"
                      r="3.5"
                      stroke="white"
                      stroke-width="0.5"
                      fill="none"
                      opacity="0.6"
                    />
                  </g>
                </svg>
              </div>
            </Html>
          </TresMesh>
        </template>
      </primitive>
    </TresGroup>

    <!-- Group B -->
    <TresGroup ref="groupB">
      <primitive
        v-if="modelB"
        :object="getRaw(modelB)"
        @click="(e: any) => handleModelClick(e, 'focus-b')"
        @pointer-down="onPointerDownWrapper"
        @pointerdown="onPointerDownWrapper"
        @pointer-enter="() => handleHover('b')"
        @pointerenter="() => handleHover('b')"
        @pointer-leave="() => handleHover(null)"
        @pointerleave="() => handleHover(null)"
      >
        <template v-if="mode === 'focus-b'">
          <!-- Hotspots B -->
          <TresMesh
            v-for="item in interactablesB"
            :key="item.id"
            :position="item.position"
            :scale="
              activeInteraction === item.id ? [1.6, 1.6, 1.6] : [1.0, 1.0, 1.0]
            "
            :geometry="glowGeom"
            :material="invisibleMaterial"
            :user-data="{
              id: item.id,
              label: item.label,
              isHotspot: true,
              item,
            }"
            @pointerenter="
              (e: any) =>
                device === 'desktop' &&
                mode === 'focus-b' &&
                !isDragging &&
                onGlowEnter(item, e.point)
            "
            @pointerleave="onGlowLeave"
            @click="(e: any) => handleModelClick(e, 'focus-b')"
            @pointer-down="onPointerDownWrapper"
            @pointerdown="onPointerDownWrapper"
          >
            <Html
              v-if="activeInteraction === item.id && tooltipVisible"
              :distance-factor="1.2"
              :transform="false"
              :style="{ pointerEvents: 'none' }"
            >
              <div
                class="jenka-tech-hud"
                :class="{ 'is-mirrored': item.position[0] < 0 }"
              >
                <div class="hud-box">
                  {{ item.label }}
                </div>
                <svg
                  class="hud-leader"
                  viewBox="0 0 60 40"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M60 40 L50 40 L20 0 H0"
                    vector-effect="non-scaling-stroke"
                  />
                  <g class="hud-marker">
                    <circle cx="60" cy="40" r="1.5" fill="white" />
                    <circle
                      cx="60"
                      cy="40"
                      r="3.5"
                      stroke="white"
                      stroke-width="0.5"
                      fill="none"
                      opacity="0.6"
                    />
                  </g>
                </svg>
              </div>
            </Html>
          </TresMesh>
        </template>
      </primitive>
    </TresGroup>
  </TresGroup>

  <Suspense>
    <!-- CRITICAL CRASH FIX: Disable Post-Processing on ALL mobile devices -->
    <EffectComposerPmndrs
      v-if="
        quality === 'high' &&
        device === 'desktop' &&
        state === 'ready' &&
        rendererReady
      "
      :multisampling="0"
    >
      <BloomPmndrs
        v-if="postfx.bloom.enabled"
        :intensity="postfx.bloom.strength"
        :luminance-threshold="postfx.bloom.threshold"
        :luminance-smoothing="0.2"
        :radius="postfx.bloom.radius"
        mipmap-blur
      />
      <BrightnessContrastPmndrs :contrast="0.05" :brightness="0.0" />
      <ToneMappingPmndrs :mode="ToneMappingMode.ACES_FILMIC" :exposure="1.0" />
      <SMAA v-if="postfx.smaa" />
    </EffectComposerPmndrs>
  </Suspense>
  <Html
    v-if="!hasInteracted && isFocus && device !== 'desktop'"
    center
    :position="[0, 0, 0]"
    wrapper-class="hint-wrapper"
    :style="{ pointerEvents: 'none', zIndex: 100 }"
    ><div
      style="
        opacity: 0.9;
        animation: hint-pulse 2.5s infinite;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        pointer-events: none;
      "
    >
      <svg
        width="70"
        height="70"
        viewBox="0 0 24 24"
        fill="white"
        style="filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))"
      >
        <path
          d="M12 7C6.5 7 2 9.2 2 12c0 2.2 2.9 4.1 7 4.8V20l4-4l-4-4v2.7c-3.2-.6-5-1.9-5-2.7c0-1.1 3-3 8-3s8 1.9 8 3c0 .7-1.5 1.9-4 2.5v2.1c3.5-.8 6-2.5 6-4.6c0-2.8-4.5-5-10-5"
        /></svg
      ><span
        style="
          color: white;
          font-family: sans-serif;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 1px;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
          opacity: 0.9;
          text-align: center;
        "
        >SWIPE TO ROTATE</span
      >
    </div></Html
  >
</template>

<style>
@keyframes hint-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.1);
    opacity: 1;
  }
}
</style>
