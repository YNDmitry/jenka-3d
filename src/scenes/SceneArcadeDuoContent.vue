<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useLoop, useTres } from '@tresjs/core'

import {
  BloomPmndrs,
  BrightnessContrastPmndrs,
  EffectComposerPmndrs,
  HueSaturationPmndrs,
  SMAA,
  ToneMappingPmndrs,
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
import { disposeObject3D } from '../three/dispose'

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
const { start, stop } = useLoop()

watch(
  () => props.active,
  (v) => (v ? start() : stop()),
  { immediate: true },
)

// --- Models ---
const { state, modelA, modelB, loadModels, LAYER_A, LAYER_B } =
  useArcadeModels(renderer)

watch(state, (s) => emit('state', s))

watch(cameraRef, (cam) => {
  if (cam) {
    cam.layers.enable(LAYER_A)
    cam.layers.enable(LAYER_B)
  }
})

watch(
  () => [props.config.modelA, props.config.modelB, props.quality],
  () => {
    loadModels(
      props.config.modelA,
      props.config.modelB,
      props.quality,
      props.emissive,
      props.envIntensity,
    )
  },
  { immediate: true },
)

// Semaphore
const isInternalUpdate = ref(false)

// Internal callback from hook
const onInternalSwap = () => {
  isInternalUpdate.value = true
  emitFromCanvas()
}

// --- Interaction (Swap & Parallax) ---
const { cameraPosition, lightIntensity, handleClick, handleHover, swap } =
  useArcadeInteraction(
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
const postfx = computed(() =>
  getPostFXSettings({
    quality: props.quality,
    bloomMultiplier: props.bloom,
    reducedMotion: props.reducedMotion,
  }),
)

const useComposer = computed(
  () => postfx.value.bloom.enabled || postfx.value.smaa,
)

const multisampling = computed(() => {
  // Balanced: 2x is sufficient to hide aliasing on most screens
  if (useComposer.value && props.quality === 'high') return 2
  return 0
})

const shadowConfig = computed(() => {
  if (props.quality === 'low') {
    return { cast: false, size: 512 }
  }
  if (props.quality === 'med') {
    return { cast: true, size: 1024 }
  }
  return { cast: true, size: 2048 }
})

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
    <Environment
      preset="studio"
      :blur="0.5"
      :background="false"
    />
  </Suspense>

  <!-- Professional Studio Lighting -->
  <TresAmbientLight :intensity="0.01" />
  
  <!-- Key Light: Main source -->
  <TresDirectionalLight 
    :position="[3.5, 5.5, 6.5]" 
    :intensity="1.0" 
    cast-shadow 
  />
  
  <!-- Fill Light: Softens shadows -->
  <TresDirectionalLight :position="[-6.5, 2.5, 4.0]" :intensity="0.1" color="#bcd7ff" />
  
  <!-- Rim Light: Backlight for separation -->
  <TresDirectionalLight :position="[0.0, 4.0, -6.0]" :intensity="0.5" />

  <!-- Accent Light: Premium Violet Underglow -->
  <TresSpotLight
    :position="[0.0, -3.0, 3.0]"
    :intensity="15.0"
    color="#FF4AFF"
    :angle="1.0"
    :penumbra="1.0"
    :look-at="[0.0, -1.0, 0]"
    cast-shadow
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
    <EffectComposerPmndrs :multisampling="0">
      <BloomPmndrs
        :intensity="props.bloom"
        :luminance-threshold="1.1"
        :luminance-smoothing="0.3"
        mipmap-blur
      />
      <BrightnessContrastPmndrs :contrast="0.05" :brightness="0.0" />
      <ToneMappingPmndrs :mode="ToneMappingMode.ACES_FILMIC" :exposure="props.exposure" />
      <SMAA v-if="quality === 'high'" />
    </EffectComposerPmndrs>
  </Suspense>
</template>
