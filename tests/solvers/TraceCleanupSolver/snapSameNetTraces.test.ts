import { describe, expect, it } from "vitest"
import { snapSameNetTraces } from "./snapSameNetTraces"
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
  it("snaps vertical segments to mean X", () => {
    const traces: SolvedTracePath[] = [
      makePath("A", "NET1", [
        { x: 1.0, y: 0 },
        { x: 1.0, y: 1 },
      ]),
      makePath("B", "NET1", [
        { x: 1.03, y: 0.5 },
        { x: 1.03, y: 1.5 },
      ]),
    ]

    const result = snapSameNetTraces(traces, 0.05)
    const xA = result.find((t) => t.mspPairId() === "A")!.tracePath[0].x
    const xB = result.find((t) => t.mspPairId() === "B")!.tracePath[0].x

    expect(Math.abs(xA - 1.015)).toBeLessThan(1e-6)
    expect(Math.abs(xB - 1.015)).toBeLessThan(1e-6)
  })

  it("does NOT snap segments from different nets", () => {
    const traces: SolvedTracePath[] = [
      makePath("G", "NETA", [
        { x: 1.0, y: 0 },
        { x: 1.0, y: 1 },
      ]),
      makePath("H", "NETB", [
        { x: 1.03, y: 0.5 },
        { x: 1.03, y: 1.5 },
      ]),
    ]

    const result = snapSameNetTraces(traces, 0.05)
    const xG = result.find((t) => t.mspPairId() === "G")!.tracePath[0].x
    const xH = result.find((t) => t.mspPairId() === "H")!.tracePath[0].x

    expect(Math.abs(xG - 1.0)).toBeLessThan(1e-6)
    expect(Math.abs(xH - 1.03)).toBeLessThan(1e-6)
  })

  it("handles empty trace list", () => {
    const result = snapSameNetTraces([])
    expect(result).toEqual([])
  })

  it("does not mutate input", () => {
    const traces: SolvedTracePath[] = [
      makePath("J", "NET7", [
        { x: 1.0, y: 0 },
        { x: 1.0, y: 1 },
      ]),
      makePath("K", "NET7", [
        { x: 1.03, y: 0.5 },
        { x: 1.03, y: 1.5 },
      ]),
    ]

    const originalXJ = traces[0].tracePath[0].x
    snapSameNetTraces(traces, 0.05)
    expect(traces[0].tracePath[0].x).toBeCloseTo(originalXJ, 9)
  })
})
