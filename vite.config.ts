/// <reference types="vitest" />
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // This tells both local and CI to look for tests here
    include: ["tests/**/*.{test,spec}.ts"],
  },
})
