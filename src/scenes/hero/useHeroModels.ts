import { markRaw, ref, type Ref, shallowRef } from 'vue'
import {
  Box3,
  type Material,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
} from 'three'
import type {
  DeviceClass,
  LoaderState,
  QualityTier,
  WebflowSceneConfig,
} from '../../shared/types'
import { loadGLTFWithTweaks } from '../../three/materialTweaks'
import { disposeObject3D } from '../../three/dispose'

export function useHeroModels(
  config: WebflowSceneConfig,
  quality: QualityTier,
  renderer: any,
  device: Ref<DeviceClass>,
) {
  const state = ref<LoaderState>('loading')
  const errorMessage = ref<string | null>(null)
  const modelA = shallowRef<Object3D | null>(null)
  const modelB = shallowRef<Object3D | null>(null)
  const buttonsA = shallowRef<Object3D[]>([])
  const buttonsB = shallowRef<Object3D[]>([])
  const screensA = shallowRef<Material[]>([])
  const screensB = shallowRef<Material[]>([])
  const boundsA = shallowRef<Box3>(new Box3())
  const boundsB = shallowRef<Box3>(new Box3())

  const LAYER_A = 11
  const LAYER_B = 12

  function collectEmissiveMaterials(root: Object3D) {
    interface EmissiveEntry {
      material: any
      base: number
      isScreen?: boolean
    }
    const out: EmissiveEntry[] = []
    root.traverse((obj: any) => {
      const anyObj = obj as any
      if (!anyObj?.isMesh) {
        return
      }
      const mesh = obj as Mesh
      const materials: Material[] = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      for (const m of materials) {
        if (!m) {
          continue
        }
        const mat: any = m
        const screenRegex = /screen|display|monitor|matrix|arcade|9_GMS/i
        const matName = mat.name || ''
        const mapName = mat.emissiveMap?.name || ''
        const isExcluded = /nayax/i.test(matName) || /nayax/i.test(mapName)
        const isScreenName =
          !isExcluded &&
          (screenRegex.test(matName) || screenRegex.test(mapName))
        const isEmissiveName = /emiss|emit|neon|glow/i.test(matName)

        if (mat.emissiveMap || isScreenName || isEmissiveName) {
          const base =
            typeof mat.emissiveIntensity === 'number'
              ? mat.emissiveIntensity
              : 1
          const boost = isScreenName ? 2.5 : 1.5
          out.push({
            material: mat,
            base: base * boost,
            isScreen: isScreenName,
          })
        }
      }
    })
    return out
  }

  function collectRandomGlintTargets(root: any, count = 12) {
    const candidates: Object3D[] = []

    // 1. Collect all valid meshes (exclude glass/screens)
    root.traverse((obj: any) => {
      if ((obj as any).isMesh) {
        const name = obj.name.toLowerCase()
        if (
          !name.includes('glass') &&
          !name.includes('screen') &&
          !name.includes('window') &&
          !name.includes('display')
        ) {
          candidates.push(obj)
        }
      }
    })

    // 2. Pick random subset
    const targets: Object3D[] = []
    // Shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }

    // Take top N
    return candidates.slice(0, count)
  }

  async function loadModels(props: {
    emissive: number
    envIntensity: number
  }): Promise<void> {
    // Skip loading on mobile/tablet for performance/design
    if (device.value === 'mobile' || device.value === 'tablet') {
      state.value = 'ready'
      return
    }

    if (!config.modelA || !config.modelB) {
      errorMessage.value = 'Missing models in config'
      state.value = 'error'
      console.error('[useHeroModels] Missing models')
      return
    }

    state.value = 'loading'
    errorMessage.value = null

    if (modelA.value) {
      disposeObject3D(modelA.value)
    }
    if (modelB.value) {
      disposeObject3D(modelB.value)
    }
    modelA.value = null
    modelB.value = null

    try {
      const [gltfA, gltfB] = await Promise.all([
        loadGLTFWithTweaks({
          url: config.modelA,
          draco: true,
          debug: false,
          quality,
          emissiveIntensity: props.emissive,
          envMapIntensity: props.envIntensity,
          renderer,
        }),
        loadGLTFWithTweaks({
          url: config.modelB,
          draco: true,
          debug: false,
          quality,
          emissiveIntensity: props.emissive,
          envMapIntensity: props.envIntensity,
          renderer,
        }),
      ])

      const sceneA = gltfA.scene as unknown as Object3D
      const sceneB = gltfB.scene as unknown as Object3D

      const enableLayerRecursive = (obj: Object3D, layer: number) => {
        obj.layers.enable(layer)
        obj.traverse((child) => {
          child.layers.enable(layer)
        })
      }

      enableLayerRecursive(sceneA, LAYER_A)
      enableLayerRecursive(sceneB, LAYER_B)

      const polishMaterials = (obj: Object3D, targetScreens: Material[]) => {
        obj.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const m = child.material
            const name = m.name.toLowerCase()

            // Protect Glass, Screens, and Lights by Name and Property
            if (
              name.includes('glass') ||
              name.includes('window') ||
              name.includes('screen') ||
              name.includes('display') ||
              name.includes('monitor') ||
              name.includes('arcade') ||
              name.includes('matrix') ||
              name.includes('9_gms')
            ) {
              m.envMapIntensity = 0.0
              m.roughness = 0.2 // Glossy for premium glass look
              m.metalness = 0.0
              // High static emission for "On" state
              m.emissiveIntensity = 0.2
              m.needsUpdate = true
              targetScreens.push(m)
              return
            }
            
            // SKIP SPHERE - It will be handled by a specific fix later
            if (name.includes('sphere')) {
               return
            }

            if (
              name.includes('button') ||
              name.includes('button') ||
              name.includes('joystick') ||
              name.includes('stick') ||
              name.includes('push') ||
              m.transparent ||
              m.opacity < 1.0 ||
              (m.transmission && m.transmission > 0) ||
              m.emissiveIntensity > 0.1 ||
              m.roughness < 0.1 || // Skip already shiny things (Glass/Screens)
              m.roughness >= 0.5 // Skip matte plastic/rubber (Buttons/Joysticks)
            ) {
              return
            }

            // Make it look like High Quality Powder Coated Metal
            m.metalness = 0.8
            m.roughness = 0.35
            m.envMapIntensity = props.envIntensity * 1.2

            // Deep Black Fix
            if (
              m.color &&
              m.color.r < 0.1 &&
              m.color.g < 0.1 &&
              m.color.b < 0.1
            ) {
              m.color.setHex(0x000000)
            }

            m.needsUpdate = true
          }
        })
      }

      const foundScreensA: Material[] = []
      const foundScreensB: Material[] = []

      polishMaterials(sceneA, foundScreensA)
      polishMaterials(sceneB, foundScreensB)

      // Fix for Plane001 in Model B: Inherit material from Cube_01005
      let sourceMat: any = null
      sceneB.traverse((child: any) => {
        if (child.isMesh && child.name === 'Cube_01005') {
          sourceMat = child.material
        }
      })
      if (sourceMat) {
        sceneB.traverse((child: any) => {
          if (child.isMesh && child.name === 'Plane001') {
            child.material = sourceMat.clone()
            child.material.color.multiplyScalar(0.5)
          }
        })
      }

      // Fix for Sphere in Model B: Replace with fresh transparent material
      sceneB.traverse((child: any) => {
        if (child.isMesh && child.name.toLowerCase().includes('sphere')) {
          const oldMat = child.material
          const newMat = new MeshStandardMaterial({
            color: oldMat.color,
            map: oldMat.map,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            metalness: 0.0,
            roughness: 0.3,
          })
          child.material = newMat
        }
      })

      screensA.value = foundScreensA
      screensB.value = foundScreensB

      // Pre-upload happens inside loadGLTFWithTweaks now via optimizeModel

      modelA.value = markRaw(gltfA.scene) as any
      modelB.value = markRaw(gltfB.scene) as any

      buttonsA.value = collectRandomGlintTargets(sceneA)
      buttonsB.value = collectRandomGlintTargets(sceneB)

      boundsA.value = new Box3().setFromObject(sceneA)
      boundsB.value = new Box3().setFromObject(sceneB)

      state.value = 'ready'
    } catch (err) {
      console.error('[useHeroModels] Load error:', err)
      errorMessage.value = (err as Error).message
      state.value = 'error'
    }
  }

  return {
    state,
    errorMessage,
    modelA,
    modelB,
    buttonsA,
    buttonsB,
    screensA,
    screensB,
    boundsA,
    boundsB,
    loadModels,
    LAYER_A,
    LAYER_B,
  }
}
