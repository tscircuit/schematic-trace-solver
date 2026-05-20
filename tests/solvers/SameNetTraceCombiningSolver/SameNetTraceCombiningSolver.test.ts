import { expect, test } from "bun:test"
import { SameNetTraceCombiningSolver } from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath => {
  const start = tracePath[0]!
  const end = tracePath[tracePath.length - 1]!

  return {
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    userNetId: globalConnNetId,
    pins: [
      {
        pinId: `${mspPairId}.1`,
        chipId: `${mspPairId}-chip-a`,
        x: start.x,
        y: start.y,
      },
      {
        pinId: `${mspPairId}.2`,
        chipId: `${mspPairId}-chip-b`,
        x: end.x,
        y: end.y,
      },
    ],
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
  }
}

const makeInputProblem = (chips: InputProblem["chips"]): InputProblem => ({
  chips,
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
})

test("snaps close overlapping same-net horizontal internal segments onto a shared axis", () => {
  const solver = new SameNetTraceCombiningSolver({
    traces: [
      makeTrace("trace-a", "NET1", [
        { x: -2, y: -1 },
        { x: -2, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: -1 },
      ]),
      makeTrace("trace-b", "NET1", [
        { x: -2, y: 1 },
        { x: -2, y: 0.08 },
        { x: 2, y: 0.08 },
        { x: 2, y: 1 },
      ]),
    ],
  })

  solver.solve()

  const traceB = solver
    .getOutput()
    .traces.find((t) => t.mspPairId === "trace-b")!
  expect(traceB.tracePath[1]!.y).toBe(0)
  expect(traceB.tracePath[2]!.y).toBe(0)
  expect(solver.mergeCount).toBe(1)
})

test("snaps close overlapping same-net vertical internal segments onto a shared axis", () => {
  const solver = new SameNetTraceCombiningSolver({
    traces: [
      makeTrace("trace-a", "NET1", [
        { x: -1, y: -2 },
        { x: 0, y: -2 },
        { x: 0, y: 2 },
        { x: -1, y: 2 },
      ]),
      makeTrace("trace-b", "NET1", [
        { x: 1, y: -2 },
        { x: 0.07, y: -2 },
        { x: 0.07, y: 2 },
        { x: 1, y: 2 },
      ]),
    ],
  })

  solver.solve()

  const traceB = solver
    .getOutput()
    .traces.find((t) => t.mspPairId === "trace-b")!
  expect(traceB.tracePath[1]!.x).toBe(0)
  expect(traceB.tracePath[2]!.x).toBe(0)
  expect(solver.mergeCount).toBe(1)
})

test("does not combine close segments from different nets", () => {
  const solver = new SameNetTraceCombiningSolver({
    traces: [
      makeTrace("trace-a", "NET1", [
        { x: -2, y: -1 },
        { x: -2, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: -1 },
      ]),
      makeTrace("trace-b", "NET2", [
        { x: -2, y: 1 },
        { x: -2, y: 0.08 },
        { x: 2, y: 0.08 },
        { x: 2, y: 1 },
      ]),
    ],
  })

  solver.solve()

  const traceB = solver
    .getOutput()
    .traces.find((t) => t.mspPairId === "trace-b")!
  expect(traceB.tracePath[1]!.y).toBe(0.08)
  expect(traceB.tracePath[2]!.y).toBe(0.08)
  expect(solver.mergeCount).toBe(0)
})

test("preserves terminal segments so pin endpoints do not drift", () => {
  const solver = new SameNetTraceCombiningSolver({
    traces: [
      makeTrace("trace-a", "NET1", [
        { x: -2, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 1 },
      ]),
      makeTrace("trace-b", "NET1", [
        { x: -2, y: 0.08 },
        { x: 2, y: 0.08 },
        { x: 2, y: -1 },
      ]),
    ],
  })

  solver.solve()

  const traceB = solver
    .getOutput()
    .traces.find((t) => t.mspPairId === "trace-b")!
  expect(traceB.tracePath[0]!.y).toBe(0.08)
  expect(traceB.tracePath[1]!.y).toBe(0.08)
  expect(solver.mergeCount).toBe(0)
})

test("rejects same-net snap candidates that create a different-net crossing", () => {
  const solver = new SameNetTraceCombiningSolver({
    traces: [
      makeTrace("trace-a", "NET1", [
        { x: -2, y: -1 },
        { x: -2, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: -1 },
      ]),
      makeTrace("trace-b", "NET1", [
        { x: -2, y: 1 },
        { x: -2, y: 0.12 },
        { x: 2, y: 0.12 },
        { x: 2, y: 1 },
      ]),
      makeTrace("trace-c", "NET2", [
        { x: -1, y: -0.05 },
        { x: 0, y: -0.05 },
        { x: 0, y: 0.05 },
        { x: -1, y: 0.05 },
      ]),
    ],
  })

  solver.solve()

  const traceB = solver
    .getOutput()
    .traces.find((t) => t.mspPairId === "trace-b")!
  expect(traceB.tracePath[1]!.y).toBe(0.12)
  expect(traceB.tracePath[2]!.y).toBe(0.12)
  expect(solver.mergeCount).toBe(0)
})

test("rejects same-net snap candidates that create a different-net endpoint touch", () => {
  const solver = new SameNetTraceCombiningSolver({
    traces: [
      makeTrace("trace-a", "NET1", [
        { x: -2, y: -1 },
        { x: -2, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: -1 },
      ]),
      makeTrace("trace-b", "NET1", [
        { x: -2, y: 1 },
        { x: -2, y: 0.12 },
        { x: 2, y: 0.12 },
        { x: 2, y: 1 },
      ]),
      makeTrace("trace-c", "NET2", [
        { x: -3, y: 0 },
        { x: -2, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const traceB = solver
    .getOutput()
    .traces.find((t) => t.mspPairId === "trace-b")!
  expect(traceB.tracePath[1]!.y).toBe(0.12)
  expect(traceB.tracePath[2]!.y).toBe(0.12)
  expect(solver.mergeCount).toBe(0)
})

test("rejects same-net snap candidates that move a connector into a chip obstacle", () => {
  const solver = new SameNetTraceCombiningSolver({
    inputProblem: makeInputProblem([
      {
        chipId: "obstacle-chip",
        center: { x: -2, y: 0.05 },
        width: 0.05,
        height: 0.05,
        pins: [],
      },
    ]),
    traces: [
      makeTrace("trace-a", "NET1", [
        { x: -2.5, y: -1 },
        { x: -2.5, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: -1 },
      ]),
      makeTrace("trace-b", "NET1", [
        { x: -2, y: 1 },
        { x: -2, y: 0.12 },
        { x: 1.5, y: 0.12 },
        { x: 1.5, y: 1 },
      ]),
    ],
  })

  solver.solve()

  const traceB = solver
    .getOutput()
    .traces.find((t) => t.mspPairId === "trace-b")!
  expect(traceB.tracePath[1]!.y).toBe(0.12)
  expect(traceB.tracePath[2]!.y).toBe(0.12)
  expect(solver.mergeCount).toBe(0)
})
