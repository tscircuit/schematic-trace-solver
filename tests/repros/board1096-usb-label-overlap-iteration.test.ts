import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./board1096-usb-label-overlap-iteration.json"
import "tests/fixtures/matcher"

test("board1096 USB section stops retrying failed merged-label overlaps", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.error).toBe(null)
  expect(solver.traceLabelOverlapAvoidanceSolver?.iterations).toBe(31)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
