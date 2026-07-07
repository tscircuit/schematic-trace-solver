import { describe, expect, test } from "bun:test"
import { mergeSameNetParallelTraces } from "lib/solvers/TraceCleanupSolver/mergeSameNetParallelTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

describe("mergeSameNetParallelTraces", () => {
  test("merges two horizontal segments on the same net that are very close in Y", () => {
    const traceA: SolvedTracePath = {
      mspPairId: "net1_A",
      globalConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      mspConnectionPairIds: ["net1_A"],
      pinIds: ["p1", "p2"],
      pins: [],
    } as any

    const traceB: SolvedTracePath = {
      mspPairId: "net1_B",
      globalConnNetId: "net1",
      tracePath: [
        { x: 1, y: 0.03 }, // only 0.03 away — should be snapped to y=0
        { x: 3, y: 0.03 },
      ],
      mspConnectionPairIds: ["net1_B"],
      pinIds: ["p3", "p4"],
      pins: [],
    } as any

    const result = mergeSameNetParallelTraces([traceA, traceB], {})

    // traceB's y should now be 0 (snapped to traceA)
    expect(result[1].tracePath[0].y).toBeCloseTo(0)
    expect(result[1].tracePath[1].y).toBeCloseTo(0)
  })

  test("does not merge segments on different nets", () => {
    const traceA: SolvedTracePath = {
      mspPairId: "net1_A",
      globalConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      mspConnectionPairIds: ["net1_A"],
      pinIds: ["p1", "p2"],
      pins: [],
    } as any

    const traceB: SolvedTracePath = {
      mspPairId: "net2_B",
      globalConnNetId: "net2",
      tracePath: [
        { x: 1, y: 0.03 },
        { x: 3, y: 0.03 },
      ],
      mspConnectionPairIds: ["net2_B"],
      pinIds: ["p3", "p4"],
      pins: [],
    } as any

    const result = mergeSameNetParallelTraces([traceA, traceB], {})

    // Different nets — traceB's y should NOT be changed
    expect(result[1].tracePath[0].y).toBeCloseTo(0.03)
  })

  test("does not merge segments far apart", () => {
    const traceA: SolvedTracePath = {
      mspPairId: "net1_A",
      globalConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      mspConnectionPairIds: ["net1_A"],
      pinIds: ["p1", "p2"],
      pins: [],
    } as any

    const traceB: SolvedTracePath = {
      mspPairId: "net1_B",
      globalConnNetId: "net1",
      tracePath: [
        { x: 1, y: 0.5 }, // 0.5 away — too far, should NOT be merged
        { x: 3, y: 0.5 },
      ],
      mspConnectionPairIds: ["net1_B"],
      pinIds: ["p3", "p4"],
      pins: [],
    } as any

    const result = mergeSameNetParallelTraces([traceA, traceB], {})

    // Should remain unchanged
    expect(result[1].tracePath[0].y).toBeCloseTo(0.5)
  })
})
