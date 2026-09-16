import { expect, test } from "bun:test"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import { getShaftPositionLabelClearanceInput } from "./assets/repro-rp2040-shaft-position-label-clearance.input"
import "tests/fixtures/matcher"

test("shaft-position SCL tag and stub stay above the unrelated SDA wire", async () => {
  const input = getShaftPositionLabelClearanceInput()
  const before = structuredClone(input)
  const solver = new InlineNetLabelSolver(input)
  solver.solve()
  const output = solver.getOutput()
  const scl = output.netLabelPlacements.find(
    (label) => label.netId === "ENC_SCL",
  )!
  expect(scl.orientation).toBe("x-")
  const sdaY = input.traces[0]!.tracePath[1]!.y
  expect(solver.solved).toBe(true)
  expect(getAnchoredNetLabelRenderedBounds(scl).minY).toBeGreaterThan(
    sdaY + 0.1,
  )
  const stub = output.traces.find((trace) =>
    input.netLabelConnectorTraceIds.has(trace.mspPairId),
  )!
  expect(stub.tracePath[0]).toEqual(input.traces[1]!.tracePath[0])
  expect(stub.tracePath.at(-1)).toEqual(scl.anchorPoint)
  expect(Math.min(...stub.tracePath.map((point) => point.y))).toBeGreaterThan(
    sdaY + 0.1,
  )
  expect(output.traces[0]).toEqual(input.traces[0])
  expect(input).toEqual(before)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
