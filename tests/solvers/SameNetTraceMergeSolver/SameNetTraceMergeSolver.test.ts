import { test, expect } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

function makeTrace(
  id: string,
  netId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    userNetId: undefined,
    pins: [] as any,
    tracePath,
    mspConnectionPairIds: [id],
    pinIds: [`${id}-p1`, `${id}-p2`],
  }
}

test("merges two same-net traces with close endpoints", () => {
  const traceA = makeTrace("a", "net1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
  const traceB = makeTrace("b", "net1", [
    { x: 1.05, y: 0 },
    { x: 2, y: 0 },
  ])

  const solver = new SameNetTraceMergeSolver({
    traces: [traceA, traceB],
    maxEndpointGap: 0.12,
  })
  solver.solve()

  const { traces } = solver.getOutput()
  expect(traces.length).toBe(1)
  expect(traces[0]!.tracePath.length).toBeGreaterThanOrEqual(2)
  expect(traces[0]!.mspConnectionPairIds).toContain("a")
  expect(traces[0]!.mspConnectionPairIds).toContain("b")
})

test("does not merge traces from different nets", () => {
  const traceA = makeTrace("a", "net1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
  const traceB = makeTrace("b", "net2", [
    { x: 1.05, y: 0 },
    { x: 2, y: 0 },
  ])

  const solver = new SameNetTraceMergeSolver({
    traces: [traceA, traceB],
    maxEndpointGap: 0.12,
  })
  solver.solve()

  const { traces } = solver.getOutput()
  expect(traces.length).toBe(2)
})

test("does not merge same-net traces whose endpoints are too far apart", () => {
  const traceA = makeTrace("a", "net1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
  const traceB = makeTrace("b", "net1", [
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ])

  const solver = new SameNetTraceMergeSolver({
    traces: [traceA, traceB],
    maxEndpointGap: 0.12,
  })
  solver.solve()

  const { traces } = solver.getOutput()
  expect(traces.length).toBe(2)
})

test("merges three same-net traces into one", () => {
  const traceA = makeTrace("a", "net1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ])
  const traceB = makeTrace("b", "net1", [
    { x: 1.05, y: 0 },
    { x: 2, y: 0 },
  ])
  const traceC = makeTrace("c", "net1", [
    { x: 2.08, y: 0 },
    { x: 3, y: 0 },
  ])

  const solver = new SameNetTraceMergeSolver({
    traces: [traceA, traceB, traceC],
    maxEndpointGap: 0.12,
  })
  solver.solve()

  const { traces } = solver.getOutput()
  expect(traces.length).toBe(1)
})
