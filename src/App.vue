<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { mountAll, refresh, unmountAll } from './webflow/boot'
import type { CompareMode, QualityPreference } from './shared/types'

const rootEl = ref<HTMLElement | null>(null)

// Placeholder URLs - in real usage these point to public/ or CDN
const MODEL_1 = '/model-1.glb'
const MODEL_2 = '/model-2.glb'

type SceneTab = 'hero-duo' | 'compare-duo' | 'single'
const activeTab = ref<SceneTab>('hero-duo')

const params = reactive({
  // Common
  exposure: 1.15,
  emissive: 1.75,
  envIntensity: 0.5,
  bloom: 1.0,
  quality: 'auto' as QualityPreference,
  transparent: true,
  background: false,
  draco: true,
  debug: false,

  // Layout
  layoutEnabled: false,
  camZ: 7.2,
  fov: 35,
  ax: -1.3,
  ay: 0,
  az: 0,
  arot: 25,
  bx: 1.3,
  by: 0,
  bz: 0,
  brot: -25,

  // Compare
  compareMode: 'grid' as CompareMode,
})

const commonAttrs = computed(() => {
  const base = {
    'data-exposure': String(params.exposure),
    'data-emissive': String(params.emissive),
    'data-env-intensity': String(params.envIntensity),
    'data-bloom': String(params.bloom),

    'data-quality': params.quality,
    'data-transparent': params.transparent ? '1' : '0',
    'data-background': params.background ? '1' : '0',

    'data-draco': params.draco ? '1' : '0',
    'data-debug': params.debug ? '1' : '0',
  }

  // Safe check for overrides
  if (params.layoutEnabled) {
    return {
      ...base,
      'data-pos-a': `${params.ax},${params.ay},${params.az}`,
      'data-pos-b': `${params.bx},${params.by},${params.bz}`,
      'data-rot-a': String(params.arot),
      'data-rot-b': String(params.brot),
      'data-cam-z': String(params.camZ),
      'data-fov': String(params.fov),
    }
  }

  return base
})

const applyRefresh = async () => {
  await nextTick()
  refresh()
}

const setCompareMode = (next: CompareMode) => {
  params.compareMode = next
}

// Watch all params that should trigger refresh
watch(
  () => [
    params.quality,
    params.draco,
    params.debug,
    params.compareMode,
    params.layoutEnabled,
    params.camZ,
    params.fov,
    params.ax,
    params.ay,
    params.az,
    params.arot,
    params.bx,
    params.by,
    params.bz,
    params.brot,
  ],
  () => {
    void applyRefresh()
  },
  { deep: true },
)

onMounted(() => {
  if (rootEl.value) { mountAll() }
})

onUnmounted(() => {
  unmountAll()
})
</script>

