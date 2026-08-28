import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE } from "lib/utils/doesPathCoincideWithTraces"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-adjacent-pin-near-parallel-rails.input.json"

const GEOMETRY_EPSILON = 1e-6

const getMinimumVerticalRailDistance = (
  firstTrace: SolvedTracePath,
  secondTrace: SolvedTracePath,
) => {
  let minimumDistance = Number.POSITIVE_INFINITY

  for (
    let firstPointIndex = 0;
    firstPointIndex < firstTrace.tracePath.length - 1;
    firstPointIndex++
  ) {
    const firstStart = firstTrace.tracePath[firstPointIndex]!
    const firstEnd = firstTrace.tracePath[firstPointIndex + 1]!
    if (Math.abs(firstStart.x - firstEnd.x) >= GEOMETRY_EPSILON) continue

    for (
      let secondPointIndex = 0;
      secondPointIndex < secondTrace.tracePath.length - 1;
      secondPointIndex++
    ) {
      const secondStart = secondTrace.tracePath[secondPointIndex]!
      const secondEnd = secondTrace.tracePath[secondPointIndex + 1]!
      if (Math.abs(secondStart.x - secondEnd.x) >= GEOMETRY_EPSILON) continue

      const verticalOverlap =
        Math.min(
          Math.max(firstStart.y, firstEnd.y),
          Math.max(secondStart.y, secondEnd.y),
        ) -
        Math.max(
          Math.min(firstStart.y, firstEnd.y),
          Math.min(secondStart.y, secondEnd.y),
        )
      if (verticalOverlap <= GEOMETRY_EPSILON) continue

      minimumDistance = Math.min(
        minimumDistance,
        Math.abs(firstStart.x - secondStart.x),
      )
    }
  }

  return minimumDistance
}

test("adjacent pin rails keep visible parallel clearance", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  const fbTrace = traces.find((trace) => trace.userNetId === "FB")!
  const groundTrace = traces.find((trace) => trace.userNetId === "GND")!
  const minimumRailDistance = getMinimumVerticalRailDistance(
    fbTrace,
    groundTrace,
  )

  expect(minimumRailDistance).toBeGreaterThanOrEqual(
    SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE - GEOMETRY_EPSILON,
  )
  expect(minimumRailDistance).toBeCloseTo(
    SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
