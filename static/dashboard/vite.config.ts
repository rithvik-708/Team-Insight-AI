import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Custom UI is served from a sub-path inside an iframe, so assets must use relative URLs.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'build', emptyOutDir: true, sourcemap: false },
});
