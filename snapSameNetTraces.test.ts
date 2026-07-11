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

  it("snaps horizontal segments on same net to mean Y", () => {
    const traces: SolvedTracePath[] = [
      makePath("C", "GND", [
        { x: 0, y: 2.0 },
        { x: 1, y: 2.0 },
      ]),
      makePath("D", "GND", [
        { x: 0.5, y: 2.04 },
        { x: 1.5, y: 2.04 },
      ]),
    ]

    const result = snapSameNetTraces(traces, 0.05)
    const yC = result.find((t) => t.mspPairId() === "C")!.tracePath[0].y
    const yD = result.find((t) => t.mspPairId() === "D")!.tracePath[0].y

    expect(Math.abs(yC - 2.02)).toBeLessThan(1e-6)
    expect(Math.abs(yD - 2.02)).toBeLessThan(1e-6)
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

  it("handles empty trace list", () => {
    const result = snapSameNetTraces([])
    expect(result).toEqual([])
  })

  it("handles single trace with no pair", () => {
    const traces = [
      makePath("G", "NET1", [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ]),
    ]

    const result = snapSameNetTraces(traces)
    expect(result[0].tracePath[0].x).toBeCloseTo(1, 9)
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

  it("does not snap non-overlapping parallel segments", () => {
    const traces: SolvedTracePath[] = [
      makePath("J", "NET3", [
        { x: 1.0, y: 0 },
        { x: 1.0, y: 1 },
      ]),
      makePath("K", "NET3", [
        { x: 1.03, y: 2 },
        { x: 1.03, y: 3 },
      ]),
    ]

    const result = snapSameNetTraces(traces, 0.05)
    const xJ = result.find((t) => t.mspPairId() === "J")!.tracePath[0].x
    const xK = result.find((t) => t.mspPairId() === "K")!.tracePath[0].x

    expect(Math.abs(xJ - 1.0)).toBeLessThan(1e-6)
    expect(Math.abs(xK - 1.03)).toBeLessThan(1e-6)
  })
})
