export function useWebflowIntegration(container: HTMLElement | undefined) {
  
  const emitFromCanvas = () => {
    if (typeof window === 'undefined') return

    const eventName = 'From canvas'

    // 1. Native DOM Event (Standard)
    // Dispatch to container AND document for maximum catchability
    const evtData = { detail: { name: eventName }, bubbles: true, cancelable: true }
    const customEvt = new CustomEvent('jenka-event', evtData)
    
    if (container) container.dispatchEvent(customEvt)
    document.dispatchEvent(new CustomEvent('jenka-event', evtData))

    // 2. Webflow IX2/IX3 API
    try {
      const wf = (window as any).Webflow
      if (wf && wf.require) {
        // IX3 Support (Requested)
        try {
          const ix3 = wf.require('ix3')
          if (ix3 && typeof ix3.emit === 'function') {
            ix3.emit(eventName)
            return // Success
          }
        } catch (_) { /* ignore module load error */ }

        // IX2 Support (Fallback)
        const ix2 = wf.require('ix2')
        // Safely check for the API
        if (ix2 && ix2.events && typeof ix2.events.dispatch === 'function') {
          ix2.events.dispatch(eventName, {
            target: container || document.body,
            payload: { source: 'jenka-3d' }
          })
        }
      }
    } catch (err) {
      // Squelch errors to prevent console noise
    }
  }

  return {
    emitFromCanvas
  }
}