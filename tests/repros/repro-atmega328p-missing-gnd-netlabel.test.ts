import { expect, test } from "bun:test"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-atmega328p-missing-gnd-netlabel.input.json"
import "tests/fixtures/matcher"

// Repro: GND pins U_MCU.3 and U_MCU.5 end up with no net label. The GND net is
// split into three MSP-paired islands; the {U_MCU.3, U_MCU.5} bracket is boxed
// in by the chip and the neighboring VCC bracket, so NetLabelPlacementSolver
// cannot place its label and silently drops the group (failedGroups), leaving
// those pins visually unlabeled.
test("repro atmega328p missing gnd netlabel on interleaved pins", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  const rail = output.traces.find(
    (trace) => trace.mspPairId === "C_MCU_DEC.1-U_MCU.18",
  )!
  expect(rail.pinIds).toEqual(["C_MCU_DEC.1", "U_MCU.18"])
  for (const pin of rail.pins)
    expect(tracePathContainsPoint(rail.tracePath, pin)).toBe(true)
  expect(
    getOutputLabelCollisions(output).filter(
      (collision) =>
        collision.kind === "trace-label" &&
        collision.trace.kind === "routed" &&
        collision.trace.id === rail.mspPairId,
    ),
  ).toEqual([])
  for (const pinId of ["U_MCU.3", "U_MCU.5"]) {
    expect(
      output.netLabelPlacements.some(
        (label) => label.netId === "GND" && label.pinIds.includes(pinId),
      ),
    ).toBe(true)
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
