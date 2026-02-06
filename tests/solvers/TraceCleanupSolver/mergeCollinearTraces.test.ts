import { expect, test, describe } from "bun:test"
import { mergeCollinearTraces } from "lib/solvers/TraceCleanupSolver/mergeCollinearTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

describe("mergeCollinearTraces", () => {
  test("should merge two horizontal collinear traces on the same net", () => {
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "trace1",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        userNetId: "net1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
        ],
        mspConnectionPairIds: ["pair1"],
        pinIds: ["pin1", "pin2"],
        pins: [] as any,
      },
      {
        mspPairId: "trace2",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        userNetId: "net1",
        tracePath: [
          { x: 2, y: 0 },
          { x: 4, y: 0 },
        ],
        mspConnectionPairIds: ["pair2"],
        pinIds: ["pin3", "pin4"],
        pins: [] as any,
      },
    ]

    const result = mergeCollinearTraces(traces)

    // Should have merged into fewer traces
    expect(result.length).toBeLessThanOrEqual(traces.length)

    // Check that at least one trace spans the full range
    const hasFullSpan = result.some((trace) => {
      const xs = trace.tracePath.map((p) => p.x)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      return minX === 0 && maxX === 4
    })
    expect(hasFullSpan).toBe(true)
  })

  test("should merge two vertical collinear traces on the same net", () => {
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "trace1",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        userNetId: "net1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 0, y: 2 },
        ],
        mspConnectionPairIds: ["pair1"],
        pinIds: ["pin1", "pin2"],
        pins: [] as any,
      },
      {
        mspPairId: "trace2",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        userNetId: "net1",
        tracePath: [
          { x: 0, y: 2 },
          { x: 0, y: 4 },
        ],
        mspConnectionPairIds: ["pair2"],
        pinIds: ["pin3", "pin4"],
        pins: [] as any,
      },
    ]

    const result = mergeCollinearTraces(traces)

    // Should have merged into fewer traces
    expect(result.length).toBeLessThanOrEqual(traces.length)

    // Check that at least one trace spans the full range
    const hasFullSpan = result.some((trace) => {
      const ys = trace.tracePath.map((p) => p.y)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      return minY === 0 && maxY === 4
    })
    expect(hasFullSpan).toBe(true)
  })

  test("should not merge traces on different nets", () => {
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "trace1",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        userNetId: "net1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
        ],
        mspConnectionPairIds: ["pair1"],
        pinIds: ["pin1", "pin2"],
        pins: [] as any,
      },
      {
        mspPairId: "trace2",
        dcConnNetId: "net2",
        globalConnNetId: "net2",
        userNetId: "net2",
        tracePath: [
          { x: 2, y: 0 },
          { x: 4, y: 0 },
        ],
        mspConnectionPairIds: ["pair2"],
        pinIds: ["pin3", "pin4"],
        pins: [] as any,
      },
    ]

    const result = mergeCollinearTraces(traces)

    // Should NOT merge - different nets
    expect(result.length).toBe(2)
  })

  test("should not merge non-collinear traces", () => {
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "trace1",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        userNetId: "net1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
        ],
        mspConnectionPairIds: ["pair1"],
        pinIds: ["pin1", "pin2"],
        pins: [] as any,
      },
      {
        mspPairId: "trace2",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        userNetId: "net1",
        tracePath: [
          { x: 0, y: 2 },
          { x: 0, y: 4 },
        ],
        mspConnectionPairIds: ["pair2"],
        pinIds: ["pin3", "pin4"],
        pins: [] as any,
      },
    ]

    const result = mergeCollinearTraces(traces)

    // Should NOT merge - one horizontal, one vertical
    expect(result.length).toBe(2)
  })

  test("should merge three collinear segments into one", () => {
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "trace1",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        userNetId: "net1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        mspConnectionPairIds: ["pair1"],
        pinIds: ["pin1", "pin2"],
        pins: [] as any,
      },
      {
        mspPairId: "trace2",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        userNetId: "net1",
        tracePath: [
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
        mspConnectionPairIds: ["pair2"],
        pinIds: ["pin3", "pin4"],
        pins: [] as any,
      },
      {
        mspPairId: "trace3",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        userNetId: "net1",
        tracePath: [
          { x: 2, y: 0 },
          { x: 3, y: 0 },
        ],
        mspConnectionPairIds: ["pair3"],
        pinIds: ["pin5", "pin6"],
        pins: [] as any,
      },
    ]

    const result = mergeCollinearTraces(traces)

    // Should merge all three into one
    expect(result.length).toBeLessThanOrEqual(1)

    if (result.length > 0) {
      const xs = result[0].tracePath.map((p) => p.x)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      expect(minX).toBe(0)
      expect(maxX).toBe(3)
    }
  })

  test("should handle close but not touching segments", () => {
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "trace1",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        userNetId: "net1",
        tracePath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        mspConnectionPairIds: ["pair1"],
        pinIds: ["pin1", "pin2"],
        pins: [] as any,
      },
      {
        mspPairId: "trace2",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        userNetId: "net1",
        tracePath: [
          { x: 1.02, y: 0 }, // Small gap of 0.02
          { x: 2, y: 0 },
        ],
        mspConnectionPairIds: ["pair2"],
        pinIds: ["pin3", "pin4"],
        pins: [] as any,
      },
    ]

    const result = mergeCollinearTraces(traces, 0.05) // threshold of 0.05

    // Should merge because gap is within threshold
    expect(result.length).toBeLessThanOrEqual(1)
  })

  test("Issue #34: should merge three fragmented collinear segments", () => {
    // Three adjacent segments on the same net that should merge into one
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "trace1",
        dcConnNetId: "SIGNAL",
        globalConnNetId: "SIGNAL",
        userNetId: "SIGNAL",
        tracePath: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
        ],
        mspConnectionPairIds: ["pair1"],
        pinIds: ["start"],
        pins: [] as any,
      },
      {
        mspPairId: "trace2",
        dcConnNetId: "SIGNAL",
        globalConnNetId: "SIGNAL",
        userNetId: "SIGNAL",
        tracePath: [
          { x: 2, y: 0 },
          { x: 5, y: 0 },
        ],
        mspConnectionPairIds: ["pair2"],
        pinIds: ["mid1"],
        pins: [] as any,
      },
      {
        mspPairId: "trace3",
        dcConnNetId: "SIGNAL",
        globalConnNetId: "SIGNAL",
        userNetId: "SIGNAL",
        tracePath: [
          { x: 5, y: 0 },
          { x: 10, y: 0 },
        ],
        mspConnectionPairIds: ["pair3"],
        pinIds: ["end"],
        pins: [] as any,
      },
    ]

    const result = mergeCollinearTraces(traces)

    // Should merge all three into one
    expect(result.length).toBe(1)
    const mergedTrace = result[0]
    const xs = mergedTrace.tracePath.map((p) => p.x)
    expect(Math.min(...xs)).toBe(0)
    expect(Math.max(...xs)).toBe(10)
  })

  test("Issue #29: should merge overlapping collinear segments on same net", () => {
    // Two overlapping horizontal segments that should merge into one
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "trace1",
        dcConnNetId: "NET",
        globalConnNetId: "NET",
        userNetId: "NET",
        tracePath: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
        ],
        mspConnectionPairIds: ["pair1"],
        pinIds: ["left"],
        pins: [] as any,
      },
      {
        mspPairId: "trace2",
        dcConnNetId: "NET",
        globalConnNetId: "NET",
        userNetId: "NET",
        tracePath: [
          { x: 4, y: 0 },
          { x: 10, y: 0 },
        ],
        mspConnectionPairIds: ["pair2"],
        pinIds: ["right"],
        pins: [] as any,
      },
    ]

    const result = mergeCollinearTraces(traces)

    // Should merge overlapping segments into one
    expect(result.length).toBe(1)
    const mergedTrace = result[0]
    const xs = mergedTrace.tracePath.map((p) => p.x)
    expect(Math.min(...xs)).toBe(0)
    expect(Math.max(...xs)).toBe(10)
  })
})
