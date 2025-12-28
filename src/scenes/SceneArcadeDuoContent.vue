<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useLoop, useTres } from '@tresjs/core'

import {
  BloomPmndrs,
  BrightnessContrastPmndrs,
  EffectComposerPmndrs,
  SMAA,
  ToneMappingPmndrs,
  VignettePmndrs,
} from '@tresjs/post-processing'
import { ToneMappingMode } from 'postprocessing'
import { Environment } from '@tresjs/cientos'

import type { PerspectiveCamera } from 'three'
import type {
  DeviceClass,
  LoaderState,
  QualityTier,
  WebflowSceneConfig,
} from '../shared/types'
import { getPostFXSettings } from '../three/postfx'
import { useShadowBaking } from '../three/utils'
import { createAttachedGlints } from '../three/glow'

import { CONSTANTS } from './arcade/config'
import { useArcadeModels } from './arcade/useArcadeModels'
import { useArcadeInteraction } from './arcade/useArcadeInteraction'
import { useWebflowIntegration } from '../shared/useWebflowIntegration'

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

const { emitFromCanvas } = useWebflowIntegration(props.container)

const emit = defineEmits<{
  (e: 'state', state: LoaderState): void
}>()

const cameraRef = shallowRef<PerspectiveCamera | null>(null)
const stageRef = shallowRef<any>(null)

const { renderer, invalidate } = useTres()
const { start, stop, onBeforeRender } = useLoop()

watch(
  () => props.active,
  (v) => (v ? start() : stop()),
  { immediate: true },
)

// --- Models ---
const {
  state,
  modelA,
  modelB,
  buttonsA,
  buttonsB,
  loadModels,
  LAYER_A,
  LAYER_B,
} = useArcadeModels(
  props.config,
  props.quality,
  renderer,
  computed(() => props.device),
)

watch(state, (s) => emit('state', s))

// OPTIMIZATION: Bake shadows once (Professional performance)
useShadowBaking(renderer, state, invalidate)

watch(cameraRef, (cam) => {
  if (cam) {
    cam.layers.enable(LAYER_A)
    cam.layers.enable(LAYER_B)
  }
})

watch(
  () => [props.config.modelA, props.config.modelB, props.quality],
  () => {
    loadModels({
      emissive: props.emissive,
      envIntensity: props.envIntensity,
    })
  },
  { immediate: true },
)

// --- Glints ---
let glintsA: ReturnType<typeof createAttachedGlints> | null = null
let glintsB: ReturnType<typeof createAttachedGlints> | null = null

watch(
  [buttonsA, buttonsB, () => props.quality],
  () => {
    if (glintsA) glintsA.dispose()
    if (glintsB) glintsB.dispose()

    if (props.quality === 'low') return

    if (buttonsA.value.length) {
      glintsA = createAttachedGlints({
        targets: buttonsA.value,
        opacity: 0.9,
        size: 0.15,
      })
    }
    if (buttonsB.value.length) {
      glintsB = createAttachedGlints({
        targets: buttonsB.value,
        opacity: 0.9,
        size: 0.15,
      })
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  glintsA?.dispose()
  glintsB?.dispose()
})

onBeforeRender(({ elapsed }) => {
  if (!props.active) return
  if (typeof elapsed !== 'number' || isNaN(elapsed)) return

  try {
    glintsA?.update(elapsed)
    glintsB?.update(elapsed + 0.5) // Offset phase
  } catch (e) {}
})

// Semaphore
const isInternalUpdate = ref(false)

// Internal callback from hook
const onInternalSwap = () => {
  isInternalUpdate.value = true
  emitFromCanvas()
}

// --- Interaction (Swap & Parallax) ---
const { cameraPosition, handleClick, handleHover, swap } = useArcadeInteraction(
  computed(() => props.active),
  computed(() => props.device),
  computed(() => props.reducedMotion),
  props.container,
  cameraRef,
  modelA,
  modelB,
  invalidate,
  onInternalSwap,
)

// Watch external trigger (HTML click -> data-toggle -> prop -> swap)
watch(
  () => props.trigger,
  () => {
    if (isInternalUpdate.value) {
      isInternalUpdate.value = false
      return
    }
    swap()
  },
)

// --- Optimizations ---
const lightConfig = computed(() => {
  const isMobile = props.device === 'mobile'
  const intensityMod = isMobile ? 0.8 : 1.0

  return {
    key: {
      pos: [3.5, 5.5, 6.5] as [number, number, number],
      intensity: 2.0 * intensityMod,
    },
    fill: {
      pos: [-6.5, 2.5, 4.0] as [number, number, number],
      intensity: 0.5 * intensityMod,
    },
    rim: {
      pos: [0.0, 4.0, -6.0] as [number, number, number],
      intensity: 1.5 * intensityMod,
    },
  }
})

const postfx = computed(() =>
  getPostFXSettings({
    quality: props.quality,
    bloomMultiplier: props.bloom,
    reducedMotion: props.reducedMotion,
  }),
)

const stagePos = computed(() => {
  return (
    CONSTANTS.layout.stagePos[props.device] || CONSTANTS.layout.stagePos.desktop
  )
})
</script>

<template>
  <TresPerspectiveCamera
    ref="cameraRef"
    :position="cameraPosition"
    :fov="CONSTANTS.layout.fov"
    :look-at="CONSTANTS.layout.lookAt"
  />

  <Suspense>
    <Environment preset="city" :blur="1.0" :background="false" />
  </Suspense>

  <!-- Professional Studio Lighting (Matched to Compare Scene) -->
  <TresAmbientLight :intensity="0.05" />

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

  <TresGroup ref="stageRef" :position="stagePos">
    <primitive
      v-if="modelA"
      :object="modelA"
      @click="(e: any) => handleClick(e, 'A')"
      @pointer-enter="() => handleHover('A', true)"
      @pointerenter="() => handleHover('A', true)"
      @pointer-leave="() => handleHover('A', false)"
      @pointerleave="() => handleHover('A', false)"
    />
    <primitive
      v-if="modelB"
      :object="modelB"
      @click="(e: any) => handleClick(e, 'B')"
      @pointer-enter="() => handleHover('B', true)"
      @pointerenter="() => handleHover('B', true)"
      @pointer-leave="() => handleHover('B', false)"
      @pointerleave="() => handleHover('B', false)"
    />
  </TresGroup>

  <Suspense>
    <EffectComposerPmndrs
      v-if="quality === 'high'"
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
      <VignettePmndrs v-if="postfx.vignette" :darkness="0.5" :offset="0.1" />
      <SMAA v-if="postfx.smaa" />
    </EffectComposerPmndrs>
  </Suspense>
</template>
