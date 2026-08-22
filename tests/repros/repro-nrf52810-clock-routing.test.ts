import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-nrf52810-clock-routing.input.json"

// Extracted from the nRF52810 clock-source schematic shown in the reproduction:
// a four-pin 32 MHz crystal and a two-pin 32.768 kHz crystal, each connected
// to an MCU schematic box, two load capacitors, and section-local GND labels.
test("repro nRF52810 HF and LF crystal trace/net-label routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.mspConnectionPairSolver?.mspConnectionPairs).toHaveLength(11)
  expect(
    solver.schematicTraceLinesSolver?.failedConnectionPairs.map(
      (pair) => pair.mspPairId,
    ),
  ).toEqual([
    "schematic_port_39-schematic_port_43", // U1.XC2 -> X1.XTAL2
    "schematic_port_45-schematic_port_47", // U1.XL2 -> X2.OSC2
    "schematic_port_41-schematic_port_40", // X1.GND2 -> X1.GND1
  ])
  expect(
    solver.sameNetJunctionAlignmentSolver?.getOutput().netLabelPlacements,
  ).toHaveLength(10)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
