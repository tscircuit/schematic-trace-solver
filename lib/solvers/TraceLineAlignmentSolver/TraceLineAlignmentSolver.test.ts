import { describe, expect, test } from "bun:test"
import { TraceLineAlignmentSolver } from "./TraceLineAlignmentSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"

function makeTrace(
  id: string,
  tracePath: Point[],
  netId = "net1",
): SolvedTracePath {
  return {
    mspPairId: id,
    netId,
    userNetId: netId,
    globalConnNetId: netId,
    dcConnNetId: netId,
    pinIds: ["pin1", "pin2"],
    mspConnectionPairIds: [id],
    connectedPinIds: [],
    pins: [
      {
        pinId: "pin1",
        chipId: "chip1",
        side: "left",
        facingDirection: "left",
        position: tracePath[0]!,
      },
      {
        pinId: "pin2",
        chipId: "chip2",
        side: "right",
        facingDirection: "right",
        position: tracePath[tracePath.length - 1]!,
      },
    ],
    tracePath,
  } as unknown as SolvedTracePath
}

describe("TraceLineAlignmentSolver", () => {
  test("aligns two close horizontal traces to same Y", () => {
    const t1 = makeTrace("a", [
      { x: 0, y: 2.001 },
      { x: 5, y: 2.001 },
    ])
    const t2 = makeTrace("b", [
      { x: 0, y: 1.999 },
      { x: 5, y: 1.999 },
    ])

    const solver = new TraceLineAlignmentSolver({ traces: [t1, t2] })
    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.alignedCount).toBeGreaterThan(0)
    // Both should now be at the same Y
    const y1 = solver.outputTraces[0]!.tracePath[0]!.y
    const y2 = solver.outputTraces[1]!.tracePath[0]!.y
    expect(Math.abs(y1 - y2)).toBeLessThan(1e-9)
  })

  test("aligns two close vertical traces to same X", () => {
    const t1 = makeTrace("a", [
      { x: 3.002, y: 0 },
      { x: 3.002, y: 5 },
    ])
    const t2 = makeTrace("b", [
      { x: 2.998, y: 0 },
      { x: 2.998, y: 5 },
    ])

    const solver = new TraceLineAlignmentSolver({ traces: [t1, t2] })
    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.alignedCount).toBeGreaterThan(0)
    const x1 = solver.outputTraces[0]!.tracePath[0]!.x
    const x2 = solver.outputTraces[1]!.tracePath[0]!.x
    expect(Math.abs(x1 - x2)).toBeLessThan(1e-9)
  })

  test("does not align traces far apart", () => {
    const t1 = makeTrace("a", [
      { x: 0, y: 2 },
      { x: 5, y: 2 },
    ])
    const t2 = makeTrace("b", [
      { x: 0, y: 5 },
      { x: 5, y: 5 },
    ])

    const solver = new TraceLineAlignmentSolver({ traces: [t1, t2] })
    solver.solve()

    expect(solver.alignedCount).toBe(0)
    // Y values should be unchanged
    expect(solver.outputTraces[0]!.tracePath[0]!.y).toBe(2)
    expect(solver.outputTraces[1]!.tracePath[0]!.y).toBe(5)
  })

  test("does not align non-overlapping segments", () => {
    // Two horizontal traces at similar Y but far apart in X
    const t1 = makeTrace("a", [
      { x: 0, y: 2.001 },
      { x: 5, y: 2.001 },
    ])
    const t2 = makeTrace("b", [
      { x: 20, y: 1.999 },
      { x: 25, y: 1.999 },
    ])

    const solver = new TraceLineAlignmentSolver({ traces: [t1, t2] })
    solver.solve()

    expect(solver.alignedCount).toBe(0)
  })

  test("custom alignThreshold", () => {
    const t1 = makeTrace("a", [
      { x: 0, y: 2 },
      { x: 5, y: 2 },
    ])
    const t2 = makeTrace("b", [
      { x: 0, y: 2.2 },
      { x: 5, y: 2.2 },
    ])

    // Default threshold (0.15) — too far, no alignment
    const solver1 = new TraceLineAlignmentSolver({ traces: [t1, t2] })
    solver1.solve()
    expect(solver1.alignedCount).toBe(0)

    // Larger threshold — should align
    const solver2 = new TraceLineAlignmentSolver({
      traces: [t1, t2],
      alignThreshold: 0.3,
    })
    solver2.solve()
    expect(solver2.alignedCount).toBeGreaterThan(0)
  })

  test("aligns L-shaped trace segments", () => {
    // L-shaped trace: horizontal then vertical
    const t1 = makeTrace("a", [
      { x: 0, y: 2.001 },
      { x: 3, y: 2.001 },
      { x: 3, y: 5 },
    ])
    const t2 = makeTrace("b", [
      { x: 0, y: 1.999 },
      { x: 3, y: 1.999 },
      { x: 3, y: 5 },
    ])

    const solver = new TraceLineAlignmentSolver({ traces: [t1, t2] })
    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.alignedCount).toBeGreaterThan(0)
    // Horizontal segments should be aligned
    const y1 = solver.outputTraces[0]!.tracePath[0]!.y
    const y2 = solver.outputTraces[1]!.tracePath[0]!.y
    expect(Math.abs(y1 - y2)).toBeLessThan(1e-9)
  })

  test("empty traces — no crash", () => {
    const solver = new TraceLineAlignmentSolver({ traces: [] })
    solver.solve()
    expect(solver.solved).toBe(true)
    expect(solver.alignedCount).toBe(0)
  })

  test("single trace — no alignment needed", () => {
    const t1 = makeTrace("a", [
      { x: 0, y: 2 },
      { x: 5, y: 2 },
    ])
    const solver = new TraceLineAlignmentSolver({ traces: [t1] })
    solver.solve()
    expect(solver.solved).toBe(true)
    expect(solver.alignedCount).toBe(0)
  })

  test("getOutput returns aligned traces", () => {
    const t1 = makeTrace("a", [
      { x: 0, y: 2.01 },
      { x: 5, y: 2.01 },
    ])
    const t2 = makeTrace("b", [
      { x: 0, y: 1.99 },
      { x: 5, y: 1.99 },
    ])

    const solver = new TraceLineAlignmentSolver({ traces: [t1, t2] })
    solver.solve()

    const output = solver.getOutput()
    expect(output.traces).toHaveLength(2)
    expect(output.traces[0]!.tracePath[0]!.y).toBeCloseTo(
      output.traces[1]!.tracePath[0]!.y,
      9,
    )
  })
})
