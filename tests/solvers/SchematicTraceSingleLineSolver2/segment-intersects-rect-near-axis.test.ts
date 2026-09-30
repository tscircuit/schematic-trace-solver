import { expect, test } from "bun:test"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

// https://github.com/tscircuit/schematic-trace-solver/issues/1099
// Real pin coordinates are not always exactly on the routing grid: a segment
// between x = 5.3999378 and x = 5.4 has dx = 6.22e-5 — far below the schematic
// grid but five orders of magnitude above the 1e-9 axis-alignment EPS. Such
// segments used to bypass every obstacle check.

const rect = {
  minX: 0,
  maxX: 2,
  minY: 0,
  maxY: 2,
}

test("nearly vertical segment crossing a chip body is a collision", () => {
  // dx = 6.22e-5 (from issue), dy = 4 — passes straight through the rect
  expect(
    segmentIntersectsRect({ x: 0.5 + 6.22e-5, y: -1 }, { x: 0.5, y: 3 }, rect),
  ).toBe(true)
})

test("nearly horizontal segment crossing a chip body is a collision", () => {
  expect(
    segmentIntersectsRect({ x: -1, y: 1 + 6.22e-5 }, { x: 3, y: 1 }, rect),
  ).toBe(true)
})

test("nearly vertical segment outside the rect stays collision-free", () => {
  expect(
    segmentIntersectsRect({ x: 2.5, y: -1 }, { x: 2.5 + 6.22e-5, y: 3 }, rect),
  ).toBe(false)
})

test("slanted segment through the rect interior is a collision", () => {
  expect(segmentIntersectsRect({ x: -1, y: -1 }, { x: 3, y: 3 }, rect)).toBe(
    true,
  )
})

test("slanted segment missing the rect is collision-free", () => {
  expect(segmentIntersectsRect({ x: -1, y: 2.5 }, { x: 3, y: 6 }, rect)).toBe(
    false,
  )
})

test("slanted segment touching only a corner is collision-free", () => {
  // Glances off the top-right corner without entering the interior
  expect(
    segmentIntersectsRect({ x: 2.2, y: 1.8 }, { x: 1.8, y: 2.2 }, rect),
  ).toBe(false)
})
