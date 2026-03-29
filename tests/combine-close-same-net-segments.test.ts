import { describe, expect, test } from "bun:test"
import { combineCloseSameNetSegments } from "../lib/phases/combine-close-same-net-segments"

describe("combineCloseSameNetSegments", () => {
  test("merges two collinear horizontal segments that overlap", () => {
    const traces = [
      {
        edges: [
          { from: { x: 0, y: 0 }, to: { x: 2, y: 0 } },
          { from: { x: 1.5, y: 0 }, to: { x: 4, y: 0 } },
        ],
      },
    ]

    const result = combineCloseSameNetSegments(traces as any)
    expect(result[0].edges).toHaveLength(1)
    expect(result[0].edges[0].from.x).toBeCloseTo(0)
    expect(result[0].edges[0].to.x).toBeCloseTo(4)
    expect(result[0].edges[0].from.y).toBeCloseTo(0)
    expect(result[0].edges[0].to.y).toBeCloseTo(0)
  })

  test("merges two collinear vertical segments that overlap", () => {
    const traces = [
      {
        edges: [
          { from: { x: 1, y: 0 }, to: { x: 1, y: 3 } },
          { from: { x: 1, y: 2 }, to: { x: 1, y: 5 } },
        ],
      },
    ]

    const result = combineCloseSameNetSegments(traces as any)
    expect(result[0].edges).toHaveLength(1)
    expect(result[0].edges[0].from.x).toBeCloseTo(1)
    expect(result[0].edges[0].to.x).toBeCloseTo(1)
    expect(result[0].edges[0].from.y).toBeCloseTo(0)
    expect(result[0].edges[0].to.y).toBeCloseTo(5)
  })

  test("merges two contiguous horizontal segments (gap within threshold)", () => {
    const traces = [
      {
        edges: [
          { from: { x: 0, y: 1 }, to: { x: 2, y: 1 } },
          // starts exactly where the first ends
          { from: { x: 2, y: 1 }, to: { x: 4, y: 1 } },
        ],
      },
    ]

    const result = combineCloseSameNetSegments(traces as any)
    expect(result[0].edges).toHaveLength(1)
    expect(result[0].edges[0].from.x).toBeCloseTo(0)
    expect(result[0].edges[0].to.x).toBeCloseTo(4)
  })

  test("does NOT merge two parallel horizontal segments at different Y values", () => {
    const traces = [
      {
        edges: [
          { from: { x: 0, y: 0 }, to: { x: 4, y: 0 } },
          { from: { x: 0, y: 1 }, to: { x: 4, y: 1 } },
        ],
      },
    ]

    const result = combineCloseSameNetSegments(traces as any)
    expect(result[0].edges).toHaveLength(2)
  })

  test("does NOT merge two non-overlapping collinear horizontal segments with large gap", () => {
    const traces = [
      {
        edges: [
          { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
          { from: { x: 5, y: 0 }, to: { x: 8, y: 0 } },
        ],
      },
    ]

    const result = combineCloseSameNetSegments(traces as any)
    expect(result[0].edges).toHaveLength(2)
  })

  test("handles empty edges array", () => {
    const traces = [{ edges: [] }]
    const result = combineCloseSameNetSegments(traces as any)
    expect(result[0].edges).toHaveLength(0)
  })

  test("handles single edge unchanged", () => {
    const traces = [
      {
        edges: [{ from: { x: 0, y: 0 }, to: { x: 3, y: 0 } }],
      },
    ]

    const result = combineCloseSameNetSegments(traces as any)
    expect(result[0].edges).toHaveLength(1)
    expect(result[0].edges[0].from.x).toBeCloseTo(0)
    expect(result[0].edges[0].to.x).toBeCloseTo(3)
  })

  test("merges three collinear overlapping horizontal segments", () => {
    const traces = [
      {
        edges: [
          { from: { x: 0, y: 2 }, to: { x: 3, y: 2 } },
          { from: { x: 2, y: 2 }, to: { x: 5, y: 2 } },
          { from: { x: 4, y: 2 }, to: { x: 7, y: 2 } },
        ],
      },
    ]

    const result = combineCloseSameNetSegments(traces as any)
    expect(result[0].edges).toHaveLength(1)
    expect(result[0].edges[0].from.x).toBeCloseTo(0)
    expect(result[0].edges[0].to.x).toBeCloseTo(7)
  })

  test("keeps distinct non-collinear segments separate", () => {
    const traces = [
      {
        edges: [
          { from: { x: 0, y: 0 }, to: { x: 2, y: 0 } }, // horizontal
          { from: { x: 2, y: 0 }, to: { x: 2, y: 3 } }, // vertical
        ],
      },
    ]

    const result = combineCloseSameNetSegments(traces as any)
    // These are not collinear, so they should stay as 2 edges
    expect(result[0].edges).toHaveLength(2)
  })

  test("handles traces without edges gracefully", () => {
    const traces = [{ some_other_field: true }]
    const result = combineCloseSameNetSegments(traces as any)
    expect(result[0]).toEqual({ some_other_field: true })
  })
})
