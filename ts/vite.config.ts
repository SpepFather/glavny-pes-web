import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { target: 'es2022', assetsInlineLimit: 1024 * 1024, chunkSizeWarningLimit: 1500 },
});
