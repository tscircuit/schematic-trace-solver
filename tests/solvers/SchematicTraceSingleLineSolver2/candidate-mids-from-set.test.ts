import { expect, test } from "bun:test"
import { candidateMidsFromSet } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/mid"
import type { ObstacleRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"

test("candidate mids include clearance beyond an open obstacle side", () => {
  const previousObstacle: ObstacleRect = {
    kind: "chip",
    chipId: "U1",
    minX: -0.9,
    maxX: 0.9,
    minY: -2.5,
    maxY: 2.5,
  }
  const collidingObstacle: ObstacleRect = {
    kind: "text_box",
    textBox: {
      center: { x: -0.38, y: 2.615 },
      width: 0.36,
      height: 0.25,
      text: "U1",
    },
    minX: -1.01,
    maxX: 0.25,
    minY: 2.04,
    maxY: 3.19,
  }
  const aabb = { minX: -0.9, maxX: 2.52, minY: 0.8, maxY: 1 }
  const collisionRects = new Set([previousObstacle])

  expect(
    candidateMidsFromSet("y", collidingObstacle, collisionRects, aabb),
  ).toEqual([1.42])

  expect(
    candidateMidsFromSet("y", collidingObstacle, collisionRects, aabb, {
      allowOpenSideCandidates: true,
    }),
  ).toEqual([1.42, 3.39])
})
