import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["lib/index.ts"],
  format: ["esm"],
  target: "es2022",
  platform: "neutral",
  // Bundle runtime dependencies, including Git-pinned solver implementations.
  // Consumers should only download this package, not our development graph.
  noExternal: [/.*/],
  clean: true,
  outDir: "dist",
})
