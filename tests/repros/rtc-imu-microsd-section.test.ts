import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import { getDetachedRailCornerCandidates } from "lib/solvers/RailNetLabelCornerPlacementSolver/getDetachedRailCornerCandidates"
import type { InputProblem } from "lib/types/InputProblem"
import { readFileSync } from "node:fs"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = JSON.parse(
  readFileSync(
    new URL("./assets/rtc-imu-microsd-section.input.json", import.meta.url),
    "utf8",
  ),
)

test("RTC IMU microSD section trace routing", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const output = solver.railNetLabelCornerPlacementSolver!.getOutput()
  const label = output.netLabelPlacements.find((label) =>
    label.pinIds.includes("schematic_port_23"),
  )!
  const connector = output.traces.find(
    (trace) =>
      !label.mspConnectionPairIds.includes(trace.mspPairId) &&
      trace.pinIds.includes("schematic_port_23"),
  )!
  expect(label.anchorPoint.x).toBeCloseTo(1.425)
  expect(label.anchorPoint.y).toBeCloseTo(-0.65)
  expect(connector.tracePath).toHaveLength(3)
  expect(connector.tracePath.at(-1)).toEqual(label.anchorPoint)

  const originalTraces = Object.values(
    solver.postLabelTraceOverlapShiftSolver!.correctedTraceMap,
  )
  for (const hostTrace of originalTraces.filter((trace) =>
    label.mspConnectionPairIds.includes(trace.mspPairId),
  )) {
    expect(
      output.traces.find((trace) => trace.mspPairId === hostTrace.mspPairId),
    ).toEqual(hostTrace)
  }

  const originalLabel =
    solver.availableNetOrientationSolver!.outputNetLabelPlacements.find(
      (label) => label.pinIds.includes("schematic_port_23"),
    )!
  const remoteLabel = {
    ...originalLabel,
    anchorPoint: {
      ...originalLabel.anchorPoint,
      x: originalLabel.anchorPoint.x + 10,
    },
  }
  const remoteTraces = originalTraces.map((trace) => {
    if (trace.mspPairId !== connector.mspPairId) return trace
    return {
      ...trace,
      tracePath: trace.tracePath.map((point) => ({
        ...point,
        x: point.x + 10,
      })),
    }
  })
  expect(
    getDetachedRailCornerCandidates({
      label: remoteLabel,
      traces: remoteTraces,
    }),
  ).toEqual([])

  // Even a same-net trace outside the original host must still block placement.
  const blockingTrace = originalTraces.find((trace) =>
    trace.pinIds.includes("schematic_port_32"),
  )!
  const blockedSolver = new RailNetLabelCornerPlacementSolver({
    inputProblem: inputProblem,
    netLabelPlacements: [originalLabel],
    traces: originalTraces.map((trace) => {
      if (trace !== blockingTrace) return trace
      return {
        ...trace,
        tracePath: [
          { x: label.anchorPoint.x - label.width, y: label.center.y },
          { x: label.anchorPoint.x + label.width, y: label.center.y },
        ],
      }
    }),
  })
  blockedSolver.solve()
  expect(blockedSolver.getOutput().netLabelPlacements[0]).toEqual(originalLabel)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
