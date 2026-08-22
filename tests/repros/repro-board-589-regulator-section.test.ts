import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-board-589-regulator-section.input.json"

const EXPECTED_ALIGNED_JUNCTION_COUNT = 2
const REGULATOR_OUTPUT_TRACE_ID = "schematic_port_31-schematic_port_26"

test("board 589 regulator section trace routing", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const junctionOutput = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const v3V3Label = junctionOutput.netLabelPlacements.find(
    (label) => label.netId === "V3_3",
  )!
  const labeledTrace = junctionOutput.traces.find((trace) =>
    v3V3Label.mspConnectionPairIds.includes(trace.mspPairId),
  )!
  const regulatorOutputTrace = junctionOutput.traces.find(
    (trace) => trace.mspPairId === REGULATOR_OUTPUT_TRACE_ID,
  )!

  expect(
    solver.sameNetJunctionAlignmentSolver!.stats.alignedJunctionCount,
  ).toBe(EXPECTED_ALIGNED_JUNCTION_COUNT)
  expect(
    tracePathContainsPoint(labeledTrace.tracePath, v3V3Label.anchorPoint),
  ).toBe(true)
  expect(
    regulatorOutputTrace.tracePath.some(
      (point, index) =>
        point.y === v3V3Label.anchorPoint.y &&
        regulatorOutputTrace.tracePath[index + 1]?.y ===
          v3V3Label.anchorPoint.y,
    ),
  ).toBe(true)
  for (const trace of [labeledTrace, regulatorOutputTrace]) {
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
