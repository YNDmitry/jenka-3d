export const CONSTANTS = {
  layout: {
    camPos: {
      desktop: [0, 0, 3.5] as [number, number, number],
      tablet: [0, 0, 5.5] as [number, number, number],
      mobile: [0, 0, 6.0] as [number, number, number],
    },
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
      desktop: { pos: [0.65, 0.2, 0.2], rot: [0, -0.9, 0] },
      tablet: { pos: [0.65, 0.2, 0.2], rot: [0, -0.9, 0] },
      mobile: { pos: [0.65, 0.2, 0.2], rot: [0, -0.9, 0] },
    },
    b: {
      desktop: { pos: [0, 0, 0], rot: [0, -0.6, 0] },
      tablet: { pos: [0, 0, 0], rot: [0, -0.6, 0] },
      mobile: { pos: [0, 0, 0], rot: [0, -0.6, 0] },
    },
  },
}
