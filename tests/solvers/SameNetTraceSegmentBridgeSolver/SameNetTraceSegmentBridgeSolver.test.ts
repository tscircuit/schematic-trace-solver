import { expect, test } from "bun:test"
import { SameNetTraceSegmentBridgeSolver } from "lib/solvers/SameNetTraceSegmentBridgeSolver/SameNetTraceSegmentBridgeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const trace = (
  id: string,
  net: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: net,
    globalConnNetId: net,
    userNetId: net,
    pins: [] as any,
    pinIds: [],
    mspConnectionPairIds: [id],
    tracePath,
  }) as SolvedTracePath

test("aligns close overlapping horizontal same-net internal segments", () => {
  const solver = new SameNetTraceSegmentBridgeSolver({
    inputProblem,
    traces: [
      trace("a", "N1", [
        { x: -1, y: -1 },
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 7, y: 1 },
      ]),
      trace("b", "N1", [
        { x: -1, y: 2 },
        { x: 1, y: 0.08 },
        { x: 4, y: 0.08 },
        { x: 6, y: 2 },
      ]),
    ],
  })

  solver.solve()
  const result = solver.getOutput()

  expect(result.bridgeCount).toBe(1)
  expect(result.traces[1]!.tracePath[1]!.y).toBe(0)
  expect(result.traces[1]!.tracePath[2]!.y).toBe(0)
})

test("aligns close overlapping vertical same-net internal segments", () => {
  const solver = new SameNetTraceSegmentBridgeSolver({
    inputProblem,
    traces: [
      trace("a", "N1", [
        { x: -1, y: -1 },
        { x: 0, y: 0 },
        { x: 0, y: 6 },
        { x: 1, y: 7 },
      ]),
      trace("b", "N1", [
        { x: 2, y: -1 },
        { x: 0.07, y: 1 },
        { x: 0.07, y: 4 },
        { x: 2, y: 6 },
      ]),
    ],
  })

  solver.solve()
  const result = solver.getOutput()

  expect(result.bridgeCount).toBe(1)
  expect(result.traces[1]!.tracePath[1]!.x).toBe(0)
  expect(result.traces[1]!.tracePath[2]!.x).toBe(0)
})

test("does not bridge different nets", () => {
  const solver = new SameNetTraceSegmentBridgeSolver({
    inputProblem,
    traces: [
      trace("a", "N1", [
        { x: -1, y: -1 },
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 7, y: 1 },
      ]),
      trace("b", "N2", [
        { x: -1, y: 2 },
        { x: 1, y: 0.08 },
        { x: 4, y: 0.08 },
        { x: 6, y: 2 },
      ]),
    ],
  })

  solver.solve()
  const result = solver.getOutput()

  expect(result.bridgeCount).toBe(0)
  expect(result.traces[1]!.tracePath[1]!.y).toBe(0.08)
})

test("keeps endpoint-only segments fixed", () => {
  const solver = new SameNetTraceSegmentBridgeSolver({
    inputProblem,
    traces: [
      trace("a", "N1", [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
      ]),
      trace("b", "N1", [
        { x: 1, y: 0.08 },
        { x: 4, y: 0.08 },
      ]),
    ],
  })

  solver.solve()
  const result = solver.getOutput()

  expect(result.bridgeCount).toBe(0)
  expect(result.traces[1]!.tracePath[0]!.y).toBe(0.08)
  expect(result.traces[1]!.tracePath[1]!.y).toBe(0.08)
})

test("does not bridge segments outside the merge distance", () => {
  const solver = new SameNetTraceSegmentBridgeSolver({
    inputProblem,
    mergeDistance: 0.05,
    traces: [
      trace("a", "N1", [
        { x: -1, y: -1 },
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 7, y: 1 },
      ]),
      trace("b", "N1", [
        { x: -1, y: 2 },
        { x: 1, y: 0.08 },
        { x: 4, y: 0.08 },
        { x: 6, y: 2 },
      ]),
    ],
  })

  solver.solve()
  const result = solver.getOutput()

  expect(result.bridgeCount).toBe(0)
  expect(result.traces[1]!.tracePath[1]!.y).toBe(0.08)
})
