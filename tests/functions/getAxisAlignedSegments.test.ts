import { expect, test } from "bun:test"
import { getAxisAlignedSegments } from "lib/solvers/InlineNetLabelSolver/getAxisAlignedSegments"

test("getAxisAlignedSegments returns runs longest first", () => {
  const segments = getAxisAlignedSegments([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 3 },
    { x: 2, y: 3 },
  ])

  expect(segments.map((s) => [s.axis, s.length])).toEqual([
    ["y", 3],
    ["x", 1],
    ["x", 1],
  ])
  expect(segments[0]).toMatchObject({
    start: { x: 1, y: 0 },
    end: { x: 1, y: 3 },
  })
})

test("getAxisAlignedSegments merges collinear points", () => {
  const segments = getAxisAlignedSegments([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ])

  expect(segments.map((s) => [s.axis, s.length])).toEqual([
    ["x", 2],
    ["y", 1],
  ])
})

test("getAxisAlignedSegments splits a run that doubles back", () => {
  const segments = getAxisAlignedSegments([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
    { x: 1, y: 0 },
  ])

  expect(segments.map((s) => s.length)).toEqual([3, 2])
})

test("getAxisAlignedSegments returns nothing for degenerate paths", () => {
  expect(getAxisAlignedSegments([])).toEqual([])
  expect(getAxisAlignedSegments([{ x: 0, y: 0 }])).toEqual([])
  expect(
    getAxisAlignedSegments([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]),
  ).toEqual([])
})
test("getAxisAlignedSegments handles 3-step staircase with identical length steps", () => {
  const segments = getAxisAlignedSegments([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 2 },
    { x: 4, y: 2 },
    { x: 4, y: 4 },
    { x: 6, y: 4 },
    { x: 6, y: 6 },
  ])

  expect(segments.length).toBe(6)
  expect(segments.map((s) => s.length)).toEqual([2, 2, 2, 2, 2, 2])
})
