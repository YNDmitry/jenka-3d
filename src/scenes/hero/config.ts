export const CONSTANTS = {
  layout: {
    camPos: [0, 0, 3.5] as [number, number, number],
    lookAt: [0, 0, 0] as [number, number, number],
    stagePos: {
      desktop: [-0.5, -1.46, 0] as [number, number, number],
      tablet: [-0.5, -1.46, 0] as [number, number, number],
      mobile: [-0.5, -1.46, 0] as [number, number, number],
    },
    fov: 35,
  },
  parallax: {
    factor: 0.2,
    easing: 0.05,
  },
  models: {
    a: {
      pos: [0.65, 0.2, 0.2] as [number, number, number],
      rot: [0, -0.9, 0] as [number, number, number],
    },
    b: {
      rot: [0, -0.6, 0] as [number, number, number],
    },
  },
}
