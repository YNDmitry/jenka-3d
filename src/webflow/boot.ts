import { createApp, type App } from 'vue'
import SceneMount from './SceneMount.vue'
import './style.css'
import './annotation.css'
import type { WebflowSceneConfig, SceneId } from '../shared/types'
import { parseEnumAttr, safeUrl } from '../shared/utils'

// --- Types ---

interface WebflowTresAPI {
  mountAll: () => void
  unmountAll: () => void
  refresh: () => void
  version: string
}

declare global {
  interface Window {
    WebflowTresScenes: WebflowTresAPI
  }
}

// --- Config Parser ---

function parseConfig(el: HTMLElement): WebflowSceneConfig {
  const ds = el.dataset
  
  // Prioritize data-scene, fall back to data-tres if it's a valid type
  const rawType = ds.scene || ds.tres
  
  const scene = parseEnumAttr<SceneId>(
    rawType || null, 
    ['hero-duo', 'compare-duo', 'arcade-duo', 'single'], 
    'hero-duo'
  )
  
  return {
    scene,
    modelA: safeUrl(ds.modelA || null),
    modelB: safeUrl(ds.modelB || null),
    hdr: safeUrl(ds.hdr || null),
    hideSpinner: ds.hideSpinner !== undefined,
    exposure: ds.exposure ? parseFloat(ds.exposure) : undefined,
    bloom: ds.bloom ? parseFloat(ds.bloom) : undefined,
    envIntensity: ds.envIntensity ? parseFloat(ds.envIntensity) : undefined,
  }
}

// --- Registry & Lifecycle ---

const mountedApps = new Map<HTMLElement, App<Element>>()

export function mountAll() {
  const elements = document.querySelectorAll<HTMLElement>('[data-tres]')
  
  elements.forEach((el) => {
    // 1. Skip if already mounted
    if (mountedApps.has(el)) return
    
    const tresAttr = el.dataset.tres || ''
    
    // 2. Validate Marker
    // Valid cases: 
    // - data-tres="scene" (generic)
    // - data-tres="hero-duo" (shorthand)
    const isSpecific = ['hero-duo', 'compare-duo', 'arcade-duo', 'single'].includes(tresAttr)
    const isGeneric = ['scene', 'mount', 'canvas'].includes(tresAttr)
    
    if (!isSpecific && !isGeneric) return
    
    // 3. Mount
    try {
      const config = parseConfig(el)
      const app = createApp(SceneMount, { container: el, config })
      
      // Inject global debug flag if present
      // app.provide('debug', isDebugMode()) 
      
      app.mount(el)
      mountedApps.set(el, app)
      
      // Mark as managed
      el.dataset.tresManaged = 'true'
    } catch (err) {
      console.error('[WebflowTres] Failed to mount scene:', el, err)
      el.dataset.tresState = 'error'
    }
  })
}

export function unmountAll() {
  mountedApps.forEach((app, el) => {
    app.unmount()
    el.innerHTML = ''
    delete el.dataset.tresManaged
    delete el.dataset.tresState
  })
  mountedApps.clear()
}

export function refresh() {
  unmountAll()
  mountAll()
}

// --- Bootstrap ---

if (typeof window !== 'undefined') {
  // 1. Expose API
  window.WebflowTresScenes = {
    mountAll,
    unmountAll,
    refresh,
    version: '1.0.0', // TODO: Inject from package.json
  }

  // 2. Initial Mount
  const init = () => {
    mountAll()
    console.log('[WebflowTres] Initialized')
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }
  
  // 3. Smart Mutation Observer
  // Only triggers if a relevant node is added
  const observer = new MutationObserver((mutations) => {
    let shouldMount = false
    
    for (const m of mutations) {
      if (m.type !== 'childList') continue
      
      for (const node of Array.from(m.addedNodes)) {
        if (node instanceof HTMLElement) {
          // Check if the node itself is a target or contains targets
          if (node.matches('[data-tres]') || node.querySelector('[data-tres]')) {
            shouldMount = true
            break
          }
        }
      }
      if (shouldMount) break
    }
    
    if (shouldMount) mountAll()
  })
  
  observer.observe(document.body, { 
    childList: true, 
    subtree: true 
  })
}
