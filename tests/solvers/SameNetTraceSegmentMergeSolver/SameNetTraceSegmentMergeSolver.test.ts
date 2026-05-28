import { expect, test } from "bun:test"
import { SameNetTraceSegmentMergeSolver } from "lib/solvers/SameNetTraceSegmentMergeSolver/SameNetTraceSegmentMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const createTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  pins: [] as any,
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: [],
})

test("merges close parallel same-net segments onto the longer segment", () => {
  const solver = new SameNetTraceSegmentMergeSolver({
    inputProblem,
    inputTracePaths: [
      createTrace("main", "GND", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      createTrace("branch", "GND", [
        { x: 1, y: 0.4 },
        { x: 1, y: 0.12 },
        { x: 3, y: 0.12 },
        { x: 3, y: 0.4 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traceMap.branch.tracePath).toEqual([
    { x: 1, y: 0.4 },
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 0.4 },
  ])
})

test("rejects a same-net merge that would introduce a different-net intersection", () => {
  const solver = new SameNetTraceSegmentMergeSolver({
    inputProblem,
    inputTracePaths: [
      createTrace("main", "GND", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      createTrace("branch", "GND", [
        { x: 1, y: 0.4 },
        { x: 1, y: 0.12 },
        { x: 3, y: 0.12 },
        { x: 3, y: 0.4 },
      ]),
      createTrace("blocker", "SIG", [
        { x: 2, y: -0.05 },
        { x: 2, y: 0.05 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traceMap.branch.tracePath).toEqual([
    { x: 1, y: 0.4 },
    { x: 1, y: 0.12 },
    { x: 3, y: 0.12 },
    { x: 3, y: 0.4 },
  ])
})
