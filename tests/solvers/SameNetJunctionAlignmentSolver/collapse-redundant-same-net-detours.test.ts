import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { collapseRedundantSameNetDetours } from "lib/solvers/SameNetJunctionAlignmentSolver/collapseRedundantSameNetDetours"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  getVisibleTraceLength,
  getVisibleTraceSegmentCount,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { PinId } from "lib/types/InputProblem"

interface TraceFixtureInput {
  mspPairId: string
  pinIds: [PinId, PinId]
  tracePath: Point[]
}

const createTraceFixture = ({
  mspPairId,
  pinIds,
  tracePath,
}: TraceFixtureInput): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: "same-net",
  globalConnNetId: "same-net",
  pins: [
    {
      pinId: pinIds[0],
      chipId: `chip-${pinIds[0]}`,
      ...tracePath[0]!,
    },
    {
      pinId: pinIds[1],
      chipId: `chip-${pinIds[1]}`,
      ...tracePath.at(-1)!,
    },
  ],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds,
})

test("collapses a same-net cycle between a shared pin and crossing", () => {
  const traces = [
    createTraceFixture({
      mspPairId: "upper-to-shared",
      pinIds: ["upper", "shared"],
      tracePath: [
        { x: 8, y: 2 },
        { x: 0, y: 2 },
        { x: 0, y: 0 },
      ],
    }),
    createTraceFixture({
      mspPairId: "shared-to-lower",
      pinIds: ["shared", "lower"],
      tracePath: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 4 },
        { x: 8, y: 4 },
      ],
    }),
  ]
  const netLabelPlacement: NetLabelPlacement = {
    globalConnNetId: "same-net",
    dcConnNetId: "same-net",
    mspConnectionPairIds: ["upper-to-shared"],
    pinIds: ["upper", "shared"],
    orientation: "x-",
    anchorPoint: { x: 0, y: 2 },
    width: 0.5,
    height: 0.2,
    center: { x: -0.25, y: 2 },
  }

  const result = collapseRedundantSameNetDetours({
    traces,
    netLabelPlacements: [netLabelPlacement],
  })

  expect(result.collapsedDetourCount).toBe(1)
  expect(getVisibleTraceLength(traces)).toBe(22)
  expect(getVisibleTraceLength(result.traces)).toBe(14)
  expect(getVisibleTraceSegmentCount(result.traces)).toBe(4)
  expect(result.traces[0]?.tracePath.at(-1)).toEqual({ x: 0, y: 0 })
  expect(result.netLabelPlacements[0]?.anchorPoint).toEqual({ x: 0, y: 0 })
})

test("keeps a valid shared same-net branch", () => {
  const traces = [
    createTraceFixture({
      mspPairId: "shared-to-branch",
      pinIds: ["shared", "branch"],
      tracePath: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
      ],
    }),
    createTraceFixture({
      mspPairId: "shared-to-trunk",
      pinIds: ["shared", "trunk"],
      tracePath: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 8, y: 0 },
      ],
    }),
  ]

  const result = collapseRedundantSameNetDetours({
    traces,
    netLabelPlacements: [],
  })

  expect(result.collapsedDetourCount).toBe(0)
  expect(result.traces).toEqual(traces)
})
