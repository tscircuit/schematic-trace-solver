import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"
import inputProblem from "../../assets/example14.json"
import { getSameNetTraceSegmentKey } from "lib/solvers/SchematicTracePipelineSolver/dedupeSameNetTraceSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const countDuplicateSameNetSegments = (traces: SolvedTracePath[]) => {
  const seenSegmentKeys = new Set<string>()
  let duplicateCount = 0

  for (const trace of traces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const segmentKey = getSameNetTraceSegmentKey(
        trace.globalConnNetId,
        trace.tracePath[i]!,
        trace.tracePath[i + 1]!,
      )
      if (seenSegmentKeys.has(segmentKey)) duplicateCount++
      seenSegmentKeys.add(segmentKey)
    }
  }

  return duplicateCount
}

test("repro78 removes duplicate same-net trace segments after pipeline post-processing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(
    countDuplicateSameNetSegments(
      solver.traceCleanupSolver!.getOutput().traces,
    ),
  ).toBeGreaterThan(0)

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  expect(countDuplicateSameNetSegments(traces)).toBe(0)
})
