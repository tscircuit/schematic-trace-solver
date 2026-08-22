import { expect, test } from "bun:test"
import { countPathIntersections } from "lib/solvers/Example28Solver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { segmentOverlapsRectBoundary } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { chipToRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import inputProblem from "tests/bug-reports/bug-report-20260724T175257Z/bug-report-20260724T175257Z.json"

test("recovers paired connections through clear same-net junctions", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const recoveredTraces =
    solver.unroutedTraceRecoverySolver!.solvedUnroutedTraces
  const alreadySolvedTraces =
    solver.longDistancePairSolver!.getOutput().allTracesMerged

  expect(recoveredTraces.map((trace) => trace.mspPairId)).toEqual([
    "R1.1-C1.1",
    "R1.2-C1.2",
  ])

  for (const recoveredTrace of recoveredTraces) {
    for (
      let pointIndex = 0;
      pointIndex < recoveredTrace.tracePath.length - 1;
      pointIndex++
    ) {
      const startPoint = recoveredTrace.tracePath[pointIndex]!
      const endPoint = recoveredTrace.tracePath[pointIndex + 1]!
      for (const chip of solver.inputProblem.chips) {
        expect(
          segmentOverlapsRectBoundary(startPoint, endPoint, chipToRect(chip)),
        ).toBe(false)
      }
    }
    for (const existingTrace of alreadySolvedTraces) {
      const intersectionCount = countPathIntersections(
        recoveredTrace.tracePath,
        existingTrace.tracePath,
      )
      if (recoveredTrace.globalConnNetId === existingTrace.globalConnNetId) {
        expect(intersectionCount).toBeGreaterThan(0)
        continue
      }
      expect(intersectionCount).toBe(0)
    }
  }
})
