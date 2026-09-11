import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblemJson from "./assets/rtc-imu-microsd-section.input.json"
import type { InputProblem } from "lib/types/InputProblem"
import { getTraceCorners } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import "tests/fixtures/matcher"

test("RTC IMU microSD section trace routing", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  const output = solver.inlineNetLabelSolver!.getOutput()
  const label = output.netLabelPlacements.find((label) =>
    label.pinIds.includes("schematic_port_23"),
  )!
  const hostTraces = output.traces.filter((trace) =>
    trace.pinIds.includes("schematic_port_23"),
  )
  expect(hostTraces).toHaveLength(1)
  expect(hostTraces[0]!.tracePath).toHaveLength(3)
  expect(getTraceCorners(hostTraces[0]!.tracePath)).toContainEqual(
    label.anchorPoint,
  )
  expect(label.anchorPoint.x).toBeCloseTo(1.2975)
  expect(label.anchorPoint.y).toBeCloseTo(-0.6)
  const upperTrace = output.traces.find((trace) =>
    trace.pinIds.includes("schematic_port_27"),
  )!
  const originalUpperTrace = solver.availableNetOrientationSolver!.traces.find(
    (trace) => trace.mspPairId === upperTrace.mspPairId,
  )!
  expect(upperTrace.tracePath[0]).toEqual(originalUpperTrace.tracePath[0])
  expect(upperTrace.tracePath.at(-1)).toEqual(
    originalUpperTrace.tracePath.at(-1),
  )
  expect(upperTrace.tracePath).toHaveLength(originalUpperTrace.tracePath.length)
  expect(
    [...getOutputLabelCollisions(output)].filter(
      (collision) =>
        collision.kind === "trace-label" &&
        collision.label.pinIds.includes("schematic_port_23"),
    ),
  ).toEqual([])
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
