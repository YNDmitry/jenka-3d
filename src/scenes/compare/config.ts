export const CONSTANTS = {
  controls: {
    parallaxStrength: 1.5,
    dragDamping: 4,
  },
  layout: {
    baseFov: 35,
    cameraZ: {
      desktop: 4.4,
      tablet: 4.6,
      mobile: 8,
    },
    stagePos: {
      desktop: [0, -0.9, 0],
      tablet: [0, -0.75, 0],
      mobile: [0, -0.3, 0],
    },
  },
  grid: {
    desktop: {
      a: { pos: [-0.6, 0, 0], scale: 1.0, rot: [0, -0.6, 0] },
      b: { pos: [0.6, 0, 0], scale: 1.0, rot: [0, 0.6, 0] },
    },
    tablet: {
      a: { pos: [-0.6, 0, 0], scale: 0.9, rot: [0, -0.6, 0] },
      b: { pos: [0.6, -0, 0], scale: 0.9, rot: [0, 0.6, 0] },
    },
    mobile: {
      a: { pos: [-0.5, 0, 0], scale: 1.0, rot: [0, -0.6, 0] },
      b: { pos: [0.5, 0, 0], scale: 1.0, rot: [0, 0.6, 0] },
    },
  },
  focus: {
    desktop: {
      target: { pos: [0, 0, 0], scale: 1, rot: [0, 0, 0] },
      background: { pos: [0, 0, -1], scale: 0.8, rot: [0, 0, 0] },
    },
    tablet: {
      target: { pos: [0, -0.4, 0], scale: 1.1, rot: [0, 0, 0] },
      background: { pos: [0, 0, -1], scale: 0.7, rot: [0, 0, 0] },
    },
    mobile: {
      target: { pos: [0, -1.3, 0], scale: 1.5, rot: [0, 0, 0] },
      background: { pos: [0, 0, -1.5], scale: 0.6, rot: [0, 0, 0] },
    },
  },
  glints: {
    opacity: 0.85,
    size: 0.25,
    // Names to match for auto-detection (lowercase)
    matchers: {
      buttons: [],
    },
  },
  customHotspots: {
    a: [
      { label: 'Right Speaker', pos: [0.2, 1.68, -0.04], type: 'button' },
      { label: 'Left Speaker', pos: [-0.2, 1.68, -0.04], type: 'button' },
      {
        label: 'FullHD touch display',
        pos: [0, 1.4, -0.1],
        type: 'button',
      },
      { label: 'Bill validator', pos: [-0, 0.55, 0.2], type: 'button' },
      { label: 'Scanner', pos: [0.19, 0.72, 0.2], type: 'button' },
      { label: 'LED push button', pos: [0.22, 0.91, 0.16], type: 'button' },
      { label: 'LED push button', pos: [-0.22, 0.91, 0.16], type: 'button' },
      { label: 'Joystick', pos: [0.01, 0.94, 0.16], type: 'button' },
    ],
    b: [
      { label: 'Joystick', pos: [0, 0.94, 0.18], type: 'button' },
      { label: 'LED push button', pos: [0.15, 0.91, 0.18], type: 'button' },
      { label: 'LED push button', pos: [-0.15, 0.91, 0.18], type: 'button' },
      { label: 'Bill validator', pos: [0.1, 1.05, 0.1], type: 'button' },
      { label: 'Scanner', pos: [0.2, 1.05, 0.1], type: 'button' },
      {
        label: 'FullHD touch display',
        pos: [0, 1.5, 0],
        type: 'button',
      },
      { label: 'Right Speaker', pos: [0.2, 1.78, 0.1], type: 'button' },
      { label: 'Left Speaker', pos: [-0.2, 1.78, 0.1], type: 'button' },
    ],
  },
}
