import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20261104T110624Z.json"
import "tests/fixtures/matcher"

test("bug-report-20261104T110624Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const { traces, netLabelPlacements } =
    solver.netLabelToTraceSolver!.getOutput()
  const vccChgLabel = netLabelPlacements.find(
    (placement) => placement.netId === "VCC_CHG",
  )!
  const vrefLabel = netLabelPlacements.find(
    (placement) => placement.netId === "VREF",
  )!
  const vccChgConnector = traces.find(
    (trace) => trace.mspPairId === "available-net-orientation-0-VCC_CHG",
  )!
  const vrefConnector = traces.find(
    (trace) => trace.mspPairId === "available-net-orientation-1-VREF",
  )!

  expect(vccChgLabel.orientation).toBe("y+")
  expect(vccChgLabel.anchorPoint.x).toBeCloseTo(2.02)
  expect(vccChgLabel.anchorPoint.y).toBeCloseTo(0.9)
  expect(vccChgConnector.tracePath).toHaveLength(2)
  expect(vccChgConnector.tracePath[0]!.x).toBeCloseTo(2.55)
  expect(vccChgConnector.tracePath[0]!.y).toBeCloseTo(0.9)
  expect(vccChgConnector.tracePath[1]!.x).toBeCloseTo(2.02)
  expect(vccChgConnector.tracePath[1]!.y).toBeCloseTo(0.9)

  expect(vrefLabel.orientation).toBe("y+")
  expect(vrefLabel.anchorPoint.x).toBeCloseTo(2.2)
  expect(vrefLabel.anchorPoint.y).toBeCloseTo(0.3)
  expect(vrefConnector.tracePath).toHaveLength(2)
  expect(vrefConnector.tracePath[0]!.x).toBeCloseTo(2.65)
  expect(vrefConnector.tracePath[0]!.y).toBeCloseTo(0.3)
  expect(vrefConnector.tracePath[1]!.x).toBeCloseTo(2.2)
  expect(vrefConnector.tracePath[1]!.y).toBeCloseTo(0.3)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
