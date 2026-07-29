import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro48-555-timer-vcc-rail-label.input.json"
import "tests/fixtures/matcher"

// Captured from @tscircuit/core repro48. U1 pin 4 is a port-only member of the
// VCC net whose rail label must retain the requested y+ orientation.
test("core repro48 U1 pin4 retains its VCC rail orientation", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const u1Pin4VccLabel = solver.netLabelNetLabelCollisionSolver
    ?.getOutput()
    .netLabelPlacements.find((placement) =>
      placement.pinIds.includes("schematic_port_3"),
    )
  const u1Pin4VccConnector = solver.availableNetOrientationSolver?.traces.find(
    (trace) =>
      trace.mspPairId.startsWith("available-net-orientation-") &&
      trace.pinIds.includes("schematic_port_3"),
  )
  const connectorPath = u1Pin4VccConnector?.tracePath ?? []

  expect(inputProblem.availableNetLabelOrientations.VCC).toEqual(["y+"])
  expect(u1Pin4VccLabel?.netId).toBe("VCC")
  expect(u1Pin4VccLabel?.orientation).toBe("y+")
  expect(connectorPath).toHaveLength(3)
  expect(connectorPath[0]!.y).toBeCloseTo(connectorPath[1]!.y)
  expect(connectorPath[1]!.x).toBeCloseTo(connectorPath[2]!.x)
  expect(connectorPath[1]!.x).toBeLessThan(connectorPath[0]!.x)
  expect(connectorPath[2]!.y).toBeGreaterThan(connectorPath[1]!.y)
  expect(connectorPath[2]).toEqual(u1Pin4VccLabel!.anchorPoint)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
