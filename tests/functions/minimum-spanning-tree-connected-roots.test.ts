import { expect, test } from "bun:test"
import { getOrthogonalMinimumSpanningTree } from "lib/solvers/MspConnectionPairSolver/getMspConnectionPairsFromPins"

test("routes a minimum forest to already connected roots without joining the roots", () => {
  const pins = [
    { pinId: "left", x: 0, y: 0 },
    { pinId: "a", x: 1, y: 0 },
    { pinId: "b", x: 2, y: 0 },
    { pinId: "c", x: 8, y: 0 },
    { pinId: "right", x: 10, y: 0 },
  ]
  expect(
    getOrthogonalMinimumSpanningTree(pins, {
      connectedPinIds: new Set(["left", "right"]),
    }),
  ).toEqual([
    ["a", "left"],
    ["b", "a"],
    ["c", "right"],
  ])
})
