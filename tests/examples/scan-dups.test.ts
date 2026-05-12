import { test, expect, describe } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import * as fs from "fs"
import * as path from "path"

const examplesDir = path.join(import.meta.dir, "..", "examples")
const assetsDir = path.join(import.meta.dir, "..", "assets")

const exampleFiles = fs.readdirSync(examplesDir)
  .filter(f => f.endsWith(".test.ts"))
  .map(f => f.replace(".test.ts", ""))

describe("scan all examples for duplicate trace segments", () => {
  for (const name of exampleFiles) {
    test(`${name}`, () => {
      const assetPath = path.join(assetsDir, `${name}.json`)
      if (!fs.existsSync(assetPath)) return
      
      const inputProblem = JSON.parse(fs.readFileSync(assetPath, "utf8"))
      const solver = new SchematicTracePipelineSolver(inputProblem)
      solver.solve()
      
      const graphics = solver.visualize()
      const allElms = [
        ...(graphics.lines ?? []),
        ...(graphics.points ?? []),
        ...(graphics.rects ?? []),
        ...(graphics.circles ?? []),
        ...(graphics.texts ?? []),
      ]
      const lastStep = allElms.reduce((acc, elm) => Math.max(acc, elm.step ?? 0), 0)
      
      const lastStepLines = (graphics.lines ?? [])
        .filter((l: any) => l.step === lastStep)
      
      const segmentMap = new Map<string, {count: number, keys: string[]}>()
      for (let i = 0; i < lastStepLines.length; i++) {
        const line = lastStepLines[i]
        const pts = (line as any).points as Array<{x: number, y: number}>
        for (let j = 0; j < pts.length - 1; j++) {
          const key = `${Math.round(pts[j].x*1000)},${Math.round(pts[j].y*1000)}-${Math.round(pts[j+1].x*1000)},${Math.round(pts[j+1].y*1000)}`
          if (!segmentMap.has(key)) segmentMap.set(key, {count: 0, keys: []})
          const entry = segmentMap.get(key)!
          entry.count++
          entry.keys.push(`trace[${i}]`)
        }
      }
      
      let dups = 0
      for (const [key, {count, keys}] of segmentMap) {
        if (count > 1) {
          dups++
          console.log(`  dup(${count}x) ${key} in ${[...new Set(keys)].join(', ')}`)
        }
      }
      
      if (dups > 0) {
        console.log(`${name}: ${dups}/${segmentMap.size} duplicate segments (${lastStepLines.length} lines)`)
      }
      
      // Don't fail, just report
    })
  }
})
