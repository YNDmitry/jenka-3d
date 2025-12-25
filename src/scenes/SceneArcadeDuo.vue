<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { NoToneMapping, SRGBColorSpace } from 'three'
import RenderDriver from '../three/RenderDriver.vue'
import SceneArcadeDuoContent from './SceneArcadeDuoContent.vue'
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
</script>

<template>
  <TresCanvas
    render-mode="on-demand"
    :alpha="true"
    :clear-alpha="0"
    clear-color="#000000"
    :dpr="props.dpr || [1, 2]"
    :antialias="false"
    :tone-mapping="NoToneMapping"
    :output-color-space="SRGBColorSpace"
    :use-legacy-lights="false"
    preset="realistic"
  >
    <RenderDriver
      :active="active"
      :quality="quality"
      :reduced-motion="reducedMotion"
    />
    <SceneArcadeDuoContent v-bind="props" @state="onState" />
  </TresCanvas>
</template>
