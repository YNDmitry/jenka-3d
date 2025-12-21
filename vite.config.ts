import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import glsl from 'vite-plugin-glsl'
import { templateCompilerOptions } from '@tresjs/core'
import { resolve } from 'node:path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    vue({
      ...templateCompilerOptions,
    }),
    glsl(),
  ],
  resolve: {
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js',
      gsap: resolve(__dirname, 'src/shared/gsap-shim.ts'),
    },
    dedupe: ['vue', 'three', '@tresjs/core'],
  },
  optimizeDeps: {
    include: ['vue', 'three', '@tresjs/core', '@tresjs/cientos'],
  },
  server: {
    cors: {
      origin: '*',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('three')) return 'vendor-three'
            if (id.includes('@tresjs')) return 'vendor-tres'
            if (id.includes('gsap')) return 'vendor-gsap'
            return 'vendor-shared'
          }
        },
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
}))
