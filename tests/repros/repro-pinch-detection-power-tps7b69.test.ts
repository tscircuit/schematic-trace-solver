import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-pinch-detection-power-tps7b69.input.json"

const PWR_RETURN_TRACE_ID = "schematic_port_14-schematic_port_10"
const LOWER_PWR_RAIL_Y = -1.54
const UPPER_PWR_RAIL_Y = 2.94
const UPPER_GND_EXIT_TRACE_ID = "schematic_port_2-schematic_port_13"
const LOWER_GND_EXIT_TRACE_ID = "schematic_port_7-schematic_port_17"
const UPPER_GND_PIN_4_Y = 1.74
const LOWER_GND_PIN_4_Y = -2.74

// Exact solver input captured from tscircuit/ti's
// PinchDetectionPower_TPS7B69 at 112956d using @tscircuit/core at 51c17c9.
test("repro PinchDetectionPower TPS7B69 schematic traces", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )
  solver.solve()

  const pwrReturnTrace = solver
    .sameNetJunctionAlignmentSolver!.getOutput()
    .traces.find((trace) => trace.mspPairId === PWR_RETURN_TRACE_ID)!
  expect(pwrReturnTrace.tracePath[1]!.y).toBeCloseTo(LOWER_PWR_RAIL_Y)
  expect(pwrReturnTrace.tracePath.at(-2)!.y).toBeCloseTo(UPPER_PWR_RAIL_Y)
  const traces = solver.sameNetJunctionAlignmentSolver!.getOutput().traces
  const upperGndExitTrace = traces.find(
    (trace) => trace.mspPairId === UPPER_GND_EXIT_TRACE_ID,
  )!
  const lowerGndExitTrace = traces.find(
    (trace) => trace.mspPairId === LOWER_GND_EXIT_TRACE_ID,
  )!
  expect(upperGndExitTrace.tracePath.at(-2)!.y).toBeCloseTo(UPPER_GND_PIN_4_Y)
  expect(lowerGndExitTrace.tracePath.at(-2)!.y).toBeCloseTo(LOWER_GND_PIN_4_Y)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
