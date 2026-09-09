import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
// Local Node runtime connects to the existing MySQL server.
export default defineConfig({
  // Modern CSS target: keeps standard properties like `backdrop-filter`
  // intact instead of downgrading them to `-webkit-`-prefixed variants.
  build: { cssTarget: ['chrome120', 'safari16.4', 'firefox121'] },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [vinext(), sites()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.WELCOME_API_ORIGIN || 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },
});
