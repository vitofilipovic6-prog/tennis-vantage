import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ─────────────────────────────────────────────────────────────────────────────
// vite.config.js – TennisVantage
// ─────────────────────────────────────────────────────────────────────────────
//
// BUILD STRATEGY
//   React + ReactDOM → vendor-react chunk  (cached across deploys)
//   Supabase         → vendor-supabase chunk (rarely changes)
//   Your app code    → own chunk (re-downloaded only when you ship)
//
// DEV PROXY
//   /api/* is proxied to your live Vercel deployment so that the Gemini
//   Edge Function (/api/chat) works during local development without
//   spinning up a local serverless runtime.
//   Set VITE_API_PROXY in your .env to override the target URL.
//   e.g. VITE_API_PROXY=https://your-project.vercel.app
//
// ─────────────────────────────────────────────────────────────────────────────

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // ── Local dev server ────────────────────────────────────────────────────────
  server: {
    proxy: {
      // Proxy all /api/* requests to your deployed Vercel project.
      // This lets the AI chat tab work locally without any local serverless setup.
      '/api': {
        target:      process.env.VITE_API_PROXY ?? 'https://tennisvantage.vercel.app',
        changeOrigin: true,
        secure:       true,
        // Log proxied requests in development so you can debug chat issues
        configure: (proxy) => {
          proxy.on('error',     (err) => console.error('[proxy error]', err.message));
          proxy.on('proxyReq', (_, req) => console.log('[proxy →]', req.method, req.url));
        },
      },
    },
  },

  // ── Production build ────────────────────────────────────────────────────────
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
    // Warn if any individual chunk exceeds 400 kB
    chunkSizeWarningLimit: 400,
  },
}));