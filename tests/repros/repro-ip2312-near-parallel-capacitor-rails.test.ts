import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { SCHEMATIC_TRACE_MIN_CENTERLINE_CLEARANCE } from "lib/utils/doesPathCoincideWithTraces"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-ip2312-near-parallel-capacitor-rails.input.json"

const GEOMETRY_EPSILON = 1e-6

const getMinimumParallelVerticalRailDistance = (
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

// Reduced from the solver input emitted by
// krishnax12/ip2312-fast-charging-module v0.1.3. Matchpack placed C4 and C5
// 0.005 schematic units apart on x. Their separate VBAT and GND return rails
// render as one wire because the trace stroke is wider than the centerline
// separation.
test("IP2312 C4/C5 produce visually merged VBAT and GND rails", async () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const traces = solver.netLabelToTraceSolver!.getOutput().traces
  const vbatTrace = traces.find((trace) =>
    ["C4.1", "C5.1"].every((pinId) => trace.pinIds.includes(pinId)),
  )
  const groundTrace = traces.find((trace) =>
    ["C4.2", "C5.2"].every((pinId) => trace.pinIds.includes(pinId)),
  )
  expect(vbatTrace).toBeDefined()
  expect(groundTrace).toBeDefined()

  const minimumRailDistance = getMinimumParallelVerticalRailDistance(
    vbatTrace!,
    groundTrace!,
  )
  expect(minimumRailDistance).toBeCloseTo(0.005, 6)
  expect(minimumRailDistance).toBeLessThan(
    SCHEMATIC_TRACE_MIN_CENTERLINE_CLEARANCE,
  )

  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
