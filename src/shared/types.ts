export type SceneId = 'hero-duo' | 'arcade-duo' | 'compare-duo' | 'single'

export type CompareMode = 'grid' | 'focus-a' | 'focus-b'

export type QualityPreference = 'auto' | 'low' | 'med' | 'high'

export type QualityTier = 'low' | 'med' | 'high'

export type LoaderState = 'loading' | 'ready' | 'error'

export type DeviceClass = 'mobile' | 'tablet' | 'desktop'

export interface WebflowSceneConfig {
  scene: SceneId

  model?: string
  modelA?: string
  modelB?: string

  hdr?: string
}

export interface MountedSceneInstance {
  container: HTMLElement
  mountEl: HTMLElement
  app: {
    unmount: () => void
  }
  stop: () => void
}
