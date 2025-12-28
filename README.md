# Jenka 3D

**High-Performance 3D Orchestration Layer for Webflow**

Jenka 3D is a headless, attribute-driven 3D rendering engine built to inject cinema-grade interactive experiences into standard Webflow projects. It decouples complex 3D logic (Vue 3 + Three.js) from content management, allowing designers to configure scenes via simple HTML `data-*` attributes without touching a line of JavaScript.

## ⚡️ The Stack

*   **Core:** [Vue 3](https://vuejs.org/) (Reactivity) + [TresJS](https://tresjs.org/) (Declarative Three.js).
*   **Engine:** [Three.js](https://threejs.org/) (WebGL) + [GSAP](https://greensock.com/) (Motion).
*   **Build:** [Vite](https://vitejs.dev/) (Library Mode) + [Bun](https://bun.sh/) (Runtime).
*   **Pipeline:** GitHub Actions -> `release` branch -> jsDelivr CDN.

---

## 🏗 Architecture

### 1. The Bootloader (`src/webflow/boot.ts`)
The library operates as a "parasitic" enhancement. On load, it scans the DOM for containers marked with `data-tres="scene"`. It parses the configuration (models, lighting, exposure) and mounts a dedicated Vue application into the container.

### 2. Scene Strategy
The engine supports multiple "Archetypes" (Scenes), dynamically loaded based on the `data-scene` attribute:

*   **Compare Duo (`compare-duo`):** A sophisticated A/B comparison view.
    *   **Grid Mode:** Two models side-by-side with parallax hover effects.
    *   **Focus Mode:** Seamless camera transition to a single model, unlocking interactive hotspots.
    *   **Tech Note:** Hotspots are parented directly to the GLTF model wrappers to ensure sub-pixel synchronization during layout transitions.
*   **Hero Duo (`hero-duo`):** Cinematic presentation of two products.
*   **Arcade (`arcade-duo`):** Gamified interaction context.

### 3. Visual Systems
*   **Glints:** Procedural, raycast-disabled sprite systems attached to model hardpoints to guide user attention without blocking interaction.
*   **Smart Hotspots:** Invisible raycast targets (`TresMesh`) overlaid on model geometry to trigger HUD elements.
*   **Post-Processing:** Selective Bloom and Tone Mapping pipelines optimized for performance (disabled on low-power devices).

---

## 🚀 Webflow Integration

This project uses a **Serverless CI/CD Pipeline**. You do not build manually.

1.  **Push** changes to the `main` branch.
2.  **GitHub Actions** (powered by Bun) compiles the project.
3.  **Artifacts** are deployed to the orphan `release` branch.
4.  **Webflow** consumes the build via jsDelivr.

### Footer Code

Paste this into your Webflow project's **Custom Code (Footer)**:

```html
<!-- Jenka 3D Core Styles -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USER/jenka-3d@release/style.css">

<!-- Jenka 3D Engine (Defer is critical) -->
<script src="https://cdn.jsdelivr.net/gh/YOUR_GITHUB_USER/jenka-3d@release/jenka-3d.js" defer></script>
```

### Element Configuration

Create a `div` in Webflow and apply attributes:

| Attribute | Value / Type | Description |
| :--- | :--- | :--- |
| `data-tres` | `scene` | **Required.** Activates the engine. |
| `data-scene` | `compare-duo` \| `hero-duo` | Selects the visual archetype. |
| `data-model-a` | `URL (.glb)` | Path to the first 3D model. |
| `data-model-b` | `URL (.glb)` | Path to the second 3D model. |
| `data-exposure` | `Number` (e.g. `1.5`) | Global scene brightness. |
| `data-bloom` | `Number` (e.g. `1.0`) | Bloom intensity (0 to disable). |

---

## 🛠 Local Development

We use **Bun** for blazing fast installs and builds.

```bash
# 1. Install
bun install

# 2. Dev Server (Playground)
bun dev

# 3. Production Build (Library Mode)
# (Runs automatically in CI, but you can test locally)
bun run build:lib
```

**Directory Structure:**
*   `src/webflow/`: Integration logic and entry point.
*   `src/scenes/`: Vue components for each 3D archetype.
*   `src/three/`: Reusable Three.js logic (lighting, controls, effects).
*   `src/App.vue`: Local development playground (simulates Webflow).

---

## 📱 Mobile & iOS Constraints

Jenka 3D implements specific safeguards for iOS Safari to prevent WebGL memory crashes ("Jetsam" events).

### The "Retina OOM" Issue
On iPhone Pro models (DPR 3.0), a fullscreen WebGL buffer with Post-Processing can exceed Safari's strict per-tab memory limit (~350MB). This is exacerbated when loading two models simultaneously (Compare Scene).

### Implemented Safeguards
1.  **SMAA Disabled on Mobile:** Subpixel Morphological Antialiasing is forcefully disabled on touch devices regardless of the `data-quality` setting. The high pixel density of mobile screens makes SMAA redundant and computationally expensive.
2.  **Texture Clamping:** Textures are automatically resized to a maximum of **2048px** on mobile devices during the loading phase (`src/three/materialTweaks.ts`).
3.  **DPR Clamping:** The renderer clamps Device Pixel Ratio to a maximum of **2.0**, preventing internal render buffers from exploding on 3x screens.

**Developer Note:** If adding new post-processing effects, always check `isCoarsePointer()` in `postfx.ts` and disable heavy passes for mobile.

## 🧠 "Ultrathink" Notes

*   **Zero-Desync Layouts:** We use a `<primitive>` container strategy for interactive elements. Hotspots are injected as children of the GLTF wrapper, inheriting all GSAP transform matrices automatically.
*   **State Management:** The `activeInteraction` state in comparison views is managed via a dedicated composable (`useInteractiveHotspots`) that handles race conditions between hover timers and camera transitions.
*   **Performance:** Glints are purely visual (raycast disabled). Interaction is handled by invisible proxy geometry to ensure 60fps interaction loops even with post-processing active.
