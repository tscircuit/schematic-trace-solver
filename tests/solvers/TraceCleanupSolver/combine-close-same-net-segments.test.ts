import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { combineCloseSameNetSegments } from "lib/solvers/TraceCleanupSolver/combineCloseSameNetSegments"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"

const trace = (
  id: string,
  net: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId: id,
    globalConnNetId: net,
    tracePath,
    mspConnectionPairIds: [id],
    pinIds: [`${id}.a`, `${id}.b`],
    pins: [],
  }) as any

test("aligns close overlapping same-net internal horizontal segments", () => {
  const traces = combineCloseSameNetSegments([
    trace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    trace("b", "net1", [
      { x: 0, y: 3 },
      { x: 0, y: 1.1 },
      { x: 4, y: 1.1 },
      { x: 4, y: 3 },
    ]),
  ])

  expect(traces[1]!.tracePath).toEqual([
    { x: 0, y: 3 },
    { x: 0, y: 1 },
    { x: 4, y: 1 },
    { x: 4, y: 3 },
  ])
})

test("TraceCleanupSolver runs close same-net segment combining as a cleanup phase", () => {
  const solver = new TraceCleanupSolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    allTraces: [
      trace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      trace("b", "net1", [
        { x: 0, y: 3 },
        { x: 0, y: 1.1 },
        { x: 4, y: 1.1 },
        { x: 4, y: 3 },
      ]),
    ],
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
  })

  solver.solve()

  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 0, y: 3 },
    { x: 0, y: 1 },
    { x: 4, y: 1 },
    { x: 4, y: 3 },
  ])
})

test("does not align close segments from different nets", () => {
  const traces = combineCloseSameNetSegments([
    trace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    trace("b", "net2", [
      { x: 0, y: 3 },
      { x: 0, y: 1.1 },
      { x: 4, y: 1.1 },
      { x: 4, y: 3 },
    ]),
  ])

  expect(traces[1]!.tracePath[1]!.y).toBe(1.1)
  expect(traces[1]!.tracePath[2]!.y).toBe(1.1)
})

test("keeps endpoint segments fixed", () => {
  const traces = combineCloseSameNetSegments([
    trace("a", "net1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    trace("b", "net1", [
      { x: 0, y: 0.1 },
      { x: 4, y: 0.1 },
    ]),
  ])

  expect(traces[1]!.tracePath).toEqual([
    { x: 0, y: 0.1 },
    { x: 4, y: 0.1 },
  ])
})

test("rejects moves that introduce a different-net intersection", () => {
  const traces = combineCloseSameNetSegments([
    trace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    trace("b", "net1", [
      { x: 0, y: 3 },
      { x: 0, y: 1.1 },
      { x: 4, y: 1.1 },
      { x: 4, y: 3 },
    ]),
    trace("blocker", "net2", [
      { x: 2, y: 0.5 },
      { x: 2, y: 1.05 },
    ]),
  ])

  expect(traces[1]!.tracePath[1]!.y).toBe(1.1)
  expect(traces[1]!.tracePath[2]!.y).toBe(1.1)
})
