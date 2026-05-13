import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import bundleExports from './vite-plugin-bundle-exports.js';

// When BUNDLE_EXPORTS=1 (GitHub Pages build), inline sessions and copy exports/.
// In normal dev/build, skip it so the file picker still works locally.
const useBundleExports = process.env.BUNDLE_EXPORTS === '1';

export default defineConfig({
  // GitHub Pages serves from /journeymap/ — set base so asset paths resolve.
  // Local builds use '/' (default).
  base: useBundleExports ? '/journeymap/' : '/',
  plugins: [
    react(),
    // Only inline sessions for the Pages build; keep singlefile for local builds
    ...(useBundleExports ? [bundleExports()] : [viteSingleFile()]),
  ],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
