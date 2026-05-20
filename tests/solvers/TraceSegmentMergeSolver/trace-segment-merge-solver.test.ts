import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceSegmentMergeSolver } from "lib/solvers/TraceSegmentMergeSolver/TraceSegmentMergeSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  userNetId: globalConnNetId,
  pins: [
    { pinId: `${mspPairId}.start`, chipId: "chip-start", x: 0, y: 0 },
    { pinId: `${mspPairId}.end`, chipId: "chip-end", x: 0, y: 0 },
  ],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}.start`, `${mspPairId}.end`],
})

test("TraceSegmentMergeSolver snaps close same-net parallel segments together", () => {
  const solver = new TraceSegmentMergeSolver({
    inputProblem,
    inputTracePaths: [
      makeTrace("a", "net-1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "net-1", [
        { x: 1, y: 3 },
        { x: 1, y: 1.06 },
        { x: 3, y: 1.06 },
        { x: 3, y: 3 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 1, y: 3 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 3 },
  ])
})

test("TraceSegmentMergeSolver keeps close segments on different nets separate", () => {
  const solver = new TraceSegmentMergeSolver({
    inputProblem,
    inputTracePaths: [
      makeTrace("a", "net-1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "net-2", [
        { x: 1, y: 3 },
        { x: 1, y: 1.06 },
        { x: 3, y: 1.06 },
        { x: 3, y: 3 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 1, y: 3 },
    { x: 1, y: 1.06 },
    { x: 3, y: 1.06 },
    { x: 3, y: 3 },
  ])
})
