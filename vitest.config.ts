import path from "node:path"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    // The forks pool is heavy on smaller machines (vitest spins up one
    // process per test file by default and times out on cold imports). The
    // threads pool with a capped worker count keeps the suite fast and
    // green on the iter-6 dev box without impacting CI throughput.
    pool: "threads",
    maxWorkers: 4,
    minWorkers: 1,
  },
})
