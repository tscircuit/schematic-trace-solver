import { expect, test } from "bun:test"
import { isVerticalLabelAtSameNetRailTap } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/anchors"

test("detects a downward label tap across joined rail segments", () => {
  expect(
    isVerticalLabelAtSameNetRailTap({
      anchor: { x: 0, y: 0 },
      traces: [
        {
          tracePath: [
            { x: -2, y: 0 },
            { x: 0, y: 0 },
          ],
        },
        {
          tracePath: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
          ],
        },
      ],
    }),
  ).toBe(true)
})

test("keeps a downward label at a rail corner", () => {
  expect(
    isVerticalLabelAtSameNetRailTap({
      anchor: { x: 0, y: 0 },
      traces: [
        {
          tracePath: [
            { x: -2, y: 0 },
            { x: 0, y: 0 },
          ],
        },
        {
          tracePath: [
            { x: 0, y: 0 },
            { x: 0, y: 2 },
          ],
        },
      ],
    }),
  ).toBe(false)
})
