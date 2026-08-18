import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./board1096-usb-label-overlap-iteration.json"
import "tests/fixtures/matcher"

test("board1096 USB section reproduces trace-label iteration exhaustion", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.failed).toBe(true)
  expect(solver.error).toBe(
    "TraceLabelOverlapAvoidanceSolver ran out of iterations",
  )
  expect(solver.traceLabelOverlapAvoidanceSolver?.iterations).toBe(100_001)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
