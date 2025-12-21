export const CONSTANTS = {
  controls: {
    parallaxStrength: 1.5,
    dragDamping: 4,
  },
  layout: {
    baseFov: 35,
    cameraZ: 4.4, // Desktop default
    cameraZMobile: 6.5, // Mobile default
    stagePos: [0, -0.9, 0], // Global stage offset
  },
  grid: {
    desktop: {
      a: { pos: [-0.6, 0, 0], scale: 1.0, rot: [0, -0.6, 0] },
      b: { pos: [0.6, 0, 0], scale: 1.0, rot: [0, 0.6, 0] },
    },
    tablet: {
      a: { pos: [0, 0.7, 0], scale: 0.9, rot: [0, 0, 0] },
      b: { pos: [0, -0.7, 0], scale: 0.9, rot: [0, 0, 0] },
    },
    mobile: {
      a: { pos: [0, 0.8, 0], scale: 1.0, rot: [0, 0, 0] },
      b: { pos: [0, -0.8, 0], scale: 1.0, rot: [0, 0, 0] },
    },
  },
  focus: {
    target: {
      pos: [0, 0, 0],
      scale: 1,
      rot: [0, 0, 0],
    },
    background: {
      pos: [0, 0, -1],
      scale: 0.8,
      rot: [0, 0, 0],
    },
  },
  glints: {
    opacity: 0.85,
    size: 0.25,
    // Names to match for auto-detection (lowercase)
    matchers: {
      buttons: ['circle.006', 'cylinder236', 'cylinder238'],
    },
  },
  customHotspots: {
    a: [
      { label: 'Top Speaker', pos: [0.2, 1.65, -0.05], type: 'button' },
      { label: 'Top Speaker', pos: [-0.2, 1.65, -0.05], type: 'button' },
      { label: 'Cube', pos: [-0, 0.5, 0.2], type: 'button' },
    ],
    b: [{ label: 'Top Speaker', pos: [0, 0, 0.2], type: 'button' }],
  },
}
