import { Texture } from 'three'
import type { Material } from 'three'

function disposeMaterial(material: Material | null | undefined): void {
  if (!material) { return }

  const anyMat = material as any
  for (const key of Object.keys(anyMat)) {
    const value = anyMat[key]
    if (!value) { continue }

    if (value instanceof Texture) {
      value.dispose()
      continue
    }

    if (Array.isArray(value)) {
      for (const v of value) {
        if (v instanceof Texture) { v.dispose() }
      }
    }
  }

  material.dispose()
}

export function disposeObject3D(root: any): void {
  if (!root?.traverse) { return }
  root.traverse((obj: any) => {
    if (obj.geometry?.dispose) {
      obj.geometry.dispose()
    }

    const material = obj.material as Material | Material[] | undefined
    if (Array.isArray(material)) {
      for (const m of material) { disposeMaterial(m) }
    }
    else {
      disposeMaterial(material)
    }
  })
}
