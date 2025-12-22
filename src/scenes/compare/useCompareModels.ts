import { markRaw, ref, shallowRef } from 'vue'
import {
  Box3,
  Group,
  type Material,
  type Object3D,
  type Texture,
  Vector3,
} from 'three'
import type {
  LoaderState,
  QualityTier,
  WebflowSceneConfig,
} from '../../shared/types'
import { loadGLTFWithTweaks } from '../../three/materialTweaks'
import { disposeObject3D } from '../../three/dispose'
import { CONSTANTS } from './config'

interface EmissiveEntry {
  material: Material
  base: number
}

interface InteractableItem {
  id: string
  label: string
  position: [number, number, number]
  object: Object3D
  type: 'button' | 'speaker'
}

interface ModelAnalysis {
  buttons: Object3D[]
  speakers: Object3D[]
  emissives: EmissiveEntry[]
  textures: Texture[]
  interactables: InteractableItem[]
}

export function useCompareModels(
  config: WebflowSceneConfig,
  quality: QualityTier,
  renderer: any,
) {
  const state = ref<LoaderState>('loading')
  const errorMessage = ref<string | null>(null)

  const modelA = shallowRef<Object3D | null>(null)
  const modelB = shallowRef<Object3D | null>(null)

  const buttonsA = shallowRef<Object3D[]>([])
  const buttonsB = shallowRef<Object3D[]>([])
  const speakersA = shallowRef<Object3D[]>([])
  const speakersB = shallowRef<Object3D[]>([])
  const interactablesA = shallowRef<InteractableItem[]>([])
  const interactablesB = shallowRef<InteractableItem[]>([])
  const emissiveA = shallowRef<EmissiveEntry[]>([])
  const emissiveB = shallowRef<EmissiveEntry[]>([])

  function analyzeModel(): ModelAnalysis {
    const buttons: Object3D[] = []
    const speakers: Object3D[] = []
    const emissivesMap = new Map<string, EmissiveEntry>()
    const textures = new Set<Texture>()
    const interactablesList: InteractableItem[] = []

    // Automatic traversal removed as requested.
    // We only use custom hotspots defined in config.

    return {
      buttons,
      speakers,
      emissives: Array.from(emissivesMap.values()),
      textures: Array.from(textures),
      interactables: interactablesList,
    }
  }

  function wrapAndNormalizeModel(gltfScene: Object3D): Object3D {
    const wrapper = new Group()
    wrapper.add(gltfScene)
    const box = new Box3().setFromObject(gltfScene)
    const center = box.getCenter(new Vector3())
    gltfScene.position.x -= center.x
    gltfScene.position.z -= center.z
    gltfScene.position.y -= box.min.y
    return wrapper as unknown as Object3D
  }

  async function loadModels(props: { emissive: number; envIntensity: number }) {
    if (!config.modelA || !config.modelB) {
      errorMessage.value = 'Missing data-model-a / data-model-b'
      state.value = 'error'
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

    try {
      const [gltfA, gltfB] = await Promise.all([
        loadGLTFWithTweaks({
          url: config.modelA,
          draco: true,
          debug: false,
          quality,
          emissiveIntensity: props.emissive,
          envMapIntensity: props.envIntensity,
          renderer: renderer.value,
        }),
        loadGLTFWithTweaks({
          url: config.modelB,
          draco: true,
          debug: false,
          quality,
          emissiveIntensity: props.emissive,
          envMapIntensity: props.envIntensity,
          renderer: renderer.value,
        }),
      ])

      const sceneA = gltfA.scene as unknown as Object3D
      const sceneB = gltfB.scene as unknown as Object3D

      const polishMaterials = (obj: Object3D) => {
        obj.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const m = child.material
            if (m.roughness > 0.1 && m.roughness < 0.6) {
              m.roughness = 0.15
            }
            if (m.metalness < 0.1) {
              m.metalness = 0.2
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

      const wrapperA = wrapAndNormalizeModel(sceneA)
      const wrapperB = wrapAndNormalizeModel(sceneB)

      wrapperA.updateMatrixWorld(true)
      wrapperB.updateMatrixWorld(true)

      const dataA = analyzeModel()
      const dataB = analyzeModel()

      // Inject Custom Hotspots
      const addCustomHotspots = (
        key: 'a' | 'b',
        targetRoot: Object3D,
        data: ModelAnalysis,
      ) => {
        const list = CONSTANTS.customHotspots?.[key]
        if (!list) {
          return
        }

        list.forEach((def, idx) => {
          const dummy = new Group()
          dummy.name = `custom-hotspot-${key}-${idx}`
          dummy.position.set(...(def.pos as [number, number, number]))

          // Add to scene so it moves with parent
          targetRoot.add(dummy)

          // Register as interactable
          data.interactables.push({
            id: dummy.uuid,
            label: def.label,
            position: [def.pos[0], def.pos[1], def.pos[2]],
            object: dummy as any,
            type: 'button',
          })

          // Register for glints
          data.buttons.push(dummy as any)
        })
      }

      addCustomHotspots('a', sceneA, dataA)
      addCustomHotspots('b', sceneB, dataB)

      if (renderer.value) {
        ;[...dataA.textures, ...dataB.textures].forEach((t) =>
          renderer.value.initTexture(t),
        )
      }

      modelA.value = markRaw(wrapperA)
      modelB.value = markRaw(wrapperB)

      buttonsA.value = dataA.buttons
      speakersA.value = dataA.speakers
      emissiveA.value = dataA.emissives
      interactablesA.value = dataA.interactables

      buttonsB.value = dataB.buttons
      speakersB.value = dataB.speakers
      emissiveB.value = dataB.emissives
      interactablesB.value = dataB.interactables

      state.value = 'ready'
    } catch (err) {
      console.error(err)
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
    speakersA,
    speakersB,
    interactablesA,
    interactablesB,
    emissiveA,
    emissiveB,
    loadModels,
  }
}
