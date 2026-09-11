import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import { getDetachedRailCornerCandidates } from "lib/solvers/RailNetLabelCornerPlacementSolver/getDetachedRailCornerCandidates"
import { getTraceCorners } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
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
  const originalTraces = Object.values(
    solver.postLabelTraceOverlapShiftSolver!.correctedTraceMap,
  )
  const connector = originalTraces.find(
    (trace) =>
      !label.mspConnectionPairIds.includes(trace.mspPairId) &&
      trace.pinIds.includes("schematic_port_23"),
  )!
  const hostTrace = output.traces.find((trace) =>
    label.mspConnectionPairIds.includes(trace.mspPairId),
  )!
  const originalHost = originalTraces.find(
    (trace) => trace.mspPairId === hostTrace.mspPairId,
  )!
  expect(label.anchorPoint.x).toBeCloseTo(1.2975)
  expect(label.anchorPoint.y).toBeCloseTo(-0.6)
  expect(getTraceCorners(hostTrace.tracePath)).toContainEqual(label.anchorPoint)
  expect(hostTrace.tracePath).toEqual(originalHost.tracePath)
  expect(hostTrace.tracePath).toHaveLength(3)
  expect(hostTrace.tracePath[0]).toEqual(originalHost.tracePath[0])
  expect(hostTrace.tracePath.at(-1)).toEqual(originalHost.tracePath.at(-1))
  const upperTrace = output.traces.find((trace) =>
    trace.pinIds.includes("schematic_port_27"),
  )!
  const originalUpperTrace = originalTraces.find(
    (trace) => trace.mspPairId === upperTrace.mspPairId,
  )!
  expect(upperTrace.tracePath[0]).toEqual(originalUpperTrace.tracePath[0])
  expect(upperTrace.tracePath.at(-1)).toEqual(
    originalUpperTrace.tracePath.at(-1),
  )
  expect(upperTrace.tracePath).toHaveLength(originalUpperTrace.tracePath.length)
  expect(upperTrace.tracePath[2]!.y).toBeGreaterThan(
    label.anchorPoint.y + label.height,
  )
  expect(
    output.traces.some((trace) => trace.mspPairId === connector.mspPairId),
  ).toBe(false)
  expect(
    output.traces.filter((trace) => trace.pinIds.includes("schematic_port_23")),
  ).toHaveLength(1)

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
  const oldCorner = connector.tracePath[1]!
  expect(
    getDetachedRailCornerCandidates({
      label: originalLabel,
      traces: originalTraces.map((trace) => {
        if (trace !== blockingTrace) return trace
        return {
          ...trace,
          tracePath: [
            oldCorner,
            { x: oldCorner.x + label.width, y: oldCorner.y },
          ],
        }
      }),
    }),
  ).toEqual([])
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
