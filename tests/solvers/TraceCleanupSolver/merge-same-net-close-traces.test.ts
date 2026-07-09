import { test, expect } from "bun:test"
import { mergeSameNetCloseTraces } from "lib/solvers/TraceCleanupSolver/mergeSameNetCloseTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("should merge horizontal same-net traces at nearly same Y", () => {
  // Two traces in U-shapes; the middle horizontal segments are at slightly
  // different Y values but should be snapped together.
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "pair1",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      pins: [
        { pinId: "p1", x: 0, y: 0, chipId: "c1" },
        { pinId: "p2", x: 5, y: 0, chipId: "c2" },
      ],
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 0 },
      ],
      mspConnectionPairIds: ["pair1"],
      pinIds: ["p1", "p2"],
    },
    {
      mspPairId: "pair2",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      pins: [
        { pinId: "p3", x: 2, y: 0, chipId: "c3" },
        { pinId: "p4", x: 7, y: 0, chipId: "c4" },
      ],
      tracePath: [
        { x: 2, y: 0 },
        { x: 2, y: 1.2 },
        { x: 7, y: 1.2 },
        { x: 7, y: 0 },
      ],
      mspConnectionPairIds: ["pair2"],
      pinIds: ["p3", "p4"],
    },
  ]

  const result = mergeSameNetCloseTraces(traces, 0.3)

  // Both middle horizontal segments should now share the same Y (avg of 1 and 1.2 = 1.1)
  expect(result[0].tracePath[1].y).toBeCloseTo(1.1)
  expect(result[0].tracePath[2].y).toBeCloseTo(1.1)
  expect(result[1].tracePath[1].y).toBeCloseTo(1.1)
  expect(result[1].tracePath[2].y).toBeCloseTo(1.1)

  // Endpoints (pin connections) must remain unchanged
  expect(result[0].tracePath[0]).toEqual({ x: 0, y: 0 })
  expect(result[0].tracePath[3]).toEqual({ x: 5, y: 0 })
  expect(result[1].tracePath[0]).toEqual({ x: 2, y: 0 })
  expect(result[1].tracePath[3]).toEqual({ x: 7, y: 0 })
})

test("should merge vertical same-net traces at nearly same X", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "pair1",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      pins: [
        { pinId: "p1", x: 0, y: 0, chipId: "c1" },
        { pinId: "p2", x: 0, y: 5, chipId: "c2" },
      ],
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 5 },
        { x: 0, y: 5 },
      ],
      mspConnectionPairIds: ["pair1"],
      pinIds: ["p1", "p2"],
    },
    {
      mspPairId: "pair2",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      pins: [
        { pinId: "p3", x: 0, y: 1, chipId: "c3" },
        { pinId: "p4", x: 0, y: 6, chipId: "c4" },
      ],
      tracePath: [
        { x: 0, y: 1 },
        { x: 1.2, y: 1 },
        { x: 1.2, y: 6 },
        { x: 0, y: 6 },
      ],
      mspConnectionPairIds: ["pair2"],
      pinIds: ["p3", "p4"],
    },
  ]

  const result = mergeSameNetCloseTraces(traces, 0.3)

  // The middle vertical segments should share the same X (avg of 1 and 1.2 = 1.1)
  expect(result[0].tracePath[1].x).toBeCloseTo(1.1)
  expect(result[0].tracePath[2].x).toBeCloseTo(1.1)
  expect(result[1].tracePath[1].x).toBeCloseTo(1.1)
  expect(result[1].tracePath[2].x).toBeCloseTo(1.1)
})

