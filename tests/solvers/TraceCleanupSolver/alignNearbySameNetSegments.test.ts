import { expect, test } from "bun:test"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import { alignNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "obs-a",
      center: { x: 3, y: 0 },
      width: 2,
      height: 0.6,
      pins: [],
    },
    {
      chipId: "obs-b",
      center: { x: 3, y: 2 },
      width: 2,
      height: 0.6,
      pins: [],
    },
  ],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const emptyInputProblem: InputProblem = {
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
  pins: [
    {
      pinId: `${mspPairId}-a`,
      chipId: "chip",
      x: tracePath[0]!.x,
      y: tracePath[0]!.y,
    },
    {
      pinId: `${mspPairId}-b`,
      chipId: "chip",
      x: tracePath.at(-1)!.x,
      y: tracePath.at(-1)!.y,
    },
  ],
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}-a`, `${mspPairId}-b`],
  tracePath,
})

const solveCleanup = (traces: SolvedTracePath[]) => {
  const solver = new TraceCleanupSolver({
    inputProblem,
    allTraces: traces,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
  })
  solver.solve()
  return solver.getOutput().traces
}

test("aligns close overlapping internal same-net horizontal segments while preserving endpoints", () => {
  const [lowerTrace, upperTrace] = solveCleanup([
    makeTrace("a", "net-1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 0 },
      { x: 6, y: 0 },
    ]),
    makeTrace("b", "net-1", [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 1.1 },
      { x: 5, y: 1.1 },
      { x: 5, y: 2 },
      { x: 6, y: 2 },
    ]),
  ])

  expect(lowerTrace!.tracePath[2]!.y).toBe(1)
  expect(lowerTrace!.tracePath[3]!.y).toBe(1)
  expect(upperTrace!.tracePath[0]).toEqual({ x: 0, y: 2 })
  expect(upperTrace!.tracePath.at(-1)).toEqual({ x: 6, y: 2 })
  expect(upperTrace!.tracePath[2]!.y).toBe(1)
  expect(upperTrace!.tracePath[3]!.y).toBe(1)
})

test("does not align close segments from different nets", () => {
  const [, otherNetTrace] = solveCleanup([
    makeTrace("a", "net-1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 0 },
      { x: 6, y: 0 },
    ]),
    makeTrace("b", "net-2", [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 1.1 },
      { x: 5, y: 1.1 },
      { x: 5, y: 2 },
      { x: 6, y: 2 },
    ]),
  ])

  expect(otherNetTrace!.tracePath[2]!.y).toBe(1.1)
  expect(otherNetTrace!.tracePath[3]!.y).toBe(1.1)
})

test("does not align when the move would touch a different-net endpoint", () => {
  const [, blockedTrace] = alignNearbySameNetSegments({
    inputProblem: emptyInputProblem,
    traces: [
      makeTrace("a", "net-1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
        { x: 5, y: 0 },
      ]),
      makeTrace("b", "net-1", [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 1.1 },
        { x: 5, y: 1.1 },
        { x: 5, y: 2 },
        { x: 6, y: 2 },
      ]),
      makeTrace("c", "net-2", [
        { x: 4.5, y: 0.5 },
        { x: 4.5, y: 1 },
      ]),
    ],
  })

  expect(blockedTrace!.tracePath[2]!.y).toBe(1.1)
  expect(blockedTrace!.tracePath[3]!.y).toBe(1.1)
})
