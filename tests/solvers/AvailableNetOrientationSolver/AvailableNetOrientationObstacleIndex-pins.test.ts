import { expect, test } from "bun:test"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { AvailableNetOrientationObstacleIndex } from "lib/solvers/AvailableNetOrientationSolver/AvailableNetOrientationObstacleIndex"

test("finds pins lying on a connector path, including at segment ends", () => {
  const obstacleIndex = new AvailableNetOrientationObstacleIndex({
    chipObstacleSpatialIndex: new ChipObstacleSpatialIndex([
      {
        chipId: "far-chip",
        center: { x: 50, y: 50 },
        width: 1,
        height: 1,
        pins: [],
      },
    ]),
    netLabelPlacements: [],
    traces: [],
    pins: [
      { pinId: "on-horizontal", x: 1, y: 0 },
      { pinId: "at-corner", x: 2, y: 0 },
      { pinId: "on-vertical", x: 2, y: -1 },
      { pinId: "beside-path", x: 1, y: 0.1 },
      { pinId: "past-end", x: 3, y: 0 },
    ],
  })

  const pinIds = obstacleIndex
    .getPinsOnTracePath([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: -2 },
    ])
    .map((pin) => pin.pinId)

  expect([...new Set(pinIds)].sort()).toEqual([
    "at-corner",
    "on-horizontal",
    "on-vertical",
  ])
})
