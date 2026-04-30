import { test, expect } from "bun:test"
import { visualizeCollision } from "lib/solvers/TraceCleanupSolver/sub-solver/visualizeCollision"
import type { CollisionInfo } from "lib/solvers/TraceCleanupSolver/sub-solver/isPathColliding"

test("visualizeCollision returns empty graphics for null", () => {
  const result = visualizeCollision(null)
  expect(result.circles).toHaveLength(0)
})

test("visualizeCollision returns empty graphics when not colliding", () => {
  const collisionInfo: CollisionInfo = { isColliding: false }
  const result = visualizeCollision(collisionInfo)
  expect(result.circles).toHaveLength(0)
})

test("visualizeCollision returns circle when colliding with point", () => {
  const collisionInfo: CollisionInfo = {
    isColliding: true,
    collisionPoint: { x: 5, y: 5 },
  }
  const result = visualizeCollision(collisionInfo)
  expect(result.circles).toHaveLength(1)
  expect(result.circles![0]).toMatchObject({
    center: { x: 5, y: 5 },
    radius: 0.01,
    fill: "red",
  })
})

test("visualizeCollision returns empty when colliding but no collision point", () => {
  const collisionInfo: CollisionInfo = {
    isColliding: true,
    collisionPoint: undefined,
  }
  const result = visualizeCollision(collisionInfo)
  expect(result.circles).toHaveLength(0)
})
