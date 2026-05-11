import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import { SameNetTraceSegmentMergeSolver } from "lib/solvers/SameNetTraceSegmentMergeSolver/SameNetTraceSegmentMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const emptyInputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

function makeTrace(
  id: string,
  netId: string,
  tracePath: Point[],
): SolvedTracePath {
  return {
    mspPairId: id,
    dcConnNetId: netId,
    globalConnNetId: netId,
    userNetId: netId,
    pins: [
      {
        pinId: `${id}.1`,
        chipId: "U1",
        x: tracePath[0]!.x,
        y: tracePath[0]!.y,
      },
      {
        pinId: `${id}.2`,
        chipId: "U2",
        x: tracePath[tracePath.length - 1]!.x,
        y: tracePath[tracePath.length - 1]!.y,
      },
    ],
    tracePath,
    mspConnectionPairIds: [id],
    pinIds: [`${id}.1`, `${id}.2`],
  }
}

test("aligns close overlapping same-net internal trace segments", () => {
  const fixedTrace = makeTrace("fixed", "NET1", [
    { x: 0, y: -1 },
    { x: 0, y: 0.1 },
    { x: 4, y: 0.1 },
    { x: 4, y: -1 },
  ])
  const movingTrace = makeTrace("moving", "NET1", [
    { x: 1, y: 1 },
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 1 },
  ])

  const solver = new SameNetTraceSegmentMergeSolver({
    inputProblem: emptyInputProblem,
    traces: [fixedTrace, movingTrace],
    mergeDistance: 0.15,
  })
  solver.solve()

  expect(solver.getOutput().mergedSegmentCount).toBe(1)
  expect(solver.getOutput().traces[1]!.tracePath[1]!.y).toBeCloseTo(0.1)
  expect(solver.getOutput().traces[1]!.tracePath[2]!.y).toBeCloseTo(0.1)
})

test("does not align close segments from different nets", () => {
  const solver = new SameNetTraceSegmentMergeSolver({
    inputProblem: emptyInputProblem,
    traces: [
      makeTrace("a", "NET1", [
        { x: 0, y: -1 },
        { x: 0, y: 0.1 },
        { x: 4, y: 0.1 },
        { x: 4, y: -1 },
      ]),
      makeTrace("b", "NET2", [
        { x: 1, y: 1 },
        { x: 1, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
      ]),
    ],
    mergeDistance: 0.15,
  })
  solver.solve()

  expect(solver.getOutput().mergedSegmentCount).toBe(0)
  expect(solver.getOutput().traces[1]!.tracePath[1]!.y).toBe(0)
  expect(solver.getOutput().traces[1]!.tracePath[2]!.y).toBe(0)
})

test("rejects same-net alignment when the moved segment would hit a chip obstacle", () => {
  const inputProblem: InputProblem = {
    ...emptyInputProblem,
    chips: [
      {
        chipId: "U_OBS",
        center: { x: 2, y: 0.1 },
        width: 0.5,
        height: 0.5,
        pins: [],
      },
    ],
  }

  const solver = new SameNetTraceSegmentMergeSolver({
    inputProblem,
    traces: [
      makeTrace("a", "NET1", [
        { x: 0, y: -1 },
        { x: 0, y: 0.1 },
        { x: 4, y: 0.1 },
        { x: 4, y: -1 },
      ]),
      makeTrace("b", "NET1", [
        { x: 1, y: 1 },
        { x: 1, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
      ]),
    ],
    mergeDistance: 0.15,
  })
  solver.solve()

  expect(solver.getOutput().mergedSegmentCount).toBe(0)
  expect(solver.getOutput().traces[1]!.tracePath[1]!.y).toBe(0)
  expect(solver.getOutput().traces[1]!.tracePath[2]!.y).toBe(0)
})

test("rejects same-net alignment when it would cross a different net", () => {
  const solver = new SameNetTraceSegmentMergeSolver({
    inputProblem: emptyInputProblem,
    traces: [
      makeTrace("a", "NET1", [
        { x: 0, y: -1 },
        { x: 0, y: 0.1 },
        { x: 4, y: 0.1 },
        { x: 4, y: -1 },
      ]),
      makeTrace("b", "NET1", [
        { x: 1, y: 1 },
        { x: 1, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 1 },
      ]),
      makeTrace("c", "NET2", [
        { x: 2, y: 0.05 },
        { x: 2, y: 0.2 },
      ]),
    ],
    mergeDistance: 0.15,
  })
  solver.solve()

  expect(solver.getOutput().mergedSegmentCount).toBe(0)
  expect(solver.getOutput().traces[1]!.tracePath[1]!.y).toBe(0)
  expect(solver.getOutput().traces[1]!.tracePath[2]!.y).toBe(0)
})
