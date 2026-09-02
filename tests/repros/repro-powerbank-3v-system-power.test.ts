import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-powerbank-3v-system-power.input.json"

// Exact solver input captured from the "3 V System Power" sheet in the
// PowerBank example circuit from @tsci/tscircuit.ti.
test("repro PowerBank 3 V System Power schematic", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()

  const alignedTraces = solver.sameNetJunctionAlignmentSolver!.outputTraces
  const pathFromPin = (traceId: string, pinId: string) => {
    const trace = alignedTraces.find((item) => item.mspPairId === traceId)!
    return trace.pins[0]!.pinId === pinId
      ? trace.tracePath
      : [...trace.tracePath].reverse()
  }
  for (const [sharedPinId, firstTraceId, secondTraceId] of [
    [
      "schematic_port_379",
      "schematic_port_393-schematic_port_379",
      "schematic_port_391-schematic_port_379",
    ],
    [
      "schematic_port_372",
      "schematic_port_372-schematic_port_369",
      "schematic_port_374-schematic_port_372",
    ],
  ]) {
    const firstPath = pathFromPin(firstTraceId, sharedPinId)
    const secondPath = pathFromPin(secondTraceId, sharedPinId)
    expect(firstPath[1]!.y).toBeCloseTo(secondPath[1]!.y, 6)
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
