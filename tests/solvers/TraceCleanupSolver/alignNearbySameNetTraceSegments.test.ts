import { describe, expect, test } from "bun:test"
import { alignNearbySameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetTraceSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  id: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    userNetId: globalConnNetId,
    tracePath,
    mspConnectionPairIds: [id],
    pinIds: [`${id}-a`, `${id}-b`],
    pins: [
      { pinId: `${id}-a`, chipId: `${id}-chip-a`, ...tracePath[0]! },
      {
        pinId: `${id}-b`,
        chipId: `${id}-chip-b`,
        ...tracePath[tracePath.length - 1]!,
      },
    ],
  }) as SolvedTracePath

describe("alignNearbySameNetTraceSegments", () => {
  test("aligns nearby overlapping horizontal internal segments on the same net", () => {
    const traces = alignNearbySameNetTraceSegments({
      traces: [
        makeTrace("a", "net1", [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 5, y: 1 },
          { x: 5, y: 0 },
          { x: 6, y: 0 },
        ]),
        makeTrace("b", "net1", [
          { x: 0, y: 0.1 },
          { x: 1, y: 0.1 },
          { x: 1, y: 1.08 },
          { x: 5, y: 1.08 },
          { x: 5, y: 0.1 },
          { x: 6, y: 0.1 },
        ]),
      ],
    })

    expect(traces[1]!.tracePath[2]!.y).toBe(1)
    expect(traces[1]!.tracePath[3]!.y).toBe(1)
    expect(traces[1]!.tracePath[0]!.y).toBe(0.1)
    expect(traces[1]!.tracePath.at(-1)!.y).toBe(0.1)
  })

  test("aligns nearby overlapping vertical internal segments on the same net", () => {
    const traces = alignNearbySameNetTraceSegments({
      traces: [
        makeTrace("a", "net1", [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 1, y: 1 },
          { x: 1, y: 5 },
          { x: 0, y: 5 },
          { x: 0, y: 6 },
        ]),
        makeTrace("b", "net1", [
          { x: 0.1, y: 0 },
          { x: 0.1, y: 1 },
          { x: 1.07, y: 1 },
          { x: 1.07, y: 5 },
          { x: 0.1, y: 5 },
          { x: 0.1, y: 6 },
        ]),
      ],
    })

    expect(traces[1]!.tracePath[2]!.x).toBe(1)
    expect(traces[1]!.tracePath[3]!.x).toBe(1)
    expect(traces[1]!.tracePath[0]!.x).toBe(0.1)
    expect(traces[1]!.tracePath.at(-1)!.x).toBe(0.1)
  })

  test("does not align segments from different nets", () => {
    const original = makeTrace("b", "net2", [
      { x: 0, y: 0.1 },
      { x: 1, y: 0.1 },
      { x: 1, y: 1.08 },
      { x: 5, y: 1.08 },
      { x: 5, y: 0.1 },
      { x: 6, y: 0.1 },
    ])
    const traces = alignNearbySameNetTraceSegments({
      traces: [
        makeTrace("a", "net1", [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 5, y: 1 },
          { x: 5, y: 0 },
          { x: 6, y: 0 },
        ]),
        original,
      ],
    })

    expect(traces[1]!.tracePath).toEqual(original.tracePath)
  })

  test("keeps endpoint-only segments anchored", () => {
    const original = makeTrace("b", "net1", [
      { x: 0, y: 1.08 },
      { x: 4, y: 1.08 },
      { x: 4, y: 0 },
    ])
    const traces = alignNearbySameNetTraceSegments({
      traces: [
        makeTrace("a", "net1", [
          { x: 0, y: 1 },
          { x: 4, y: 1 },
          { x: 4, y: 0 },
        ]),
        original,
      ],
    })

    expect(traces[1]!.tracePath).toEqual(original.tracePath)
  })
})
