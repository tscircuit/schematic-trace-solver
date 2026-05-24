import { expect, test } from "bun:test"
import { TraceCombineSolver } from "lib/solvers/TraceCombineSolver/TraceCombineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const trace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    userNetId: globalConnNetId,
    pins: [],
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    tracePath,
  }) as unknown as SolvedTracePath

test("TraceCombineSolver snaps close same-net internal segments together", () => {
  const solver = new TraceCombineSolver({
    inputProblem,
    inputTraces: [
      trace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      trace("b", "net1", [
        { x: 0, y: 0.08 },
        { x: 0, y: 1.08 },
        { x: 4, y: 1.08 },
        { x: 4, y: 0.08 },
      ]),
    ],
  })

  solver.solve()

  const [first, second] = solver.getOutput().traces
  expect(solver.stats.combinedSegmentCount).toBe(1)
  expect(first!.tracePath[1]!.y).toBe(1)
  expect(first!.tracePath[2]!.y).toBe(1)
  expect(second!.tracePath[1]!.y).toBe(1)
  expect(second!.tracePath[2]!.y).toBe(1)
})

test("TraceCombineSolver does not snap close segments from different nets", () => {
  const solver = new TraceCombineSolver({
    inputProblem,
    inputTraces: [
      trace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      trace("b", "net2", [
        { x: 0, y: 0.08 },
        { x: 0, y: 1.08 },
        { x: 4, y: 1.08 },
        { x: 4, y: 0.08 },
      ]),
    ],
  })

  solver.solve()

  const second = solver.getOutput().traces[1]!
  expect(solver.stats.combinedSegmentCount).toBe(0)
  expect(second.tracePath[1]!.y).toBe(1.08)
  expect(second.tracePath[2]!.y).toBe(1.08)
})
