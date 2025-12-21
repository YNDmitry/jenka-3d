import { ref, shallowRef } from 'vue'
import type { Material, Mesh, Object3D } from 'three'
import type { LoaderState, QualityTier } from '../../shared/types'
import { loadGLTFWithTweaks } from '../../three/materialTweaks'
import { disposeObject3D } from '../../three/dispose'

export function useArcadeModels(
  renderer: any,
) {
  const state = ref<LoaderState>('loading')
  const errorMessage = ref<string | null>(null)
  const modelA = shallowRef<Object3D | null>(null)
  const modelB = shallowRef<Object3D | null>(null)

  const LAYER_A = 11
  const LAYER_B = 12

  function collectEmissiveMaterials(root: Object3D) {
    interface EmissiveEntry {
      material: any
      base: number
      isScreen?: boolean
    }
    const out: EmissiveEntry[] = []
    root.traverse((obj) => {
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
          !isExcluded && (screenRegex.test(matName) || screenRegex.test(mapName))
        const isEmissiveName = /emiss|emit|neon|glow/i.test(matName)

        if (mat.emissiveMap || isScreenName || isEmissiveName) {
          const base =
            typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 1
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

  function setLayerRecursive(obj: Object3D, layer: number) {
    obj.layers.set(layer)
    obj.traverse((child) => {
      child.layers.set(layer)
    })
  }

  async function loadModels(
    urlA: string | undefined,
    urlB: string | undefined,
    quality: QualityTier,
    emissive: number,
    envIntensity: number
  ): Promise<void> {
    if (!urlA || !urlB) {
      errorMessage.value = 'Missing models in config'
      state.value = 'error'
      return
    }

    state.value = 'loading'
    errorMessage.value = null

    if (modelA.value) disposeObject3D(modelA.value)
    if (modelB.value) disposeObject3D(modelB.value)
    modelA.value = null
    modelB.value = null

    try {
      const [gltfA, gltfB] = await Promise.all([
        loadGLTFWithTweaks({
          url: urlA,
          draco: true,
          debug: false,
          quality,
          emissiveIntensity: emissive,
          envMapIntensity: envIntensity,
          renderer: renderer.value,
        }),
        loadGLTFWithTweaks({
          url: urlB,
          draco: true,
          debug: false,
          quality,
          emissiveIntensity: emissive,
          envMapIntensity: envIntensity,
          renderer: renderer.value,
        }),
      ])

      const sceneA = gltfA.scene as unknown as Object3D
      const sceneB = gltfB.scene as unknown as Object3D

      setLayerRecursive(sceneA, LAYER_A)
      setLayerRecursive(sceneB, LAYER_B)

      const polishMaterials = (obj: Object3D) => {
        obj.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const m = child.material
            if (m.roughness > 0.1 && m.roughness < 0.6) {
              m.roughness = 0.15
            }
            if (m.metalness < 0.1) {
              m.metalness = 0.4
            }
            m.envMapIntensity = 4.0
            if (
              m.color &&
              m.color.r < 0.1 &&
              m.color.g < 0.1 &&
              m.color.b < 0.1
            ) {
              m.color.setHex(0x000000)
            }
          }
        })
      }
      polishMaterials(sceneA)
      polishMaterials(sceneB)

      modelA.value = sceneA
      modelB.value = sceneB
      collectEmissiveMaterials(sceneA)
      collectEmissiveMaterials(sceneB)

      state.value = 'ready'
    } catch (err) {
      console.error('[useArcadeModels] Load error:', err)
      errorMessage.value = (err as Error).message
      state.value = 'error'
    }
  }

  return {
    state,
    errorMessage,
    modelA,
    modelB,
    loadModels,
    LAYER_A,
    LAYER_B
  }
}
