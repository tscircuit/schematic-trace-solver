import path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  resolve: {
    alias: {
      lib: path.resolve(__dirname, "lib"),
      site: path.resolve(__dirname, "site"),
      tests: path.resolve(__dirname, "tests"),
    },
  },
  server: {
    port: 5020,
  },
})
