import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import glsl from 'vite-plugin-glsl'
import { templateCompilerOptions } from '@tresjs/core'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue({ ...templateCompilerOptions }),
    glsl(),
  ],
  resolve: {
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js',
      gsap: resolve(__dirname, 'src/shared/gsap-shim.ts'),
    },
  },
  build: {
    outDir: 'dist/lib',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/webflow/boot.ts'),
      name: 'Jenka3D',
      fileName: () => 'jenka-3d.js', // Simple name for IIFE
      formats: ['iife'],
    },
    rollupOptions: {
      // Ensure we bundle everything
      external: [],
      output: {
        // Global variable name for IIFE
        name: 'Jenka3D',
        // Ensure standard exports
        extend: true,
      }
    },
    // Minification
    minify: 'esbuild',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  }
})
