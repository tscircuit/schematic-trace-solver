import { describe, it, expect } from "vitest"
import { combineCloseSameNetTraceSegments } from "../../lib/phases/combine-close-same-net-trace-segments"
import type { SchematicTrace } from "@tscircuit/props"

/**
 * Helper to create a minimal SchematicTrace-compatible object for testing.
 */
function makeTrace(
  net: string,
  edges: Array<{ from: Record<string, unknown>; to: Record<string, unknown> }>,
): SchematicTrace {
  return {
    connection_name: net,
    edges,
  } as unknown as SchematicTrace
}

describe("combineCloseSameNetTraceSegments", () => {
  it("merges two overlapping horizontal edges from separate traces on the same net", () => {
    const traces = [
      makeTrace("net1", [
        { from: { x: 0, y: 0 }, to: { x: 2, y: 0 } },
      ]),
      makeTrace("net1", [
        { from: { x: 1, y: 0 }, to: { x: 3, y: 0 } },
      ]),
    ]

    const result = combineCloseSameNetTraceSegments(traces)
    expect(result).toHaveLength(1)

    const edges = (result[0] as any).edges
    expect(edges).toHaveLength(1)
    expect(edges[0].from.x).toBeCloseTo(0)
    expect(edges[0].to.x).toBeCloseTo(3)
    expect(edges[0].from.y).toBeCloseTo(0)
    expect(edges[0].to.y).toBeCloseTo(0)
  })

  it("merges two overlapping vertical edges from separate traces on the same net", () => {
    const traces = [
      makeTrace("net1", [
        { from: { x: 0, y: 0 }, to: { x: 0, y: 2 } },
      ]),
      makeTrace("net1", [
        { from: { x: 0, y: 1 }, to: { x: 0, y: 3 } },
      ]),
    ]

    const result = combineCloseSameNetTraceSegments(traces)
    expect(result).toHaveLength(1)

    const edges = (result[0] as any).edges
    expect(edges).toHaveLength(1)
    expect(edges[0].from.y).toBeCloseTo(0)
    expect(edges[0].to.y).toBeCloseTo(3)
  })

  it("does NOT merge edges from different nets", () => {
    const traces = [
      makeTrace("net1", [{ from: { x: 0, y: 0 }, to: { x: 2, y: 0 } }]),
      makeTrace("net2", [{ from: { x: 0, y: 0 }, to: { x: 2, y: 0 } }]),
    ]

    const result = combineCloseSameNetTraceSegments(traces)
    expect(result).toHaveLength(2)
  })

  it("does NOT merge horizontal edges that are far apart in X", () => {
    const traces = [
      makeTrace("net1", [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }]),
      makeTrace("net1", [{ from: { x: 5, y: 0 }, to: { x: 6, y: 0 } }]),
    ]

    const result = combineCloseSameNetTraceSegments(traces)
    const edges = (result[0] as any).edges
    expect(edges).toHaveLength(2)
  })

  it("does NOT merge horizontal edges that are far apart in Y", () => {
    const traces = [
      makeTrace("net1", [{ from: { x: 0, y: 0 }, to: { x: 2, y: 0 } }]),
      makeTrace("net1", [{ from: { x: 0, y: 1 }, to: { x: 2, y: 1 } }]),
    ]

    const result = combineCloseSameNetTraceSegments(traces)
    const edges = (result[0] as any).edges
    expect(edges).toHaveLength(2)
  })

  it("preserves schematic_port_id on the correct endpoint after merge", () => {
    // net1 has two traces: one starts at x=0 (with port A), another ends at x=3 (with port B)
    const traces = [
      makeTrace("net1", [
        {
          from: { x: 0, y: 0, schematic_port_id: "portA" },
          to: { x: 2, y: 0 },
        },
      ]),
      makeTrace("net1", [
        {
          from: { x: 1, y: 0 },
          to: { x: 3, y: 0, schematic_port_id: "portB" },
        },
      ]),
    ]

    const result = combineCloseSameNetTraceSegments(traces)
    expect(result).toHaveLength(1)

    const edges = (result[0] as any).edges
    expect(edges).toHaveLength(1)

    // The merged edge should span x=0..x=3
    expect(edges[0].from.x).toBeCloseTo(0)
    expect(edges[0].to.x).toBeCloseTo(3)

    // portA is at x=0 (min), so it should be on `from`
    expect(edges[0].from.schematic_port_id).toBe("portA")

    // portB is at x=3 (max), so it should be on `to`
    expect(edges[0].to.schematic_port_id).toBe("portB")
  })

  it("merges edges within a single trace", () => {
    const traces = [
      makeTrace("net1", [
        { from: { x: 0, y: 0 }, to: { x: 2, y: 0 } },
        { from: { x: 1, y: 0 }, to: { x: 4, y: 0 } },
      ]),
    ]

    const result = combineCloseSameNetTraceSegments(traces)
    const edges = (result[0] as any).edges
    expect(edges).toHaveLength(1)
    expect(edges[0].from.x).toBeCloseTo(0)
    expect(edges[0].to.x).toBeCloseTo(4)
  })

  it("handles an empty trace list", () => {
    expect(combineCloseSameNetTraceSegments([])).toHaveLength(0)
  })

  it("handles traces with no edges", () => {
    const traces = [makeTrace("net1", [])]
    // Empty traces are filtered out
    const result = combineCloseSameNetTraceSegments(traces)
    expect(result).toHaveLength(0)
  })

  it("merges close horizontal edges within the CLOSE_THRESHOLD", () => {
    // Edges are close in Y (within 0.1) and overlap in X
    const traces = [
      makeTrace("net1", [{ from: { x: 0, y: 0 }, to: { x: 2, y: 0 } }]),
      makeTrace("net1", [{ from: { x: 0, y: 0.05 }, to: { x: 2, y: 0.05 } }]),
    ]

    const result = combineCloseSameNetTraceSegments(traces)
    expect(result).toHaveLength(1)
    const edges = (result[0] as any).edges
    expect(edges).toHaveLength(1)
    // Y should be averaged
    expect(edges[0].from.y).toBeCloseTo(0.025)
  })
})