test("should not merge traces on different nets", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "pair1",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      pins: [
        { pinId: "p1", x: 0, y: 0, chipId: "c1" },
        { pinId: "p2", x: 5, y: 0, chipId: "c2" },
      ],
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 0 },
      ],
      mspConnectionPairIds: ["pair1"],
      pinIds: ["p1", "p2"],
    },
    {
      mspPairId: "pair2",
      dcConnNetId: "net2",
      globalConnNetId: "net2",
      pins: [
        { pinId: "p3", x: 2, y: 0, chipId: "c3" },
        { pinId: "p4", x: 7, y: 0, chipId: "c4" },
      ],
      tracePath: [
        { x: 2, y: 0 },
        { x: 2, y: 1.2 },
        { x: 7, y: 1.2 },
        { x: 7, y: 0 },
      ],
      mspConnectionPairIds: ["pair2"],
      pinIds: ["p3", "p4"],
    },
  ]

  const result = mergeSameNetCloseTraces(traces, 0.3)

  // Should NOT merge - different nets; horizontal Y stays as authored
  expect(result[0].tracePath[1].y).toBe(1)
  expect(result[0].tracePath[2].y).toBe(1)
  expect(result[1].tracePath[1].y).toBe(1.2)
  expect(result[1].tracePath[2].y).toBe(1.2)
})

test("should not merge traces that do not overlap on parallel axis", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "pair1",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      pins: [
        { pinId: "p1", x: 0, y: 0, chipId: "c1" },
        { pinId: "p2", x: 3, y: 0, chipId: "c2" },
      ],
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 0 },
      ],
      mspConnectionPairIds: ["pair1"],
      pinIds: ["p1", "p2"],
    },
    {
      mspPairId: "pair2",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      pins: [
        { pinId: "p3", x: 10, y: 0, chipId: "c3" },
        { pinId: "p4", x: 15, y: 0, chipId: "c4" },
      ],
      tracePath: [
        { x: 10, y: 0 },
        { x: 10, y: 1.1 },
        { x: 15, y: 1.1 },
        { x: 15, y: 0 },
      ],
      mspConnectionPairIds: ["pair2"],
      pinIds: ["p3", "p4"],
    },
  ]

  const result = mergeSameNetCloseTraces(traces, 0.3)

  // Should NOT merge - the horizontal segments do not overlap on X axis
  expect(result[0].tracePath[1].y).toBe(1)
  expect(result[0].tracePath[2].y).toBe(1)
  expect(result[1].tracePath[1].y).toBe(1.1)
  expect(result[1].tracePath[2].y).toBe(1.1)
})

test("should preserve pin endpoints when merging", () => {
  // The first/last segments of each trace touch a pin and must not move.
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "pair1",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      pins: [
        { pinId: "p1", x: 0, y: 0.05, chipId: "c1" },
        { pinId: "p2", x: 5, y: 0.05, chipId: "c2" },
      ],
      tracePath: [
        // First segment is horizontal but at the pin — must not move.
        { x: 0, y: 0.05 },
        { x: 1, y: 0.05 },
        { x: 1, y: 2 },
        { x: 4, y: 2 },
        { x: 4, y: 0.05 },
        { x: 5, y: 0.05 },
      ],
      mspConnectionPairIds: ["pair1"],
      pinIds: ["p1", "p2"],
    },
    {
      mspPairId: "pair2",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      pins: [
        { pinId: "p3", x: 0, y: -0.05, chipId: "c3" },
        { pinId: "p4", x: 5, y: -0.05, chipId: "c4" },
      ],
      tracePath: [
        { x: 0, y: -0.05 },
        { x: 1.2, y: -0.05 },
        { x: 1.2, y: 2.1 },
        { x: 3.8, y: 2.1 },
        { x: 3.8, y: -0.05 },
        { x: 5, y: -0.05 },
      ],
      mspConnectionPairIds: ["pair2"],
      pinIds: ["p3", "p4"],
    },
  ]

  const result = mergeSameNetCloseTraces(traces, 0.3)

  // Endpoints stay where they were
  expect(result[0].tracePath[0]).toEqual({ x: 0, y: 0.05 })
  expect(result[0].tracePath[5]).toEqual({ x: 5, y: 0.05 })
  expect(result[1].tracePath[0]).toEqual({ x: 0, y: -0.05 })
  expect(result[1].tracePath[5]).toEqual({ x: 5, y: -0.05 })
})
