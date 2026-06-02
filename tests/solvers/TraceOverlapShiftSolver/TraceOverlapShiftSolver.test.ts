import { expect, test } from "bun:test"
import { TraceOverlapShiftSolver } from "lib/solvers/TraceOverlapShiftSolver/TraceOverlapShiftSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = ({
  mspPairId,
  globalConnNetId,
  tracePath,
}: {
  mspPairId: string
  globalConnNetId: string
  tracePath: SolvedTracePath["tracePath"]
}): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  pins: [
    { pinId: `${mspPairId}.1`, chipId: "chip", x: 0, y: 0 },
    { pinId: `${mspPairId}.2`, chipId: "chip", x: 1, y: 0 },
  ],
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
  tracePath,
})

test("TraceOverlapShiftSolver chooses the offset direction with fewer crossings", () => {
  const upperTrace = makeTrace({
    mspPairId: "upper",
    globalConnNetId: "upper-net",
    tracePath: [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 1 },
    ],
  })

  const lowerTrace = makeTrace({
    mspPairId: "lower",
    globalConnNetId: "lower-net",
    tracePath: [
      { x: 0, y: -1 },
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: -1 },
    ],
  })

  const solver = new TraceOverlapShiftSolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    inputTracePaths: [upperTrace, lowerTrace],
    globalConnMap: {} as any,
  })

  solver.solve()

  expect(solver.correctedTraceMap.upper.tracePath[1]!.y).toBeGreaterThan(0)
  expect(solver.correctedTraceMap.upper.tracePath[2]!.y).toBeGreaterThan(0)
  expect(solver.correctedTraceMap.lower.tracePath[1]!.y).toBeLessThan(0)
  expect(solver.correctedTraceMap.lower.tracePath[2]!.y).toBeLessThan(0)
})
