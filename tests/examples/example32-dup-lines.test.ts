import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "tests/assets/example32.json"

test("example32 - no duplicate trace segments at last step", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
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

  // Filter to last step lines
  const lastStepLines = (graphics.lines ?? [])
    .filter((l) => l.step === lastStep)
    .map((l) => l.points.map((p) => [p.x, p.y]))

  console.log(`Total lines at last step: ${lastStepLines.length}`)

  // Find duplicate segments
  const segmentMap = new Map<string, { count: number; traceIdx: number[] }>()
  for (let i = 0; i < lastStepLines.length; i++) {
    const line = lastStepLines[i]
    for (let j = 0; j < line.length - 1; j++) {
      const [x1, y1] = line[j]
      const [x2, y2] = line[j + 1]
      const key = `${Math.round(x1 * 1000)},${Math.round(y1 * 1000)}-${Math.round(x2 * 1000)},${Math.round(y2 * 1000)}`
      if (!segmentMap.has(key)) segmentMap.set(key, { count: 0, traceIdx: [] })
      const entry = segmentMap.get(key)!
      entry.count++
      entry.traceIdx.push(i)
    }
  }

  let dupCount = 0
  for (const [key, { count, traceIdx }] of segmentMap) {
    if (count > 1) {
      dupCount++
      console.log(
        `  Duplicate segment (${count}x): ${key} in traces [${[...new Set(traceIdx)].join(",")}]`,
      )
    }
  }
  console.log(
    `Total unique segments: ${segmentMap.size}, duplicate segments: ${dupCount}`,
  )

  expect(dupCount).toBe(0)
})
