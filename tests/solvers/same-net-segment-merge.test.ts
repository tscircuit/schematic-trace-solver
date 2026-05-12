import { describe, it, expect } from "bun:test"
import { SameNetSegmentMergeSolver } from "lib/solvers/SameNetSegmentMergeSolver/SameNetSegmentMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const basePath = (
  id: string,
  netId: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId: id,
    globalConnNetId: netId,
    tracePath: points,
    mspConnectionPairIds: [],
    pinIds: [],
  }) as any

describe("SameNetSegmentMergeSolver", () => {
  it("passes through traces on different nets unchanged", () => {
    const traces = [
      basePath("a", "net1", [{ x: 0, y: 0 }, { x: 10, y: 0 }]),
      basePath("b", "net2", [{ x: 0, y: 0.04 }, { x: 10, y: 0.04 }]),
    ]
    const solver = new SameNetSegmentMergeSolver({ inputProblem: {} as any, traces })
    solver.solve()
    const out = solver.getOutput().traces
    expect(out[0].tracePath[0].y).toBeCloseTo(0, 5)
    expect(out[1].tracePath[0].y).toBeCloseTo(0.04, 5)
  })

  it("deduplicates nearly-coincident horizontal segments on the same net", () => {
    const traces = [
      basePath("a", "net1", [{ x: 0, y: 0 }, { x: 10, y: 0 }]),
      basePath("b", "net1", [{ x: 0, y: 0.04 }, { x: 10, y: 0.04 }]),
    ]
    const solver = new SameNetSegmentMergeSolver({ inputProblem: {} as any, traces })
    solver.solve()
    const out = solver.getOutput().traces
    // B's segment should snap onto A's y=0 line
    expect(out[1].tracePath[0].y).toBeCloseTo(0, 5)
    expect(out[1].tracePath[1].y).toBeCloseTo(0, 5)
  })

  it("deduplicates nearly-coincident vertical segments on the same net", () => {
    const traces = [
      basePath("a", "net1", [{ x: 0, y: 0 }, { x: 0, y: 10 }]),
      basePath("b", "net1", [{ x: 0.04, y: 0 }, { x: 0.04, y: 10 }]),
    ]
    const solver = new SameNetSegmentMergeSolver({ inputProblem: {} as any, traces })
    solver.solve()
    const out = solver.getOutput().traces
    expect(out[1].tracePath[0].x).toBeCloseTo(0, 5)
    expect(out[1].tracePath[1].x).toBeCloseTo(0, 5)
  })

  it("does not merge segments that are beyond the threshold", () => {
    const traces = [
      basePath("a", "net1", [{ x: 0, y: 0 }, { x: 10, y: 0 }]),
      basePath("b", "net1", [{ x: 0, y: 0.1 }, { x: 10, y: 0.1 }]),
    ]
    const solver = new SameNetSegmentMergeSolver({ inputProblem: {} as any, traces })
    solver.solve()
    const out = solver.getOutput().traces
    // threshold is 0.05, distance is 0.1 — should not merge
    expect(out[1].tracePath[0].y).toBeCloseTo(0.1, 5)
  })

  it("snaps a T-junction endpoint to an interior segment point on same net", () => {
    // traceA: horizontal 0→10 at y=0
    // traceB: vertical from y=0.03 to y=5 at x=5, endpoint near A's interior
    const traces = [
      basePath("a", "net1", [{ x: 0, y: 0 }, { x: 10, y: 0 }]),
      basePath("b", "net1", [{ x: 5, y: 0.03 }, { x: 5, y: 5 }]),
    ]
    const solver = new SameNetSegmentMergeSolver({ inputProblem: {} as any, traces })
    solver.solve()
    const out = solver.getOutput().traces
    // The near-endpoint of B should snap onto A's segment (y→0)
    expect(out[1].tracePath[0].y).toBeCloseTo(0, 5)
  })
})
