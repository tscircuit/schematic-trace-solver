import { expect, test } from "bun:test"
import { snapSameNetTraces } from "lib/solvers/TraceCleanupSolver/snapSameNetTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makePath = (id: string, net: string, points: {x: number, y: number}[]): SolvedTracePath => ({
  mspPairId: () => id,
  net,
  tracePath: points,
  mspConnection: { name: net } as any,
  viaCount: 0,
})

test("snaps vertical segments to mean X", () => {
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

test("snaps horizontal segments to mean Y", () => {
  const traces: SolvedTracePath[] = [
    makePath("C", "NET2", [
      { x: 0, y: 2.0 },
      { x: 1, y: 2.0 },
    ]),
    makePath("D", "NET2", [
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

test("does NOT snap segments from different nets", () => {
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

test("handles empty trace list", () => {
  const result = snapSameNetTraces([])
  expect(result).toEqual([])
})

test("handles single trace with no pair", () => {
  const traces = [
    makePath("I", "NET6", [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]),
  ]
  
  const result = snapSameNetTraces(traces)
  expect(result[0].tracePath[0].x).toBeCloseTo(1, 9)
})

test("preserves original traces array (does not mutate input)", () => {
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
  const originalXK = traces[1].tracePath[0].x
  
  snapSameNetTraces(traces, 0.05)
  
  expect(traces[0].tracePath[0].x).toBeCloseTo(originalXJ, 9)
  expect(traces[1].tracePath[0].x).toBeCloseTo(originalXK, 9)
})

test("does not snap non-overlapping parallel segments", () => {
  const traces: SolvedTracePath[] = [
    makePath("L", "NET8", [
      { x: 1.0, y: 0 },
      { x: 1.0, y: 1 },
    ]),
    makePath("M", "NET8", [
      { x: 1.03, y: 2 },
      { x: 1.03, y: 3 },
    ]),
  ]
  
  const result = snapSameNetTraces(traces, 0.05)
  
  const xL = result.find((t) => t.mspPairId() === "L")!.tracePath[0].x
  const xM = result.find((t) => t.mspPairId() === "M")!.tracePath[0].x
  
  expect(Math.abs(xL - 1.0)).toBeLessThan(1e-6)
  expect(Math.abs(xM - 1.03)).toBeLessThan(1e-6)
})
