import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { pathIntersectsRenderedLabel } from "lib/utils/pathIntersectsRenderedLabel"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-tmc5160-ground-bus-label.input.json"

// solver:started input from core's matching repro at 9072c621f.
// Only private spatial-index/display caches are omitted; geometry is unchanged.
// One chip, pins 6–16: GND at GNDA/SRAL/SRBL/TST_MODE/CLK. The nearby
// signal labels below CLK are needed to reproduce the mid-bus GND label.
const solveRepro = () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )
  solver.solve()
  return solver
}

test("TMC5160 ground bus stays clear of its GND symbol", async () => {
  const solver = solveRepro()
  expect(solver.solved).toBe(true)
  expect(
    solver
      .netLabelToTraceSolver!.getOutput()
      .netLabelPlacements.filter((label) => label.netId === "GND"),
  ).toHaveLength(1)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("TMC5160 ground traces should not cross the GND label interior", () => {
  const solver = solveRepro()
  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const groundLabel = netLabelPlacements.find((label) => label.netId === "GND")!
  // Schematic world coordinates, mm, +X right/+Y up. Shrink the rectangle
  // slightly so touching the attachment boundary is not counted as overlap.
  const labelInterior = {
    ...groundLabel,
    width: groundLabel.width - 0.002,
    height: groundLabel.height - 0.002,
  }
  const crossingGroundTraces = traces
    .filter(
      (trace) =>
        trace.globalConnNetId === groundLabel.globalConnNetId &&
        pathIntersectsRenderedLabel(trace.tracePath, labelInterior),
    )
    .map((trace) => trace.pins.map((pin) => pin.displayName).join(" → "))
  expect(crossingGroundTraces).toEqual([])
})
