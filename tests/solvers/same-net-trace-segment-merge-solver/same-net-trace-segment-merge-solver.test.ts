import { expect, test } from "bun:test"
import { SameNetTraceSegmentMergeSolver } from "lib/solvers/SameNetTraceSegmentMergeSolver/SameNetTraceSegmentMergeSolver"

const makeTrace = (
  id: string,
  net: string,
  tracePath: Array<{ x: number; y: number }>,
) => ({
  mspPairId: id,
  dcConnNetId: net,
  globalConnNetId: net,
  pins: [] as any,
  mspConnectionPairIds: [id],
  pinIds: [`${id}-a`, `${id}-b`],
  tracePath,
})

test("merges same-net trace paths with nearby endpoints", () => {
  const solver = new SameNetTraceSegmentMergeSolver({
    maxEndpointGap: 0.12,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 1.05, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("c", "net2", [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ]),
    ],
  })

  solver.solve()
  const output = solver.getOutput().traces

  expect(output).toHaveLength(2)
  const merged = output.find((trace) => trace.globalConnNetId === "net1")!
  expect(merged.mspConnectionPairIds).toEqual(["a", "b"])
  expect(merged.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
})

test("merges close overlapping same-net parallel segments onto one axis", () => {
  const solver = new SameNetTraceSegmentMergeSolver({
    maxEndpointGap: 0.12,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 0, y: 0.05 },
        { x: 2, y: 0.05 },
      ]),
    ],
  })

  solver.solve()
  const output = solver.getOutput().traces

  expect(output).toHaveLength(1)
  expect(output[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  expect(output[0]!.mspConnectionPairIds).toEqual(["a", "b"])
})

test("does not merge different-net traces even when endpoints are close", () => {
  const solver = new SameNetTraceSegmentMergeSolver({
    maxEndpointGap: 0.12,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "net2", [
        { x: 1.05, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
  })

  solver.solve()
  expect(solver.getOutput().traces).toHaveLength(2)
})
