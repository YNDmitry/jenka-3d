<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type {
  LoaderState,
  QualityTier,
  WebflowSceneConfig,
} from '../shared/types'
import {
  getDeviceClassFromWidth,
  guessQualityTier,
  prefersReducedMotion,
  resolveQualityTier,
} from '../shared/utils'
import SceneCompareDuo from '../scenes/SceneCompareDuo.vue'
import SceneHeroDuo from '../scenes/SceneHeroDuo.vue'
import SceneArcadeDuo from '../scenes/SceneArcadeDuo.vue'
import { SharedObserver } from './observers'
import { useWebflowIntegration } from '../shared/useWebflowIntegration'

const props = defineProps<{
  container: HTMLElement
  config: WebflowSceneConfig
}>()

const { emitFromCanvas } = useWebflowIntegration(props.container)

const trigger = ref(0) // Increments on toggle
let mo: MutationObserver | null = null

const size = ref({ width: 0, height: 0 })
const windowWidth = ref(window.innerWidth)

const isVisible = ref(true)
const hasSize = computed(() => size.value.width > 2 && size.value.height > 2)
const active = computed(() => isVisible.value && hasSize.value)

const reducedMotion = ref(prefersReducedMotion())

const device = computed(() =>
  getDeviceClassFromWidth(windowWidth.value),
)

const quality = computed<QualityTier>(() => {
  const fallback = reducedMotion.value ? 'low' : guessQualityTier()
  return resolveQualityTier('auto', fallback)
})

const exposure = props.config.exposure ?? 0.6
const emissive = 1.0
const envIntensity = props.config.envIntensity ?? 0.5
const bloom = props.config.bloom ?? 0.2
const background = false

const bgStyle = ref<Record<string, string>>({})
const proxyVisible = ref(true)

const state = ref<LoaderState>('loading')

const onSceneState = (next: LoaderState) => {
  state.value = next
  props.container.dataset.tresState = next
  
  console.log('[SceneMount] State:', next, 'Device:', device.value)

  // Determine if we should reveal the canvas (fade out proxy).
  // Hero/Arcade scenes strictly skip loading on mobile/tablet (relying on the static BG).
  // Compare scenes load on all devices.
  const shouldReveal = 
    device.value === 'desktop' || 
    props.config.scene === 'compare-duo'

  if (next === 'ready' && shouldReveal) {
    console.log('[SceneMount] Fading out proxy')
    setTimeout(() => {
      proxyVisible.value = false
    }, 50)
  }
}

const sceneComponent = computed(() => {
  if (props.config.scene === 'compare-duo') { return SceneCompareDuo }
  if (props.config.scene === 'arcade-duo') { return SceneArcadeDuo }
  return SceneHeroDuo
})

let rmListener: ((e: MediaQueryListEvent) => void) | null = null
let resizeListener: (() => void) | null = null

onMounted(() => {
  props.container.dataset.tresState = state.value

  // Capture Webflow background
  const style = window.getComputedStyle(props.container)
  if (style.backgroundImage && style.backgroundImage !== 'none') {
    bgStyle.value = {
      backgroundImage: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      backgroundPosition: style.backgroundPosition,
      backgroundRepeat: style.backgroundRepeat,
    }
    // Hide original immediately so proxy takes over
    props.container.style.backgroundImage = 'none'
  }

  SharedObserver.observeResize(props.container, (entry) => {
    const { width, height } = entry.contentRect
    size.value = { width, height }
  })

  // Track window width for breakpoints
  resizeListener = () => {
    windowWidth.value = window.innerWidth
  }
  window.addEventListener('resize', resizeListener)

  SharedObserver.observeIntersection(props.container, (entry) => {
    isVisible.value = entry.isIntersecting
  })

  mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'data-toggle') {
        trigger.value++
      }
    }
  })
  mo.observe(props.container, { attributes: true, attributeFilter: ['data-toggle'] })

  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  if (mq) {
    rmListener = e => (reducedMotion.value = e.matches)
    mq.addEventListener?.('change', rmListener)
  }
})

onUnmounted(() => {
  mo?.disconnect()
  SharedObserver.unobserveResize(props.container)
  SharedObserver.unobserveIntersection(props.container)
  
  if (resizeListener) {
    window.removeEventListener('resize', resizeListener)
  }

  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  if (mq && rmListener) { mq.removeEventListener?.('change', rmListener) }
})

const dpr = computed<[number, number]>(() => [1, Math.min(window.devicePixelRatio, 2.5)])

// Static container style
const containerStyle = {
  width: '100%',
  height: '100%',
  display: 'block'
}
</script>

<template>
  <div 
    class="scene-wrapper" 
    :style="containerStyle"
  >
    <div 
      class="bg-proxy" 
      :style="bgStyle" 
      :class="{ 'fade-out': !proxyVisible }"
    ></div>

    <Transition name="fade">
      <div v-if="state === 'loading'" class="tres-loader">
        <div v-if="!config.hideSpinner" class="tech-spinner">
          <div class="tech-spinner-dot"></div>
          <div class="tech-spinner-ring"></div>
        </div>
      </div>
    </Transition>
    <component
      :is="sceneComponent"
      :container="props.container"
      :config="props.config"
      :active="active"
      :quality="quality"
      :dpr="dpr"
      :device="device"
      :reduced-motion="reducedMotion"
      :exposure="exposure"
      :emissive="emissive"
      :env-intensity="envIntensity"
      :bloom="bloom"
      :background="background"
      :trigger="trigger"
      @state="onSceneState"
    />
  </div>
</template>