<template>
  <div ref="rootEl" class="playground">
    <header class="topbar">
      <div class="title">
        <div class="kicker">Webflow Tres Scenes</div>
        <h1>Dev Playground</h1>
      </div>

      <nav class="tabs">
        <button
          class="tab-btn"
          :data-active="activeTab === 'hero-duo'"
          @click="activeTab = 'hero-duo'"
        >
          Scene A (Hero)
        </button>
        <button
          class="tab-btn"
          :data-active="activeTab === 'compare-duo'"
          @click="activeTab = 'compare-duo'"
        >
          Scene B (Compare)
        </button>
        <button
          class="tab-btn"
          :data-active="activeTab === 'single'"
          @click="activeTab = 'single'"
        >
          Scene C (Single)
        </button>
      </nav>
    </header>

    <div class="layout">
      <aside class="panel dark">
        <div class="notes">
          <p>Switch tabs to focus on a specific scene.</p>
          <p>Controls apply to the active scene.</p>
        </div>
      </aside>

      <main class="scenes">
        <!-- SCENE A: HERO DUO -->
        <section v-if="activeTab === 'hero-duo'" class="sceneBlock">
          <header class="sceneHeader">
            <div>
              <div class="sceneTitle">Scene A (Hero Duo)</div>
              <div class="sceneSub">data-scene="hero-duo" · Wide Aspect</div>
            </div>
          </header>

          <div class="wf-container hero-container">
            <div
              class="wf-tres-scene"
              data-tres="scene"
              data-scene="hero-duo"
              :data-model-a="MODEL_1"
              :data-model-b="MODEL_2"
              v-bind="commonAttrs"
            ></div>
          </div>
        </section>

        <!-- SCENE B: COMPARE -->
        <section v-if="activeTab === 'compare-duo'" class="sceneBlock">
          <header class="sceneHeader">
            <div>
              <div class="sceneTitle">Scene B (Compare)</div>
              <div class="sceneSub">
                data-scene="compare-duo" · Mode: {{ params.compareMode }}
              </div>
            </div>
            <div class="modeButtons">
              <button
                class="btn btnSmall"
                :data-active="params.compareMode === 'grid'"
                @click="setCompareMode('grid')"
              >
                Grid
              </button>
              <button
                class="btn btnSmall"
                :data-active="params.compareMode === 'focus-a'"
                @click="setCompareMode('focus-a')"
              >
                Focus A
              </button>
              <button
                class="btn btnSmall"
                :data-active="params.compareMode === 'focus-b'"
                @click="setCompareMode('focus-b')"
              >
                Focus B
              </button>
            </div>
          </header>

          <div class="wf-container compare-container">
            <div
              class="wf-tres-scene"
              data-tres="scene"
              data-scene="compare-duo"
              :data-model-a="MODEL_2"
              :data-model-b="MODEL_1"
              :data-mode="params.compareMode"
              v-bind="commonAttrs"
            ></div>
          </div>
        </section>

        <!-- SCENE C: SINGLE -->
        <section v-if="activeTab === 'single'" class="sceneBlock">
          <header class="sceneHeader">
            <div>
              <div class="sceneTitle">Scene C (Single)</div>
              <div class="sceneSub">data-scene="single" · Tall/Large</div>
            </div>
          </header>

          <div class="wf-container single-container">
            <div
              class="wf-tres-scene"
              data-tres="scene"
              data-scene="single"
              :data-model="MODEL_1"
              v-bind="commonAttrs"
            ></div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.playground {
  min-height: 100vh;
  background: #0b0d14;
  color: #e0e6ed;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #0b0d14;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.title .kicker {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #64748b;
  margin-bottom: 4px;
}
.title h1 {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: #f8fafc;
}

.tabs {
  display: flex;
  gap: 8px;
  background: rgba(255, 255, 255, 0.03);
  padding: 4px;
  border-radius: 8px;
}
.tab-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.2s;
}
.tab-btn:hover {
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.05);
}
.tab-btn[data-active='true'],
.tab-btn[data-active='1'] {
  background: #1e293b;
  color: #38bdf8;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
}

.panel {
  position: sticky;
  top: 24px;
  height: fit-content;
}

.notes {
  margin-top: 16px;
  font-size: 13px;
  color: #94a3b8;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.scenes {
  display: grid;
  gap: 32px;
}

.sceneBlock {
  background: #11141d;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sceneHeader {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.sceneTitle {
  font-size: 15px;
  font-weight: 600;
  color: #f1f5f9;
}
.sceneSub {
  font-size: 12px;
  color: #64748b;
  font-family: monospace;
  margin-top: 2px;
}

.modeButtons {
  display: flex;
  gap: 8px;
}

.btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn:hover {
  background: rgba(255, 255, 255, 0.1);
}
.btn[data-active='true'],
.btn[data-active='1'] {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.wf-container {
  width: 100%;
  background: radial-gradient(circle at 50% 50%, #1e293b 0%, #0f172a 100%);
  position: relative;
}

.hero-container {
  height: 600px;
}

.compare-container {
  height: 500px;
  max-width: 1000px;
  margin: 0 auto;
}

.single-container {
  height: 600px;
  max-width: 600px;
  margin: 0 auto;
}

.wf-tres-scene {
  width: 100%;
  height: 100%;
  display: block;
}

@media (max-width: 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .panel {
    position: static;
  }
}
</style>
