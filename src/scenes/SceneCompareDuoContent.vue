<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useLoop, useTres } from '@tresjs/core'
import gsap from 'gsap'
import { SphereGeometry } from 'three'

import {
  BloomPmndrs,
  BrightnessContrastPmndrs,
  EffectComposerPmndrs,
  SMAAPmndrs as SMAA,
} from '@tresjs/post-processing'
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
import { unwrapRenderer } from '../three/utils'

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

const { emitFromCanvas } = useWebflowIntegration(props.container)

const { renderer, scene } = useTres()
const { onBeforeRender, start, stop } = useLoop()

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
} = useCompareModels(props.config, props.quality, unwrapRenderer(renderer))

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
  handleModelClick,
} = useCompareInteraction(
  computed(() => props.active),
  mode,
  groupA,
  groupB,
  computed(() => props.reducedMotion),
  computed(() => layout.value.lookAt),
  (newMode) => handleModeChange(newMode),
  () => emitFromCanvas(),
)

const isDragging = computed(() => drag.isDragging.value)

// Reset interaction if dragging starts
watch(isDragging, (dragging) => {
  if (dragging) {
    onGlowLeave()
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
  onGlowEnter,
  onGlowLeave,
  reset: resetHotspots,
} = useInteractiveHotspots(computed(() => layout.value.camPos))

// --- 5. Webflow Events ---
onMounted(() => {
  window.addEventListener('jenka-set-mode', onExternalSetMode)
})

onUnmounted(() => {
  window.removeEventListener('jenka-set-mode', onExternalSetMode)
})

function onExternalSetMode(e: any) {
  const targetMode = e.detail?.mode
  if (targetMode && ['grid', 'focus-a', 'focus-b'].includes(targetMode)) {
    handleModeChange(targetMode as CompareMode, false)
  }
}

function handleModeChange(newMode: CompareMode, internal = true) {
  if (internal) {
    isInternalUpdate.value = true
    emitFromCanvas()
  }

  const prev = internalMode.value
  internalMode.value = newMode
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

  // Glow buttons logic: only show for the focused model
  glintsA?.setEnabled?.(newMode === 'focus-a')
  glintsB?.setEnabled?.(newMode === 'focus-b')

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
const useComposer = computed(
  () => postfx.value.bloom.enabled || postfx.value.smaa,
)
const multisampling = computed(() => {
  if (useComposer.value && props.quality === 'high') return 4
  return 0
})

const glowGeom = new SphereGeometry(0.1, 16, 16)

// Hover Effect
function handleHover(target: 'a' | 'b' | null) {
  if (!modelA.value || !modelB.value) return

  // Cursor logic
  if (target) {
    document.body.style.cursor = 'pointer'
  } else {
    document.body.style.cursor = 'default'
  }

  // Scale logic - ONLY IN GRID
  if (mode.value !== 'grid') return

  if (!ctx) ctx = gsap.context(() => {})

  let gridCfg = CONSTANTS.grid.desktop
  if (props.device === 'mobile') gridCfg = CONSTANTS.grid.mobile
  if (props.device === 'tablet') gridCfg = CONSTANTS.grid.tablet

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

// --- Lifecycle ---
onMounted(() => {
  ctx = gsap.context(() => {})
})

onUnmounted(() => {
  ctx?.revert()
  glintsA?.dispose()
  glintsB?.dispose()
  if (modelA.value) disposeObject3D(modelA.value)
  if (modelB.value) disposeObject3D(modelB.value)
})

watch(
  () => props.active,
  (v) => (v ? start() : stop()),
  { immediate: true },
)
watch(state, (s) => emit('state', s))

watch(
  () => [props.config.modelA, props.config.modelB, props.quality, props.device],
  () => {
    loadModels({
      emissive: props.emissive,
      envIntensity: props.envIntensity,
    }).then(() => {
      const isDesktop = props.device === 'desktop'

      const targetsA = [...buttonsA.value]
      // Glints enabled
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

      // Glints are disabled in Grid mode by default
      glintsA?.setEnabled?.(mode.value === 'focus-a')
      glintsB?.setEnabled?.(mode.value === 'focus-b')

      applyGridLayout()
    })
  },
  { immediate: true, deep: true },
)

watch(
  () => props.emissive,
  (newVal, oldVal) => {
    const update = (list: any[]) =>
      list.forEach((entry) => {
        if (entry.material) {
          // Обновляем базу (на случай пропорций)
          // Но главное - обновляем сам материал:
          entry.material.emissiveIntensity = newVal
        }
      })
    update(emissiveA.value)
    update(emissiveB.value)
  },
  { immediate: true },
)

// --- Render Loop ---

watch(
  () => props.device,
  () => {
    applyGridLayout()
    if (state.value === 'ready') applyMode(mode.value, false)
  },
)

// --- Render Loop ---
onBeforeRender(({ elapsed, delta }) => {
  if (!props.active || state.value !== 'ready') return

  // Параллакс в Grid режиме
  if (stageRef.value) {
    if (mode.value === 'grid' && !props.reducedMotion) {
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

  glintsA?.update(elapsed)
  glintsB?.update(elapsed + 0.5)
})

const stageRef = shallowRef<any>(null)
const cameraPos = computed(() => [
  layout.value.camPos[0] + camNudge.x + glowNudge.x,
  layout.value.camPos[1] + camNudge.y + glowNudge.y,
  layout.value.camPos[2] + camNudge.z + glowNudge.z,
])
const cameraLookAt = computed(() => [lookAtRef.x, lookAtRef.y, lookAtRef.z])
const cameraFov = computed(() => layout.value.fov + fovNudge.value)
</script>

<template>
  <TresPerspectiveCamera
    make-default
    :position="cameraPos as any"
    :fov="cameraFov"
    :look-at="cameraLookAt"
  />

  <Suspense>
    <Environment
      preset="city"
      :blur="0.9"
      :background="false"
    />
  </Suspense>

  <!-- Lighting matched to ArcadeDuo -->
  <TresAmbientLight :intensity="0.2" color="#ffffff" />

  <TresGroup ref="stageRef" :position="layout.stagePos">
    <!-- Group A -->
    <TresGroup ref="groupA">
      <primitive
        v-if="modelA"
        :object="modelA"
        @click="(e: any) => handleModelClick(e, 'focus-a')"
        @pointer-down="handlePointerDown"
        @pointerdown="handlePointerDown"
        @pointer-enter="() => handleHover('a')"
        @pointerenter="() => handleHover('a')"
        @pointer-leave="() => handleHover(null)"
        @pointerleave="() => handleHover(null)"
      >
        <template v-if="mode === 'focus-a'">
          <TresMesh
            v-for="item in interactablesA"
            :key="item.id"
            :geometry="glowGeom"
            :position="item.position"
            :scale="1.2"
            @pointerenter="
              device === 'desktop' &&
              mode === 'focus-a' &&
              !isDragging &&
              onGlowEnter(item)
            "
            @pointerleave="onGlowLeave"
            @click="(e: any) => handleModelClick(e, 'focus-a')"
            @pointer-down="handlePointerDown"
            @pointerdown="handlePointerDown"
          >
            <TresMeshBasicMaterial :visible="false" />
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
        :object="modelB"
        @click="(e: any) => handleModelClick(e, 'focus-b')"
        @pointer-down="handlePointerDown"
        @pointerdown="handlePointerDown"
        @pointer-enter="() => handleHover('b')"
        @pointerenter="() => handleHover('b')"
        @pointer-leave="() => handleHover(null)"
        @pointerleave="() => handleHover(null)"
      >
        <template v-if="mode === 'focus-b'">
          <TresMesh
            v-for="item in interactablesB"
            :key="item.id"
            :geometry="glowGeom"
            :position="item.position"
            :scale="1.2"
            @pointerenter="
              device === 'desktop' &&
              mode === 'focus-b' &&
              !isDragging &&
              onGlowEnter(item)
            "
            @pointerleave="onGlowLeave"
            @click="(e: any) => handleModelClick(e, 'focus-b')"
            @pointer-down="handlePointerDown"
            @pointerdown="handlePointerDown"
          >
            <TresMeshBasicMaterial :visible="false" />
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
    <EffectComposerPmndrs :multisampling="multisampling">
      <BloomPmndrs
        :intensity="postfx.bloom.strength"
        :luminance-threshold="postfx.bloom.threshold"
        :luminance-smoothing="postfx.bloom.radius"
        mipmap-blur
      />
      <BrightnessContrastPmndrs :contrast="0.2" :brightness="0.01" />
      <SMAA v-if="postfx.smaa" />
    </EffectComposerPmndrs>
  </Suspense>
</template>

<style>
.jenka-annotation {
  font-family: sans-serif;
  pointer-events: none;
  user-select: none;
  opacity: 0;
  animation: fadeIn 0.3s forwards;
}
.jenka-annotation h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.02em;
}
.jenka-annotation p {
  margin: 0;
  font-size: 12px;
  opacity: 0.7;
}
@keyframes fadeIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
</style>
