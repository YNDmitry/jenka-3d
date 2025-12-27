<script setup lang="ts">
import { computed } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { NoToneMapping, SRGBColorSpace, ACESFilmicToneMapping } from 'three'
import RenderDriver from '../three/RenderDriver.vue'
import SceneHeroDuoContent from './SceneHeroDuoContent.vue'
import type {
  DeviceClass,
  LoaderState,
  QualityTier,
  WebflowSceneConfig,
} from '../shared/types'

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
}>()

const emit = defineEmits<{
  (e: 'state', state: LoaderState): void
}>()

const onState = (s: LoaderState) => emit('state', s)
const transparent = true
const toneMapping = computed(() =>
  props.quality === 'high' ? NoToneMapping : ACESFilmicToneMapping,
)
const antialias = computed(() => props.quality !== 'high')
</script>

<template>
  <TresCanvas
    render-mode="on-demand"
    :alpha="transparent"
    :clear-alpha="transparent ? 0 : 1"
    clear-color="#000000"
    :dpr="props.dpr || [1, 2]"
    :antialias="antialias"
    :tone-mapping="toneMapping"
    :output-color-space="SRGBColorSpace"
    :use-legacy-lights="false"
    preset="realistic"
  >
    <RenderDriver
      :active="active"
      :quality="quality"
      :reduced-motion="reducedMotion"
    />
    <SceneHeroDuoContent v-bind="props" @state="onState" />
  </TresCanvas>
</template>
