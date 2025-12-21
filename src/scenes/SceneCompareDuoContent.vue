<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, shallowRef } from 'vue'
import { useLoop, useTres } from '@tresjs/core'
import gsap from 'gsap'
import { SphereGeometry } from 'three'

import {
  BloomPmndrs as Bloom,
  BrightnessContrastPmndrs as BrightnessContrast,
  EffectComposerPmndrs as EffectComposer,
  SMAAPmndrs as SMAA,
  VignettePmndrs as Vignette,
} from '@tresjs/post-processing'
import { BlendFunction } from 'postprocessing'
import { Environment, Html } from '@tresjs/cientos'

import type {
  CompareMode,
  DeviceClass,
  LoaderState,
  QualityTier,
  WebflowSceneConfig,
} from '../shared/types'

import { damp } from '../shared/utils'
import { createFallbackLightRig, hasLights } from '../three/lighting'
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
  speakersA,
  speakersB,
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

// --- Watch External Trigger ---
const isInternalUpdate = ref(false)

watch(() => props.trigger, () => {
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
})

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

  glintsA?.setEnabled?.(newMode === 'focus-a')
  glintsB?.setEnabled?.(newMode === 'focus-b')
  if (newMode === 'grid') {
    glintsA?.setEnabled?.(false)
    glintsB?.setEnabled?.(false)
    
    // Safety: Ensure visibility is restored in case fadeObject logic missed a frame
    if (modelA.value) modelA.value.visible = true
    if (modelB.value) modelB.value.visible = true
  }
}

// --- 6. Effects ---
let glintsA: ReturnType<typeof createAttachedGlints> | null = null
let glintsB: ReturnType<typeof createAttachedGlints> | null = null

const rig = createFallbackLightRig(1)
const showRig = computed(() => {
  if (!modelA.value || !modelB.value) return true
  return !(hasLights(modelA.value) || hasLights(modelB.value))
})

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
  // Optimization: 4x is too heavy for many devices. 2x is sufficient for high.
  if (useComposer.value && props.quality === 'high') return 2
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
      duration: 0.25,
      ease: 'power2.out',
      overwrite: true,
    })

  if (target === 'a') {
    animate(modelA.value, gridCfg.a.scale * 1.05)
    animate(modelB.value, gridCfg.b.scale)
  } else if (target === 'b') {
    animate(modelA.value, gridCfg.a.scale)
    animate(modelB.value, gridCfg.b.scale * 1.05)
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

      glintsA?.setEnabled?.(false)
      glintsB?.setEnabled?.(false)

      applyGridLayout()
      applyMode(mode.value, false)
    })
  },
  { immediate: true, deep: true },
)

watch(
  () => props.emissive,
  (newVal, oldVal) => {
    const ratio = newVal / (oldVal || 0.001)
    const update = (list: any[]) => list.forEach((e) => (e.base *= ratio))
    update(emissiveA.value)
    update(emissiveB.value)
  },
)

watch(
  () => props.envIntensity,
  (val) => {
    const apply = (m: any) =>
      m?.traverse((o: any) => {
        if (o.isMesh && o.material) {
          ;(Array.isArray(o.material) ? o.material : [o.material]).forEach(
            (mat: any) => (mat.envMapIntensity = val),
          )
        }
      })
    apply(modelA.value)
    apply(modelB.value)
  },
)

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

  // Subtle environment rotation for "alive" reflections
  if (scene.value?.environment) {
    scene.value.environment.rotation += delta * 0.05
  }

  if (!props.reducedMotion) {
    const pulse = 0.96 + 0.04 * Math.sin(elapsed * 1.0)
    const update = (list: any[]) =>
      list.forEach((e) => (e.material.emissiveIntensity = e.base * pulse))
    update(emissiveA.value)
    update(emissiveB.value)
  }

  // Параллакс в Grid режиме
  if (stageRef.value) {
    if (mode.value === 'grid' && !props.reducedMotion) {
      const strength = CONSTANTS.controls.parallaxStrength
      const maxRot = 0.07 * strength
      stageRef.value.rotation.y = damp(stageRef.value.rotation.y, pointer.value.x * maxRot, 4, delta)
      stageRef.value.rotation.x = damp(stageRef.value.rotation.x, -pointer.value.y * maxRot * 0.7, 4, delta)
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
    <Environment preset="city" :blur="0.5" :background-intensity="0.5" />
  </Suspense>
  <TresAmbientLight :intensity="0.5" />

  <primitive v-if="showRig" :object="rig" />

  <EffectComposer v-if="useComposer" :multisampling="multisampling">
    <Bloom
      v-if="postfx.bloom.enabled"
      :intensity="postfx.bloom.strength"
      :luminance-threshold="postfx.bloom.threshold"
      :luminance-smoothing="postfx.bloom.radius"
    />
    <BrightnessContrast :contrast="0.25" :brightness="0.01" />
    <Vignette :offset="0.3" :darkness="0.5" />
    <SMAA v-if="postfx.smaa" />
  </EffectComposer>

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
            @pointerenter="device === 'desktop' && mode === 'focus-a' && onGlowEnter(item)"
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
              :center="true"
              :style="{ pointerEvents: 'none' }"
            >
              <div
                class="jenka-leader-tooltip"
                :class="{ 'is-mirrored': item.position[0] < 0 }"
              >
                <img src="/ui/hud-leader.svg" class="leader-svg" alt="" />
                <div class="leader-label">{{ item.label }}</div>
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
            @pointerenter="device === 'desktop' && mode === 'focus-b' && onGlowEnter(item)"
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
              :center="true"
              :style="{ pointerEvents: 'none' }"
            >
              <div
                class="jenka-leader-tooltip"
                :class="{ 'is-mirrored': item.position[0] < 0 }"
              >
                <img src="/ui/hud-leader.svg" class="leader-svg" alt="" />
                <div class="leader-label">{{ item.label }}</div>
              </div>
            </Html>
          </TresMesh>
        </template>
      </primitive>
    </TresGroup>
  </TresGroup>
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
