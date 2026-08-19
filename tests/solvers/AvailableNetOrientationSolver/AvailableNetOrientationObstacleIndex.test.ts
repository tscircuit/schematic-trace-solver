import { expect, test } from "bun:test"
import { AvailableNetOrientationObstacleIndex } from "lib/solvers/AvailableNetOrientationSolver/AvailableNetOrientationObstacleIndex"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const netLabelPlacements: NetLabelPlacement[] = [
  {
    globalConnNetId: "net-1",
    mspConnectionPairIds: ["trace-1"],
    pinIds: ["pin-1", "pin-2"],
    orientation: "x+",
    anchorPoint: { x: 0, y: 0 },
    center: { x: 1, y: 0 },
    width: 2,
    height: 1,
  },
  {
    globalConnNetId: "net-2",
    mspConnectionPairIds: [],
    pinIds: ["pin-3"],
    orientation: "x-",
    anchorPoint: { x: 11, y: 10 },
    center: { x: 10, y: 10 },
    width: 2,
    height: 1,
  },
]

const traces: SolvedTracePath[] = [
  {
    mspPairId: "trace-1",
    dcConnNetId: "net-1",
    globalConnNetId: "net-1",
    pins: [
      { pinId: "pin-1", chipId: "chip-1", x: -2, y: 3 },
      { pinId: "pin-2", chipId: "chip-2", x: 2, y: 3 },
    ],
    tracePath: [
      { x: -2, y: 3 },
      { x: 2, y: 3 },
    ],
    mspConnectionPairIds: ["trace-1"],
    pinIds: ["pin-1", "pin-2"],
  },
]

const chipObstacleSpatialIndex = new ChipObstacleSpatialIndex([
  {
    chipId: "chip-obstacle",
    center: { x: 0, y: 3 },
    width: 1,
    height: 1,
    pins: [],
  },
])

test("queries only nearby net labels and trace segments", () => {
  const obstacleIndex = new AvailableNetOrientationObstacleIndex({
    chipObstacleSpatialIndex,
    netLabelPlacements,
    traces,
  })

  expect(
    obstacleIndex.getLabelIndicesInBounds({
      minX: -0.1,
      minY: -0.1,
      maxX: 0.1,
      maxY: 0.1,
    }),
  ).toEqual([0])
  expect(
    obstacleIndex.getTraceSegmentsInBounds({
      minX: -0.1,
      minY: 2.9,
      maxX: 0.1,
      maxY: 3.1,
    }),
  ).toHaveLength(1)
  expect(
    obstacleIndex.getTraceSegmentsInBounds({
      minX: -0.1,
      minY: 9.9,
      maxX: 0.1,
      maxY: 10.1,
    }),
  ).toHaveLength(0)
  expect(obstacleIndex.doesTracePathCrossChip(traces[0]!.tracePath)).toBe(true)
  expect(
    obstacleIndex.getLabelIndicesNearTracePath([
      { x: 2 + 5e-10, y: -1 },
      { x: 2 + 5e-10, y: 1 },
    ]),
  ).toEqual([0])
})

test("rebuilds after a net label moves", () => {
  const obstacleIndex = new AvailableNetOrientationObstacleIndex({
    chipObstacleSpatialIndex,
    netLabelPlacements,
    traces,
  })
  const movedNetLabelPlacements = [
    { ...netLabelPlacements[0]!, center: { x: 20, y: 20 } },
    netLabelPlacements[1]!,
  ]

  obstacleIndex.rebuild({
    netLabelPlacements: movedNetLabelPlacements,
    traces,
  })

  expect(
    obstacleIndex.getLabelIndicesInBounds({
      minX: -0.1,
      minY: -0.1,
      maxX: 0.1,
      maxY: 0.1,
    }),
  ).toHaveLength(0)
})
