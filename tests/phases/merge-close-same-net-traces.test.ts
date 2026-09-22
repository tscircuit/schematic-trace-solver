import { describe, it, expect } from "vitest"
import { mergeCloseSameNetTraces } from "../../lib/phases/merge-close-same-net-traces"
import type { SchematicTrace } from "../../lib/types"

// Helper to build a minimal SchematicTrace
function makeTrace(
  net: string,
  edges: { from: { x: number; y: number }; to: { x: number; y: number } }[],
): SchematicTrace {
  return {
    schematic_trace_id: `trace_${Math.random().toString(36).slice(2)}`,
    type: "schematic_trace",
    net_labels: [],
    edges,
    // @ts-ignore – extra field used by the phase for net grouping
    net_name: net,
  } as unknown as SchematicTrace
}

describe("mergeCloseSameNetTraces", () => {
  it("does not change a single isolated trace", () => {
    const traces = [
      makeTrace("net1", [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]),
    ]
    const result = mergeCloseSameNetTraces(traces)
    expect(result).toHaveLength(1)
    expect(result[0].edges).toHaveLength(1)
  })

  it("merges two collinear horizontal segments that touch end-to-end", () => {
    // [0,0]->[1,0] and [1,0]->[2,0] should become [0,0]->[2,0]
    const traces = [
      makeTrace("net1", [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
      ]),
    ]
    const result = mergeCloseSameNetTraces(traces)
    expect(result).toHaveLength(1)
    expect(result[0].edges).toHaveLength(1)
    const edge = result[0].edges[0]
    expect(Math.min(edge.from.x, edge.to.x)).toBeCloseTo(0)
    expect(Math.max(edge.from.x, edge.to.x)).toBeCloseTo(2)
    expect(edge.from.y).toBeCloseTo(0)
    expect(edge.to.y).toBeCloseTo(0)
  })

  it("merges two collinear horizontal segments that overlap", () => {
    // [0,0]->[2,0] and [1,0]->[3,0] → [0,0]->[3,0]
    const traces = [
      makeTrace("net1", [
        { from: { x: 0, y: 0 }, to: { x: 2, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 3, y: 0 } },
      ]),
    ]
    const result = mergeCloseSameNetTraces(traces)
    expect(result[0].edges).toHaveLength(1)
    const edge = result[0].edges[0]
    expect(Math.max(edge.from.x, edge.to.x)).toBeCloseTo(3)
  })

  it("merges two collinear vertical segments that touch", () => {
    const traces = [
      makeTrace("net1", [
        { from: { x: 0, y: 0 }, to: { x: 0, y: 1 } },
        { from: { x: 0, y: 1 }, to: { x: 0, y: 2 } },
      ]),
    ]
    const result = mergeCloseSameNetTraces(traces)
    expect(result[0].edges).toHaveLength(1)
    const edge = result[0].edges[0]
    expect(Math.min(edge.from.y, edge.to.y)).toBeCloseTo(0)
    expect(Math.max(edge.from.y, edge.to.y)).toBeCloseTo(2)
  })

  it("does NOT merge segments from different nets", () => {
    const traces = [
      makeTrace("net1", [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]),
      makeTrace("net2", [{ from: { x: 1, y: 0 }, to: { x: 2, y: 0 } }]),
    ]
    const result = mergeCloseSameNetTraces(traces)
    // Both traces should be kept independently
    expect(result).toHaveLength(2)
    expect(result.find((t) => (t as any).net_name === "net1")?.edges).toHaveLength(1)
    expect(result.find((t) => (t as any).net_name === "net2")?.edges).toHaveLength(1)
  })

  it("does NOT merge perpendicular segments on the same net", () => {
    const traces = [
      makeTrace("net1", [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }, // horizontal
        { from: { x: 1, y: 0 }, to: { x: 1, y: 1 } }, // vertical
      ]),
    ]
    const result = mergeCloseSameNetTraces(traces)
    expect(result[0].edges).toHaveLength(2)
  })

  it("merges segments across two different trace objects on the same net", () => {
    // Two separate SchematicTrace objects for the same net
    const trace1 = makeTrace("net1", [
      { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
    ])
    const trace2 = makeTrace("net1", [
      { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
    ])
    ;(trace2 as any).net_name = "net1"

    const result = mergeCloseSameNetTraces([trace1, trace2])
    // Both should be merged into a single trace with a single edge
    const net1Traces = result.filter((t) => (t as any).net_name === "net1")
    const allEdges = net1Traces.flatMap((t) => t.edges)
    expect(allEdges).toHaveLength(1)
    const edge = allEdges[0]
    expect(Math.min(edge.from.x, edge.to.x)).toBeCloseTo(0)
    expect(Math.max(edge.from.x, edge.to.x)).toBeCloseTo(2)
  })

  it("handles traces with no net_name without crashing", () => {
    const trace = {
      schematic_trace_id: "t1",
      type: "schematic_trace",
      net_labels: [],
      edges: [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }],
    } as unknown as SchematicTrace
    expect(() => mergeCloseSameNetTraces([trace])).not.toThrow()
  })

  it("merges three or more collinear segments in a chain", () => {
    const traces = [
      makeTrace("net1", [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 2, y: 0 } },
        { from: { x: 2, y: 0 }, to: { x: 3, y: 0 } },
      ]),
    ]
    const result = mergeCloseSameNetTraces(traces)
    expect(result[0].edges).toHaveLength(1)
    const edge = result[0].edges[0]
    expect(Math.min(edge.from.x, edge.to.x)).toBeCloseTo(0)
    expect(Math.max(edge.from.x, edge.to.x)).toBeCloseTo(3)
  })

  it("keeps two parallel horizontal segments on the same net at different y values separate", () => {
    const traces = [
      makeTrace("net1", [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        { from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
      ]),
    ]
    const result = mergeCloseSameNetTraces(traces)
    // Different y → they are NOT collinear → should not be merged
    expect(result[0].edges).toHaveLength(2)
  })

  it("merges two nearly-identical segments that differ by less than the threshold", () => {
    const traces = [
      makeTrace("net1", [
        { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
        // y is slightly off due to floating point noise
        { from: { x: 0, y: 0.005 }, to: { x: 1, y: 0.005 } },
      ]),
    ]
    const result = mergeCloseSameNetTraces(traces)
    expect(result[0].edges).toHaveLength(1)
  })
})
