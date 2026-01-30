import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  base: './',
  build: {
    rollupOptions: {
      input: {
        inject: resolve(__dirname, 'src/inject/index.ts'),
        panel: resolve(__dirname, 'src/panel/index.html'),
        'panel-bundle': resolve(__dirname, 'src/panel/main.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'inject') return 'assets/inject.js'
          if (chunk.name === 'panel-bundle') return 'assets/panel.js'
          return 'assets/[name]-[hash].js'
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
})
