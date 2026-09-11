import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { findFirstCollision } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./repro-manual-placement-detour.input.json"

// Captured from core/tests/components/primitive-components/schematic-section-manual-placement-5.test.tsx.
// R2 pin1 and C3 pin1 face upward, with C3 obstructing the initial U-shaped route.
test("routes R2 to C3 locally in manually placed schematic sections", async () => {
  const inputProblem: InputProblem = JSON.parse(JSON.stringify(inputJson))
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const trace = solver
    .netLabelToTraceSolver!.getOutput()
    .traces.find(
      (trace) =>
        trace.pinIds.includes("schematic_port_31") &&
        trace.pinIds.includes("schematic_port_29"),
    )!
  let routeLength = 0
  for (let pointIndex = 1; pointIndex < trace.tracePath.length; pointIndex++) {
    const previousPoint = trace.tracePath[pointIndex - 1]!
    const point = trace.tracePath[pointIndex]!
    routeLength +=
      Math.abs(point.x - previousPoint.x) + Math.abs(point.y - previousPoint.y)
  }
  expect(solver.solved).toBe(true)
  expect(
    findFirstCollision(trace.tracePath, getObstacleRects(inputProblem)),
  ).toBeNull()
  expect(routeLength).toBeCloseTo(3.06)
  expect(Math.min(...trace.tracePath.map((point) => point.x))).toBeGreaterThan(
    -3.5,
  )
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
