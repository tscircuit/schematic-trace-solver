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
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [
      {
        pinId: `${mspPairId}.a`,
        chipId: "A",
        x: tracePath[0]!.x,
        y: tracePath[0]!.y,
      },
      {
        pinId: `${mspPairId}.b`,
        chipId: "B",
        x: tracePath[tracePath.length - 1]!.x,
        y: tracePath[tracePath.length - 1]!.y,
      },
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}.a`, `${mspPairId}.b`],
  }) as SolvedTracePath

test("collapses close same-net horizontal loop segments", () => {
  const solver = new SameNetTraceSegmentMergeSolver({
    inputProblem,
    inputTracePaths: [
      createTrace("trace-1", "NET_A", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: -0.1 },
        { x: 0, y: -0.1 },
        { x: 0, y: -0.4 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: -0.4 },
  ])
  expect(solver.stats.mergedSegmentCount).toBe(1)
})

test("aligns close same-net segments from separate traces without moving endpoints", () => {
  const solver = new SameNetTraceSegmentMergeSolver({
    inputProblem,
    inputTracePaths: [
      createTrace("trace-1", "NET_A", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      createTrace("trace-2", "NET_A", [
        { x: 1, y: 0.1 },
        { x: 3, y: 0.1 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().correctedTraceMap["trace-2"]!.tracePath).toEqual([
    { x: 1, y: 0.1 },
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 0.1 },
  ])
})

test("does not merge close segments from different nets", () => {
  const tracePath = [
    { x: 1, y: 0.1 },
    { x: 3, y: 0.1 },
  ]
  const solver = new SameNetTraceSegmentMergeSolver({
    inputProblem,
    inputTracePaths: [
      createTrace("trace-1", "NET_A", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      createTrace("trace-2", "NET_B", tracePath),
    ],
  })

  solver.solve()

  expect(solver.getOutput().correctedTraceMap["trace-2"]!.tracePath).toEqual(
    tracePath,
  )
  expect(solver.stats.mergedSegmentCount).toBeUndefined()
})
