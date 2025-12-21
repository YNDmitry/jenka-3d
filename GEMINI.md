# Jenka 3D (Webflow Tres Scenes)

This project is a high-performance 3D rendering library designed to be embedded in Webflow websites. It utilizes **Vue 3** and **TresJS** (a Vue wrapper for Three.js) to render interactive 3D scenes based on HTML `data-*` attributes.

## Project Overview

*   **Goal:** Provide production-ready, interactive 3D scenes (Hero, Compare, Single) for Webflow without writing code in Webflow.
*   **Mechanism:** A single JavaScript bundle (IIFE) scans the DOM for containers with `data-tres="scene"`, parses configuration from attributes, and mounts a Vue application into them.
*   **Tech Stack:**
    *   **Framework:** Vue 3
    *   **3D Engine:** Three.js via TresJS (`@tresjs/core`, `@tresjs/cientos`)
    *   **Build Tool:** Vite
    *   **Animation:** GSAP (via shim)

## Architecture

### 1. The Bootloader (`src/webflow/boot.ts`)
This is the entry point for the production library.
*   **Auto-Mount:** Runs on `DOMContentLoaded` and observes the DOM (`MutationObserver`) for new elements.
*   **Config Parsing:** specific `data-*` attributes (e.g., `data-scene`, `data-model-a`) are parsed into a `WebflowSceneConfig` object.
*   **Mounting:** Creates a fresh Vue app instance for each detected container using `SceneMount.vue`.

### 2. The Playground (`src/App.vue`)
This is the development harness used when running `npm run dev`.
*   Simulates the Webflow environment locally.
*   Provides UI controls to toggle between scenes and tweak parameters (exposure, bloom, layout) in real-time.
*   Useful for testing models and lighting without deploying.

### 3. Scenes (`src/scenes/`)
Each visual experience is encapsulated in a Vue component.
*   **`SceneHeroDuo`**: Two models with hover interaction (Scene A).
*   **`SceneCompareDuo`**: Comparison view with grid/focus modes (Scene B).
*   **`SceneArcadeDuo`**: (Likely similar to Hero/Compare).
*   `Scene...Content.vue`: Inner components separating the scene logic from the wrapper/props.

### 4. 3D Core (`src/three/`)
Shared Three.js logic and render setup.
*   **`RenderDriver.vue`**: Manages the render loop, quality settings, and pixel ratio.
*   **`postfx.ts`**: Post-processing configuration (Bloom, ToneMapping).
*   **`lighting.ts`**: Scene lighting setup.

## Key Files & Directories

| Path | Description |
| :--- | :--- |
| `src/webflow/boot.ts` | **Library Entry**. Handles DOM scanning and app mounting. |
| `src/App.vue` | **Dev Playground**. Main dev UI. |
| `src/scenes/` | Contains the 3D logic for each scene type. |
| `src/shared/types.ts` | TypeScript definitions for scene configs and props. |
| `src/three/` | Reusable 3D components (Lighting, Controls, Post-FX). |
| `vite.config.ts` | Build configuration (supports both dev server and production build). |

## Development

### Setup & Run
```bash
npm install
npm run dev
```
This opens the local playground where you can test all scenes.

### Building
```bash
npm run build
```
Generates the production artifacts in `dist/`.

### Adding a New Scene
1.  Create `src/scenes/SceneNew.vue` (and `SceneNewContent.vue`).
2.  Register it in `src/webflow/SceneMount.vue` (to dynamically load it based on `config.scene`).
3.  Add it to the `SceneId` type in `src/shared/types.ts`.
4.  Add a test case in `src/App.vue`.

## Usage (Webflow Context)

Containers are configured via attributes:

```html
<div 
  data-tres="scene" 
  data-scene="hero-duo"
  data-model-a="url/to/model.glb"
  data-model-b="url/to/model.glb"
  data-exposure="1.2"
></div>
```

**Common Attributes:**
*   `data-scene`: `hero-duo` | `compare-duo` | `single`
*   `data-model-a`, `data-model-b`, `data-model`: URLs to GLB/GLTF files.
*   `data-hdr`: URL to HDR environment map.
*   `data-exposure`, `data-bloom`, `data-quality`: Rendering adjustments.
