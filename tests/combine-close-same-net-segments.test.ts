/**
 * Tests for combineCloseSameNetSegments.
 *
 * NOTE: This tests a flat-segment phase that is intentionally separate from
 * `combineCloseSameNetTraceSegments`. The two phases target different data
 * shapes in the rendering pipeline:
 *
 *   - `combineCloseSameNetTraceSegments` (lib/phases/) — operates on
 *     SchematicTrace objects with edge arrays (the primary phase for issue #29).
 *   - `combineCloseSameNetSegments` (lib/phases/) — operates on flat Segment
 *     objects used in earlier pipeline stages where traces have already been
 *     decomposed into individual x1/y1/x2/y2 segments.
 *
 * Both address the root problem in issue #29 (redundant duplicate lines) but
 * at different points in the rendering pipeline.
 */
import { describe, it, expect } from "vitest"
import { combineCloseSameNetSegments } from "../lib/phases/combine-close-same-net-segments"

describe("combineCloseSameNetSegments", () => {
  it("merges two overlapping horizontal segments on the same net", () => {
    const segments = [
      { x1: 0, y1: 0, x2: 2, y2: 0, net_name: "net1" },
      { x1: 1, y1: 0, x2: 3, y2: 0, net_name: "net1" },
    ]
    const result = combineCloseSameNetSegments(segments)
    expect(result).toHaveLength(1)
    expect(result[0].x1).toBeCloseTo(0)
    expect(result[0].x2).toBeCloseTo(3)
    expect(result[0].y1).toBeCloseTo(0)
    expect(result[0].y2).toBeCloseTo(0)
  })

  it("merges two nearly-overlapping horizontal segments within threshold", () => {
    const segments = [
      { x1: 0, y1: 0, x2: 1, y2: 0, net_name: "net1" },
      { x1: 1.05, y1: 0, x2: 2, y2: 0, net_name: "net1" },
    ]
    const result = combineCloseSameNetSegments(segments)
    expect(result).toHaveLength(1)
    expect(result[0].x1).toBeCloseTo(0)
    expect(result[0].x2).toBeCloseTo(2)
  })

  it("does NOT merge horizontal segments that are too far apart", () => {
    const segments = [
      { x1: 0, y1: 0, x2: 1, y2: 0, net_name: "net1" },
      { x1: 2, y1: 0, x2: 3, y2: 0, net_name: "net1" },
    ]
    const result = combineCloseSameNetSegments(segments)
    expect(result).toHaveLength(2)
  })

  it("does NOT merge segments on different nets", () => {
    const segments = [
      { x1: 0, y1: 0, x2: 2, y2: 0, net_name: "net1" },
      { x1: 0, y1: 0, x2: 2, y2: 0, net_name: "net2" },
    ]
    const result = combineCloseSameNetSegments(segments)
    expect(result).toHaveLength(2)
  })

  it("merges two overlapping vertical segments on the same net", () => {
    const segments = [
      { x1: 0, y1: 0, x2: 0, y2: 2, net_name: "net1" },
      { x1: 0, y1: 1, x2: 0, y2: 3, net_name: "net1" },
    ]
    const result = combineCloseSameNetSegments(segments)
    expect(result).toHaveLength(1)
    expect(result[0].y1).toBeCloseTo(0)
    expect(result[0].y2).toBeCloseTo(3)
    expect(result[0].x1).toBeCloseTo(0)
    expect(result[0].x2).toBeCloseTo(0)
  })

  it("merges three overlapping horizontal segments into one", () => {
    const segments = [
      { x1: 0, y1: 0, x2: 2, y2: 0, net_name: "net1" },
      { x1: 1, y1: 0, x2: 3, y2: 0, net_name: "net1" },
      { x1: 2, y1: 0, x2: 4, y2: 0, net_name: "net1" },
    ]
    const result = combineCloseSameNetSegments(segments)
    expect(result).toHaveLength(1)
    expect(result[0].x1).toBeCloseTo(0)
    expect(result[0].x2).toBeCloseTo(4)
  })

  it("handles an empty segment list", () => {
    expect(combineCloseSameNetSegments([])).toHaveLength(0)
  })

  it("leaves non-parallel close segments alone", () => {
    // One horizontal, one vertical — should not be merged
    const segments = [
      { x1: 0, y1: 0, x2: 2, y2: 0, net_name: "net1" },
      { x1: 1, y1: -1, x2: 1, y2: 1, net_name: "net1" },
    ]
    const result = combineCloseSameNetSegments(segments)
    expect(result).toHaveLength(2)
  })

  it("preserves net_name on merged segment", () => {
    const segments = [
      { x1: 0, y1: 0, x2: 1, y2: 0, net_name: "powerNet" },
      { x1: 0.5, y1: 0, x2: 2, y2: 0, net_name: "powerNet" },
    ]
    const result = combineCloseSameNetSegments(segments)
    expect(result).toHaveLength(1)
    expect(result[0].net_name).toBe("powerNet")
  })
})
