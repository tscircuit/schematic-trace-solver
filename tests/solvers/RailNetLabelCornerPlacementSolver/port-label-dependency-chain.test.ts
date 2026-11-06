import { expect, test } from "bun:test"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import {
  rectsOverlap,
  tracePathContainsPoint,
} from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import { createTrace } from "../TraceCleanupSolver/fixtures/alignSameNetRails"
import { createCrossedPortLabelsFixture } from "./fixtures/crossedPortLabels"

test.each([false, true])(
  "resolves a port-label dependency chain, reversed=%s",
  (reverse) => {
    const input = createCrossedPortLabelsFixture()
    const pin = { pinId: "U.C", chipId: "U", x: 0, y: -0.8 }
    const label = {
      ...input.netLabelPlacements[1]!,
      globalConnNetId: "C",
      netId: "C",
      pinIds: [pin.pinId],
      anchorPoint: { x: -0.8, y: -0.5 },
      center: { x: -0.8, y: -0.1 },
      height: 0.8,
    }
    input.inputProblem.chips[0]!.pins.push(pin)
    input.netLabelPlacements.push(label)
    input.traces.push({
      ...createTrace(
        "connector-2",
        [pin, { x: -0.8, y: pin.y }, label.anchorPoint],
        [pin, pin],
        "C",
      ),
      pinIds: [pin.pinId],
    })
    input.netLabelConnectorTraceIds.add("connector-2")
    if (reverse) input.netLabelPlacements.reverse()

    const solver = new RailNetLabelCornerPlacementSolver(input)
    solver.solve()
    expect(solver.solved).toBe(true)
    const { traces, netLabelPlacements } = solver.getOutput()
    expect(
      detectTraceLabelOverlap({ traces, netLabels: netLabelPlacements }),
    ).toHaveLength(0)
    const bounds = netLabelPlacements.map((label) =>
      getRectBounds(label.center, label.width, label.height),
    )
    expect(rectsOverlap(bounds[0]!, bounds[1]!)).toBe(false)
    expect(rectsOverlap(bounds[0]!, bounds[2]!)).toBe(false)
    expect(rectsOverlap(bounds[1]!, bounds[2]!)).toBe(false)
    expect(
      netLabelPlacements.every((label) => {
        const connector = traces.find(
          (trace) => trace.globalConnNetId === label.globalConnNetId,
        )!
        return (
          tracePathContainsPoint(connector.tracePath, label.anchorPoint) &&
          tracePathContainsPoint(connector.tracePath, connector.pins[0])
        )
      }),
    ).toBe(true)
  },
)
