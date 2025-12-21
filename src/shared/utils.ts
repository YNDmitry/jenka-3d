import type { DeviceClass, QualityPreference, QualityTier } from './types'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export function damp(current: number, target: number, smoothing: number, delta: number): number {
  const t = 1 - Math.exp(-smoothing * delta)
  return lerp(current, target, t)
}

export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  waitMs: number,
): (...args: TArgs) => void {
  let timeout: number | undefined
  return (...args: TArgs) => {
    if (timeout) { window.clearTimeout(timeout) }
    timeout = window.setTimeout(() => fn(...args), waitMs)
  }
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
}

export function supportsHover(): boolean {
  return window.matchMedia?.('(hover: hover)')?.matches ?? false
}

export function isCoarsePointer(): boolean {
  return window.matchMedia?.('(pointer: coarse)')?.matches ?? false
}

export function getDeviceClassFromWidth(width: number): DeviceClass {
  if (width <= 479) { return 'mobile' }
  if (width <= 991) { return 'tablet' }
  return 'desktop'
}

export function resolveQualityTier(preference: QualityPreference, fallback: QualityTier): QualityTier {
  if (preference === 'low' || preference === 'med' || preference === 'high') { return preference }
  return fallback
}

export function guessQualityTier(): QualityTier {
  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const memory = (navigator as any).deviceMemory as number | undefined
  const cores = navigator.hardwareConcurrency ?? 4

  if (isMobileUA) { return 'low' }
  if (typeof memory === 'number' && memory <= 4) { return 'low' }
  if (cores <= 4) { return 'med' }
  return 'high'
}

export function parseEnumAttr<T extends string>(
  value: string | null,
  allowed: readonly T[],
  defaultValue: T,
): T {
  if (value === null) { return defaultValue }
  const v = value.trim() as T
  return (allowed as readonly string[]).includes(v) ? v : defaultValue
}

export function safeUrl(value: string | null): string | undefined {
  if (!value) { return undefined }
  const trimmed = value.trim()
  if (!trimmed) { return undefined }
  return trimmed
}

export function once<TArgs extends unknown[]>(fn: (...args: TArgs) => void): (...args: TArgs) => void {
  let called = false
  return (...args: TArgs) => {
    if (called) { return }
    called = true
    fn(...args)
  }
}

export function warnOnce(key: string, message: string): void {
  const w = window as unknown as { __wfTresWarned?: Set<string> }
  if (!w.__wfTresWarned) { w.__wfTresWarned = new Set() }
  if (w.__wfTresWarned.has(key)) { return }
  w.__wfTresWarned.add(key)

  console.warn(message)
}
