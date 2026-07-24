import { expect, test } from "bun:test"
import { countPathIntersections } from "lib/solvers/Example28Solver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { segmentOverlapsRectBoundary } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { chipToRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import inputProblem from "./bug-report-20260724T175257Z.json"
import "tests/fixtures/matcher"

test("routes a failed connection only when it does not cross existing traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const recoveredTraces =
    solver.unroutedTraceRecoverySolver!.solvedUnroutedTraces
  expect(recoveredTraces.map((trace) => trace.mspPairId)).toEqual([
    "R1.1-C1.1",
    "R1.2-C1.2",
  ])

  const alreadySolvedTraces =
    solver.longDistancePairSolver!.getOutput().allTracesMerged
  const c1 = inputProblem.chips.find(
    (chip) => chip.chipId === "schematic_component_2",
  )!
  const c1Top = c1.center.y + c1.height / 2
  const c1Bottom = c1.center.y - c1.height / 2
  const c1Pin1Trace = recoveredTraces.find(
    (trace) => trace.mspPairId === "R1.1-C1.1",
  )!
  const c1Pin2Trace = recoveredTraces.find(
    (trace) => trace.mspPairId === "R1.2-C1.2",
  )!

  expect(
    Math.max(...c1Pin1Trace.tracePath.map((point) => point.y)),
  ).toBeGreaterThan(c1Top)
  expect(
    Math.min(...c1Pin2Trace.tracePath.map((point) => point.y)),
  ).toBeLessThan(c1Bottom)

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
      if (recoveredTrace.globalConnNetId === existingTrace.globalConnNetId) {
        expect(
          countPathIntersections(
            recoveredTrace.tracePath,
            existingTrace.tracePath,
          ),
        ).toBeGreaterThan(0)
        continue
      }
      const intersectionCount = countPathIntersections(
        recoveredTrace.tracePath,
        existingTrace.tracePath,
      )
      expect(intersectionCount).toBe(0)
    }
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
