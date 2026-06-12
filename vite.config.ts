import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    port: 5173,
  },
  optimizeDeps: {
    include: [
      '@deck.gl/core',
      '@deck.gl/aggregation-layers',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-dialog',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-progress',
      'three',
      'react-markdown',
      'remark-gfm',
    ],
    exclude: [
      'ai',
      '@deck.gl/react',
    ],
  },
})
