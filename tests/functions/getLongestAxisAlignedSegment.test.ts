import { expect, test } from "bun:test"
import { getLongestAxisAlignedSegment } from "lib/solvers/InlineNetLabelSolver/getLongestAxisAlignedSegment"

test("getLongestAxisAlignedSegment picks the longest straight run", () => {
  const segment = getLongestAxisAlignedSegment([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
  ])

  expect(segment).toMatchObject({
    axis: "y",
    length: 3,
    start: { x: 1, y: 0 },
    end: { x: 1, y: 3 },
  })
})

test("getLongestAxisAlignedSegment merges collinear points", () => {
  const segment = getLongestAxisAlignedSegment([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ])

  expect(segment).toMatchObject({ axis: "x", length: 2 })
})

test("getLongestAxisAlignedSegment splits a run that doubles back", () => {
  const segment = getLongestAxisAlignedSegment([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 1, y: 0 },
  ])

  expect(segment).toMatchObject({ axis: "x", length: 3 })
})

test("getLongestAxisAlignedSegment returns null for degenerate paths", () => {
  expect(getLongestAxisAlignedSegment([])).toBeNull()
  expect(getLongestAxisAlignedSegment([{ x: 0, y: 0 }])).toBeNull()
  expect(
    getLongestAxisAlignedSegment([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]),
  ).toBeNull()
})
