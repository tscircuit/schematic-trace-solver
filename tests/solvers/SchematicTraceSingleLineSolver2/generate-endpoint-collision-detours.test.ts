import { expect, test } from "bun:test"
import { generateEndpointCollisionDetours } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/generateEndpointCollisionDetours"

test("endpoint collision detours preserve both endpoint anchors", () => {
  const path = [
    { x: 0, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: -1 },
  ]

  const obstacle = {
    minX: 1,
    maxX: 3,
    minY: 0,
    maxY: 2,
    kind: "chip" as const,
    chipId: "U1",
  }

  const detours = [0, 1].flatMap((collidingSegmentIndex) =>
    generateEndpointCollisionDetours({
      path,
      collidingSegmentIndex,
      obstacle,
    }),
  )

  expect(detours.length).toBeGreaterThan(0)
  expect(
    detours.every(
      (detour) =>
        detour[0]?.x === path[0]?.x &&
        detour[0]?.y === path[0]?.y &&
        detour.at(-1)?.x === path.at(-1)?.x &&
        detour.at(-1)?.y === path.at(-1)?.y,
    ),
  ).toBe(true)
})

test("endpoint collision detours preserve the remainder of a U-shaped path", () => {
  const path = [
    { x: 0, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: -1 },
    { x: 4, y: -1 },
  ]

  const obstacle = {
    minX: 1,
    maxX: 3,
    minY: 0,
    maxY: 2,
    kind: "chip" as const,
    chipId: "U1",
  }

  for (const collidingSegmentIndex of [0, 2]) {
    const detours = generateEndpointCollisionDetours({
      path,
      collidingSegmentIndex,
      obstacle,
    })

    expect(detours.length).toBeGreaterThan(0)
    const preservedSegment =
      collidingSegmentIndex === 0 ? path.slice(-2) : path.slice(0, 2)
    for (const detour of detours) {
      expect(detour[0]).toEqual(path[0])
      expect(detour.at(-1)).toEqual(path.at(-1))
      expect(
        collidingSegmentIndex === 0 ? detour.slice(-2) : detour.slice(0, 2),
      ).toEqual(preservedSegment)
    }
  }
})
