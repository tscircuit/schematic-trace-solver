import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getTraceCorners } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE } from "lib/utils/doesPathCoincideWithTraces"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-bq25895-cross-net-trace-overlap.input.json"

const EPSILON = 1e-6

const tracesHaveInsufficientParallelClearance = (
  firstTrace: SolvedTracePath,
  secondTrace: SolvedTracePath,
) => {
  for (
    let firstPointIndex = 0;
    firstPointIndex < firstTrace.tracePath.length - 1;
    firstPointIndex++
  ) {
    const firstStart = firstTrace.tracePath[firstPointIndex]!
    const firstEnd = firstTrace.tracePath[firstPointIndex + 1]!
    const firstIsVertical = Math.abs(firstStart.x - firstEnd.x) < EPSILON
    if (!firstIsVertical) continue

    for (
      let secondPointIndex = 0;
      secondPointIndex < secondTrace.tracePath.length - 1;
      secondPointIndex++
    ) {
      const secondStart = secondTrace.tracePath[secondPointIndex]!
      const secondEnd = secondTrace.tracePath[secondPointIndex + 1]!
      const secondIsVertical = Math.abs(secondStart.x - secondEnd.x) < EPSILON
      if (!secondIsVertical) continue

      const xSeparation = Math.abs(firstStart.x - secondStart.x)
      const verticalOverlap =
        Math.min(
          Math.max(firstStart.y, firstEnd.y),
          Math.max(secondStart.y, secondEnd.y),
        ) -
        Math.max(
          Math.min(firstStart.y, firstEnd.y),
          Math.min(secondStart.y, secondEnd.y),
        )

      if (
        xSeparation + EPSILON <
          SCHEMATIC_TRACE_MIN_VISUAL_CENTERLINE_CLEARANCE &&
        verticalOverlap > EPSILON
      ) {
        return true
      }
    }
  }

  return false
}

test("BQ25895 CE and GND traces keep visible parallel clearance", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  const ceTraces = traces.filter(
    (trace) => trace.userNetId === "J3.pin6 to U1.CE",
  )
  const groundTraces = traces.filter((trace) => trace.userNetId === "GND")
  const hasInsufficientCeAndGroundClearance = ceTraces.some((ceTrace) =>
    groundTraces.some((groundTrace) =>
      tracesHaveInsufficientParallelClearance(ceTrace, groundTrace),
    ),
  )

  expect(hasInsufficientCeAndGroundClearance).toBe(false)

  const output = solver.netLabelTraceCollisionSolver!.getOutput()
  const groundLabel = output.netLabelPlacements.find(
    (label) => label.netId === "GND",
  )!
  const groundLabelTrace = output.traces.find((trace) =>
    groundLabel.mspConnectionPairIds.includes(trace.mspPairId),
  )!

  expect(getTraceCorners(groundLabelTrace.tracePath)).toContainEqual(
    groundLabel.anchorPoint,
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
