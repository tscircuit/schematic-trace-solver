import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260717T031704Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260717T031704Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.netLabelToTraceSolver?.getOutput()
  const gndConnectorTrace = output?.traces.find(
    (trace) => trace.mspPairId === "available-net-orientation-0-GND",
  )
  expect(gndConnectorTrace?.tracePath).toHaveLength(2)
  expect(gndConnectorTrace?.tracePath[0]?.x).toBeCloseTo(-2.075, 6)
  expect(gndConnectorTrace?.tracePath[0]?.y).toBeCloseTo(-3.5, 6)
  expect(gndConnectorTrace?.tracePath[1]?.x).toBeCloseTo(-2.075, 6)
  expect(gndConnectorTrace?.tracePath[1]?.y).toBeCloseTo(-3.751, 6)

  const gndLabel = output?.netLabelPlacements.find(
    (label) =>
      label.netId === "GND" && label.mspConnectionPairIds.includes("J3.1-J4.1"),
  )
  expect(gndLabel?.orientation).toBe("y-")
  expect(gndLabel?.anchorPoint.x).toBeCloseTo(-2.075, 6)
  expect(gndLabel?.anchorPoint.y).toBeCloseTo(-3.751, 6)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
