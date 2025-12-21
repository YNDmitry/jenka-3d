import {
  Cache,
  Color,
  LinearSRGBColorSpace,
  LoadingManager,
  NoColorSpace,
  SRGBColorSpace,
} from 'three'
import type { Material, Mesh, Object3D, Texture, WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { QualityTier } from '../shared/types'
import { clamp, warnOnce } from '../shared/utils'
import { unwrapRenderer } from './utils'

export interface MaterialTweaksOptions {
  debug: boolean
  quality: QualityTier
  emissiveIntensity: number
  envMapIntensity: number
  screenNameBoost: number
  renderer?: any
}

export function isLikelyScreenMaterial(name: string): boolean {
  const n = name.toLowerCase()
  return (
    n.includes('screen')
    || n.includes('display')
    || n.includes('emiss')
    || n.includes('emit')
    || n.includes('neon')
    || n.includes('glow')
    || n.includes('led')
    || n.includes('pink')
    || n.includes('blue')
  )
}

function setTextureColorSpace(
  tex: Texture | null | undefined,
  colorSpace: Texture['colorSpace'],
): void {
  if (!tex) {
    return
  }
  if (tex.colorSpace !== colorSpace) {
    tex.colorSpace = colorSpace
  }
}

function setTextureAnisotropy(
  tex: Texture | null | undefined,
  renderer: WebGLRenderer | null,
  quality: QualityTier,
): void {
  if (!tex || !renderer) {
    return
  }
  const max = renderer.capabilities?.getMaxAnisotropy?.() ?? 1
  // Optimization: Disable anisotropy (1) on low tier to save bandwidth
  const target = quality === 'low' ? 1 : quality === 'med' ? 2 : 8
  const val = clamp(target, 1, max)

  if (tex.anisotropy !== val) {
    tex.anisotropy = val
    tex.needsUpdate = true
  }
}

/**
 * Uploads texture to GPU immediately to avoid frame drop on first visibility.
 */
function uploadTexture(tex: Texture | null | undefined, renderer: WebGLRenderer | null) {
  if (tex && renderer) {
    renderer.initTexture(tex)
  }
}

function clampMaterialScalars(material: any): void {
  if (typeof material.roughness === 'number') {
    material.roughness = clamp(material.roughness, 0, 1)
  }
  if (typeof material.metalness === 'number') {
    material.metalness = clamp(material.metalness, 0, 1)
  }
  if (typeof material.opacity === 'number') {
    material.opacity = clamp(material.opacity, 0, 1)
  }
}

/**
 * Applies material tweaks AND uploads textures to GPU immediately.
 */
export function optimizeModel(
  root: Object3D,
  options: MaterialTweaksOptions,
): void {
  const {
    emissiveIntensity,
    envMapIntensity,
    screenNameBoost,
    renderer,
    quality,
  } = options

  const r = unwrapRenderer(renderer)

  root.traverse((obj) => {
    const anyObj = obj as any
    if (!anyObj?.isMesh) {
      return
    }

    const mesh = obj as Mesh
    const materials: Material[] = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]

    for (const mat of materials) {
      if (!mat) {
        continue
      }
      const material: any = mat

      // 1. Color Space
      setTextureColorSpace(material.map, SRGBColorSpace)
      setTextureColorSpace(material.emissiveMap, SRGBColorSpace)
      setTextureColorSpace(material.normalMap, NoColorSpace)
      setTextureColorSpace(material.roughnessMap, NoColorSpace)
      setTextureColorSpace(material.metalnessMap, NoColorSpace)
      setTextureColorSpace(material.aoMap, NoColorSpace)
      setTextureColorSpace(material.alphaMap, NoColorSpace)
      setTextureColorSpace(material.lightMap, LinearSRGBColorSpace)

      // 2. Filter Quality & GPU Upload
      setTextureAnisotropy(material.map, r, quality)
      setTextureAnisotropy(material.normalMap, r, quality)
      
      // Upload to GPU now, not later
      uploadTexture(material.map, r)
      uploadTexture(material.emissiveMap, r)
      uploadTexture(material.normalMap, r)
      uploadTexture(material.roughnessMap, r)
      uploadTexture(material.metalnessMap, r)
      uploadTexture(material.aoMap, r)

      // 3. Emissive Boost
      const name = (material.name as string | undefined) ?? ''
      const screenish = isLikelyScreenMaterial(name)

      if (
        material.emissiveMap
        && material.emissive
        && material.emissive instanceof Color
      ) {
        if (material.emissive.equals(new Color(0x000000))) {
          material.emissive.setRGB(1, 1, 1)
        }
      }

      if (material.emissiveMap || screenish) {
        material.emissiveIntensity
          = emissiveIntensity * (screenish ? screenNameBoost : 1)
      }

      if (typeof material.envMapIntensity === 'number') {
        material.envMapIntensity = envMapIntensity
      }

      clampMaterialScalars(material)
      material.needsUpdate = true
    }
  })
}

