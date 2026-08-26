import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-nrf52810-clock-routing.input.json"

const EXPECTED_CRYSTAL_RAIL_Y_BY_TRACE_ID = new Map([
  ["schematic_port_42-schematic_port_175", 4.99],
  ["schematic_port_46-schematic_port_181", 5],
])
const REDUNDANT_UPPER_RAIL_Y = 5.1
const POINT_EPSILON = 1e-6

// Extracted from the nRF52810 clock-source schematic shown in the reproduction:
// a four-pin 32 MHz crystal and a two-pin 32.768 kHz crystal, each connected
// to an MCU schematic box, two load capacitors, and section-local GND labels.
test("repro nRF52810 HF and LF crystal trace/net-label routing", () => {
  const solverInput: InputProblem = JSON.parse(JSON.stringify(inputProblem))
  const solver = new SchematicTracePipelineSolver(solverInput)

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
  expect(solver.sameNetJunctionAlignmentSolver?.stats.collapsedCycleCount).toBe(
    2,
  )
  for (const [traceId, expectedRailY] of EXPECTED_CRYSTAL_RAIL_Y_BY_TRACE_ID) {
    const crystalLoadTrace =
      solver.sameNetJunctionAlignmentSolver?.outputTraces.find(
        (trace) => trace.mspPairId === traceId,
      )
    expect(crystalLoadTrace?.tracePath[0]?.y).toBeCloseTo(expectedRailY)
    expect(crystalLoadTrace?.tracePath[1]?.y).toBeCloseTo(expectedRailY)
    expect(
      crystalLoadTrace?.tracePath.some(
        (point) => Math.abs(point.y - REDUNDANT_UPPER_RAIL_Y) < POINT_EPSILON,
      ),
    ).toBe(false)
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
