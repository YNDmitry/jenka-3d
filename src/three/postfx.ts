import type { QualityTier } from '../shared/types'

export interface BloomSettings {
  enabled: boolean
  strength: number
  threshold: number
  radius: number
}

export interface PostFXSettings {
  bloom: BloomSettings
  smaa: boolean
}

export function getDprForQuality(quality: QualityTier): [number, number] {
  // Prefer crisp rendering on Retina while still allowing tiers to scale down.
  if (quality === 'low') {
    return [1, 1]
  }
  if (quality === 'med') {
    return [1, 1.25]
  }
  // Cap high DPR at 1.5 to reduce pixel shading load on high-res screens
  return [1, 1.5]
}

export function getTargetFpsForQuality(quality: QualityTier): number {
  // Cap framerate to avoid running at 120Hz on modern displays.
  if (quality === 'low') {
    return 30
  }
  if (quality === 'med') {
    return 45
  }
  return 60
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
    }
  }

  // Cinematic bloom (thin & highlight-only):
  // - Strength noticeably lower than before
  // - Threshold higher so it catches *only* bright bits (screens/glints)
  // - Radius moderate to avoid milky wash
  const base
    = quality === 'low'
      ? { strength: 0, threshold: 0.95, radius: 0, smaa: false }
      : quality === 'med'
        ? { strength: 0.08, threshold: 0.92, radius: 0.15, smaa: false }
        : { strength: 0.15, threshold: 0.88, radius: 0.25, smaa: true }

  return {
    bloom: {
      enabled: quality === 'high' && bloomMultiplier > 0, // Disable bloom on med/low
      strength: base.strength * bloomMultiplier * focusBoost,
      threshold: base.threshold,
      radius: base.radius,
    },
    smaa: base.smaa,
  }
}
