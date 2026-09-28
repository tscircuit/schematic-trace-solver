import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import "tests/fixtures/matcher"
import input from "./assets/repro-portable-logic-analyzer-pico-sheet.input.json"

// Captured before routing from the LA16 Pico sheet in core 43fd7e3.
test("repro portable logic analyzer Pico schematic sheet", async () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(input) as InputProblem,
  )
  solver.solve()

  expect(input.chips).toHaveLength(1)
  expect(input.chips[0]!.pins).toHaveLength(40)
  expect(input.netConnections).toHaveLength(18)
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  const output = solver.netLabelToTraceSolver!.getOutput()
  const groundLabel = output.netLabelPlacements.find(
    (label) =>
      label.netId === "GND" &&
      label.anchorPoint.y > 0 &&
      label.anchorPoint.x < 0,
  )!
  expect(groundLabel.anchorPoint.x).toBeCloseTo(-3.42)
  expect(
    output.traces.some(
      (trace) =>
        trace.globalConnNetId === groundLabel.globalConnNetId &&
        trace.tracePath.some(
          (point) =>
            point.x === groundLabel.anchorPoint.x &&
            point.y === groundLabel.anchorPoint.y,
        ),
    ),
  ).toBe(true)
  expect(getOutputLabelCollisions(output)).toEqual([])
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
