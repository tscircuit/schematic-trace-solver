import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import inputProblem from "./bug-report-20260717T022934Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260717T022934Z", async () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  const groundLabel = output.netLabelPlacements.find(
    (label) => label.netId === "GND" && label.pinIds.includes("U1.2"),
  )!
  const groundConnector = output.traces.find(
    (trace) => trace.userNetId === "GND" && trace.pinIds.includes("U1.2"),
  )!
  const pin = groundConnector.pins[0]!

  // Keep the GND rail where it was placed and connect the pin with one elbow,
  // without the upward jog caused by leaving the neighboring power trace unrouted.
  expect(groundConnector.tracePath).toEqual([
    { x: pin.x, y: pin.y },
    { x: groundLabel.anchorPoint.x, y: pin.y },
    groundLabel.anchorPoint,
  ])
  expect(getOutputLabelCollisions(output)).toEqual([])
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
