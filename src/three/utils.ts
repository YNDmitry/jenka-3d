import { watch, type Ref } from 'vue'
import type { WebGLRenderer, Scene, Camera, Object3D } from 'three'
import type { LoaderState } from '../shared/types'

/**
 * Safely extracts the raw WebGLRenderer from a TresJS renderer ref.
 * TresJS sometimes wraps it, sometimes passes a Ref, sometimes a Proxy.
 */
export function unwrapRenderer(renderer: any): WebGLRenderer | null {
  if (!renderer) return null
  if (renderer.value) return renderer.value as WebGLRenderer
  if (renderer.domElement) return renderer as WebGLRenderer
  return null
}

/**
 * Optimization: Bakes shadows once when the scene is ready, then disables auto-updates.
 * drastically reduces CPU/GPU usage for static lighting scenes.
 */
export function useShadowBaking(
  rendererRef: any,
  state: Ref<LoaderState>,
  invalidate: () => void
) {
  watch(
    () => state.value,
    (s) => {
      if (s !== 'ready') return
      
      const r = unwrapRenderer(rendererRef)
      if (r) {
        // Force one update then freeze
        r.shadowMap.autoUpdate = false
        r.shadowMap.needsUpdate = true
        invalidate()
      }
    },
    { immediate: true }
  )
}

export async function precompileScene(
  renderer: WebGLRenderer, 
  scene: Scene | Object3D, 
  camera: Camera
) {
  // Safari fix: compileAsync prevents UI thread blocking
  if (renderer.compileAsync) {
    await renderer.compileAsync(scene, camera, scene as Scene)
  } else {
    renderer.compile(scene, camera)
  }
}
