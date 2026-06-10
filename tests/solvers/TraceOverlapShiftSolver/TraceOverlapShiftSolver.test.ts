import { expect, test } from "bun:test"
import { TraceOverlapShiftSolver } from "lib/solvers/TraceOverlapShiftSolver/TraceOverlapShiftSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [],
    tracePath,
  }) as unknown as SolvedTracePath

const solveTraceOverlapShift = (inputTracePaths: SolvedTracePath[]) => {
  const solver = new TraceOverlapShiftSolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    inputTracePaths,
    globalConnMap: {} as any,
  })
  solver.solve()
  expect(solver.failed).toBe(false)
  return solver.correctedTraceMap
}

test("aligns close same-net horizontal trace segments", () => {
  const correctedTraceMap = solveTraceOverlapShift([
    makeTrace("trunk", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("branch", "net1", [
      { x: 0.5, y: -0.5 },
      { x: 0.5, y: 0.08 },
      { x: 1.5, y: 0.08 },
      { x: 1.5, y: 0.6 },
    ]),
  ])

  expect(correctedTraceMap.branch!.tracePath).toEqual([
    { x: 0.5, y: -0.5 },
    { x: 0.5, y: 0 },
    { x: 1.5, y: 0 },
    { x: 1.5, y: 0.6 },
  ])
})

test("aligns close same-net vertical trace segments", () => {
  const correctedTraceMap = solveTraceOverlapShift([
    makeTrace("trunk", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
    ]),
    makeTrace("branch", "net1", [
      { x: -0.5, y: 0.5 },
      { x: 0.08, y: 0.5 },
      { x: 0.08, y: 1.5 },
      { x: -0.5, y: 1.5 },
    ]),
  ])

  expect(correctedTraceMap.branch!.tracePath).toEqual([
    { x: -0.5, y: 0.5 },
    { x: 0, y: 0.5 },
    { x: 0, y: 1.5 },
    { x: -0.5, y: 1.5 },
  ])
})

test("does not align close trace segments from different nets", () => {
  const correctedTraceMap = solveTraceOverlapShift([
    makeTrace("trunk", "net1", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ]),
    makeTrace("branch", "net2", [
      { x: 0.5, y: -0.5 },
      { x: 0.5, y: 0.08 },
      { x: 1.5, y: 0.08 },
      { x: 1.5, y: 0.6 },
    ]),
  ])

  expect(correctedTraceMap.branch!.tracePath).toEqual([
    { x: 0.5, y: -0.5 },
    { x: 0.5, y: 0.08 },
    { x: 1.5, y: 0.08 },
    { x: 1.5, y: 0.6 },
  ])
})
