<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useLoop, useTres } from '@tresjs/core'
import { Environment } from '@tresjs/cientos'
import {
  BloomPmndrs,
  BrightnessContrastPmndrs,
  EffectComposerPmndrs,
  SMAA,
  ToneMappingPmndrs,
  VignettePmndrs,
} from '@tresjs/post-processing'
import { ToneMappingMode } from 'postprocessing'

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
import { useShadowBaking, unwrapRenderer } from '../three/utils'
import { createAttachedGlints } from '../three/glow'
import { getPostFXSettings } from '../three/postfx'

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
watch(
  () => props.trigger,
  () => {
    // Guard against loopback (Webflow reflecting the event back to us)
    if (Date.now() - lastInteraction.value < 300) return
    emitFromCanvas()
  },
)

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
  loadModels,
  LAYER_A,
  LAYER_B,
  buttonsA,
  buttonsB,
  screensA,
  screensB,
} = useHeroModels(
  props.config,
  props.quality,
  unwrapRenderer(renderer),
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
  () => [props.config.modelA, props.config.modelB, props.quality, props.device],
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

const postfx = computed(() =>
  getPostFXSettings({
    quality: props.quality,
    bloomMultiplier: props.bloom,
    reducedMotion: props.reducedMotion,
  }),
)

onUnmounted(() => {
  glintsA?.dispose()
  glintsB?.dispose()
})

// --- Render Loop ---
onBeforeRender(({ elapsed }) => {
  if (!props.active) return

  glintsA?.update(elapsed)
  glintsB?.update(elapsed + 0.5) // Offset phase
})

// --- Interaction (Parallax) ---
const cameraPos = computed(
  () =>
    CONSTANTS.layout.camPos[props.device] || CONSTANTS.layout.camPos.desktop,
)

const forceReducedMotion = computed(
  () =>
    props.reducedMotion ||
    props.device === 'mobile' ||
    props.device === 'tablet',
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
  return (
    CONSTANTS.layout.stagePos[props.device] || CONSTANTS.layout.stagePos.desktop
  )
})

const modelConfigA = computed(
  () => CONSTANTS.models.a[props.device] || CONSTANTS.models.a.desktop,
)
const modelConfigB = computed(
  () => CONSTANTS.models.b[props.device] || CONSTANTS.models.b.desktop,
)
</script>

<template>
  <TresPerspectiveCamera
    ref="cameraRef"
    :position="cameraPos"
    :fov="CONSTANTS.layout.fov"
    :look-at="CONSTANTS.layout.lookAt"
  />

  <Suspense>
    <Environment preset="city" :blur="1.0" :background="false" />
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
  <TresDirectionalLight
    :position="[-6.5, 2.5, 4.0]"
    :intensity="0.1"
    color="#bcd7ff"
  />

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
        :intensity="props.bloom"
        :luminance-threshold="1.1"
        :luminance-smoothing="0.3"
        mipmap-blur
      />
      <BrightnessContrastPmndrs :contrast="0.05" :brightness="0.0" />
      <ToneMappingPmndrs
        :mode="ToneMappingMode.ACES_FILMIC"
        :exposure="props.exposure"
      />
      <VignettePmndrs v-if="postfx.vignette" :darkness="0.5" :offset="0.1" />
      <SMAA v-if="quality === 'high'" />
    </EffectComposerPmndrs>
  </Suspense>
</template>
