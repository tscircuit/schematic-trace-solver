import { expect, test } from "bun:test"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./bug-report-20260819T091818Z.json"
import "tests/fixtures/matcher"

test("disconnected netlabel", () => {
  const expectedAlignedRailX = 3.18
  const expectedCloserLabelAnchorX = 3.71
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  const targetLabel = output.netLabelPlacements.find((label) =>
    label.pinIds.includes("schematic_port_204"),
  )!
  const hostTrace = output.traces.find((trace) =>
    targetLabel.mspConnectionPairIds.includes(trace.mspPairId),
  )!
  const labelConnectorTrace = output.traces.find(
    (trace) =>
      trace.mspPairId !== hostTrace.mspPairId &&
      trace.globalConnNetId === targetLabel.globalConnNetId &&
      tracePathContainsPoint(trace.tracePath, targetLabel.anchorPoint),
  )!

  expect(hostTrace.tracePath[1]!.x).toBeCloseTo(expectedAlignedRailX)
  expect(targetLabel.anchorPoint.x).toBeCloseTo(expectedCloserLabelAnchorX)
  expect(labelConnectorTrace.tracePath[0]).toEqual(hostTrace.tracePath[1])
  expect([...getOutputLabelCollisions(output)]).toEqual([])
  // The split left rail moves with its branch junction, without adding bends
  // or moving any of its three pin connections.
  const branch = output.traces.find(
    (trace) => trace.mspPairId === "schematic_port_144-schematic_port_143",
  )!
  const rail = output.traces.find(
    (trace) => trace.mspPairId === "schematic_port_143-schematic_port_140",
  )!
  expect(branch.tracePath).toHaveLength(4)
  expect(rail.tracePath).toHaveLength(3)
  expect(tracePathContainsPoint(branch.tracePath, rail.tracePath[0]!)).toBe(
    true,
  )
  for (const pin of [...branch.pins, ...rail.pins])
    expect(
      [branch, rail].some((trace) =>
        tracePathContainsPoint(trace.tracePath, pin),
      ),
    ).toBe(true)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
