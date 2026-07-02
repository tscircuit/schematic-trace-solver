import { expect, test } from "bun:test"
import { mergeSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/mergeSameNetTraceSegments"

test("mergeSameNetTraceSegments aligns close same-net horizontal segments", () => {
  const traces = mergeSameNetTraceSegments(
    [
      {
        mspPairId: "a",
        globalConnNetId: "GND",
        userNetId: "GND",
        pins: [] as any,
        pinIds: [] as any,
        mspConnectionPairIds: ["a"],
        tracePath: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 4, y: 1 },
          { x: 4, y: 0 },
        ],
      },
      {
        mspPairId: "b",
        globalConnNetId: "GND",
        userNetId: "GND",
        pins: [] as any,
        pinIds: [] as any,
        mspConnectionPairIds: ["b"],
        tracePath: [
          { x: 1, y: 2 },
          { x: 1, y: 1.06 },
          { x: 3, y: 1.06 },
          { x: 3, y: 2 },
        ],
      },
    ] as any,
    0.1,
  )

  expect(traces[1]!.tracePath[1]!.y).toBe(1)
  expect(traces[1]!.tracePath[2]!.y).toBe(1)
})

test("mergeSameNetTraceSegments does not align different nets", () => {
  const traces = mergeSameNetTraceSegments(
    [
      {
        mspPairId: "a",
        globalConnNetId: "GND",
        userNetId: "GND",
        pins: [] as any,
        pinIds: [] as any,
        mspConnectionPairIds: ["a"],
        tracePath: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 4, y: 1 },
          { x: 4, y: 0 },
        ],
      },
      {
        mspPairId: "b",
        globalConnNetId: "VCC",
        userNetId: "VCC",
        pins: [] as any,
        pinIds: [] as any,
        mspConnectionPairIds: ["b"],
        tracePath: [
          { x: 1, y: 2 },
          { x: 1, y: 1.06 },
          { x: 3, y: 1.06 },
          { x: 3, y: 2 },
        ],
      },
    ] as any,
    0.1,
  )

  expect(traces[1]!.tracePath[1]!.y).toBe(1.06)
  expect(traces[1]!.tracePath[2]!.y).toBe(1.06)
})

test("mergeSameNetTraceSegments aligns close same-net vertical segments", () => {
  const traces = mergeSameNetTraceSegments(
    [
      {
        mspPairId: "a",
        globalConnNetId: "SDA",
        userNetId: "SDA",
        pins: [] as any,
        pinIds: [] as any,
        mspConnectionPairIds: ["a"],
        tracePath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 4 },
          { x: 0, y: 4 },
        ],
      },
      {
        mspPairId: "b",
        globalConnNetId: "SDA",
        userNetId: "SDA",
        pins: [] as any,
        pinIds: [] as any,
        mspConnectionPairIds: ["b"],
        tracePath: [
          { x: 2, y: 1 },
          { x: 1.05, y: 1 },
          { x: 1.05, y: 3 },
          { x: 2, y: 3 },
        ],
      },
    ] as any,
    0.1,
  )

  expect(traces[1]!.tracePath[1]!.x).toBe(1)
  expect(traces[1]!.tracePath[2]!.x).toBe(1)
})
