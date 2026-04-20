
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Ensures assets are loaded relatively (Fixes blank screen on Siteground subfolders)
  server: {
    host: true // Enables Network/Mobile testing on localhost
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000, 
    // Removed manualChunks to allow Vite/Rollup to automatically split 
    // the code based on the new React.lazy() dynamic imports in App.tsx
  }
});
