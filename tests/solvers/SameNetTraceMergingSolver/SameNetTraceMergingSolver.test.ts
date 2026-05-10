import { expect, test } from "bun:test"
import { SameNetTraceMergingSolver } from "lib/solvers/SameNetTraceMergingSolver/SameNetTraceMergingSolver"
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
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
  }) as any

test("aligns nearby same-net internal horizontal segments", () => {
  const solver = new SameNetTraceMergingSolver({
    inputProblem,
    inputTraces: [
      makeTrace("a", "net0", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 0 },
      ]),
      makeTrace("b", "net0", [
        { x: 0, y: 0 },
        { x: 0, y: 1.12 },
        { x: 3, y: 1.12 },
        { x: 3, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const [traceA, traceB] = solver.getOutput().traces
  expect(traceA!.tracePath[1]!.y).toBeCloseTo(1.06)
  expect(traceA!.tracePath[2]!.y).toBeCloseTo(1.06)
  expect(traceB!.tracePath[1]!.y).toBeCloseTo(1.06)
  expect(traceB!.tracePath[2]!.y).toBeCloseTo(1.06)
})

test("moves an internal same-net segment onto a fixed endpoint segment", () => {
  const solver = new SameNetTraceMergingSolver({
    inputProblem,
    inputTraces: [
      makeTrace("fixed", "net0", [
        { x: 0, y: 1 },
        { x: 3, y: 1 },
      ]),
      makeTrace("movable", "net0", [
        { x: 0, y: 0 },
        { x: 0, y: 1.12 },
        { x: 3, y: 1.12 },
        { x: 3, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const movable = solver.getOutput().traces[1]!
  expect(movable.tracePath[1]!.y).toBeCloseTo(1)
  expect(movable.tracePath[2]!.y).toBeCloseTo(1)
})

test("does not create a colinear overlap with a different net", () => {
  const solver = new SameNetTraceMergingSolver({
    inputProblem,
    inputTraces: [
      makeTrace("a", "net0", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 0 },
      ]),
      makeTrace("b", "net0", [
        { x: 0, y: 0 },
        { x: 0, y: 1.12 },
        { x: 3, y: 1.12 },
        { x: 3, y: 0 },
      ]),
      makeTrace("other-net", "net1", [
        { x: 0, y: 1.06 },
        { x: 3, y: 1.06 },
      ]),
    ],
  })

  solver.solve()

  const [traceA, traceB] = solver.getOutput().traces
  expect(traceA!.tracePath[1]!.y).toBeCloseTo(1)
  expect(traceB!.tracePath[1]!.y).toBeCloseTo(1.12)
})
