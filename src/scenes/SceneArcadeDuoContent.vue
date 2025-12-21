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
const {
  state,
  errorMessage,
  modelA,
  modelB,
  loadModels,
  LAYER_A,
  LAYER_B,
} = useArcadeModels(renderer)

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
const {
  cameraPosition,
  lightIntensity,
  handleClick,
  handleHover,
  swap,
} = useArcadeInteraction(
  computed(() => props.active),
  computed(() => props.reducedMotion),
  props.container,
  cameraRef,
  modelA,
  modelB,
  invalidate,
  onInternalSwap,
)

// Watch external trigger (HTML click -> data-toggle -> prop -> swap)
watch(() => props.trigger, () => {
  if (isInternalUpdate.value) {
    isInternalUpdate.value = false
    return
  }
  swap()
})

// --- Optimizations ---
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
  return CONSTANTS.layout.stagePos[props.device] || CONSTANTS.layout.stagePos.desktop
})

const enableSmaa = computed(() => props.quality === 'high')
const multisampling = computed(() => props.quality === 'high' ? 4 : 0)
</script>

<template>
  <TresPerspectiveCamera
    ref="cameraRef"
    :position="cameraPosition"
    :fov="CONSTANTS.layout.fov"
    :look-at="CONSTANTS.layout.lookAt"
  />

  <Suspense>
    <Environment preset="city" :blur="0.9" :background="false" />
  </Suspense>

  <TresAmbientLight :intensity="0.2" color="#ffffff" />

  <TresGroup ref="stageRef" :position="stagePos">
    <primitive
      v-if="modelA"
      :object="modelA"
      @click="(e: any) => handleClick(e, 'A')"
      @pointer-enter="() => handleHover('A', true)"
      @pointer-leave="() => handleHover('A', false)"
    />
    <primitive
      v-if="modelB"
      :object="modelB"
      @click="(e: any) => handleClick(e, 'B')"
      @pointer-enter="() => handleHover('B', true)"
      @pointer-leave="() => handleHover('B', false)"
    />
  </TresGroup>

  <Suspense>
    <EffectComposerPmndrs :multisampling="multisampling">
      <BloomPmndrs
        :intensity="0.2"
        :luminance-threshold="0.001"
        :luminance-smoothing="0.3"
        mipmap-blur
      />

      <BrightnessContrastPmndrs :contrast="0.2" :brightness="0.01" />

      <ToneMappingPmndrs :mode="ToneMappingMode.AGX" />

      <SMAA v-if="enableSmaa" />
    </EffectComposerPmndrs>
  </Suspense>
</template>