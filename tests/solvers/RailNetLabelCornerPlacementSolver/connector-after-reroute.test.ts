import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { createTrace } from "../TraceCleanupSolver/fixtures/alignSameNetRails"

const createFixture = (direction = 1, mirror = 1) => {
  const point = (x: number, y: number) => ({ x: x * mirror, y: y * direction })
  const pins: SolvedTracePath["pins"] = [
    { pinId: "U1.1", chipId: "U1", ...point(2, 0) },
    { pinId: "U1.2", chipId: "U1", ...point(2, 4) },
  ]
  const originalTrace = createTrace(
    "rail",
    [
      point(2, 0),
      point(1, 0),
      point(1, 1),
      point(0, 1),
      point(0, 2),
      point(1, 2),
      point(1, 4),
      point(2, 4),
    ],
    pins,
  )
  const trace = {
    ...originalTrace,
    tracePath: [point(2, 0), point(0, 0), point(0, 4), point(2, 4)],
  }
  const connector = createTrace(
    "connector",
    [point(1, 0), point(0.5, 0), point(0.5, 0.1)],
    pins,
  )
  const orientation = direction === 1 ? ("y+" as const) : ("y-" as const)
  const label: NetLabelPlacement = {
    globalConnNetId: trace.globalConnNetId,
    netId: "POWER",
    mspConnectionPairIds: [trace.mspPairId],
    pinIds: trace.pinIds,
    orientation,
    anchorPoint: point(0.5, 0.1),
    center: point(0.5, 0.3),
    width: 0.4,
    height: 0.4,
  }
  const inputProblem: InputProblem = {
    chips: [{ chipId: "U1", center: point(3, 2), width: 2, height: 6, pins }],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: { POWER: [orientation] },
  }
  return {
    point,
    trace,
    connector,
    input: {
      inputProblem,
      traces: [trace, connector],
      originalTraces: [originalTrace, connector],
      netLabelPlacements: [label],
      netLabelConnectorTraceIds: new Set([connector.mspPairId]),
      onlyOverlappingLabels: true,
    },
  }
}

for (const direction of [1, -1]) {
  for (const mirror of [1, -1]) {
    test(`uses a new clear rail corner and removes its redundant connector, direction=${direction}, mirror=${mirror}`, () => {
      const { input, trace, point } = createFixture(direction, mirror)
      const before = structuredClone(input)
      const solver = new RailNetLabelCornerPlacementSolver(input)
      solver.solve()
      const output = solver.getOutput()
      expect(output.netLabelPlacements[0]!.anchorPoint).toEqual(point(0, 4))
      expect(output.netLabelPlacements[0]!.mspConnectionPairIds).toEqual([
        trace.mspPairId,
      ])
      expect(output.traces).toEqual([trace])
      expect(input).toEqual(before)
      const second = new RailNetLabelCornerPlacementSolver({
        ...input,
        ...output,
      })
      second.solve()
      expect(second.getOutput()).toEqual(output)
    })
  }
}

test.each([
  "unchanged_rail",
  "unregistered_connector",
  "shared_branch",
  "shared_label",
  "shared_pin",
  "blocked_by_text",
  "blocked_by_chip",
  "blocked_by_label",
  "blocked_by_trace",
] as const)("keeps the existing attachment when %s", (condition) => {
  const { input, trace, point } = createFixture()
  if (condition === "unchanged_rail") input.originalTraces[0] = trace
  if (condition === "unregistered_connector")
    input.netLabelConnectorTraceIds.clear()
  if (condition === "blocked_by_text") {
    input.inputProblem.textBoxes = [
      { center: point(0, 4.2), width: 1, height: 0.4, text: "U2" },
    ]
  }
  if (condition === "blocked_by_chip") {
    input.inputProblem.chips.push({
      chipId: "U2",
      center: point(0, 4.2),
      width: 1,
      height: 0.4,
      pins: [],
    })
  }
  if (condition === "shared_pin") {
    input.inputProblem.chips.push({
      chipId: "U2",
      center: point(0.2, 0.05),
      width: 0.2,
      height: 0.05,
      pins: [{ pinId: "U2.1", ...point(0.5, 0.05) }],
    })
  }
  if (condition === "blocked_by_label") {
    input.netLabelPlacements.push({
      ...input.netLabelPlacements[0]!,
      globalConnNetId: "other-net",
      mspConnectionPairIds: [],
      pinIds: [],
      netId: "OTHER",
      anchorPoint: point(0, 4.2),
      center: point(0.2, 4.2),
      orientation: "x+",
    })
  }
  if (condition === "blocked_by_trace") {
    input.traces.push({
      ...createTrace(
        "other",
        [point(-1, 4.2), point(1, 4.2)],
        [
          { pinId: "U2.1", chipId: "U2", ...point(-1, 4.2) },
          { pinId: "U3.1", chipId: "U3", ...point(1, 4.2) },
        ],
      ),
      globalConnNetId: "other-net",
    })
  }
  if (condition === "shared_label") {
    input.netLabelPlacements.push({
      ...input.netLabelPlacements[0]!,
      netId: "ALIAS",
      anchorPoint: point(0.5, 0.05),
      center: point(0.7, 0.05),
      orientation: "x+",
      width: 0.4,
      height: 0.1,
    })
  }
  if (condition === "shared_branch") {
    input.traces.push(
      createTrace(
        "branch",
        [point(0.5, 0.05), point(-1, 0.05)],
        [
          { pinId: "U2.1", chipId: "U2", ...point(0.5, 0.05) },
          { pinId: "U3.1", chipId: "U3", ...point(-1, 0.05) },
        ],
      ),
    )
  }
  const solver = new RailNetLabelCornerPlacementSolver(input)
  solver.solve()
  expect(solver.getOutput()).toEqual({
    traces: input.traces,
    netLabelPlacements: input.netLabelPlacements,
  })
})
