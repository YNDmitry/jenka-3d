<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useLoop, useTres } from '@tresjs/core'
import { ContactShadows, Environment } from '@tresjs/cientos'
import {
  BloomPmndrs,
  EffectComposerPmndrs,
  SMAA,
  ToneMappingPmndrs,
} from '@tresjs/post-processing'
import { ToneMappingMode } from 'postprocessing'
import { SRGBColorSpace } from 'three'

import type { PerspectiveCamera } from 'three'
import type {
  DeviceClass,
  LoaderState,
  QualityTier,
  WebflowSceneConfig,
} from '../shared/types'

import { CONSTANTS } from './hero/config'
import { useHeroModels } from './hero/useHeroModels'
import { useHeroInteraction } from './hero/useHeroInteraction'
import { useWebflowIntegration } from '../shared/useWebflowIntegration'
import { useShadowBaking } from '../three/utils'

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
const lastInteraction = ref(0)

const handleModelClick = (e: any) => {
  e?.stopPropagation?.()
  lastInteraction.value = Date.now()
  emitFromCanvas()
}

// Watch trigger
watch(() => props.trigger, () => {
  // Guard against loopback (Webflow reflecting the event back to us)
  if (Date.now() - lastInteraction.value < 300) return
  emitFromCanvas() 
})

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
  modelA,
  modelB,
  loadModels,
  LAYER_A,
  LAYER_B,
} = useHeroModels(renderer)

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

// --- Interaction (Parallax) ---
const cameraPos = computed(() => CONSTANTS.layout.camPos[props.device] || CONSTANTS.layout.camPos.desktop)

const forceReducedMotion = computed(() => 
  props.reducedMotion || props.device === 'mobile' || props.device === 'tablet'
)

useHeroInteraction(
  computed(() => props.active),
  computed(() => props.device),
  forceReducedMotion,
  props.container,
  cameraRef,
  invalidate,
)

// --- Optimizations ---
const shadowConfig = computed(() => {
  // Disable shadows on low/med to prevent overheating if not essential
  if (props.quality === 'low' || props.quality === 'med') {
    return { cast: false, size: 512 }
  }
  return { cast: true, size: 2048 }
})

const stagePos = computed(() => {
  return CONSTANTS.layout.stagePos[props.device] || CONSTANTS.layout.stagePos.desktop
})

const modelConfigA = computed(() => CONSTANTS.models.a[props.device] || CONSTANTS.models.a.desktop)
const modelConfigB = computed(() => CONSTANTS.models.b[props.device] || CONSTANTS.models.b.desktop)
</script>

<template>
  <TresPerspectiveCamera
    ref="cameraRef"
    :position="cameraPos"
    :fov="CONSTANTS.layout.fov"
    :look-at="CONSTANTS.layout.lookAt"
  />

  <!-- СВЕТ: Cinematic Tech Setup -->
  <TresAmbientLight :intensity="0.3" color="#ffffff" />

  <!-- Key Light: Strong, slightly warm main source -->
  <TresDirectionalLight
    :position="[5, 5, 5]"
    :intensity="3.0"
    color="#fff0dd"
    :cast-shadow="shadowConfig.cast"
    :shadow-bias="-0.0001"
    :shadow-mapSize-width="shadowConfig.size"
    :shadow-mapSize-height="shadowConfig.size"
  />

  <!-- Fill Light: Soft cool fill from left -->
  <TresSpotLight
    :position="[-5, 5, 2]"
    :intensity="1.0"
    color="#ccccff"
    :angle="0.6"
    :penumbra="1"
    :look-at="[0, 0, 0]"
  />

  <!-- Rim Light: Strong blue kicker for silhouette -->
  <TresSpotLight
    :position="[0, 5, -5]"
    :intensity="8.0"
    color="#44aaff"
    :angle="0.6"
    :penumbra="0.5"
    :look-at="[0, 0, 0]"
  />

  <TresGroup ref="stageRef" :position="stagePos">
    <primitive
      v-if="modelA"
      :object="modelA"
      :position="modelConfigA.pos"
      :rotation="modelConfigA.rot"
      @click="handleModelClick"
    />
    <primitive
      v-if="modelB"
      :object="modelB"
      :position="modelConfigB.pos"
      :rotation="modelConfigB.rot"
      @click="handleModelClick"
    />
  </TresGroup>

  <Suspense>
    <EffectComposerPmndrs :multisampling="0">
      <BloomPmndrs
        :intensity="0.5"
        :luminance-threshold="1.1"
        :luminance-smoothing="0.3"
        mipmap-blur
      />
      <ToneMappingPmndrs :mode="ToneMappingMode.ACES_FILMIC" />
      <SMAA v-if="quality === 'high'" />
    </EffectComposerPmndrs>
  </Suspense>
</template>
