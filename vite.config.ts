import { defineConfig } from "vite"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      lib: path.resolve(__dirname, "lib"),
      site: path.resolve(__dirname, "site"),
      tests: path.resolve(__dirname, "tests"),
    },
  },
})
