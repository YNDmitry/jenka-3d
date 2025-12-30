<script setup lang="ts">
import { computed, ref } from 'vue'
import { TresCanvas } from '@tresjs/core'
import { NoToneMapping, SRGBColorSpace, ACESFilmicToneMapping } from 'three'
import RenderDriver from '../three/RenderDriver.vue'
import SceneCompareDuoContent from './SceneCompareDuoContent.vue'
import type {
  CompareMode,
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
  (e: 'change-mode', mode: CompareMode): void
}>()

const mode = ref<CompareMode>('grid')

const onState = (s: LoaderState) => emit('state', s)
const onChangeMode = (m: CompareMode) => {
  mode.value = m
  emit('change-mode', m)
}

const transparent = true
const toneMapping = computed(() =>
  props.quality === 'high' ? NoToneMapping : ACESFilmicToneMapping,
)
const antialias = computed(() => props.quality !== 'high')
</script>

<template>
  <TresCanvas
    :class="{ 'interactive-mode': mode !== 'grid' }"
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
    <SceneCompareDuoContent
      v-bind="props"
      @state="onState"
      @change-mode="onChangeMode"
    />
  </TresCanvas>
</template>
