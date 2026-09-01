import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./repro-ti-power-output-section.input"

test("repro ti power output section", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
  const traces = solver.sameNetJunctionAlignmentSolver!.outputTraces
  const pathFromPin = (traceId: string, pinId: string) => {
    const trace = traces.find((item) => item.mspPairId === traceId)!
    return trace.pins[0]!.pinId === pinId
      ? trace.tracePath
      : [...trace.tracePath].reverse()
  }
  const sharedPinId = "schematic_port_11"
  const groundRail = pathFromPin(
    "schematic_port_9-schematic_port_11",
    sharedPinId,
  )
  const inductorGroundBranch = pathFromPin(
    "schematic_port_14-schematic_port_11",
    sharedPinId,
  )
  expect(inductorGroundBranch[1]!.y).toBeCloseTo(groundRail[1]!.y, 6)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
