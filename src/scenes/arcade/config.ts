export const CONSTANTS = {
  layout: {
    camPos: [0, 0, 4.4] as [number, number, number],
    lookAt: [0, 0, 0] as [number, number, number],
    stagePos: {
      desktop: [0, -1.1, -0.5] as [number, number, number],
      tablet: [0, -1.1, -0.5] as [number, number, number],
      mobile: [0, -1.1, -0.5] as [number, number, number],
    },
    fov: 35,
  },
  states: {
    front: {
      pos: [0.2, 0, 0.4] as [number, number, number],
      rot: [0.4, -0.5, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
    },
    back: {
      pos: [0, 0.5, -1.0] as [number, number, number],
      rot: [0, 0.6, 0.3] as [number, number, number],
      scale: [0.9, 0.9, 0.9] as [number, number, number],
    },
  },
  animation: {
    rotRange: 0.8,
    swapDuration: 0.7,
  },
}
