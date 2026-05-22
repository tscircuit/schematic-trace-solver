import { expect, test } from "bun:test"
import {
  SameNetTraceSegmentMergeSolver,
  mergeSameNetCloseTraceSegments,
} from "lib/solvers/SameNetTraceSegmentMergeSolver/SameNetTraceSegmentMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const makeTrace = (
  mspPairId: string,
  netId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: netId,
  globalConnNetId: netId,
  userNetId: netId,
  pins: [
    { pinId: `${mspPairId}.1`, chipId: "U1", x: 0, y: 0 },
    { pinId: `${mspPairId}.2`, chipId: "U2", x: 1, y: 1 },
  ],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
})

test("mergeSameNetCloseTraceSegments aligns nearby horizontal same-net segments", () => {
  const output = mergeSameNetCloseTraceSegments(
    [
      makeTrace("a", "VCC", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 0 },
      ]),
      makeTrace("b", "VCC", [
        { x: 1, y: 0 },
        { x: 1, y: 1.12 },
        { x: 4, y: 1.12 },
        { x: 4, y: 0 },
      ]),
    ],
    0.18,
  )

  expect(output[0]!.tracePath[1]!.y).toBeCloseTo(1.045, 3)
  expect(output[0]!.tracePath[2]!.y).toBeCloseTo(1.045, 3)
  expect(output[1]!.tracePath[1]!.y).toBeCloseTo(1.045, 3)
  expect(output[1]!.tracePath[2]!.y).toBeCloseTo(1.045, 3)
})

test("mergeSameNetCloseTraceSegments does not align different nets", () => {
  const output = mergeSameNetCloseTraceSegments(
    [
      makeTrace("a", "VCC", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 5, y: 1 },
        { x: 5, y: 0 },
      ]),
      makeTrace("b", "GND", [
        { x: 1, y: 0 },
        { x: 1, y: 1.12 },
        { x: 4, y: 1.12 },
        { x: 4, y: 0 },
      ]),
    ],
    0.18,
  )

  expect(output[0]!.tracePath[1]!.y).toBe(1)
  expect(output[1]!.tracePath[1]!.y).toBe(1.12)
})

test("SameNetTraceSegmentMergeSolver returns aligned output traces", () => {
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const solver = new SameNetTraceSegmentMergeSolver({
    inputProblem,
    inputTracePaths: [
      makeTrace("a", "SIG", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("b", "SIG", [
        { x: 0.1, y: 0.1 },
        { x: 2.1, y: 0.1 },
      ]),
    ],
    mergeDistance: 0.18,
  })

  solver.solve()

  const { traces } = solver.getOutput()
  expect(traces[0]!.tracePath[0]!.y).toBeCloseTo(0.05, 3)
  expect(traces[1]!.tracePath[0]!.y).toBeCloseTo(0.05, 3)
})
