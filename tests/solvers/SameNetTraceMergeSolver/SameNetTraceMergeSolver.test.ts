import { expect, test, describe } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

function makeTrace(
  id: string,
  netId: string,
  path: Array<{ x: number; y: number }>,
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    userNetId: undefined,
    pins: [] as any,
    tracePath: path,
    mspConnectionPairIds: [id],
    pinIds: [],
  }
}

describe("SameNetTraceMergeSolver", () => {
  test("merges two collinear same-net traces with touching endpoints", () => {
    const t1 = makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
    const t2 = makeTrace("t2", "net1", [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ])
    const solver = new SameNetTraceMergeSolver({ traces: [t1, t2] })
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.solved).toBe(true)
    expect(solver.outputTraces.length).toBe(1)
    expect(solver.mergeCount).toBe(1)
    expect(solver.outputTraces[0]!.tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ])
  })

  test("merges traces with a small gap within maxEndpointGap", () => {
    const t1 = makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
    const t2 = makeTrace("t2", "net1", [
      { x: 1.1, y: 0 },
      { x: 2, y: 0 },
    ])
    const solver = new SameNetTraceMergeSolver({
      traces: [t1, t2],
      maxEndpointGap: 0.15,
    })
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(1)
  })

  test("does NOT merge traces from different nets", () => {
    const t1 = makeTrace("t1", "netA", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
    const t2 = makeTrace("t2", "netB", [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ])
    const solver = new SameNetTraceMergeSolver({ traces: [t1, t2] })
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(2)
    expect(solver.mergeCount).toBe(0)
  })

  test("does NOT merge when gap exceeds maxEndpointGap", () => {
    const t1 = makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
    const t2 = makeTrace("t2", "net1", [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ])
    const solver = new SameNetTraceMergeSolver({
      traces: [t1, t2],
      maxEndpointGap: 0.12,
    })
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(2)
  })

  test("inserts L-bridge when endpoints are not axis-aligned", () => {
    const t1 = makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
    const t2 = makeTrace("t2", "net1", [
      { x: 1.05, y: 0.05 },
      { x: 2, y: 0.05 },
    ])
    const solver = new SameNetTraceMergeSolver({
      traces: [t1, t2],
      maxEndpointGap: 0.15,
    })
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(1)
    // Bridge point should exist between the two paths
    const path = solver.outputTraces[0]!.tracePath
    expect(path.length).toBeGreaterThan(3)
  })

  test("merges multiple traces in the same net iteratively", () => {
    const t1 = makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
    const t2 = makeTrace("t2", "net1", [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ])
    const t3 = makeTrace("t3", "net1", [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ])
    const solver = new SameNetTraceMergeSolver({ traces: [t1, t2, t3] })
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(1)
    expect(solver.mergeCount).toBe(2)
  })

  test("leaves single-trace nets unchanged", () => {
    const t1 = makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
    const solver = new SameNetTraceMergeSolver({ traces: [t1] })
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(1)
    expect(solver.mergeCount).toBe(0)
  })

  test("handles reversed endpoint matching (end-to-end)", () => {
    const t1 = makeTrace("t1", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
    const t2 = makeTrace("t2", "net1", [
      { x: 2, y: 0 },
      { x: 1, y: 0 },
    ])
    const solver = new SameNetTraceMergeSolver({ traces: [t1, t2] })
    while (!solver.solved && !solver.failed) solver.step()
    expect(solver.outputTraces.length).toBe(1)
  })
})
