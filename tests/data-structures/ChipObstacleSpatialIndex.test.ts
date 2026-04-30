import { test, expect } from "bun:test"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"

test("ChipObstacleSpatialIndex is exported and constructable", () => {
  expect(ChipObstacleSpatialIndex).toBeDefined()
  expect(typeof ChipObstacleSpatialIndex).toBe("function")
})
