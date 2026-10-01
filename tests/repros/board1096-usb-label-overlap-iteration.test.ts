import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./board1096-usb-label-overlap-iteration.json"
import "tests/fixtures/matcher"

test("board1096 USB section stops retrying failed merged-label overlaps", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.error).toBe(null)
  expect(solver.traceLabelOverlapAvoidanceSolver?.iterations).toBe(30)
  const bridge = solver.sameNetJunctionAlignmentSolver!.outputTraces.find(
    (trace) =>
      trace.pinIds.includes("schematic_port_319") &&
      trace.pinIds.includes("schematic_port_321"),
  )!
  expect(bridge.tracePath[1]!.x - bridge.pins[0].x).toBeCloseTo(0.2)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
