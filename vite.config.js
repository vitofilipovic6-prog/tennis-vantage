import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Code-splitting strategy:
// React + ReactDOM go into their own chunk (vendor) so the browser can
// cache them separately from your app code. This means on every deploy,
// users only re-download your app code, not React itself.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Heavy vendor libs into their own cached chunk
          'vendor-react':   ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
    // Warn if any individual chunk is over 400 kB
    chunkSizeWarningLimit: 400,
  },
});