import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputJson from "./repro-manual-placement-detour.input.json"

// Captured from core/tests/components/primitive-components/schematic-section-manual-placement-5.test.tsx.
// R2 pin1 and C3 pin1 face upward, with C3 obstructing the initial U-shaped route.
test("reproduces the R2 to C3 detour in manually placed schematic sections", async () => {
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
  expect(routeLength).toBeGreaterThan(26)
  expect(Math.min(...trace.tracePath.map((point) => point.x))).toBeLessThan(-15)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
