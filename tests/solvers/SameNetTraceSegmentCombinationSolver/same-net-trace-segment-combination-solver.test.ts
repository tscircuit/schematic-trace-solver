import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import { SameNetTraceSegmentCombinationSolver } from "lib/solvers/SameNetTraceSegmentCombinationSolver/SameNetTraceSegmentCombinationSolver"
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
  tracePath: Point[],
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  pins: [
    { pinId: `${mspPairId}.a`, chipId: "chip", ...tracePath[0]! },
    {
      pinId: `${mspPairId}.b`,
      chipId: "chip",
      ...tracePath[tracePath.length - 1]!,
    },
  ],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}.a`, `${mspPairId}.b`],
})

test("combines an internal same-net segment onto a nearby containing segment", () => {
  const solver = new SameNetTraceSegmentCombinationSolver({
    inputProblem,
    inputTraces: [
      makeTrace("a", "net1", [
        { x: 0, y: 1 },
        { x: 0, y: 0.08 },
        { x: 1, y: 0.08 },
        { x: 1, y: 1 },
      ]),
      makeTrace("b", "net1", [
        { x: -0.25, y: 0 },
        { x: 1.25, y: 0 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces[0]!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ])
})

test("does not move segments that are not contained by the nearby segment", () => {
  const solver = new SameNetTraceSegmentCombinationSolver({
    inputProblem,
    inputTraces: [
      makeTrace("a", "net1", [
        { x: 0, y: 1 },
        { x: 0, y: 0.08 },
        { x: 1, y: 0.08 },
        { x: 1, y: 1 },
      ]),
      makeTrace("b", "net1", [
        { x: 0.5, y: 0 },
        { x: 1.5, y: 0 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces[0]!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 0, y: 0.08 },
    { x: 1, y: 0.08 },
    { x: 1, y: 1 },
  ])
})

test("does not introduce intersections with different-net traces", () => {
  const solver = new SameNetTraceSegmentCombinationSolver({
    inputProblem,
    inputTraces: [
      makeTrace("a", "net1", [
        { x: 0, y: 1 },
        { x: 0, y: 0.08 },
        { x: 1, y: 0.08 },
        { x: 1, y: 1 },
      ]),
      makeTrace("b", "net1", [
        { x: -0.25, y: 0 },
        { x: 1.25, y: 0 },
      ]),
      makeTrace("c", "net2", [
        { x: -0.1, y: 0.04 },
        { x: 0.1, y: 0.04 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces[0]!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 0, y: 0.08 },
    { x: 1, y: 0.08 },
    { x: 1, y: 1 },
  ])
})
