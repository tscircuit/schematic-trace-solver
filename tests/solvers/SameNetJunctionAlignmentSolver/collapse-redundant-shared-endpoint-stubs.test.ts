import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { collapseRedundantSharedEndpointStubs } from "lib/solvers/SameNetJunctionAlignmentSolver/collapseRedundantSharedEndpointStubs"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { PinId } from "lib/types/InputProblem"

const createTrace = ({
  mspPairId,
  pinIds,
  tracePath,
}: {
  mspPairId: MspConnectionPairId
  pinIds: [PinId, PinId]
  tracePath: Point[]
}): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: "gnd",
  globalConnNetId: "gnd",
  pins: [
    { pinId: pinIds[0], chipId: "first-chip", ...tracePath[0]! },
    { pinId: pinIds[1], chipId: "second-chip", ...tracePath.at(-1)! },
  ],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds,
})

test("collapses one duplicate stub at a shared same-net endpoint", () => {
  const traces = [
    createTrace({
      mspPairId: "upper-shared",
      pinIds: ["upper", "shared"],
      tracePath: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
    }),
    createTrace({
      mspPairId: "lower-shared",
      pinIds: ["lower", "shared"],
      tracePath: [
        { x: 0, y: 5 },
        { x: 0, y: 4 },
        { x: 2, y: 4 },
        { x: 2, y: 2 },
        { x: 1, y: 2 },
      ],
    }),
  ]

  const result = collapseRedundantSharedEndpointStubs({
    traces,
    netLabelPlacements: [],
    netLabelConnectorTraceIds: new Set<MspConnectionPairId>(),
    multiPinNetPinIds: new Set(["shared"]),
  })

  expect(result.map((trace) => trace.tracePath.length)).toEqual([4, 4])
  expect(result[1]?.tracePath.at(-1)).toEqual({ x: 2, y: 2 })
})

test("collapses a shared stub and partial rail overlap", () => {
  const traces = [
    createTrace({
      mspPairId: "shared-trunk",
      pinIds: ["shared", "trunk"],
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: -1 },
        { x: -4, y: -1 },
        { x: -4, y: 0 },
      ],
    }),
    createTrace({
      mspPairId: "feed-shared",
      pinIds: ["feed", "shared"],
      tracePath: [
        { x: -1, y: 3 },
        { x: -1, y: -1 },
        { x: 0, y: -1 },
        { x: 0, y: 0 },
      ],
    }),
  ]

  const result = collapseRedundantSharedEndpointStubs({
    traces,
    netLabelPlacements: [],
    netLabelConnectorTraceIds: new Set<MspConnectionPairId>(),
    multiPinNetPinIds: new Set(["shared"]),
  })

  expect(result[0]?.tracePath).toEqual(traces[0]?.tracePath)
  expect(result[1]?.tracePath).toEqual([
    { x: -1, y: 3 },
    { x: -1, y: -1 },
  ])
})
