import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getTraceLocationsForPoint } from "lib/solvers/TraceAnchoredNetLabelOverlapSolver/geometry"
import inputProblem from "./bug-report-20260706T213649Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260706T213649Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any, {
    hideRatsNet: true,
  })

  solver.solve()

  const j1 = inputProblem.chips.find((chip) =>
    chip.pins.some((pin) => pin.pinId === "J1.3"),
  )!
  const label = solver
    .netLabelToTraceSolver!.getOutput()
    .netLabelPlacements.find((label) => label.pinIds.includes("J1.3"))!
  expect(label.center.y - label.height / 2).toBeGreaterThan(
    j1.center.y + j1.height / 2,
  )
  const trace = solver.netLabelToTraceSolver!.outputTraces.find((trace) =>
    trace.pinIds.includes("J1.3"),
  )!
  expect(
    getTraceLocationsForPoint(label.anchorPoint, [trace]).length,
  ).toBeGreaterThan(0)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
