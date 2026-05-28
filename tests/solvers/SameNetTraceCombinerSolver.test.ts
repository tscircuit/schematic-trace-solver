import { expect, test } from "bun:test"
import { SameNetTraceCombinerSolver } from "lib/solvers/SameNetTraceCombinerSolver/SameNetTraceCombinerSolver"
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
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  pins: [
    {
      pinId: `${mspPairId}.1`,
      chipId: "chip1",
      x: tracePath[0]!.x,
      y: tracePath[0]!.y,
    },
    {
      pinId: `${mspPairId}.2`,
      chipId: "chip2",
      x: tracePath.at(-1)!.x,
      y: tracePath.at(-1)!.y,
    },
  ],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
})

test("snaps close internal same-net segments onto one shared route", () => {
  const solver = new SameNetTraceCombinerSolver({
    inputProblem,
    proximityThreshold: 0.12,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 1, y: 2 },
        { x: 1, y: 1.08 },
        { x: 4, y: 1.08 },
        { x: 4, y: 2 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 1, y: 2 },
    { x: 1, y: 1 },
    { x: 4, y: 1 },
    { x: 4, y: 2 },
  ])
})

test("does not combine nearby segments from different nets", () => {
  const solver = new SameNetTraceCombinerSolver({
    inputProblem,
    proximityThreshold: 0.12,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 0 },
      ]),
      makeTrace("b", "net2", [
        { x: 1, y: 2 },
        { x: 1, y: 1.08 },
        { x: 4, y: 1.08 },
        { x: 4, y: 2 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces[1]!.tracePath[1]!.y).toBe(1.08)
  expect(solver.getOutput().traces[1]!.tracePath[2]!.y).toBe(1.08)
})

test("does not snap through other-net traces", () => {
  const solver = new SameNetTraceCombinerSolver({
    inputProblem,
    proximityThreshold: 0.12,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 1, y: 2 },
        { x: 1, y: 1.08 },
        { x: 4, y: 1.08 },
        { x: 4, y: 2 },
      ]),
      makeTrace("c", "net2", [
        { x: 2, y: 0.5 },
        { x: 2, y: 1.05 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces[1]!.tracePath[1]!.y).toBe(1.08)
  expect(solver.getOutput().traces[1]!.tracePath[2]!.y).toBe(1.08)
})

test("keeps boundary segments anchored to their pins", () => {
  const solver = new SameNetTraceCombinerSolver({
    inputProblem,
    proximityThreshold: 0.12,
    traces: [
      makeTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 0, y: 0.08 },
        { x: 3, y: 0.08 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces[1]!.tracePath).toEqual([
    { x: 0, y: 0.08 },
    { x: 3, y: 0.08 },
  ])
})
