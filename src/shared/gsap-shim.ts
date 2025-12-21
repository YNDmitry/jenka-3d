// Shim to use global GSAP from Webflow/CDN lazily.
// We use a Proxy to ensure we access window.gsap only when properties are accessed,
// preventing issues if window.gsap is not yet available at module import time.

import type { gsap as GsapType } from 'gsap'

const gsapProxy = new Proxy({} as typeof GsapType, {
  get(_target, prop) {
    const globalGsap = (window as any).gsap
    if (!globalGsap) {
      console.warn('[WebflowTresScenes] GSAP not found on window. Ensure it is loaded.')
      return undefined
    }
    const value = globalGsap[prop]

    // If the accessed property is a function, bind it to the real gsap instance
    // just in case it relies on 'this' context (though GSAP usually doesn't).
    if (typeof value === 'function') {
      return value.bind(globalGsap)
    }
    return value
  },
  // Forward other operations if necessary, but 'get' covers most usages like gsap.to()
})

export const gsap = gsapProxy
export default gsapProxy
