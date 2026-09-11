import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./assets/section-autolayout-mcu.input.json"
import "tests/fixtures/matcher"

// Captured from core's schematic-section-autolayout.test.tsx at 87d04cc,
// retaining the four MCU components and their original geometry:
// <capacitor name="C3" capacitance="100nF" schSectionName="mcu"
//   connections={{ pin1: "net.VCC_3V3", pin2: "net.GND" }} />
// <resistor name="R2" resistance="10k" schSectionName="mcu"
//   connections={{ pin1: "net.VCC_3V3", pin2: "net.SCL" }} />
// <resistor name="R3" resistance="10k" schSectionName="mcu"
//   connections={{ pin1: "net.VCC_3V3", pin2: "net.SDA" }} />
// <chip name="U2" schSectionName="mcu" connections={{
//   VCC: "net.VCC_3V3", GND: "net.GND", SCL: "net.SCL", SDA: "net.SDA"
// }} />
test("section autolayout recovers a detour between stacked upper terminals", () => {
  const problem = structuredClone(inputProblem) as InputProblem
  const solver = new SchematicTracePipelineSolver(problem)
  solver.solve()

  const stackedConnection =
    solver.schematicTraceLinesSolver!.failedConnectionPairs.find(
      (pair) =>
        pair.pins.some((pin) => pin.pinId === "schematic_port_31") &&
        pair.pins.some((pin) => pin.pinId === "schematic_port_29"),
    )!
  expect(stackedConnection).toBeDefined()
  expect(stackedConnection.pins.map((pin) => pin._facingDirection)).toEqual([
    "y+",
    "y+",
  ])
  const recoveredTraces = solver
    .unroutedTraceRecoverySolver!.getOutput()
    .newTraces.filter(
      (trace) => trace.mspPairId === stackedConnection.mspPairId,
    )
  expect(recoveredTraces).toHaveLength(1)
  expect(recoveredTraces[0]!.tracePath.length).toBeGreaterThan(3)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
