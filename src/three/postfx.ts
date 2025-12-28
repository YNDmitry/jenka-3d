import type { QualityTier } from '../shared/types'
import { isCoarsePointer } from '../shared/utils'

export interface BloomSettings {
  enabled: boolean
  strength: number
  threshold: number
  radius: number
}

export interface PostFXSettings {
  bloom: BloomSettings
  smaa: boolean
  vignette: boolean
}

export function getDprForQuality(quality: QualityTier): [number, number] {
  // Cap high DPR at 1.5 to reduce pixel shading load on high-res screens
  return [1, 2]
}

export function getTargetFpsForQuality(quality: QualityTier): number {
  return 144
}

export function getPostFXSettings(params: {
  quality: QualityTier
  bloomMultiplier: number
  reducedMotion: boolean
  focusBoost?: number
}): PostFXSettings {
  const { quality, bloomMultiplier, reducedMotion, focusBoost = 1 } = params

  if (reducedMotion) {
    return {
      bloom: { enabled: false, strength: 0, threshold: 0.9, radius: 0 },
      smaa: false,
      vignette: false,
    }
  }

  // Cinematic bloom (thin & highlight-only):
  const base = {
    strength: 0.15,
    threshold: 0.88,
    radius: 0.25,
    smaa: true,
    vignette: true,
  }

  const isMobile = isCoarsePointer()

  return {
    bloom: {
      enabled: quality === 'high' && bloomMultiplier > 0,
      strength: base.strength * bloomMultiplier * focusBoost,
      threshold: base.threshold,
      radius: base.radius,
    },
    smaa: props.quality === 'high' && !params.reducedMotion && !isMobile,
    vignette: base.vignette,
  }
}
