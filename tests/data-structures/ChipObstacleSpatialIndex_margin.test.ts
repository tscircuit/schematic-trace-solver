import { test, expect } from "bun:test"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import type { InputChip } from "lib/types/InputProblem"

test("doesOrthogonalLineIntersectChip respects negative margin", () => {
  const chip: InputChip = {
    chipId: "C",
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    pins: [],
  }

  const index = new ChipObstacleSpatialIndex([chip])

  const line: [{ x: number; y: number }, { x: number; y: number }] = [
    { x: -2, y: 1 },
    { x: 2, y: 1 },
  ]

  expect(index.doesOrthogonalLineIntersectChip(line)).toBe(true)
  expect(index.doesOrthogonalLineIntersectChip(line, { margin: -1e-6 })).toBe(
    false,
  )
})
