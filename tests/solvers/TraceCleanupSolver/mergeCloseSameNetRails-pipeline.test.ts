import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import type { InputProblem } from "lib/types/InputProblem"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: { x: number; y: number }[],
): SolvedTracePath =>
  ({
    mspPairId,
    globalConnNetId,
    dcConnNetId: mspPairId,
    userNetId: globalConnNetId.toUpperCase(),
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
  }) as unknown as SolvedTracePath

const emptyProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  textBoxes: [],
  availableNetLabelOrientations: {},
}

/**
 * Verifies that the `merging_close_same_net_rails` operation is actually wired
 * into the TraceCleanupSolver pipeline (not dead code). Two same-net traces with
 * close parallel horizontal rails (y=2.0 and y=2.1) should be snapped onto a
 * shared Y coordinate after the solver runs.
 */
test("TraceCleanupSolver merges close same-net rails via pipeline operation", () => {
  const traces = [
    makeTrace("t1", "netA", [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 0 },
    ]),
    makeTrace("t2", "netA", [
      { x: 0, y: 0 },
      { x: 0, y: 2.1 },
      { x: 4, y: 2.1 },
      { x: 4, y: 0 },
    ]),
  ]

  const solver = new TraceCleanupSolver({
    inputProblem: emptyProblem,
    allTraces: traces,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
    operations: ["merging_close_same_net_rails"],
  })
  solver.solve()

  const output = solver.getOutput().traces
  const y1 = output[0]!.tracePath[1]!.y
  const y2 = output[1]!.tracePath[1]!.y
  expect(y1).toBe(y2)
  expect(y1).toBeCloseTo(2.05, 5)
  expect(solver.stats.mergedCloseRailGroupCount).toBe(1)
  expect(solver.stats.mergedCloseTraceCount).toBe(2)
})

test("TraceCleanupSolver leaves different-net close rails untouched", () => {
  const traces = [
    makeTrace("t1", "netA", [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 0 },
    ]),
    makeTrace("t2", "netB", [
      { x: 0, y: 0 },
      { x: 0, y: 2.1 },
      { x: 4, y: 2.1 },
      { x: 4, y: 0 },
    ]),
  ]

  const solver = new TraceCleanupSolver({
    inputProblem: emptyProblem,
    allTraces: traces,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
    operations: ["merging_close_same_net_rails"],
  })
  solver.solve()

  const output = solver.getOutput().traces
  expect(output[0]!.tracePath[1]!.y).toBe(2)
  expect(output[1]!.tracePath[1]!.y).toBe(2.1)
  expect(solver.stats.mergedCloseRailGroupCount ?? 0).toBe(0)
})
