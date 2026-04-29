import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeSameNetTraceLines } from "lib/solvers/SchematicTracePipelineSolver/merge-same-net-trace-lines"

const makeTrace = (
  {
    mspPairId,
    dcConnNetId,
    globalConnNetId,
    userNetId,
    points,
  }: {
    mspPairId: string
    dcConnNetId: string
    globalConnNetId: string
    userNetId?: string
    points: Array<{ x: number; y: number }>
  },
  pinAId: string,
  pinBId: string,
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId,
  globalConnNetId,
  userNetId,
  pins: [
    { pinId: pinAId, chipId: "U1", x: points[0]!.x, y: points[0]!.y },
    {
      pinId: pinBId,
      chipId: "U1",
      x: points[points.length - 1]!.x,
      y: points[points.length - 1]!.y,
    },
  ],
  tracePath: points,
  mspConnectionPairIds: [mspPairId],
  pinIds: [pinAId, pinBId],
})

test("mergeSameNetTraceLines merges touching and overlapping same-net collinear lines", () => {
  const traces: SolvedTracePath[] = [
    makeTrace(
      {
        mspPairId: "A-B",
        dcConnNetId: "N1",
        globalConnNetId: "G1",
        userNetId: "VCC",
        points: [
          { x: 2, y: 0 },
          { x: 2, y: 3 },
        ],
      },
      "A",
      "B",
    ),
    makeTrace(
      {
        mspPairId: "B-C",
        dcConnNetId: "N1",
        globalConnNetId: "G1",
        userNetId: "VCC",
        points: [
          { x: 2, y: 3 },
          { x: 2, y: 6 },
        ],
      },
      "B",
      "C",
    ),
    makeTrace(
      {
        mspPairId: "D-E",
        dcConnNetId: "N1",
        globalConnNetId: "G1",
        userNetId: "VCC",
        points: [
          { x: 1, y: 5 },
          { x: 4, y: 5 },
        ],
      },
      "D",
      "E",
    ),
    makeTrace(
      {
        mspPairId: "E-F",
        dcConnNetId: "N1",
        globalConnNetId: "G1",
        userNetId: "VCC",
        points: [
          { x: 3, y: 5 },
          { x: 8, y: 5 },
        ],
      },
      "E",
      "F",
    ),
    makeTrace(
      {
        mspPairId: "X-Y",
        dcConnNetId: "N2",
        globalConnNetId: "G2",
        userNetId: "GND",
        points: [
          { x: 2, y: 0 },
          { x: 2, y: 6 },
        ],
      },
      "X",
      "Y",
    ),
  ]

  const merged = mergeSameNetTraceLines(traces)

  expect(merged).toHaveLength(3)

  const vccVertical = merged.find(
    (trace) =>
      trace.userNetId === "VCC" &&
      trace.tracePath[0]!.x === 2 &&
      trace.tracePath[1]!.x === 2,
  )
  expect(vccVertical).toBeDefined()
  expect(vccVertical!.tracePath).toEqual([
    { x: 2, y: 0 },
    { x: 2, y: 6 },
  ])

  const vccHorizontal = merged.find(
    (trace) =>
      trace.userNetId === "VCC" &&
      trace.tracePath[0]!.y === 5 &&
      trace.tracePath[1]!.y === 5,
  )
  expect(vccHorizontal).toBeDefined()
  expect(vccHorizontal!.tracePath).toEqual([
    { x: 1, y: 5 },
    { x: 8, y: 5 },
  ])

  const gndVertical = merged.find((trace) => trace.userNetId === "GND")
  expect(gndVertical).toBeDefined()
  expect(gndVertical!.tracePath).toEqual([
    { x: 2, y: 0 },
    { x: 2, y: 6 },
  ])
})
