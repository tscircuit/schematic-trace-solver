import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260929T054232Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260929T054232Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.solved).toBe(true)
  const output = solver.netLabelToTraceSolver!.getOutput()
  const groundTrace = output.traces.find(
    (trace) =>
      trace.pinIds.length === 1 && trace.pinIds.includes("schematic_port_347"),
  )!
  const groundLabel = output.netLabelPlacements.find((label) =>
    label.pinIds.includes("schematic_port_347"),
  )!
  const groundPin = inputProblem.chips
    .flatMap((chip) => chip.pins)
    .find((pin) => pin.pinId === "schematic_port_347")!

  expect(groundTrace.tracePath).toHaveLength(2)
  expect(groundTrace.tracePath[0]).toEqual({
    x: groundPin.x,
    y: groundPin.y,
  })
  expect(groundTrace.tracePath[1]).toEqual(groundLabel.anchorPoint)
  expect(groundLabel.anchorPoint.y).toBeCloseTo(groundPin.y)
  expect(groundLabel.orientation).toBe("y-")
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
