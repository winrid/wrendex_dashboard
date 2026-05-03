import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
//
// Code-splitting (P5 iter 1 FE-A): the route table in `src/router.tsx`
// loads every route via React.lazy(), so per-route chunks emit
// automatically. We additionally split the large vendor deps that the
// AppShell pulls eagerly into their own chunks so the main entry stays
// under the 500 kB warning threshold.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        // rolldown's manualChunks accepts a function (id -> chunk name | null).
        // We split the largest eager-loaded vendor surfaces out of the main
        // entry so the warning threshold (500 kB minified) stops tripping:
        //   - React + React DOM + scheduler
        //   - React Router + TanStack Query (used by every route)
        //   - Radix primitives + cmdk + lucide / tabler icons (shared shell)
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return null
          if (
            /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)
          ) {
            return 'vendor-react'
          }
          if (
            /[\\/]node_modules[\\/](react-router|react-router-dom|@remix-run|@tanstack[\\/]react-query)[\\/]/.test(
              id,
            )
          ) {
            return 'vendor-router-query'
          }
          if (
            /[\\/]node_modules[\\/](@radix-ui|radix-ui|cmdk|lucide-react|@tabler[\\/]icons-react|sonner|next-themes|framer-motion)[\\/]/.test(
              id,
            )
          ) {
            return 'vendor-ui'
          }
          return null
        },
      },
    },
  },
})
