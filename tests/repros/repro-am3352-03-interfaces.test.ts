import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import input from "./assets/repro-am3352-03-interfaces.input.json"

// Full sheet from am3352-dev-board-4layer-dogbone.json; routing uses core defaults.
test("repro complete AM3352 03-Interfaces sheet", async () => {
  const problem = structuredClone(input) as InputProblem
  const solver = new SchematicTracePipelineSolver(problem, {
    hideRatsNet: true,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const spiGroundPinId = "schematic_port_876"
  const i2cGroundPinId = "schematic_port_884"
  expect(
    traces.some(
      (trace) =>
        trace.pinIds.includes(spiGroundPinId) &&
        trace.pinIds.includes(i2cGroundPinId),
    ),
  ).toBe(false)
  expect(
    netLabelPlacements.filter((label) => label.pinIds.includes(spiGroundPinId)),
  ).toHaveLength(1)
  expect(
    netLabelPlacements.filter((label) => label.pinIds.includes(i2cGroundPinId)),
  ).toHaveLength(1)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
