import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  // Served from https://<user>.github.io/clearwater/ in production
  base: mode === 'production' ? '/clearwater/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'ClearWater',
        short_name: 'ClearWater',
        scope: mode === 'production' ? '/clearwater/' : '/',
        description:
          'Turn water test reports into smart shopping lists and track every dollar spent on your pool.',
        theme_color: '#0891b2',
        background_color: '#f8fafc',
        display: 'standalone',
        start_url: mode === 'production' ? '/clearwater/' : '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
}))
