import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"
import overlapFixture from "../../assets/OverlapAvoidanceStepSolver.test.input.json"

const segmentKey = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const p1 = `${a.x},${a.y}`
  const p2 = `${b.x},${b.y}`
  return p1 < p2 ? `${p1}|${p2}` : `${p2}|${p1}`
}

test("SchematicTracePipelineSolver_repro78 removes extra trace lines in post-processing", () => {
  const inputProblem = structuredClone((overlapFixture as any).problem)
  // Hint from issue discussion: DISCH fixture reproduces when schMaxTraceDistance=6.
  ;(inputProblem as any).schMaxTraceDistance = 6

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const traces =
    solver.traceCleanupSolver?.getOutput().traces ??
    solver.traceLabelOverlapAvoidanceSolver?.getOutput().traces ??
    []

  const rawSegmentCounts = new Map<string, number>()
  for (const trace of traces as any[]) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const key = `${trace.globalConnNetId}|${segmentKey(trace.tracePath[i], trace.tracePath[i + 1])}`
      rawSegmentCounts.set(key, (rawSegmentCounts.get(key) ?? 0) + 1)
    }
  }

  const duplicateRawSegments = [...rawSegmentCounts.entries()].filter(
    ([, count]) => count > 1,
  )
  expect(duplicateRawSegments.length).toBeGreaterThan(0)

  const postProcessedLines = solver.getPostProcessedTraceLines()
  const postProcessedKeys = new Set<string>()
  for (const line of postProcessedLines) {
    const key = `${line.globalConnNetId}|${segmentKey(line.points[0], line.points[1])}`
    expect(postProcessedKeys.has(key)).toBeFalse()
    postProcessedKeys.add(key)
  }
})
