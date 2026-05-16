import { expect, test } from "bun:test"
import { SameNetTraceCombiningSolver } from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const makePin = (pinId: string, x: number, y: number) => ({
  pinId,
  chipId: "chip",
  x,
  y,
})

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  userNetId: globalConnNetId,
  pins: [
    makePin(`${mspPairId}.1`, tracePath[0]!.x, tracePath[0]!.y),
    makePin(
      `${mspPairId}.2`,
      tracePath[tracePath.length - 1]!.x,
      tracePath[tracePath.length - 1]!.y,
    ),
  ],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
})

test("SameNetTraceCombiningSolver combines adjacent same-net horizontal segments", () => {
  const traceA = makeTrace("trace-a", "net-1", [
    { x: -1, y: 0 },
    { x: -1, y: 1.5 },
    { x: 0, y: 1.5 },
  ])
  const traceB = makeTrace("trace-b", "net-1", [
    { x: 0, y: 1.5 },
    { x: 1, y: 1.5 },
    { x: 1, y: 0 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem,
    inputTraces: [traceA, traceB],
  })
  solver.solve()

  const horizontalTraces = solver
    .getOutput()
    .traces.filter((trace) => trace.tracePath[0]!.y === trace.tracePath[1]!.y)

  expect(horizontalTraces).toHaveLength(1)
  expect(horizontalTraces[0]!.tracePath).toEqual([
    { x: -1, y: 1.5 },
    { x: 1, y: 1.5 },
  ])
  expect(horizontalTraces[0]!.mspConnectionPairIds).toEqual([
    "trace-a",
    "trace-b",
  ])
})

test("SameNetTraceCombiningSolver combines close vertical segments but not different nets", () => {
  const traceA = makeTrace("trace-a", "net-1", [
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ])
  const traceB = makeTrace("trace-b", "net-1", [
    { x: 2.005, y: 1.1 },
    { x: 2.005, y: 2 },
  ])
  const traceC = makeTrace("trace-c", "net-2", [
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ])

  const solver = new SameNetTraceCombiningSolver({
    inputProblem,
    inputTraces: [traceA, traceB, traceC],
  })
  solver.solve()

  const traces = solver.getOutput().traces
  const net1Vertical = traces.find(
    (trace) =>
      trace.globalConnNetId === "net-1" &&
      trace.mspConnectionPairIds.length === 2,
  )
  const net2Vertical = traces.find((trace) => trace.globalConnNetId === "net-2")

  expect(net1Vertical?.tracePath).toEqual([
    { x: 2.0025, y: 0 },
    { x: 2.0025, y: 2 },
  ])
  expect(net2Vertical?.tracePath).toEqual([
    { x: 2, y: 0 },
    { x: 2, y: 1 },
  ])
})
