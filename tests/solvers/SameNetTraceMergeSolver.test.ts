import { expect, test } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

function makeTrace(
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath {
  return {
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [
      { chipId: "U1", pinId: `${mspPairId}.1`, x: 0, y: 0 },
      { chipId: "U1", pinId: `${mspPairId}.2`, x: 1, y: 1 },
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
  }
}

test("snaps close overlapping same-net horizontal internal segments", () => {
  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    inputTraces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 0.5, y: 2 },
        { x: 0.5, y: 1.08 },
        { x: 2.5, y: 1.08 },
        { x: 2.5, y: 2 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.outputTraceMap.a!.tracePath[1]!.y).toBeCloseTo(1.04)
  expect(solver.outputTraceMap.a!.tracePath[2]!.y).toBeCloseTo(1.04)
  expect(solver.outputTraceMap.b!.tracePath[1]!.y).toBeCloseTo(1.04)
  expect(solver.outputTraceMap.b!.tracePath[2]!.y).toBeCloseTo(1.04)
  expect(solver.mergedSegments).toHaveLength(1)
})

test("does not snap close segments from different nets", () => {
  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    inputTraces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 0 },
      ]),
      makeTrace("b", "net2", [
        { x: 0.5, y: 2 },
        { x: 0.5, y: 1.08 },
        { x: 2.5, y: 1.08 },
        { x: 2.5, y: 2 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.outputTraceMap.a!.tracePath[1]!.y).toBe(1)
  expect(solver.outputTraceMap.b!.tracePath[1]!.y).toBe(1.08)
  expect(solver.mergedSegments).toHaveLength(0)
})
