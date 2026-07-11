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
  it("snaps vertical segments on same net to mean X", () => {
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
    const xA = result.find((t) => t.mspPairId() === "A")!.tracePath[0].x
    const xB = result.find((t) => t.mspPairId() === "B")!.tracePath[0].x

    expect(Math.abs(xA - 1.015)).toBeLessThan(1e-6)
    expect(Math.abs(xB - 1.015)).toBeLessThan(1e-6)
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
    const xE = result.find((t) => t.mspPairId() === "E")!.tracePath[0].x
    const xF = result.find((t) => t.mspPairId() === "F")!.tracePath[0].x

    expect(Math.abs(xE - 1.0)).toBeLessThan(1e-6)
    expect(Math.abs(xF - 1.03)).toBeLessThan(1e-6)
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
    
    expect(traces[0].tracePath[0].x).toBeCloseTo(originalX, 9)
  })
})
