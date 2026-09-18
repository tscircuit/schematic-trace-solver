import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260716T144856Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260716T144856Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  expect(
    traces.some(
      (trace) =>
        trace.pinIds.includes("C1.2") && trace.pinIds.includes("JP7.1"),
    ),
  ).toBe(false)
  const ground = netLabelPlacements.find((label) =>
    label.pinIds.includes("C1.2"),
  )!
  expect(ground.netId).toBe("GND")
  expect(ground.orientation).toBe("y-")
  expect(Math.abs(ground.anchorPoint.y - -0.88)).toBeLessThanOrEqual(4)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
