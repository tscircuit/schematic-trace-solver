import { expect, test } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
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
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  pins: [
    {
      pinId: `${mspPairId}.1`,
      chipId: "U1",
      x: tracePath[0]!.x,
      y: tracePath[0]!.y,
    },
    {
      pinId: `${mspPairId}.2`,
      chipId: "U2",
      x: tracePath[tracePath.length - 1]!.x,
      y: tracePath[tracePath.length - 1]!.y,
    },
  ],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
})

test("aligns close horizontal same-net internal segments", () => {
  const fixedAxisTrace = makeTrace("a", "VCC", [
    { x: 0, y: -1 },
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: -1 },
  ])
  const closeTrace = makeTrace("b", "VCC", [
    { x: 0, y: 1 },
    { x: 0, y: 0.1 },
    { x: 4, y: 0.1 },
    { x: 4, y: 1 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    inputTracePaths: [fixedAxisTrace, closeTrace],
  })
  solver.solve()

  expect(solver.stats.alignedSegments).toBe(1)
  expect(solver.correctedTraceMap.b!.tracePath[1]!.y).toBe(0)
  expect(solver.correctedTraceMap.b!.tracePath[2]!.y).toBe(0)
})

test("aligns close vertical same-net internal segments", () => {
  const fixedAxisTrace = makeTrace("a", "GND", [
    { x: -1, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 4 },
    { x: -1, y: 4 },
  ])
  const closeTrace = makeTrace("b", "GND", [
    { x: 1, y: 0 },
    { x: 0.1, y: 0 },
    { x: 0.1, y: 4 },
    { x: 1, y: 4 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    inputTracePaths: [fixedAxisTrace, closeTrace],
  })
  solver.solve()

  expect(solver.stats.alignedSegments).toBe(1)
  expect(solver.correctedTraceMap.b!.tracePath[1]!.x).toBe(0)
  expect(solver.correctedTraceMap.b!.tracePath[2]!.x).toBe(0)
})

test("does not align close segments from different nets", () => {
  const firstTrace = makeTrace("a", "VCC", [
    { x: 0, y: -1 },
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: -1 },
  ])
  const otherNetTrace = makeTrace("b", "GND", [
    { x: 0, y: 1 },
    { x: 0, y: 0.1 },
    { x: 4, y: 0.1 },
    { x: 4, y: 1 },
  ])

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    inputTracePaths: [firstTrace, otherNetTrace],
  })
  solver.solve()

  expect(solver.stats.alignedSegments).toBe(0)
  expect(solver.correctedTraceMap.b!.tracePath[1]!.y).toBe(0.1)
  expect(solver.correctedTraceMap.b!.tracePath[2]!.y).toBe(0.1)
})
