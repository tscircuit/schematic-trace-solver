import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro48-555-timer-vcc-rail-label.input.json"
import "tests/fixtures/matcher"

// Captured from @tscircuit/core repro48. U1 pin 4 is a port-only member of the
// VCC net, but its required y+ rail placement falls back to a horizontal label.
test("core repro48 U1 pin4 VCC rail label falls back horizontally", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const u1Pin4VccLabel = solver.netLabelNetLabelCollisionSolver
    ?.getOutput()
    .netLabelPlacements.find((placement) =>
      placement.pinIds.includes("schematic_port_3"),
    )

  expect(inputProblem.availableNetLabelOrientations.VCC).toEqual(["y+"])
  expect(u1Pin4VccLabel?.netId).toBe("VCC")
  expect(u1Pin4VccLabel?.orientation).toBe("x-")
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
