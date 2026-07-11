import { describe, expect, it } from "vitest"
import { snapSameNetTraces } from "lib/solvers/TraceCleanupSolver/snapSameNetTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makePath = (
  id: string,
  net: string,
  points: { x: number; y: number }[],
): SolvedTracePath => ({
  mspPairId: () => id,
  net,
  tracePath: points,
  mspConnection: { name: net } as any,
  viaCount: 0,
})

describe("snapSameNetTraces", () => {
  it("snaps two same-net vertical segments that are close together", () => {
    const traces: SolvedTracePath[] = [
      makePath("A", "VCC", [
        { x: 1.0, y: 0 },
        { x: 1.0, y: 1 },
      ]),
      makePath("B", "VCC", [
        { x: 1.03, y: 0.5 },
        { x: 1.03, y: 1.5 },
      ]),
    ]

    const result = snapSameNetTraces(traces, 0.05)
    
    const traceA = result.find((t) => t.mspPairId() === "A")!
    const traceB = result.find((t) => t.mspPairId() === "B")!
    
    // Don't use.find() on tracePath - just check the points directly
    const xA = traceA.tracePath[0].x
    const xB = traceB.tracePath[0].x

    expect(xA).toBeCloseTo(1.015, 6)
    expect(xB).toBeCloseTo(1.015, 6)
    expect(Math.abs(xA - xB)).toBeLessThan(1e-6)
  })

  it("does NOT snap segments from different nets", () => {
    const traces: SolvedTracePath[] = [
      makePath("E", "VCC", [
        { x: 1.0, y: 0 },
        { x: 1.0, y: 1 },
      ]),
      makePath("F", "GND", [
        { x: 1.03, y: 0.5 },
        { x: 1.03, y: 1.5 },
      ]),
    ]

    const result = snapSameNetTraces(traces, 0.05)
    
    const traceE = result.find((t) => t.mspPairId() === "E")!
    const traceF = result.find((t) => t.mspPairId() === "F")!

    expect(traceE.tracePath[0].x).toBeCloseTo(1.0, 9)
    expect(traceF.tracePath[0].x).toBeCloseTo(1.03, 9)
  })

  it("does not mutate input array", () => {
    const traces: SolvedTracePath[] = [
      makePath("H", "NET2", [
        { x: 1.0, y: 0 },
        { x: 1.0, y: 1 },
      ]),
      makePath("I", "NET2", [
        { x: 1.03, y: 0.5 },
        { x: 1.03, y: 1.5 },
      ]),
    ]

    const originalX = traces[0].tracePath[0].x
    snapSameNetTraces(traces, 0.05)
    
    expect(traces[0].tracePath[0].x).toBe(originalX)
  })
})
