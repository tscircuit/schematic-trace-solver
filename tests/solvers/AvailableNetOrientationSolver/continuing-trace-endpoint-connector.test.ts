import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import bugReport676 from "tests/bug-reports/bug-report-20260717T031704Z/bug-report-20260717T031704Z.json"

test("starts two-pin vertical net label connector at continuing trace endpoint (#676)", () => {
  const solver = new SchematicTracePipelineSolver(
    structuredClone(bugReport676) as InputProblem,
  )
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
})
