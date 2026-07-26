import { expect, test } from "bun:test"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { generateInternalSegmentCollisionDetours } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/generateInternalSegmentCollisionDetours"

test("internal segment detours preserve endpoint legs and clear the obstacle", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 9, y: 0 },
    { x: 10, y: 0 },
  ]
  const obstacle = { minX: 4, minY: -0.5, maxX: 6, maxY: 0.5 }

  const detours = generateInternalSegmentCollisionDetours({
    path,
    collidingSegmentIndex: 1,
    obstacle,
  })

  expect(detours).toHaveLength(2)
  for (const detour of detours) {
    expect(detour.slice(0, 2)).toEqual(path.slice(0, 2))
    expect(detour.slice(-2)).toEqual(path.slice(-2))
    expect(isPathCollidingWithObstacles(detour, [obstacle])).toBe(false)
  }
})

test("internal segment detours support vertical paths", () => {
  const path = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 9 },
    { x: 0, y: 10 },
  ]
  const obstacle = { minX: -0.5, minY: 4, maxX: 0.5, maxY: 6 }

  const detours = generateInternalSegmentCollisionDetours({
    path,
    collidingSegmentIndex: 1,
    obstacle,
  })

  expect(detours).toHaveLength(2)
  expect(
    detours.every(
      (detour) => !isPathCollidingWithObstacles(detour, [obstacle]),
    ),
  ).toBe(true)
})
