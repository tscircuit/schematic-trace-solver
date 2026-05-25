import { describe, expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetSegments"

const trace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [] as any,
  }) as SolvedTracePath

describe("alignNearbySameNetSegments", () => {
  test("aligns close overlapping horizontal segments on the same net", () => {
    const [anchor, moved] = alignNearbySameNetSegments([
      trace("a", "net1", [
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2 },
      ]),
      trace("b", "net1", [
        { x: 2, y: -2 },
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: 2 },
      ]),
    ])

    expect(anchor.tracePath[1].y).toBe(0)
    expect(anchor.tracePath[2].y).toBe(0)
    expect(moved.tracePath[1].y).toBe(0)
    expect(moved.tracePath[2].y).toBe(0)
  })

  test("aligns close overlapping vertical segments on the same net", () => {
    const [, moved] = alignNearbySameNetSegments([
      trace("a", "net1", [
        { x: -2, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 10 },
        { x: 2, y: 10 },
      ]),
      trace("b", "net1", [
        { x: -2, y: 2 },
        { x: 0.08, y: 2 },
        { x: 0.08, y: 8 },
        { x: 2, y: 8 },
      ]),
    ])

    expect(moved.tracePath[1].x).toBe(0)
    expect(moved.tracePath[2].x).toBe(0)
  })

  test("does not move endpoint-only segments", () => {
    const [, endpointTrace] = alignNearbySameNetSegments([
      trace("a", "net1", [
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2 },
      ]),
      trace("b", "net1", [
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: 2 },
      ]),
    ])

    expect(endpointTrace.tracePath[0].y).toBe(0.08)
    expect(endpointTrace.tracePath[1].y).toBe(0.08)
  })

  test("does not align different nets", () => {
    const [, otherNet] = alignNearbySameNetSegments([
      trace("a", "net1", [
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2 },
      ]),
      trace("b", "net2", [
        { x: 2, y: -2 },
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: 2 },
      ]),
    ])

    expect(otherNet.tracePath[1].y).toBe(0.08)
    expect(otherNet.tracePath[2].y).toBe(0.08)
  })

  test("rejects alignments that would collide with a different net", () => {
    const [, blockedTrace] = alignNearbySameNetSegments([
      trace("a", "net1", [
        { x: 0, y: -2 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2 },
      ]),
      trace("b", "net1", [
        { x: 2, y: -2 },
        { x: 2, y: 0.08 },
        { x: 8, y: 0.08 },
        { x: 8, y: 2 },
      ]),
      trace("c", "net2", [
        { x: 5, y: -0.02 },
        { x: 5, y: 0.02 },
      ]),
    ])

    expect(blockedTrace.tracePath[1].y).toBe(0.08)
    expect(blockedTrace.tracePath[2].y).toBe(0.08)
  })
})
