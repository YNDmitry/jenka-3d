export const CONSTANTS = {
  layout: {
    camPos: [0, 0, 4.4] as [number, number, number],
    lookAt: [0, 0, 0] as [number, number, number],
    stagePos: {
      desktop: [0.3, -1.1, -0.5] as [number, number, number],
      tablet: [0, -1.1, -0.5] as [number, number, number],
      mobile: [0, -1.1, -0.5] as [number, number, number],
    },
    fov: 35,
  },
  states: {
    front: {
      desktop: { pos: [0.2, 0, 0.4], rot: [0.4, -0.5, 0], scale: [1, 1, 1] },
      tablet: { pos: [0.2, 0, 0.4], rot: [0.4, -0.5, 0], scale: [1, 1, 1] },
      mobile: { pos: [0.2, 0, 0.4], rot: [0.4, -0.5, 0], scale: [1, 1, 1] },
    },
    back: {
      desktop: {
        pos: [0, 0.5, -1.0],
        rot: [0, 0.6, 0.3],
        scale: [0.9, 0.9, 0.9],
      },
      tablet: {
        pos: [0, 0.5, -1.0],
        rot: [0, 0.6, 0.3],
        scale: [0.9, 0.9, 0.9],
      },
      mobile: {
        pos: [-0.15, 0.5, -1.0],
        rot: [0, 0.6, 0.3],
        scale: [0.9, 0.9, 0.9],
      },
    },
  },
  animation: {
    rotRange: 0.8,
    swapDuration: 0.7,
  },
}
