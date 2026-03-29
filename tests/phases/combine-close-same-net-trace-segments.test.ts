import { describe, expect, it } from "bun:test"
import { combineCloseSameNetTraceSegments } from "../../lib/phases/combine-close-same-net-trace-segments"
import type { SchematicTrace } from "../../lib/types"

function makeTrace(
  net: string,
  edges: Array<{ x1: number; y1: number; x2: number; y2: number }>
): SchematicTrace {
  return {
    connection_name: net,
    edges: edges.map((e) => ({
      from: { x: e.x1, y: e.y1 },
      to: { x: e.x2, y: e.y2 },
    })),
  } as SchematicTrace
}

describe("combineCloseSameNetTraceSegments", () => {
  it("merges two identical horizontal segments on the same net", () => {
    const traces = [
      makeTrace("net1", [{ x1: 0, y1: 0, x2: 2, y2: 0 }]),
      makeTrace("net1", [{ x1: 0, y1: 0, x2: 2, y2: 0 }]),
    ]
    const result = combineCloseSameNetTraceSegments(traces)
    expect(result.length).toBe(1)
    expect(result[0].edges.length).toBe(1)
    const edge = result[0].edges[0]
    expect(Math.min(edge.from.x, edge.to.x)).toBeCloseTo(0)
    expect(Math.max(edge.from.x, edge.to.x)).toBeCloseTo(2)
  })

  it("merges two overlapping horizontal segments on the same net", () => {
    const traces = [
      makeTrace("net1", [{ x1: 0, y1: 0, x2: 2, y2: 0 }]),
      makeTrace("net1", [{ x1: 1, y1: 0, x2: 3, y2: 0 }]),
    ]
    const result = combineCloseSameNetTraceSegments(traces)
    expect(result.length).toBe(1)
    expect(result[0].edges.length).toBe(1)
    const edge = result[0].edges[0]
    expect(Math.min(edge.from.x, edge.to.x)).toBeCloseTo(0)
    expect(Math.max(edge.from.x, edge.to.x)).toBeCloseTo(3)
  })

  it("merges two collinear vertical segments on the same net", () => {
    const traces = [
      makeTrace("net1", [{ x1: 0, y1: 0, x2: 0, y2: 2 }]),
      makeTrace("net1", [{ x1: 0, y1: 1, x2: 0, y2: 4 }]),
    ]
    const result = combineCloseSameNetTraceSegments(traces)
    expect(result.length).toBe(1)
    expect(result[0].edges.length).toBe(1)
    const edge = result[0].edges[0]
    expect(Math.min(edge.from.y, edge.to.y)).toBeCloseTo(0)
    expect(Math.max(edge.from.y, edge.to.y)).toBeCloseTo(4)
  })

  it("does NOT merge segments on different nets", () => {
    const traces = [
      makeTrace("net1", [{ x1: 0, y1: 0, x2: 2, y2: 0 }]),
      makeTrace("net2", [{ x1: 0, y1: 0, x2: 2, y2: 0 }]),
    ]
    const result = combineCloseSameNetTraceSegments(traces)
    expect(result.length).toBe(2)
  })

  it("does NOT merge non-overlapping segments on the same net", () => {
    const traces = [
      makeTrace("net1", [{ x1: 0, y1: 0, x2: 1, y2: 0 }]),
      makeTrace("net1", [{ x1: 2, y1: 0, x2: 3, y2: 0 }]),
    ]
    const result = combineCloseSameNetTraceSegments(traces)
    // Both edges remain because they don't overlap
    const totalEdges = result.reduce((sum, t) => sum + t.edges.length, 0)
    expect(totalEdges).toBe(2)
  })

  it("does NOT merge perpendicular segments on the same net", () => {
    const traces = [
      makeTrace("net1", [{ x1: 0, y1: 0, x2: 2, y2: 0 }]),
      makeTrace("net1", [{ x1: 1, y1: -1, x2: 1, y2: 1 }]),
    ]
    const result = combineCloseSameNetTraceSegments(traces)
    const totalEdges = result.reduce((sum, t) => sum + t.edges.length, 0)
    expect(totalEdges).toBe(2)
  })

  it("merges touching (end-to-end) horizontal segments", () => {
    const traces = [
      makeTrace("net1", [{ x1: 0, y1: 0, x2: 1, y2: 0 }]),
      makeTrace("net1", [{ x1: 1, y1: 0, x2: 2, y2: 0 }]),
    ]
    const result = combineCloseSameNetTraceSegments(traces)
    expect(result.length).toBe(1)
    expect(result[0].edges.length).toBe(1)
    const edge = result[0].edges[0]
    expect(Math.min(edge.from.x, edge.to.x)).toBeCloseTo(0)
    expect(Math.max(edge.from.x, edge.to.x)).toBeCloseTo(2)
  })

  it("handles traces with multiple edges - only merges close parallel ones", () => {
    // Trace 1 has two edges (an L-shape), trace 2 has one edge that duplicates
    // the horizontal part of trace 1's first edge
    const trace1: SchematicTrace = {
      connection_name: "net1",
      edges: [
        { from: { x: 0, y: 0 }, to: { x: 2, y: 0 } },
        { from: { x: 2, y: 0 }, to: { x: 2, y: 1 } },
      ],
    } as SchematicTrace

    const trace2: SchematicTrace = {
      connection_name: "net1",
      edges: [{ from: { x: 0, y: 0 }, to: { x: 2, y: 0 } }],
    } as SchematicTrace

    const result = combineCloseSameNetTraceSegments([trace1, trace2])
    const totalEdges = result.reduce((sum, t) => sum + t.edges.length, 0)
    // The duplicate horizontal edge is merged; the vertical remains
    expect(totalEdges).toBe(2)
  })

  it("merges nearly-collinear segments within the closeness threshold", () => {
    // Segments very slightly offset in y — should still merge
    const traces = [
      makeTrace("net1", [{ x1: 0, y1: 0, x2: 2, y2: 0 }]),
      makeTrace("net1", [{ x1: 0, y1: 0.0005, x2: 2, y2: 0.0005 }]),
    ]
    const result = combineCloseSameNetTraceSegments(traces)
    expect(result.length).toBe(1)
    expect(result[0].edges.length).toBe(1)
  })

  it("does NOT merge segments slightly beyond the closeness threshold", () => {
    const traces = [
      makeTrace("net1", [{ x1: 0, y1: 0, x2: 2, y2: 0 }]),
      makeTrace("net1", [{ x1: 0, y1: 0.002, x2: 2, y2: 0.002 }]),
    ]
    const result = combineCloseSameNetTraceSegments(traces, {
      closenessThreshold: 0.001,
    })
    const totalEdges = result.reduce((sum, t) => sum + t.edges.length, 0)
    expect(totalEdges).toBe(2)
  })

  it("returns empty array for empty input", () => {
    const result = combineCloseSameNetTraceSegments([])
    expect(result).toEqual([])
  })

  it("returns single trace unchanged", () => {
    const traces = [makeTrace("net1", [{ x1: 0, y1: 0, x2: 2, y2: 0 }])]
    const result = combineCloseSameNetTraceSegments(traces)
    expect(result.length).toBe(1)
    expect(result[0].edges.length).toBe(1)
  })
})
