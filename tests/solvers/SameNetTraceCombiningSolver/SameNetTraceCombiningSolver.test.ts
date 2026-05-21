import { test, expect } from "bun:test"
import { SameNetTraceCombiningSolver } from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const makeTrace = (
  id: string,
  netId: string,
  path: { x: number; y: number }[],
): SolvedTracePath => ({
  mspPairId: id,
  dcConnNetId: netId,
  globalConnNetId: netId,
  pins: [
    { pinId: `${id}_p1`, x: path[0]!.x, y: path[0]!.y, chipId: "U1" },
    {
      pinId: `${id}_p2`,
      x: path[path.length - 1]!.x,
      y: path[path.length - 1]!.y,
      chipId: "U2",
    },
  ],
  tracePath: path,
  mspConnectionPairIds: [id],
  pinIds: [`${id}_p1`, `${id}_p2`],
})

const emptyInput: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
}

test("snaps close horizontal same-net segments to average Y", () => {
  const t1 = makeTrace("t1", "VCC", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ])
  const t2 = makeTrace("t2", "VCC", [
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 1, y: 3.1 },
    { x: 3, y: 3.1 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInput,
    traces: [t1, t2],
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces).toHaveLength(2)

  const t2Path = output.traces[1]!.tracePath
  const seg2Y = t2Path[2]!.y
  const seg3Y = t2Path[3]!.y
  expect(seg2Y).toBeCloseTo(seg3Y, 5)
})

test("does not snap segments from different nets", () => {
  const t1 = makeTrace("t1", "VCC", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1.05 },
  ])
  const t2 = makeTrace("t2", "GND", [
    { x: 0, y: 3 },
    { x: 1, y: 3 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInput,
    traces: [t1, t2],
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces[0]!.tracePath[1]!.y).toBe(0)
  expect(output.traces[1]!.tracePath[2]!.y).toBe(1)
})

test("preserves terminal pin endpoints", () => {
  const t1 = makeTrace("t1", "VCC", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  const t2 = makeTrace("t2", "VCC", [
    { x: 0, y: 0.1 },
    { x: 2, y: 0.1 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInput,
    traces: [t1, t2],
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces[0]!.tracePath[0]!.y).toBe(0)
  expect(output.traces[1]!.tracePath[0]!.y).toBe(0.1)
})

test("handles single trace without errors", () => {
  const t1 = makeTrace("t1", "VCC", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInput,
    traces: [t1],
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces).toHaveLength(1)
  expect(output.traces[0]!.tracePath).toEqual(t1.tracePath)
})

test("snaps close vertical same-net segments to average X", () => {
  const t1 = makeTrace("t1", "NET1", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 3 },
  ])
  const t2 = makeTrace("t2", "NET1", [
    { x: 0, y: 5 },
    { x: 1.1, y: 5 },
    { x: 1.1, y: 2 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInput,
    traces: [t1, t2],
  })
  solver.solve()

  const output = solver.getOutput()
  const t1X = output.traces[0]!.tracePath[1]!.x
  const t2X = output.traces[1]!.tracePath[1]!.x
  expect(t1X).toBeCloseTo(t2X, 5)
  expect(t1X).toBeCloseTo(1.05, 5)
})

test("does not snap segments farther apart than threshold", () => {
  const t1 = makeTrace("t1", "VCC", [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ])
  const t2 = makeTrace("t2", "VCC", [
    { x: 0, y: 5 },
    { x: 2, y: 5 },
    { x: 2, y: 1.5 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: emptyInput,
    traces: [t1, t2],
  })
  solver.solve()

  const output = solver.getOutput()
  expect(output.traces[0]!.tracePath[1]!.y).toBe(0)
  expect(output.traces[1]!.tracePath[1]!.y).toBe(5)
})

test("integrates into full pipeline without breaking existing tests", () => {
  const inputProblem = require("../../assets/example01.json")
  const {
    SchematicTracePipelineSolver,
  } = require("lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver")

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.sameNetTraceCombiningSolver).toBeDefined()
})
