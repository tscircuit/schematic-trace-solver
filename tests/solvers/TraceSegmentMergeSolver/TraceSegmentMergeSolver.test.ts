import { expect, test } from "bun:test"
import { TraceSegmentMergeSolver } from "lib/index"
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
  tracePath: Array<{ x: number; y: number }>,
  globalConnNetId = "VCC",
): SolvedTracePath => {
  const pins = [
    {
      pinId: `${mspPairId}.1`,
      chipId: `${mspPairId}.chip1`,
      ...tracePath[0]!,
    },
    {
      pinId: `${mspPairId}.2`,
      chipId: `${mspPairId}.chip2`,
      ...tracePath[tracePath.length - 1]!,
    },
  ] as SolvedTracePath["pins"]

  return {
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    userNetId: globalConnNetId,
    pins,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: pins.map((pin) => pin.pinId),
  }
}

test("TraceSegmentMergeSolver adds a bridge between close same-net endpoints", () => {
  const solver = new TraceSegmentMergeSolver({
    inputProblem,
    traces: [
      makeTrace("a", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", [
        { x: 1.12, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const output = solver.getOutput().traces
  expect(output).toHaveLength(3)
  expect(output[2]!.mspPairId.startsWith("trace-segment-merge-")).toBe(true)
  expect(output[2]!.tracePath).toEqual([
    { x: 1, y: 0 },
    { x: 1.12, y: 0 },
  ])
})

test("TraceSegmentMergeSolver bridges close parallel same-net segments", () => {
  const solver = new TraceSegmentMergeSolver({
    inputProblem,
    traces: [
      makeTrace("a", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ]),
      makeTrace("b", [
        { x: 0.5, y: 0.12 },
        { x: 1.5, y: 0.12 },
      ]),
    ],
  })

  solver.solve()

  const bridge = solver
    .getOutput()
    .traces.find((trace) => trace.mspPairId.startsWith("trace-segment-merge-"))
  expect(bridge?.tracePath).toEqual([
    { x: 1, y: 0 },
    { x: 1, y: 0.12 },
  ])
})

test("TraceSegmentMergeSolver does not bridge different nets", () => {
  const solver = new TraceSegmentMergeSolver({
    inputProblem,
    traces: [
      makeTrace("a", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace(
        "b",
        [
          { x: 1.12, y: 0 },
          { x: 2, y: 0 },
        ],
        "GND",
      ),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces).toHaveLength(2)
})

test("TraceSegmentMergeSolver does not create floating bridges between gapped parallel segments", () => {
  const solver = new TraceSegmentMergeSolver({
    inputProblem,
    traces: [
      makeTrace("a", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", [
        { x: 1.24, y: 0.12 },
        { x: 2.2, y: 0.12 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().traces).toHaveLength(2)
})