export function diagnoseMaterials(root: Object3D): void {
  const issues: Array<{ material: string, issue: string }> = []

  root.traverse((obj) => {
    const anyObj = obj as any
    if (!anyObj?.isMesh) {
      return
    }
    const mesh = obj as Mesh
    const materials: Material[] = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]
    for (const mat of materials) {
      if (!mat) {
        continue
      }
      const material: any = mat
      const name = (material.name as string | undefined) ?? '(unnamed)'

      const checkSrgb = (tex: Texture | null | undefined, mapName: string) => {
        if (!tex) {
          return
        }
        if (tex.colorSpace !== SRGBColorSpace) {
          issues.push({ material: name, issue: `${mapName} should be sRGB` })
        }
      }
      const checkNonColor = (
        tex: Texture | null | undefined,
        mapName: string,
      ) => {
        if (!tex) {
          return
        }
        if (tex.colorSpace !== NoColorSpace) {
          issues.push({
            material: name,
            issue: `${mapName} should be Non-Color`,
          })
        }
      }

      checkSrgb(material.map, 'map')
      checkSrgb(material.emissiveMap, 'emissiveMap')
      checkNonColor(material.normalMap, 'normalMap')
      checkNonColor(material.roughnessMap, 'roughnessMap')
      checkNonColor(material.metalnessMap, 'metalnessMap')
      checkNonColor(material.aoMap, 'aoMap')
    }
  })

  if (issues.length) {
    // eslint-disable-next-line no-console
    console.groupCollapsed?.(
      `[WebflowTresScenes][debug] Material diagnostics (${issues.length})`,
    )
    for (const issue of issues) {
      console.warn(
        `[WebflowTresScenes][debug] ${issue.material}: ${issue.issue}`,
      )
    }
    // eslint-disable-next-line no-console
    console.groupEnd?.()
  }
  else {
    // eslint-disable-next-line no-console
    console.log('[WebflowTresScenes][debug] Material diagnostics: OK')
  }
}

function createDracoLoader(manager: LoadingManager): DRACOLoader {
  const draco = new DRACOLoader(manager)
  // Reverting to CDN for Webflow compatibility where local /draco/ is not available
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
  draco.setDecoderConfig({ type: 'js' })
  draco.preload()
  return draco
}

export interface LoadGLTFOptions extends Partial<MaterialTweaksOptions> {
  url: string
  draco: boolean
  onProgress?: (ratio01: number) => void
}

export async function loadGLTFWithTweaks(
  options: LoadGLTFOptions,
): Promise<GLTF> {
  const {
    url,
    onProgress,
    draco,
    debug = false,
    quality = 'high',
    emissiveIntensity = 1.75,
    envMapIntensity = 1,
    screenNameBoost = 1.1,
    renderer,
  } = options

  Cache.enabled = true

  const manager = new LoadingManager()
  if (onProgress) {
    manager.onProgress = (_item, loaded, total) => {
      if (!total) {
        return
      }
      onProgress(clamp(loaded / total, 0, 1))
    }
  }

  const loader = new GLTFLoader(manager)

  if (draco) {
    try {
      loader.setDRACOLoader(createDracoLoader(manager))
    }
    catch (err) {
      warnOnce(
        'draco-loader-failed',
        `[WebflowTresScenes] Draco init failed; loading without Draco: ${(err as Error).message}`,
      )
    }
  }

  const gltf = await loader.loadAsync(url)
  
  // Use the new enhanced optimizer
  optimizeModel(gltf.scene as any, {
    debug,
    quality,
    emissiveIntensity,
    envMapIntensity,
    screenNameBoost,
    renderer,
  })
  
  if (debug) {
    diagnoseMaterials(gltf.scene as any)
  }
  return gltf
}