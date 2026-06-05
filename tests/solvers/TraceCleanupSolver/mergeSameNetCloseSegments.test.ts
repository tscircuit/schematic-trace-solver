import { expect, test } from "bun:test"
import { mergeSameNetCloseSegments } from "lib/solvers/TraceCleanupSolver/mergeSameNetCloseSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    dcConnNetId: globalConnNetId,
    pins: [],
    pinIds: [],
    mspConnectionPairIds: [mspPairId],
    tracePath,
  }) as any

test("mergeSameNetCloseSegments aligns close parallel segments on the same net", () => {
  const [longTrace, shortTrace] = mergeSameNetCloseSegments(
    [
      makeTrace("msp1", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
      ]),
      makeTrace("msp2", "net1", [
        { x: 0, y: 2 },
        { x: 1, y: 0.08 },
        { x: 4, y: 0.08 },
        { x: 4, y: 3 },
      ]),
    ],
    { tolerance: 0.12 },
  )

  expect(longTrace!.tracePath[1]!.y).toBe(0)
  expect(longTrace!.tracePath[2]!.y).toBe(0)
  expect(shortTrace!.tracePath[1]!.y).toBe(0)
  expect(shortTrace!.tracePath[2]!.y).toBe(0)
})

test("mergeSameNetCloseSegments does not align different nets", () => {
  const [traceA, traceB] = mergeSameNetCloseSegments(
    [
      makeTrace("msp1", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
      ]),
      makeTrace("msp2", "net2", [
        { x: 0, y: 2 },
        { x: 1, y: 0.08 },
        { x: 4, y: 0.08 },
        { x: 4, y: 3 },
      ]),
    ],
    { tolerance: 0.12 },
  )

  expect(traceA!.tracePath[1]!.y).toBe(0)
  expect(traceB!.tracePath[1]!.y).toBe(0.08)
})
