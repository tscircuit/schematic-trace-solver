import { defineConfig } from 'vitest/config'
import path from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    {
      name: 'resolve-extensionless-relative-imports',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source.startsWith('.') && importer) {
          let resolvedPath = path.resolve(path.dirname(importer), source)

          const extensions = ['.ts', '.tsx', '.js', '.jsx']
          for (const ext of extensions) {
            if (fs.existsSync(resolvedPath + ext)) {
              return resolvedPath + ext
            }
          }

          for (const ext of extensions) {
            const indexPath = path.join(resolvedPath, 'index' + ext)
            if (fs.existsSync(indexPath)) {
              return indexPath
            }
          }
        }
        return null
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'lib': path.resolve(__dirname, './lib'),
      'tests': path.resolve(__dirname, './tests'),
    },
  },
  test: {
    setupFiles: ['./tests/fixtures/watcher.ts', './tests/fixtures/matcher.ts'],
// watcher first, then matcher so matcher can overwrite the stub with real logic
  },
})
