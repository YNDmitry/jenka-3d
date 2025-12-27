import { markRaw, ref, shallowRef } from 'vue'
import {
  CanvasTexture,
  SRGBColorSpace,
  DoubleSide,
  Group,
  type Material,
  MeshStandardMaterial,
  type Object3D,
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
  const screensA = shallowRef<Material[]>([])
  const screensB = shallowRef<Material[]>([])

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

      const foundScreensA: Material[] = []
      const foundScreensB: Material[] = []

      // Exact match of Arcade's polish logic
      const polishMaterials = (
        obj: Object3D,
        targetScreens: Material[],
        isDarkUnit: boolean = false,
      ) => {
        obj.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const m = child.material
            const name = (m.name || '').toLowerCase()

            // Protect Glass, Screens, and Lights by Name and Property
            if (m.emissiveMap) {
              m.envMapIntensity = 0 // No environmental reflections on screens
              m.roughness = 0.2 // Glossy for premium glass look
              m.metalness = 0.0
              // High static emission for "On" state
              m.emissiveIntensity = 1.2
              m.needsUpdate = true
              targetScreens.push(m)
              return
            }

            m.envMapIntensity = props.envIntensity * 0.5
            const isScreenFrame = child.name.includes('Cylinder014')

            if (isScreenFrame) {
              m.color.multiplyScalar(0.4) // Darken existing color
            }

            // FILTER: Skip buttons, joysticks, glass, etc.
            if (
              name.includes('button') ||
              name.includes('joystick') ||
              name.includes('stick') ||
              name.includes('push') ||
              m.transparent ||
              m.opacity < 1.0 ||
              (m.transmission && m.transmission > 0) ||
              m.emissiveIntensity > 0.1 ||
              m.roughness < 0.1 ||
              m.roughness >= 0.5
            ) {
              m.needsUpdate = true
              return
            }

            // Make it look like High Quality Powder Coated Metal
            m.metalness = 0.8
            m.roughness = 0.35
            m.envMapIntensity = props.envIntensity * 0.8

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
      polishMaterials(sceneA, foundScreensA, false)
      polishMaterials(sceneB, foundScreensB, true)

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
            side: DoubleSide,
            alphaTest: 0,
          })
          child.material = newMat
          child.renderOrder = 1 // Ensure it renders after opaque objects
        }
      })

      screensA.value = foundScreensA
      screensB.value = foundScreensB

      // Inject Custom Hotspots (Keep this feature from Compare)
      const injectCustomHotspots = (key: 'a' | 'b', targetRoot: Object3D) => {
        const list = CONSTANTS.customHotspots?.[key]
        if (!list) {
          return []
        }

        const out: InteractableItem[] = []
        list.forEach((def, idx) => {
          const dummy = new Group()
          dummy.name = `custom-hotspot-${key}-${idx}`
          dummy.position.set(...(def.pos as [number, number, number]))
          targetRoot.add(dummy)

          out.push({
            id: dummy.uuid,
            label: def.label,
            position: [def.pos[0], def.pos[1], def.pos[2]],
            object: dummy as any,
            type: 'button',
          })
        })
        return out
      }

      interactablesA.value = injectCustomHotspots('a', sceneA)
      interactablesB.value = injectCustomHotspots('b', sceneB)

      modelA.value = markRaw(sceneA)
      modelB.value = markRaw(sceneB)

      // Use Interactables for Glints (Compare Style)
      buttonsA.value = interactablesA.value.map((i) => i.object)
      buttonsB.value = interactablesB.value.map((i) => i.object)

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
    screensA,
    screensB,
    loadModels,
  }
}
