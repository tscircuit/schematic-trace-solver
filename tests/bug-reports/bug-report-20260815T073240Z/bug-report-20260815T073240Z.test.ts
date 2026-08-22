import { expect, test } from "bun:test"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./bug-report-20260815T073240Z.json"
import "tests/fixtures/matcher"

const V3V3_TRACE_IDS = [
  "schematic_port_8-schematic_port_11",
  "schematic_port_17-schematic_port_11",
  "schematic_port_13-schematic_port_17",
]

test("bug-report-20260815T073240Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const junctionOutput = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const v3V3Label = junctionOutput.netLabelPlacements.find(
    (label) => label.netId === "V3V3",
  )!
  const v3V3Traces = V3V3_TRACE_IDS.map(
    (traceId) =>
      junctionOutput.traces.find((trace) => trace.mspPairId === traceId)!,
  )

  expect(
    solver.sameNetJunctionAlignmentSolver!.stats.alignedJunctionCount,
  ).toBe(2)
  expect(
    tracePathContainsPoint(v3V3Traces[1]!.tracePath, v3V3Label.anchorPoint),
  ).toBe(true)
  for (const trace of v3V3Traces) {
    expect(
      trace.tracePath.some(
        (point, index) =>
          point.y === v3V3Label.anchorPoint.y &&
          trace.tracePath[index + 1]?.y === v3V3Label.anchorPoint.y,
      ),
    ).toBe(true)
    expect(
      trace.tracePath.every(
        (point, index, path) =>
          index === 0 ||
          point.x === path[index - 1]!.x ||
          point.y === path[index - 1]!.y,
      ),
    ).toBe(true)
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
